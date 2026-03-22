import uuid

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.dependencies import get_current_user
from app.models.user import User
from app.schemas.search import SearchResponse
from app.services.search_service import search_documents

router = APIRouter(prefix="/api/search", tags=["search"])


@router.get("", response_model=SearchResponse)
async def search(
    q: str = Query(..., min_length=1),
    folder_id: uuid.UUID | None = None,
    mime_type: str | None = None,
    page: int = 1,
    page_size: int = 20,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    owner_filter = None if current_user.role == "admin" else current_user.id
    items, total = await search_documents(
        db,
        query=q,
        owner_id=owner_filter,
        folder_id=folder_id,
        mime_type=mime_type,
        page=page,
        page_size=page_size,
    )
    return SearchResponse(items=items, total=total, query=q)
