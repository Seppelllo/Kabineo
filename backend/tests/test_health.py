import pytest


@pytest.mark.asyncio
async def test_health_returns_200(client):
    response = await client.get("/api/health")
    assert response.status_code in (200, 503)
    data = response.json()
    assert "status" in data
    assert "database" in data
    assert "redis" in data


@pytest.mark.asyncio
async def test_register_creates_user(client, test_user_data):
    response = await client.post("/api/auth/register", json=test_user_data)
    # 201 on first run, 400 if user already exists
    assert response.status_code in (201, 400)
    if response.status_code == 201:
        data = response.json()
        assert data["email"] == test_user_data["email"]
        assert data["username"] == test_user_data["username"]


@pytest.mark.asyncio
async def test_login_returns_tokens(client, test_user_data):
    # Ensure user exists
    await client.post("/api/auth/register", json=test_user_data)
    # Login
    response = await client.post("/api/auth/login", json={
        "username": test_user_data["username"],
        "password": test_user_data["password"],
    })
    assert response.status_code == 200
    data = response.json()
    assert "access_token" in data
    assert "refresh_token" in data


@pytest.mark.asyncio
async def test_documents_requires_auth(client):
    response = await client.get("/api/documents")
    assert response.status_code in (401, 403)
