# Kabineo — Dein digitales Aktenkabinett
# Copyright (C) 2026 Seppello
# Licensed under AGPL-3.0. See LICENSE file.

import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.responses import Response as StarletteResponse
from sqlalchemy import text

from app.config import settings as app_settings
from app.database import engine, async_session
from app.models import Base
from app.routers import (
    admin, api_keys, auth, correspondents, document_shares, document_types, documents,
    export, folder_permissions, folders, groups, matching_rules, notifications, search,
    settings, shares, sso, tags, webhooks,
)

logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Create all tables on startup
    async with engine.begin() as conn:
        # Enable extensions
        await conn.execute(text('CREATE EXTENSION IF NOT EXISTS "uuid-ossp"'))
        await conn.execute(text('CREATE EXTENSION IF NOT EXISTS "pg_trgm"'))
        # Create tables
        await conn.run_sync(Base.metadata.create_all)
        # Create search vector trigger
        await conn.execute(text("""
            CREATE OR REPLACE FUNCTION documents_search_vector_update() RETURNS trigger AS $$
            BEGIN
                NEW.search_vector :=
                    to_tsvector('german', coalesce(NEW.title, '')) ||
                    to_tsvector('german', coalesce(NEW.description, '')) ||
                    to_tsvector('german', coalesce(NEW.ocr_text, '')) ||
                    to_tsvector('english', coalesce(NEW.title, '')) ||
                    to_tsvector('english', coalesce(NEW.ocr_text, ''));
                RETURN NEW;
            END;
            $$ LANGUAGE plpgsql;
        """))
        await conn.execute(text("""
            DO $$ BEGIN
                IF NOT EXISTS (
                    SELECT 1 FROM pg_trigger WHERE tgname = 'documents_search_vector_trigger'
                ) THEN
                    CREATE TRIGGER documents_search_vector_trigger
                    BEFORE INSERT OR UPDATE ON documents
                    FOR EACH ROW EXECUTE FUNCTION documents_search_vector_update();
                END IF;
            END $$;
        """))
    logger.info("Database tables created successfully")

    # Log configuration summary
    features = []
    if app_settings.imap_enabled:
        features.append("IMAP email import")
    if app_settings.consume_folder_path:
        features.append("Consume folder")
    if app_settings.telegram_bot_token and app_settings.telegram_bot_token != "your-telegram-bot-token":
        features.append("Telegram bot")
    if app_settings.storage_backend == "s3":
        features.append("S3 storage")
    if app_settings.sso_enabled:
        features.append("SSO/OIDC")
    if app_settings.saml_enabled:
        features.append("SAML")

    logger.info("=== DMS Configuration Summary ===")
    logger.info(f"  Storage backend: {app_settings.storage_backend}")
    logger.info(f"  IMAP email import: {'enabled' if app_settings.imap_enabled else 'disabled'}")
    logger.info(f"  Consume folder: {'configured (' + app_settings.consume_folder_path + ')' if app_settings.consume_folder_path else 'not configured'}")
    logger.info(f"  Telegram bot: {'configured' if app_settings.telegram_bot_token and app_settings.telegram_bot_token != 'your-telegram-bot-token' else 'not configured'}")
    logger.info(f"  SSO/OIDC: {'enabled' if app_settings.sso_enabled else 'disabled'}")
    logger.info(f"  SAML: {'enabled' if app_settings.saml_enabled else 'disabled'}")
    logger.info(f"  Active features: {len(features)} ({', '.join(features) if features else 'base only'})")
    logger.info("=================================")

    # Auto-create admin user from env
    from app.config import settings
    if settings.admin_email and settings.admin_username and settings.admin_password:
        from sqlalchemy import select
        from app.database import async_session
        from app.models.user import User, UserRole
        from app.services.auth_service import hash_password

        async with async_session() as db:
            result = await db.execute(select(User).where(User.email == settings.admin_email))
            existing = result.scalar_one_or_none()
            if not existing:
                admin = User(
                    email=settings.admin_email,
                    username=settings.admin_username,
                    hashed_password=hash_password(settings.admin_password),
                    full_name="Administrator",
                    role=UserRole.admin,
                )
                db.add(admin)
                await db.commit()
                logger.info(f"Admin user '{settings.admin_username}' created")
            else:
                # Ensure existing user is admin
                if existing.role != UserRole.admin:
                    existing.role = UserRole.admin
                    await db.commit()
                    logger.info(f"User '{settings.admin_email}' promoted to admin")

    yield


