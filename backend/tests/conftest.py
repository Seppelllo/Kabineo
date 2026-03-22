import os
import pytest
import pytest_asyncio
from httpx import ASGITransport, AsyncClient

# Override database URL before importing the app
os.environ.setdefault("DATABASE_URL", "postgresql+asyncpg://dms:dms_secret@localhost:5432/dms")
os.environ.setdefault("REDIS_URL", "redis://localhost:6379/0")
os.environ.setdefault("SECRET_KEY", "test-secret-key-not-for-production")
os.environ.setdefault("STORAGE_BACKEND", "local")
os.environ.setdefault("LOCAL_STORAGE_PATH", "/tmp/dms-test-documents")

from app.main import app


@pytest_asyncio.fixture
async def client():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        yield ac


@pytest.fixture
def test_user_data():
    return {
        "email": "testuser@example.com",
        "username": "testuser",
        "password": "testpassword123",
        "full_name": "Test User",
    }
