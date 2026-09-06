#!/bin/bash
set -e
cd /home/gery/Documents/projects/productivity/irm-reads/ocr-service
PIP="./venv/bin/pip"
echo "[1/3] Installing paddlepaddle CPU 3.2.0 (Baidu mirror)..."
$PIP install "paddlepaddle==3.2.0" -i https://www.paddlepaddle.org.cn/packages/stable/cpu/ 2>&1 | tail -5
echo "[2/3] Installing paddleocr + web deps..."
$PIP install "paddleocr>=3.4" fastapi uvicorn python-multipart pymupdf pillow 2>&1 | tail -15
echo "[3/3] Verifying imports..."
./venv/bin/python -c "import paddle; print('paddle', paddle.__version__)"
./venv/bin/python -c "import paddleocr; print('paddleocr', paddleocr.__version__)"
./venv/bin/python -c "import fitz; print('pymupdf', fitz.__doc__.split(chr(10))[0] if fitz.__doc__ else 'ok')"
echo "DONE_INSTALL"
