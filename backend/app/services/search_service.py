import uuid

from sqlalchemy import func, select, text
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.document import Document


async def search_documents(
    db: AsyncSession,
    query: str,
    owner_id: uuid.UUID | None = None,
    folder_id: uuid.UUID | None = None,
    tag_ids: list[uuid.UUID] | None = None,
    mime_type: str | None = None,
    page: int = 1,
    page_size: int = 20,
) -> tuple[list[dict], int]:
    ts_query_de = func.plainto_tsquery("german", query)
    ts_query_en = func.plainto_tsquery("english", query)
    ts_query = ts_query_de.op("||")(ts_query_en)

    stmt = (
        select(
            Document,
            func.ts_rank(Document.search_vector, ts_query).label("rank"),
            func.ts_headline(
                "german",
                func.coalesce(Document.ocr_text, ""),
                ts_query,
                "StartSel=<mark>, StopSel=</mark>, MaxWords=50, MinWords=20",
            ).label("snippet"),
        )
        .where(Document.search_vector.op("@@")(ts_query))
    )

    if owner_id:
        stmt = stmt.where(Document.owner_id == owner_id)
    if folder_id:
        stmt = stmt.where(Document.folder_id == folder_id)
    if mime_type:
        safe_mime = mime_type.replace("%", r"\%").replace("_", r"\_")
        stmt = stmt.where(Document.mime_type.ilike(f"%{safe_mime}%", escape="\\"))

    count_stmt = select(func.count()).select_from(
        select(Document.id).where(Document.search_vector.op("@@")(ts_query)).subquery()
    )
    if owner_id:
        count_stmt = select(func.count()).select_from(
            select(Document.id)
            .where(Document.search_vector.op("@@")(ts_query))
            .where(Document.owner_id == owner_id)
            .subquery()
        )
    total = (await db.execute(count_stmt)).scalar() or 0

    stmt = stmt.order_by(text("rank DESC"))
    stmt = stmt.offset((page - 1) * page_size).limit(page_size)

    result = await db.execute(stmt)
    rows = result.all()

    items = []
    for doc, rank, snippet in rows:
        items.append({
            "id": doc.id,
            "title": doc.title,
            "description": doc.description,
            "filename": doc.filename,
            "mime_type": doc.mime_type,
            "file_size": doc.file_size,
            "folder_id": doc.folder_id,
            "ocr_status": doc.ocr_status.value,
            "snippet": snippet,
            "rank": float(rank),
            "created_at": doc.created_at,
        })

    return items, total
