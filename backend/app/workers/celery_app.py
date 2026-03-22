from celery import Celery

from app.config import settings

celery_app = Celery(
    "dms",
    broker=settings.redis_url,
    backend=settings.redis_url,
    include=[
        "app.workers.ocr_tasks",
        "app.workers.thumbnail_tasks",
        "app.workers.scan_tasks",
        "app.workers.classify_tasks",
        "app.workers.extract_tasks",
        "app.workers.barcode_tasks",
        "app.workers.email_tasks",
        "app.workers.consume_tasks",
        "app.workers.webhook_tasks",
    ],
)

celery_app.conf.update(
    task_serializer="json",
    accept_content=["json"],
    result_serializer="json",
    timezone="UTC",
    enable_utc=True,
    task_acks_late=True,
    task_reject_on_worker_lost=True,
    worker_prefetch_multiplier=1,
    beat_schedule={
        "poll-email-every-5-min": {
            "task": "app.workers.email_tasks.poll_email",
            "schedule": 300.0,  # 5 minutes
        },
        "consume-folder-every-30-sec": {
            "task": "app.workers.consume_tasks.consume_folder",
            "schedule": 30.0,  # 30 seconds
        },
    },
)
