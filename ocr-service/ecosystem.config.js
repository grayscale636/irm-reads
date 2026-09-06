module.exports = {
  apps: [{
    name: 'irmreads-ocr',
    script: './venv/bin/uvicorn',
    args: 'ocr_service:app --host 127.0.0.1 --port 8222',
    cwd: '/home/gery/Documents/projects/productivity/irm-reads/ocr-service',
    interpreter: 'none',
    instances: 1,
    exec_mode: 'fork',
    env: {
      OCR_LANG: 'latin',
      OCR_DPI: '200',
      OCR_DET_MODEL: 'PP-OCRv5_mobile_det',
      OCR_REC_MODEL: 'PP-OCRv5_mobile_rec',
      PADDLE_PDX_DISABLE_MODEL_SOURCE_CHECK: 'True',
      OCR_PORT: '8222'
    },
    max_memory_restart: '2500M',
    log_date_format: 'YYYY-MM-DD HH:mm:ss',
    error_file: './logs/error.log',
    out_file: './logs/out.log',
    merge_logs: true,
    max_restarts: 5,
    min_uptime: '20s',
    restart_delay: 10000,
    watch: false,
    kill_timeout: 30000
  }]
};
