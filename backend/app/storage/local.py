import os
from pathlib import Path
from typing import BinaryIO

import aiofiles

from app.storage.base import StorageBackend


class LocalStorageBackend(StorageBackend):
    def __init__(self, base_path: str):
        self.base_path = Path(base_path)
        self.base_path.mkdir(parents=True, exist_ok=True)

    def _resolve(self, key: str) -> Path:
        resolved = (self.base_path / key).resolve()
        if not str(resolved).startswith(str(self.base_path.resolve())):
            raise ValueError("Invalid storage key: path traversal detected")
        return resolved

    async def put(self, key: str, data: BinaryIO, content_type: str) -> None:
        path = self._resolve(key)
        path.parent.mkdir(parents=True, exist_ok=True)
        async with aiofiles.open(path, "wb") as f:
            while chunk := data.read(8192):
                await f.write(chunk)

    async def get(self, key: str) -> bytes:
        path = self._resolve(key)
        async with aiofiles.open(path, "rb") as f:
            return await f.read()

    async def delete(self, key: str) -> None:
        path = self._resolve(key)
        if path.exists():
            os.remove(path)

    async def exists(self, key: str) -> bool:
        return self._resolve(key).exists()

    async def get_presigned_url(self, key: str, expires_in: int = 3600) -> str | None:
        return None
