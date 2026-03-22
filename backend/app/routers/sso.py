"""SSO/OIDC and SAML authentication endpoints.

Supports:
- OIDC (OpenID Connect) — works with Keycloak, Azure AD, Okta, Google, Auth0
- SAML 2.0 (simplified) — for enterprise SSO

NOTE: The SAML implementation is simplified and does NOT perform signature
verification on the SAML response. For production SAML deployments, use a
proper SAML library (e.g. python3-saml) or route SAML through Keycloak as
an OIDC-to-SAML bridge.
"""

import base64
import datetime
import secrets
import uuid
import xml.etree.ElementTree as ET
from urllib.parse import urlencode

import httpx
from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import RedirectResponse
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.database import get_db
from app.models.user import User, UserRole
from app.services.auth_service import create_access_token, create_refresh_token, hash_password

router = APIRouter(prefix="/api/auth/sso", tags=["sso"])

# In-memory state store for CSRF protection.
# In production, replace with Redis-backed store with TTL.
_states: dict[str, dict] = {}


@router.get("/config")
async def sso_config():
    """Public endpoint — returns SSO configuration for the frontend."""
    return {
        "sso_enabled": settings.sso_enabled,
        "sso_provider_name": settings.sso_provider_name,
        "saml_enabled": settings.saml_enabled,
    }


@router.get("/login")
async def sso_login():
    """Initiate OIDC login — redirects to the identity provider."""
    if not settings.sso_enabled:
        raise HTTPException(status_code=404, detail="SSO not configured")

    state = secrets.token_urlsafe(32)
    _states[state] = {"type": "oidc"}

    params = {
        "client_id": settings.sso_client_id,
        "redirect_uri": settings.sso_redirect_uri,
        "response_type": "code",
        "scope": settings.sso_scopes,
        "state": state,
    }
    auth_url = f"{settings.sso_authorization_url}?{urlencode(params)}"
    return RedirectResponse(url=auth_url)


@router.get("/callback")
async def sso_callback(code: str, state: str, db: AsyncSession = Depends(get_db)):
    """OIDC callback — exchange authorization code for tokens, find or create user."""
    if state not in _states:
        raise HTTPException(status_code=400, detail="Invalid state")
    del _states[state]

    # Exchange authorization code for tokens
    async with httpx.AsyncClient() as client:
        token_response = await client.post(
            settings.sso_token_url,
            data={
                "grant_type": "authorization_code",
                "client_id": settings.sso_client_id,
                "client_secret": settings.sso_client_secret,
                "code": code,
                "redirect_uri": settings.sso_redirect_uri,
            },
        )
        if token_response.status_code != 200:
            raise HTTPException(status_code=400, detail="Token exchange failed")
        tokens = token_response.json()

        # Fetch user info from the identity provider
        userinfo_response = await client.get(
            settings.sso_userinfo_url,
            headers={"Authorization": f"Bearer {tokens['access_token']}"},
        )
        if userinfo_response.status_code != 200:
            raise HTTPException(status_code=400, detail="Failed to get user info")
        userinfo = userinfo_response.json()

    email = userinfo.get("email", "")
    username = userinfo.get("preferred_username", email.split("@")[0] if email else "")
    full_name = userinfo.get("name", "")

    if not email:
        raise HTTPException(status_code=400, detail="No email in SSO response")

    # Find or create the user
    result = await db.execute(select(User).where(User.email == email))
    user = result.scalar_one_or_none()

    if not user:
        if not settings.sso_auto_create_users:
            raise HTTPException(status_code=403, detail="User not found and auto-creation disabled")
        user = User(
            email=email,
            username=username,
            hashed_password=hash_password(secrets.token_urlsafe(32)),  # Random password — SSO users don't need it
            full_name=full_name,
            role=UserRole(settings.sso_default_role),
        )
        db.add(user)
        await db.commit()
        await db.refresh(user)

    # Generate JWT tokens for the DMS session
    access_token = create_access_token(str(user.id))
    refresh_token = create_refresh_token(str(user.id))

    # Redirect to frontend callback page with tokens
    redirect_url = f"{settings.sso_redirect_uri}?access_token={access_token}&refresh_token={refresh_token}"
    return RedirectResponse(url=redirect_url)


