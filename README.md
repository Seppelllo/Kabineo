# Kabineo — Dein digitales Aktenkabinett

A self-hosted, full-featured document management system built with FastAPI and Next.js. Designed for individuals and small teams who need to organize, search, and manage their documents with powerful OCR, automated classification, and multi-channel ingestion.

## Features

- **Document Storage & Organization** - Upload, tag, and organize documents in folders with full version history
- **Full-Text Search** - PostgreSQL-powered search with German and English language support, OCR text indexing, and highlighted snippets
- **OCR Processing** - Automatic text extraction from PDFs and images using Tesseract (English and German)
- **Barcode/QR Detection** - Automatic barcode and QR code detection in uploaded documents
- **Automated Classification** - Rule-based matching to auto-assign tags, correspondents, and document types
- **Telegram Bot Integration** - Upload and search documents directly from Telegram
- **Email Import (IMAP)** - Automatically import documents from email attachments
- **Consume Folder** - Watch a folder for new files and auto-import them
- **Document Sharing** - Generate shareable links with optional expiration
- **Folder Permissions** - Granular access control for shared folders
- **Correspondents & Document Types** - Categorize documents by sender/recipient and type
- **Webhooks** - Notify external services on document events
- **API Keys** - Programmatic access via API keys
- **Export** - Bulk export documents with metadata
- **Admin Dashboard** - User management, system settings, and audit logs
- **Dark Mode** - Full dark/light theme support
- **Responsive UI** - Mobile-friendly Next.js frontend

## Tech Stack

| Component       | Technology                          |
|----------------|--------------------------------------|
| **Backend**    | Python 3.12, FastAPI, SQLAlchemy 2.0 |
| **Frontend**   | Next.js, React 19, TypeScript, Tailwind CSS |
| **Database**   | PostgreSQL 16                        |
| **Cache/Queue**| Redis 7                              |
| **Task Queue** | Celery                               |
| **OCR**        | Tesseract                            |
| **Storage**    | Local filesystem or S3/MinIO         |
| **Bot**        | python-telegram-bot                  |

## Prerequisites

