"""Auto-crop documents from photos using OpenCV edge detection + perspective transform."""
import asyncio
import io
import logging
import uuid

import cv2
import numpy as np

from app.workers.celery_app import celery_app

logger = logging.getLogger(__name__)


def _run_async(coro):
    loop = asyncio.new_event_loop()
    try:
        return loop.run_until_complete(coro)
    finally:
        loop.close()


def _order_points(pts):
    rect = np.zeros((4, 2), dtype="float32")
    s = pts.sum(axis=1)
    rect[0] = pts[np.argmin(s)]
    rect[2] = pts[np.argmax(s)]
    diff = np.diff(pts, axis=1)
    rect[1] = pts[np.argmin(diff)]
    rect[3] = pts[np.argmax(diff)]
    return rect


def _four_point_transform(image, pts):
    rect = _order_points(pts)
    (tl, tr, br, bl) = rect

    widthA = np.sqrt(((br[0] - bl[0]) ** 2) + ((br[1] - bl[1]) ** 2))
    widthB = np.sqrt(((tr[0] - tl[0]) ** 2) + ((tr[1] - tl[1]) ** 2))
    maxWidth = max(int(widthA), int(widthB))

    heightA = np.sqrt(((tr[0] - br[0]) ** 2) + ((tr[1] - br[1]) ** 2))
    heightB = np.sqrt(((tl[0] - bl[0]) ** 2) + ((tl[1] - bl[1]) ** 2))
    maxHeight = max(int(heightA), int(heightB))

    if maxWidth < 100 or maxHeight < 100:
        return None

    dst = np.array([[0, 0], [maxWidth - 1, 0], [maxWidth - 1, maxHeight - 1], [0, maxHeight - 1]], dtype="float32")
    M = cv2.getPerspectiveTransform(rect, dst)
    return cv2.warpPerspective(image, M, (maxWidth, maxHeight))