app = FastAPI(
    title="Kabineo API",
    description="Kabineo — Dein digitales Aktenkabinett",
    version="0.1.0",
    lifespan=lifespan,
)

class SecurityHeadersMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        response: StarletteResponse = await call_next(request)
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["X-Frame-Options"] = "DENY"
        response.headers["X-XSS-Protection"] = "1; mode=block"
        return response


app.add_middleware(SecurityHeadersMiddleware)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router)
app.include_router(documents.router)
app.include_router(folders.router)
app.include_router(tags.router)
app.include_router(search.router)
app.include_router(shares.router)
app.include_router(document_shares.router)
app.include_router(admin.router)
app.include_router(correspondents.router)
app.include_router(document_types.router)
app.include_router(matching_rules.router)
app.include_router(export.router)
app.include_router(api_keys.router)
app.include_router(webhooks.router)
app.include_router(folder_permissions.router)
app.include_router(settings.router)
app.include_router(sso.router)
app.include_router(groups.router)
app.include_router(notifications.router)


@app.get("/api/health")
async def health_check():
    status_details: dict = {"status": "ok"}
    overall_ok = True

    # Check database
    try:
        async with async_session() as db:
            await db.execute(text("SELECT 1"))
        status_details["database"] = "healthy"
    except Exception as e:
        status_details["database"] = f"unhealthy: {e}"
        overall_ok = False

    # Check Redis
    try:
        import redis as sync_redis
        r = sync_redis.from_url(app_settings.redis_url, socket_connect_timeout=2)
        r.ping()
        status_details["redis"] = "healthy"
    except Exception as e:
        status_details["redis"] = f"unhealthy: {e}"
        overall_ok = False

    # Check storage backend
    try:
        if app_settings.storage_backend == "local":
            import os
            storage_path = app_settings.local_storage_path
            if os.path.isdir(storage_path) and os.access(storage_path, os.W_OK):
                status_details["storage"] = "healthy"
            else:
                status_details["storage"] = f"unhealthy: {storage_path} not writable or missing"
                overall_ok = False
        else:
            status_details["storage"] = "s3 (not checked)"
    except Exception as e:
        status_details["storage"] = f"unhealthy: {e}"
        overall_ok = False

    # Check Celery workers
    try:
        from app.workers.celery_app import celery_app as celery
        inspector = celery.control.inspect(timeout=2.0)
        ping_result = inspector.ping()
        if ping_result:
            status_details["celery_workers"] = f"healthy ({len(ping_result)} worker(s))"
        else:
            status_details["celery_workers"] = "unhealthy: no workers responding"
            overall_ok = False
    except Exception as e:
        status_details["celery_workers"] = f"unhealthy: {e}"
        overall_ok = False

    status_details["status"] = "ok" if overall_ok else "degraded"

    from fastapi.responses import JSONResponse
    return JSONResponse(
        content=status_details,
        status_code=200 if overall_ok else 503,
    )


@app.get("/api/health/workers")
async def worker_health():
    result: dict = {}
    try:
        from app.workers.celery_app import celery_app as celery
        inspector = celery.control.inspect(timeout=2.0)

        # Ping workers
        ping_result = inspector.ping()
        result["workers_responding"] = len(ping_result) if ping_result else 0
        result["workers"] = list(ping_result.keys()) if ping_result else []

        # Queue lengths
        try:
            import redis as sync_redis
            r = sync_redis.from_url(app_settings.redis_url, socket_connect_timeout=2)
            result["queue_lengths"] = {
                "celery": r.llen("celery"),
            }
        except Exception:
            result["queue_lengths"] = "unavailable"

        # Active tasks
        active = inspector.active()
        if active:
            result["active_tasks"] = {
                worker: len(tasks) for worker, tasks in active.items()
            }
        else:
            result["active_tasks"] = {}

    except Exception as e:
        result["error"] = str(e)

    return result