- [Docker](https://docs.docker.com/get-docker/) (v20.10+)
- [Docker Compose](https://docs.docker.com/compose/install/) (v2.0+)

## Quick Start

```bash
# Clone the repository
git clone https://github.com/your-org/dms.git
cd dms

# Copy and configure environment variables
cp .env.example .env
# Edit .env with your settings (see Configuration Reference below)

# Start all services
docker compose up -d

# The application is now running:
#   Frontend:  http://localhost:3000
#   API:       http://localhost:8000
#   API Docs:  http://localhost:8000/docs
#   MinIO:     http://localhost:9001
```

The default admin credentials are configured via `ADMIN_EMAIL`, `ADMIN_USERNAME`, and `ADMIN_PASSWORD` in `.env`.

## Configuration Reference

All configuration is done via environment variables (`.env` file).

### Database

| Variable            | Default                                          | Description              |
|---------------------|--------------------------------------------------|--------------------------|
| `POSTGRES_USER`     | `dms`                                            | PostgreSQL username      |
| `POSTGRES_PASSWORD` | `dms_secret`                                     | PostgreSQL password      |
| `POSTGRES_DB`       | `dms`                                            | PostgreSQL database name |
| `DATABASE_URL`      | `postgresql+asyncpg://dms:dms_secret@postgres:5432/dms` | Full database URL  |

### Redis

| Variable    | Default                | Description   |
|-------------|------------------------|---------------|
| `REDIS_URL` | `redis://redis:6379/0` | Redis URL     |

### Authentication

| Variable                      | Default                          | Description                |
|-------------------------------|----------------------------------|----------------------------|
| `SECRET_KEY`                  | `change-me-to-a-random-secret-key` | JWT signing key (change in production!) |
| `ACCESS_TOKEN_EXPIRE_MINUTES` | `30`                             | Access token TTL (minutes) |
| `REFRESH_TOKEN_EXPIRE_DAYS`   | `7`                              | Refresh token TTL (days)   |

### Storage

| Variable           | Default             | Description                          |
|--------------------|---------------------|--------------------------------------|
| `STORAGE_BACKEND`  | `local`             | Storage backend: `local` or `s3`     |
| `LOCAL_STORAGE_PATH`| `/data/documents`  | Path for local file storage          |
| `S3_ENDPOINT_URL`  | `http://minio:9000` | S3/MinIO endpoint                    |
| `S3_ACCESS_KEY`    | `minioadmin`        | S3 access key                        |
| `S3_SECRET_KEY`    | `minioadmin`        | S3 secret key                        |
| `S3_BUCKET`        | `dms-documents`     | S3 bucket name                       |

### Admin User

| Variable         | Default              | Description                         |
|------------------|----------------------|-------------------------------------|
| `ADMIN_EMAIL`    | _(empty)_            | Auto-created admin email            |
| `ADMIN_USERNAME` | _(empty)_            | Auto-created admin username         |
| `ADMIN_PASSWORD` | _(empty)_            | Auto-created admin password         |

### Ingestion

| Variable              | Default   | Description                            |
|-----------------------|-----------|----------------------------------------|
| `CONSUME_FOLDER_PATH` | _(empty)_ | Path to watch for new documents        |
| `IMAP_ENABLED`        | `false`   | Enable IMAP email import               |
| `IMAP_SERVER`         | _(empty)_ | IMAP server hostname                   |
| `IMAP_USER`           | _(empty)_ | IMAP username                          |
| `IMAP_PASSWORD`       | _(empty)_ | IMAP password                          |
| `IMAP_FOLDER`         | `INBOX`   | IMAP folder to monitor                 |

### Telegram

| Variable             | Default   | Description                     |
|----------------------|-----------|---------------------------------|
| `TELEGRAM_BOT_TOKEN` | _(empty)_ | Telegram bot API token          |

### Frontend

| Variable              | Default                   | Description          |
|-----------------------|---------------------------|----------------------|
| `NEXT_PUBLIC_API_URL` | `http://localhost:8000`   | API URL for frontend |

## Telegram Bot Setup

1. Create a bot via [BotFather](https://t.me/BotFather) on Telegram
2. Copy the bot token and set `TELEGRAM_BOT_TOKEN` in your `.env`
3. Restart the `telegram-bot` service: `docker compose restart telegram-bot`
4. Start a chat with your bot and link your account using the `/start` command
5. Send documents (PDFs, images) directly to the bot to upload them
6. Use inline search to find documents from any Telegram chat

## Architecture Overview

```
                    +------------------+
                    |   Nginx (prod)   |
                    |   :80 / :443     |
                    +--------+---------+
                             |
              +--------------+--------------+
              |                             |
     +--------v--------+          +--------v--------+
     |    Frontend      |          |    API Server   |
     |    Next.js       |          |    FastAPI      |
     |    :3000         |          |    :8000        |
     +--------+---------+          +---+----+---+----+
                                       |    |   |
                            +----------+    |   +----------+
                            |               |              |
                   +--------v----+  +-------v-------+  +--v---------+
                   |  PostgreSQL |  |     Redis      |  |   MinIO/   |
                   |    :5432    |  |     :6379      |  | Local FS   |
                   +-------------+  +-------+-------+  +------------+
                                            |
                                   +--------v--------+
                                   | Celery Workers  |
                                   | - OCR           |
                                   | - Thumbnails    |
                                   | - Classification|
                                   | - Email import  |
                                   | - Consume folder|
                                   | - Webhooks      |
                                   +-----------------+
                                            |
                                   +--------v--------+
                                   | Telegram Bot    |
                                   +-----------------+
```

### Processing Pipeline

1. **Ingestion** - Documents enter via upload, Telegram, email, or consume folder
2. **Storage** - Files are stored in local filesystem or S3/MinIO
3. **OCR** - Celery workers extract text using Tesseract
4. **Indexing** - Extracted text is indexed in PostgreSQL full-text search (German + English)
5. **Classification** - Matching rules auto-assign tags, correspondents, and document types
6. **Barcode Detection** - QR codes and barcodes are extracted and stored
7. **Thumbnails** - Preview images are generated for all document types
8. **Webhooks** - External services are notified of document events

## API Reference

The API is fully documented with OpenAPI/Swagger:

- **Swagger UI**: [http://localhost:8000/docs](http://localhost:8000/docs)
- **ReDoc**: [http://localhost:8000/redoc](http://localhost:8000/redoc)
- **Interactive API Docs** (frontend): [http://localhost:3000/api-docs](http://localhost:3000/api-docs)

### Key Endpoints

| Endpoint                | Description              |
|-------------------------|--------------------------|
| `POST /api/auth/register` | Register a new user    |
| `POST /api/auth/login`    | Login and get tokens   |
| `GET /api/documents`      | List documents         |
| `POST /api/documents`     | Upload a document      |
| `GET /api/search`         | Full-text search       |
| `GET /api/health`         | Health check (detailed)|
| `GET /api/health/workers` | Celery worker status   |

## Development Setup

### Backend

```bash
cd backend
python -m venv .venv
source .venv/bin/activate
pip install -e ".[dev]"

# Run linting
ruff check app/

# Run tests
pytest

# Start development server (requires PostgreSQL and Redis)
uvicorn app.main:app --reload --port 8000
```

### Frontend

```bash
cd frontend
npm install

# Run linting
npm run lint

# Run development server
npm run dev

# Build for production
npm run build
```

### Running Everything with Docker (Development)

```bash
docker compose up -d
```

### Production Deployment

```bash
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d
```

## Backup & Restore

```bash
# Create a backup
./scripts/backup.sh

# Restore from a backup
./scripts/restore.sh ./backups/20240101_120000
```

## Screenshots

_Screenshots coming soon._

## License

This project is licensed under the **GNU Affero General Public License v3.0 (AGPL-3.0)**. See [LICENSE](LICENSE) for details.

This means:
- You can use, modify, and distribute Kabineo freely
- If you host a modified version as a service, you must publish your source code
- All derivative works must use the same license