@router.get("/saml/login")
async def saml_login():
    """Initiate SAML login — builds AuthnRequest and redirects to IdP.

    NOTE: This is a simplified SAML implementation. The AuthnRequest is not
    signed. For production use, consider using python3-saml or routing SAML
    through Keycloak as an OIDC bridge.
    """
    if not settings.saml_enabled:
        raise HTTPException(status_code=404, detail="SAML not configured")

    request_id = f"_{uuid.uuid4().hex}"
    issue_instant = datetime.datetime.utcnow().strftime("%Y-%m-%dT%H:%M:%SZ")

    acs_url = settings.sso_redirect_uri.replace("/callback", "/saml/callback")

    saml_request = f"""<samlp:AuthnRequest xmlns:samlp="urn:oasis:names:tc:SAML:2.0:protocol"
        xmlns:saml="urn:oasis:names:tc:SAML:2.0:assertion"
        ID="{request_id}"
        Version="2.0"
        IssueInstant="{issue_instant}"
        AssertionConsumerServiceURL="{acs_url}"
        Destination="{settings.saml_sso_url}">
        <saml:Issuer>{settings.saml_entity_id}</saml:Issuer>
    </samlp:AuthnRequest>"""

    encoded = base64.b64encode(saml_request.encode()).decode()
    state = secrets.token_urlsafe(32)
    _states[state] = {"type": "saml", "request_id": request_id}

    redirect_url = f"{settings.saml_sso_url}?SAMLRequest={encoded}&RelayState={state}"
    return RedirectResponse(url=redirect_url)


@router.post("/saml/callback")
async def saml_callback(request: Request, db: AsyncSession = Depends(get_db)):
    """SAML Assertion Consumer Service — processes the SAML response.

    NOTE: This implementation does NOT verify the SAML response signature.
    For production, use a proper SAML library or route through Keycloak.
    """
    form = await request.form()
    saml_response = form.get("SAMLResponse", "")
    # relay_state = form.get("RelayState", "")  # noqa: ERA001

    if not saml_response:
        raise HTTPException(status_code=400, detail="No SAML response")

    # Decode and parse the SAML response XML
    try:
        xml_data = base64.b64decode(saml_response)
        root = ET.fromstring(xml_data)

        # Extract attributes (namespace-aware)
        ns = {
            "saml": "urn:oasis:names:tc:SAML:2.0:assertion",
            "samlp": "urn:oasis:names:tc:SAML:2.0:protocol",
        }

        attributes: dict[str, str] = {}
        for attr in root.findall(".//saml:Attribute", ns):
            name = attr.get("Name", "")
            value_elem = attr.find("saml:AttributeValue", ns)
            if value_elem is not None and value_elem.text:
                attributes[name] = value_elem.text

        email = attributes.get(settings.saml_attribute_email, "")
        username = attributes.get(settings.saml_attribute_username, email.split("@")[0] if email else "")
        full_name = attributes.get(settings.saml_attribute_name, "")
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Invalid SAML response: {e}")

    if not email:
        raise HTTPException(status_code=400, detail="No email in SAML response")

    # Find or create user (same logic as OIDC)
    result = await db.execute(select(User).where(User.email == email))
    user = result.scalar_one_or_none()

    if not user:
        if not settings.sso_auto_create_users:
            raise HTTPException(status_code=403, detail="User not found and auto-creation disabled")
        user = User(
            email=email,
            username=username,
            hashed_password=hash_password(secrets.token_urlsafe(32)),
            full_name=full_name,
            role=UserRole(settings.sso_default_role),
        )
        db.add(user)
        await db.commit()
        await db.refresh(user)

    access_token = create_access_token(str(user.id))
    refresh_token = create_refresh_token(str(user.id))

    redirect_url = f"{settings.sso_redirect_uri}?access_token={access_token}&refresh_token={refresh_token}"
    return RedirectResponse(url=redirect_url, status_code=303)
