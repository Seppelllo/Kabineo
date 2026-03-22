import re
import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.dependencies import get_current_user
from app.models.document import Document
from app.models.matching_rule import MatchingRule
from app.models.user import User
from app.schemas.matching_rule import (
    MatchingRuleCreate,
    MatchingRuleResponse,
    MatchingRuleTestRequest,
    MatchingRuleTestResponse,
    MatchingRuleTextTestMatch,
    MatchingRuleTextTestRequest,
    MatchingRuleTextTestResponse,
    MatchingRuleUpdate,
)

router = APIRouter(prefix="/api/matching-rules", tags=["matching-rules"])


@router.get("", response_model=list[MatchingRuleResponse])
async def list_matching_rules(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(MatchingRule)
        .where(MatchingRule.owner_id == current_user.id)
        .order_by(MatchingRule.order, MatchingRule.name)
    )
    return list(result.scalars().all())


@router.post("", response_model=MatchingRuleResponse, status_code=status.HTTP_201_CREATED)
async def create_matching_rule(
    data: MatchingRuleCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    if data.match_type not in ("keyword", "regex", "exact"):
        raise HTTPException(status_code=400, detail="match_type must be 'keyword', 'regex', or 'exact'")
    rule = MatchingRule(
        name=data.name,
        order=data.order,
        match_type=data.match_type,
        pattern=data.pattern,
        case_sensitive=data.case_sensitive,
        assign_correspondent_id=data.assign_correspondent_id,
        assign_document_type_id=data.assign_document_type_id,
        assign_tag_ids=[str(tid) for tid in data.assign_tag_ids] if data.assign_tag_ids else [],
        assign_folder_id=data.assign_folder_id,
        owner_id=current_user.id,
    )
    db.add(rule)
    await db.commit()
    await db.refresh(rule)
    return rule


@router.put("/{rule_id}", response_model=MatchingRuleResponse)
async def update_matching_rule(
    rule_id: uuid.UUID,
    data: MatchingRuleUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(MatchingRule).where(
            MatchingRule.id == rule_id,
            MatchingRule.owner_id == current_user.id,
        )
    )
    rule = result.scalar_one_or_none()
    if not rule:
        raise HTTPException(status_code=404, detail="Matching rule not found")
    if data.name is not None:
        rule.name = data.name
    if data.order is not None:
        rule.order = data.order
    if data.match_type is not None:
        if data.match_type not in ("keyword", "regex", "exact"):
            raise HTTPException(status_code=400, detail="match_type must be 'keyword', 'regex', or 'exact'")
        rule.match_type = data.match_type
    if data.pattern is not None:
        rule.pattern = data.pattern
    if data.case_sensitive is not None:
        rule.case_sensitive = data.case_sensitive
    if data.assign_correspondent_id is not None:
        rule.assign_correspondent_id = data.assign_correspondent_id
    if data.assign_document_type_id is not None:
        rule.assign_document_type_id = data.assign_document_type_id
    if data.assign_tag_ids is not None:
        rule.assign_tag_ids = [str(tid) for tid in data.assign_tag_ids]
    if data.assign_folder_id is not None:
        rule.assign_folder_id = data.assign_folder_id
    await db.commit()
    await db.refresh(rule)
    return rule


@router.delete("/{rule_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_matching_rule(
    rule_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(MatchingRule).where(
            MatchingRule.id == rule_id,
            MatchingRule.owner_id == current_user.id,
        )
    )
    rule = result.scalar_one_or_none()
    if not rule:
        raise HTTPException(status_code=404, detail="Matching rule not found")
    await db.delete(rule)
    await db.commit()


@router.post("/test", response_model=MatchingRuleTestResponse)
async def test_matching_rule(
    data: MatchingRuleTestRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    # Get the document
    doc_result = await db.execute(
        select(Document).where(
            Document.id == data.document_id,
            Document.owner_id == current_user.id,
        )
    )
    doc = doc_result.scalar_one_or_none()
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")

    # Get rule parameters
    if data.rule_id:
        rule_result = await db.execute(
            select(MatchingRule).where(
                MatchingRule.id == data.rule_id,
                MatchingRule.owner_id == current_user.id,
            )
        )
        rule = rule_result.scalar_one_or_none()
        if not rule:
            raise HTTPException(status_code=404, detail="Matching rule not found")
        match_type = rule.match_type
        pattern = rule.pattern
        case_sensitive = rule.case_sensitive
    elif data.match_type and data.pattern:
        match_type = data.match_type
        pattern = data.pattern
        case_sensitive = data.case_sensitive
    else:
        raise HTTPException(status_code=400, detail="Provide rule_id or match_type+pattern")

    # Build text to search
    text_to_search = " ".join(filter(None, [doc.title, doc.description, doc.ocr_text]))

    matches, matched_text = _test_rule(match_type, pattern, case_sensitive, text_to_search)
    return MatchingRuleTestResponse(matches=matches, matched_text=matched_text)


@router.post("/test-text", response_model=MatchingRuleTextTestResponse)
async def test_matching_rules_with_text(
    data: MatchingRuleTextTestRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Test all matching rules against a given text string."""
    result = await db.execute(
        select(MatchingRule)
        .where(MatchingRule.owner_id == current_user.id)
        .order_by(MatchingRule.order)
    )
    rules = list(result.scalars().all())

    matches = []
    for rule in rules:
        found, matched_text = _test_rule(rule.match_type, rule.pattern, rule.case_sensitive, data.text)
        if found:
            matches.append(MatchingRuleTextTestMatch(
                rule_id=rule.id,
                rule_name=rule.name,
                matched_text=matched_text,
                assign_correspondent_id=rule.assign_correspondent_id,
                assign_document_type_id=rule.assign_document_type_id,
                assign_tag_ids=[uuid.UUID(t) for t in rule.assign_tag_ids] if rule.assign_tag_ids else None,
                assign_folder_id=rule.assign_folder_id,
            ))

    return MatchingRuleTextTestResponse(matches=matches)


def _test_rule(match_type: str, pattern: str, case_sensitive: bool, text: str) -> tuple[bool, str | None]:
    flags = 0 if case_sensitive else re.IGNORECASE
    if match_type == "exact":
        if case_sensitive:
            found = pattern in text
        else:
            found = pattern.lower() in text.lower()
        return found, pattern if found else None
    elif match_type == "keyword":
        # Match any keyword (space-separated)
        keywords = pattern.split()
        for kw in keywords:
            if case_sensitive:
                if kw in text:
                    return True, kw
            else:
                if kw.lower() in text.lower():
                    return True, kw
        return False, None
    elif match_type == "regex":
        match = re.search(pattern, text, flags)
        if match:
            return True, match.group(0)
        return False, None
    return False, None