def _find_document_contour(image):
    """Try multiple strategies to find a document contour."""
    gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
    img_area = image.shape[0] * image.shape[1]

    # Strategy 1: Canny with standard thresholds
    for low, high in [(50, 200), (30, 150), (75, 250), (20, 100)]:
        blurred = cv2.GaussianBlur(gray, (5, 5), 0)
        edged = cv2.Canny(blurred, low, high)
        kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (3, 3))
        edged = cv2.dilate(edged, kernel, iterations=2)
        edged = cv2.erode(edged, kernel, iterations=1)

        contours, _ = cv2.findContours(edged, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
        contours = sorted(contours, key=cv2.contourArea, reverse=True)[:5]

        for contour in contours:
            peri = cv2.arcLength(contour, True)
            approx = cv2.approxPolyDP(contour, 0.02 * peri, True)
            if len(approx) == 4:
                area = cv2.contourArea(approx)
                if area > img_area * 0.1:
                    return approx.reshape(4, 2)

    # Strategy 2: Adaptive threshold
    blurred = cv2.GaussianBlur(gray, (11, 11), 0)
    thresh = cv2.adaptiveThreshold(blurred, 255, cv2.ADAPTIVE_THRESH_GAUSSIAN_C, cv2.THRESH_BINARY_INV, 11, 2)
    kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (5, 5))
    thresh = cv2.morphologyEx(thresh, cv2.MORPH_CLOSE, kernel, iterations=3)

    contours, _ = cv2.findContours(thresh, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    contours = sorted(contours, key=cv2.contourArea, reverse=True)[:5]

    for contour in contours:
        peri = cv2.arcLength(contour, True)
        approx = cv2.approxPolyDP(contour, 0.02 * peri, True)
        if len(approx) == 4:
            area = cv2.contourArea(approx)
            if area > img_area * 0.1:
                return approx.reshape(4, 2)

    # Strategy 3: Largest contour → minimum area rectangle (fallback)
    if contours:
        largest = contours[0]
        area = cv2.contourArea(largest)
        if area > img_area * 0.15:
            rect = cv2.minAreaRect(largest)
            box = cv2.boxPoints(rect)
            return box.astype("float32")

    return None


def scan_document(image_bytes: bytes) -> bytes | None:
    """Detect and crop a document from a photo."""
    nparr = np.frombuffer(image_bytes, np.uint8)
    image = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
    if image is None:
        return None

    h, w = image.shape[:2]
    scale = 1.0
    if max(h, w) > 1500:
        scale = 1500.0 / max(h, w)
        small = cv2.resize(image, (int(w * scale), int(h * scale)))
    else:
        small = image

    contour = _find_document_contour(small)
    if contour is None:
        logger.info("No document contour found")
        return None

    # Scale contour back to original size
    contour = (contour / scale).astype("float32")

    warped = _four_point_transform(image, contour)
    if warped is None:
        return None

    _, buffer = cv2.imencode(".jpg", warped, [cv2.IMWRITE_JPEG_QUALITY, 92])
    return buffer.tobytes()


async def _process_scan(doc_id: str):
    from sqlalchemy import select
    from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

    from app.config import settings
    from app.models.document import Document
    from app.storage import get_storage_backend

    engine = create_async_engine(settings.database_url)
    session_factory = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)
    storage = get_storage_backend()

    async with session_factory() as db:
        result = await db.execute(select(Document).where(Document.id == uuid.UUID(doc_id)))
        doc = result.scalar_one_or_none()
        if not doc:
            return

        if not doc.mime_type.startswith("image/"):
            return

        # Multi-page? Delegate to multipage handler
        page_keys = (doc.custom_metadata or {}).get("page_keys", [])
        if page_keys:
            await _scan_pages(storage, db, doc, page_keys)
            await engine.dispose()
            return

        try:
            file_data = await storage.get(doc.storage_key)
            cropped = scan_document(file_data)

            if cropped is None:
                logger.info(f"Scan: No document found in {doc_id}, keeping original")
                return

            original_key = doc.storage_key.replace("/v1/", "/v1/original_")
            await storage.put(original_key, io.BytesIO(file_data), doc.mime_type)
            await storage.put(doc.storage_key, io.BytesIO(cropped), "image/jpeg")

            doc.file_size = len(cropped)
            doc.mime_type = "image/jpeg"
            doc.custom_metadata = {**(doc.custom_metadata or {}), "scanned": True, "original_key": original_key}
            await db.commit()
            logger.info(f"Scan: Document {doc_id} cropped ({len(file_data)} -> {len(cropped)} bytes)")

        except Exception as e:
            logger.error(f"Scan: Failed for {doc_id}: {e}")

    await engine.dispose()


async def _scan_pages(storage, db, doc, page_keys):
    """Scan each page of a multi-page document."""
    scanned = 0
    for key in page_keys:
        try:
            file_data = await storage.get(key)

            import magic as libmagic
            mime = libmagic.from_buffer(file_data[:2048], mime=True)
            if not mime.startswith("image/"):
                continue

            cropped = scan_document(file_data)
            if cropped:
                await storage.put(key, io.BytesIO(cropped), "image/jpeg")
                scanned += 1
                logger.info(f"Scan: Cropped page {key}")
            else:
                logger.info(f"Scan: No document found in page {key}, keeping original")
        except Exception as e:
            logger.error(f"Scan: Failed for page {key}: {e}")

    if scanned > 0:
        doc.custom_metadata = {**(doc.custom_metadata or {}), "scanned": True, "scanned_pages": scanned}
        await db.commit()
    logger.info(f"Scan: {scanned}/{len(page_keys)} pages cropped for {doc.id}")


@celery_app.task(bind=True, max_retries=1, default_retry_delay=10)
def process_document_scan(self, doc_id: str):
    logger.info(f"Scan task started for {doc_id}")
    try:
        _run_async(_process_scan(doc_id))
    except Exception as exc:
        logger.error(f"Scan task error for {doc_id}: {exc}")
        raise self.retry(exc=exc)


@celery_app.task(bind=True, max_retries=1, default_retry_delay=10)
def process_multipage_scan(self, doc_id: str):
    logger.info(f"Multipage scan task started for {doc_id}")
    try:
        _run_async(_process_scan(doc_id))
    except Exception as exc:
        logger.error(f"Multipage scan task error for {doc_id}: {exc}")
        raise self.retry(exc=exc)
