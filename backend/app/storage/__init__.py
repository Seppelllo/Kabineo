from app.config import settings
from app.storage.base import StorageBackend
from app.storage.local import LocalStorageBackend
from app.storage.s3 import S3StorageBackend


def get_storage_backend() -> StorageBackend:
    if settings.storage_backend == "s3":
        return S3StorageBackend(
            endpoint_url=settings.s3_endpoint_url,
            access_key=settings.s3_access_key,
            secret_key=settings.s3_secret_key,
            bucket=settings.s3_bucket,
        )
    return LocalStorageBackend(base_path=settings.local_storage_path)


storage = get_storage_backend()
