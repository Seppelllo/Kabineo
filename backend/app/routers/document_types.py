import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.dependencies import get_current_user
from app.models.document_type import DocumentType
from app.models.user import User
from app.schemas.document_type import DocumentTypeCreate, DocumentTypeResponse, DocumentTypeUpdate

router = APIRouter(prefix="/api/document-types", tags=["document-types"])


@router.get("", response_model=list[DocumentTypeResponse])
async def list_document_types(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(DocumentType)
        .where(DocumentType.owner_id == current_user.id)
        .order_by(DocumentType.name)
    )
    return list(result.scalars().all())


@router.post("", response_model=DocumentTypeResponse, status_code=status.HTTP_201_CREATED)
async def create_document_type(
    data: DocumentTypeCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    existing = await db.execute(
        select(DocumentType).where(
            DocumentType.name == data.name,
            DocumentType.owner_id == current_user.id,
        )
    )
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="Document type already exists")
    doc_type = DocumentType(
        name=data.name,
        match_pattern=data.match_pattern,
        owner_id=current_user.id,
    )
    db.add(doc_type)
    await db.commit()
    await db.refresh(doc_type)
    return doc_type


@router.put("/{doc_type_id}", response_model=DocumentTypeResponse)
async def update_document_type(
    doc_type_id: uuid.UUID,
    data: DocumentTypeUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(DocumentType).where(
            DocumentType.id == doc_type_id,
            DocumentType.owner_id == current_user.id,
        )
    )
    doc_type = result.scalar_one_or_none()
    if not doc_type:
        raise HTTPException(status_code=404, detail="Document type not found")
    if data.name is not None:
        doc_type.name = data.name
    if data.match_pattern is not None:
        doc_type.match_pattern = data.match_pattern
    await db.commit()
    await db.refresh(doc_type)
    return doc_type


@router.delete("/{doc_type_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_document_type(
    doc_type_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(DocumentType).where(
            DocumentType.id == doc_type_id,
            DocumentType.owner_id == current_user.id,
        )
    )
    doc_type = result.scalar_one_or_none()
    if not doc_type:
        raise HTTPException(status_code=404, detail="Document type not found")
    await db.delete(doc_type)
    await db.commit()
