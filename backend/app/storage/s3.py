from io import BytesIO
from typing import BinaryIO

from aiobotocore.session import get_session

from app.storage.base import StorageBackend


class S3StorageBackend(StorageBackend):
    def __init__(self, endpoint_url: str, access_key: str, secret_key: str, bucket: str):
        self.endpoint_url = endpoint_url
        self.access_key = access_key
        self.secret_key = secret_key
        self.bucket = bucket
        self._session = get_session()

    def _client(self):
        return self._session.create_client(
            "s3",
            endpoint_url=self.endpoint_url,
            aws_access_key_id=self.access_key,
            aws_secret_access_key=self.secret_key,
        )

    async def _ensure_bucket(self, client):
        try:
            await client.head_bucket(Bucket=self.bucket)
        except Exception:
            await client.create_bucket(Bucket=self.bucket)

    async def put(self, key: str, data: BinaryIO, content_type: str) -> None:
        async with self._client() as client:
            await self._ensure_bucket(client)
            body = data.read()
            await client.put_object(
                Bucket=self.bucket,
                Key=key,
                Body=body,
                ContentType=content_type,
            )

    async def get(self, key: str) -> bytes:
        async with self._client() as client:
            response = await client.get_object(Bucket=self.bucket, Key=key)
            async with response["Body"] as stream:
                return await stream.read()

    async def delete(self, key: str) -> None:
        async with self._client() as client:
            await client.delete_object(Bucket=self.bucket, Key=key)

    async def exists(self, key: str) -> bool:
        async with self._client() as client:
            try:
                await client.head_object(Bucket=self.bucket, Key=key)
                return True
            except Exception:
                return False

    async def get_presigned_url(self, key: str, expires_in: int = 3600) -> str | None:
        async with self._client() as client:
            url = await client.generate_presigned_url(
                "get_object",
                Params={"Bucket": self.bucket, "Key": key},
                ExpiresIn=expires_in,
            )
            return url
