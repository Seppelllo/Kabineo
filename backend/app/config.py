import logging

from pydantic_settings import BaseSettings

_config_logger = logging.getLogger(__name__)


class Settings(BaseSettings):
    # Database
    database_url: str = "postgresql+asyncpg://dms:dms_secret@localhost:5432/dms"

    # Redis
    redis_url: str = "redis://localhost:6379/0"

    # Auth
    secret_key: str = "change-me-to-a-random-secret-key"
    access_token_expire_minutes: int = 30
    refresh_token_expire_days: int = 7
    algorithm: str = "HS256"

    # Storage
    storage_backend: str = "local"  # "local" or "s3"
    local_storage_path: str = "/data/documents"

    # S3 / MinIO
    s3_endpoint_url: str = "http://minio:9000"
    s3_access_key: str = "minioadmin"
    s3_secret_key: str = "minioadmin"
    s3_bucket: str = "dms-documents"

    # Consume folder (watch for new files)
    consume_folder_path: str = ""

    # IMAP email import
    imap_server: str = ""
    imap_user: str = ""
    imap_password: str = ""
    imap_folder: str = "INBOX"
    imap_enabled: bool = False

    # Admin user (auto-created on startup)
    admin_email: str = ""
    admin_username: str = ""
    admin_password: str = ""

    # Registration
    registration_enabled: bool = True

    # SMTP
    smtp_host: str = ""
    smtp_port: int = 587
    smtp_user: str = ""
    smtp_password: str = ""
    smtp_from: str = ""
    smtp_tls: bool = True
    smtp_enabled: bool = False

    # Telegram
    telegram_bot_token: str = ""

    # SSO / OIDC
    sso_enabled: bool = False
    sso_provider_name: str = "SSO"  # Display name on login button
    sso_client_id: str = ""
    sso_client_secret: str = ""
    sso_authorization_url: str = ""  # e.g. https://keycloak.example.com/realms/dms/protocol/openid-connect/auth
    sso_token_url: str = ""  # e.g. https://keycloak.example.com/realms/dms/protocol/openid-connect/token
    sso_userinfo_url: str = ""  # e.g. https://keycloak.example.com/realms/dms/protocol/openid-connect/userinfo
    sso_redirect_uri: str = "http://localhost:3000/auth/callback"
    sso_scopes: str = "openid email profile"
    sso_auto_create_users: bool = True  # Create user on first SSO login
    sso_default_role: str = "user"  # Default role for SSO-created users

    # SAML (optional, if different from OIDC)
    saml_enabled: bool = False
    saml_entity_id: str = ""
    saml_sso_url: str = ""  # IdP SSO URL
    saml_certificate: str = ""  # IdP certificate (base64)
    saml_attribute_email: str = "email"
    saml_attribute_username: str = "preferred_username"
    saml_attribute_name: str = "name"

    model_config = {"env_file": ".env", "extra": "ignore"}


settings = Settings()

if settings.secret_key == "change-me-to-a-random-secret-key":
    _config_logger.warning(
        "SECURITY WARNING: Using default secret_key. Set a strong random SECRET_KEY in production!"
    )
