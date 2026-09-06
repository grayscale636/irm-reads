#!/usr/bin/env python3
"""
IRM Reads — OCR microservice (PaddleOCR by Baidu, CPU only).

Exposes:
  GET  /health                 -> { status: "ok", model_loaded: bool }
  POST /ocr                    -> multipart file (PDF / PNG / JPG / JPEG / WEBP / BMP / TIFF)
                                 returns per-page recognized text.

Runs on CPU only (no GPU). Uses PaddleOCR 3.x (Baidu) with the Latin script model,
which covers Indonesian + English. PDF pages are rendered with PyMuPDF; pages that
already contain an embedded text layer are read directly (faster + more accurate),
and only image-only pages are OCR'd.
"""

import os
import io
import time
import logging

import numpy as np
from fastapi import FastAPI, File, UploadFile, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from PIL import Image

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s %(message)s")
log = logging.getLogger("ocr-service")

# ---------------------------------------------------------------------------
# Config (env-overridable)
# ---------------------------------------------------------------------------
OCR_LANG = os.environ.get("OCR_LANG", "latin")       # "latin" covers id+en; "en" is lighter
OCR_DPI = int(os.environ.get("OCR_DPI", "200"))       # render DPI for PDF pages
# Mobile models keep RAM/CPU low (no GPU on this host). Override with server models
# if you ever add a GPU and want higher accuracy.
OCR_DET_MODEL = os.environ.get("OCR_DET_MODEL", "PP-OCRv5_mobile_det")
OCR_REC_MODEL = os.environ.get("OCR_REC_MODEL", "PP-OCRv5_mobile_rec")

# Models are already cached in ~/.paddlex/official_models; skip the slow
# connectivity probe on every boot.
os.environ.setdefault("PADDLE_PDX_DISABLE_MODEL_SOURCE_CHECK", "True")
MIN_TEXT_CHARS = int(os.environ.get("MIN_TEXT_CHARS", "25"))  # below this -> OCR the page
MAX_PAGES = int(os.environ.get("MAX_PAGES", "0"))     # 0 = unlimited (any page count)

SUPPORTED_IMG = {".png", ".jpg", ".jpeg", ".webp", ".bmp", ".tif", ".tiff"}
SUPPORTED_PDF = {".pdf"}

app = FastAPI(title="IRM Reads OCR", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

_ocr = None
_load_error = None

# In-memory progress tracking for long OCR jobs (single instance, one book at a time).
_jobs: dict = {}


def get_ocr():
    """Lazily construct the PaddleOCR pipeline (CPU) and cache it."""
    global _ocr, _load_error
    if _ocr is not None:
        return _ocr
    if _load_error is not None:
        raise RuntimeError(_load_error)
    log.info("Loading PaddleOCR (lang=%s, CPU)...", OCR_LANG)
    try:
        from paddleocr import PaddleOCR

        _ocr = PaddleOCR(
            use_doc_orientation_classify=False,
            use_doc_unwarping=False,
            use_textline_orientation=False,
            text_detection_model_name=OCR_DET_MODEL,
            text_recognition_model_name=OCR_REC_MODEL,
            lang=OCR_LANG,
        )
        log.info("PaddleOCR ready.")
        return _ocr
    except Exception as e:  # noqa: BLE001
        _load_error = f"Failed to load PaddleOCR: {e}"
        log.exception(_load_error)
        raise RuntimeError(_load_error)


def ocr_image_bytes(img_bytes: bytes) -> str:
    """OCR a single image (PNG/JPEG bytes) and return recognized text."""
    ocr = get_ocr()
    img = Image.open(io.BytesIO(img_bytes))
    img = img.convert("RGB")
    arr = np.asarray(img)
    result = ocr.predict(input=arr)
    lines: list[str] = []
    for res in result:
        try:
            texts = res["rec_texts"] or []
        except Exception:  # noqa: BLE001
            texts = []
        for t in texts:
            t = (t or "").strip()
            if t:
                lines.append(t)
    return "\n".join(lines)


def render_page(doc, page_index: int, dpi: int) -> bytes:
    page = doc.load_page(page_index)
    pix = page.get_pixmap(dpi=dpi, colorspace="rgb")
    return pix.tobytes("png")


def extract_text_layer(doc, page_index: int) -> str:
    try:
        return doc.load_page(page_index).get_text("text") or ""
    except Exception:  # noqa: BLE001
        return ""


def process_pdf(data: bytes, job_id: str | None = None) -> dict:
    import pymupdf as fitz  # PyMuPDF (1.28+: "fitz" alias is deprecated)

    doc = fitz.open(stream=data, filetype="pdf")
    total = doc.page_count
    if MAX_PAGES and total > MAX_PAGES:
        total = MAX_PAGES

    pages: list[dict] = []
    full_parts: list[str] = []
    for i in range(total):
        if job_id:
            _jobs[job_id] = {"page": i + 1, "total": total, "status": "processing"}
        embedded = extract_text_layer(doc, i).strip()
        if len(embedded) >= MIN_TEXT_CHARS:
            text = embedded
            method = "text-layer"
        else:
            png = render_page(doc, i, OCR_DPI)
            text = ocr_image_bytes(png)
            method = "ocr"
        text = text.strip()
        pages.append({"page": i + 1, "text": text, "method": method})
        if text:
            full_parts.append(text)

    doc.close()
    return {
        "pageCount": total,
        "pages": pages,
        "text": "\n\n".join(full_parts),
    }


def process_image(data: bytes) -> dict:
    text = ocr_image_bytes(data)
    return {
        "pageCount": 1,
        "pages": [{"page": 1, "text": text.strip(), "method": "ocr"}],
        "text": text.strip(),
    }


@app.get("/progress/{job_id}")
def progress(job_id: str):
    j = _jobs.get(job_id)
    if not j:
        return {"status": "unknown"}
    return j


@app.get("/health")
def health():
    return {"status": "ok", "model_loaded": _ocr is not None, "lang": OCR_LANG}


@app.post("/ocr")
async def ocr_endpoint(file: UploadFile = File(...), job_id: str | None = None):
    filename = (file.filename or "").lower()
    ext = os.path.splitext(filename)[1]
    data = await file.read()
    if not data:
        raise HTTPException(status_code=400, detail="Empty file")

    t0 = time.time()
    try:
        if ext in SUPPORTED_PDF:
            out = process_pdf(data, job_id)
        elif ext in SUPPORTED_IMG:
            out = process_image(data)
        else:
            raise HTTPException(
                status_code=400,
                detail=f"Unsupported file type '{ext}'. Use PDF or an image.",
            )
    except HTTPException:
        if job_id:
            _jobs[job_id] = {"page": 0, "total": 0, "status": "error"}
        raise
    except Exception as e:  # noqa: BLE001
        log.exception("OCR failed for %s", filename)
        if job_id:
            _jobs[job_id] = {"page": 0, "total": 0, "status": "error", "error": str(e)}
        raise HTTPException(status_code=500, detail=f"OCR failed: {e}")

    if job_id:
        _jobs[job_id] = {"page": out["pageCount"], "total": out["pageCount"], "status": "done"}

    out["elapsedMs"] = int((time.time() - t0) * 1000)
    out["filename"] = filename
    return out


@app.get("/")
def root():
    return {"service": "irm-reads-ocr", "docs": "/docs", "health": "/health"}


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="127.0.0.1", port=int(os.environ.get("OCR_PORT", "8222")))
