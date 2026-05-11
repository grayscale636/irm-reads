#!/bin/bash
echo "=== IRM Reads Deploy ==="
REPO_DIR="/home/gery/Documents/projects/productivity/irm-reads"
START_TIME=$(date +%s)
WEBHOOK="https://discord.com/api/webhooks/1394595057905958923/Eq7RrMQYPSODInBLmb5drZjyPvfRsqyUvEmZqNCLPbM4HGxwBHove2E-S1Wa31EWl5VD"

send_notif() {
  local status="$1"
  local color="$2"
  local desc="$3"
  local END_TIME=$(date +%s)
  local DURATION=$((END_TIME - START_TIME))
  local MINS=$((DURATION / 60))
  local SECS=$((DURATION % 60))

  curl -s -X POST "$WEBHOOK" \
    -H "Content-Type: application/json" \
    -d '{
      "username": "IRM-Notification",
      "embeds": [{
        "title": "irm-reads",
        "color": '"$color"',
        "description": "'"$desc"'",
        "fields": [
          {"name": "Status", "value": "'"$status"'", "inline": true},
          {"name": "Duration", "value": "'"$MINS"m "$SECS"s'", "inline": true},
          {"name": "Branch", "value": "master", "inline": true}
        ],
        "footer": {"text": "irmlabs-de001 \u2022 Jenkins"}
      }]
    }' > /dev/null 2>&1 || true
}

# Pull
cd "$REPO_DIR" || exit 1
git pull origin master

# Build frontend
echo "--- Building frontend ---"
cd "$REPO_DIR/read-dash" && npm install && npm run build:dev

# Build API
echo "--- Building API ---"
cd "$REPO_DIR/read-dash-api" && npm install && npm run build

# Restart
echo "--- Restarting services ---"
cd "$REPO_DIR/read-dash" && pm2 startOrRestart ecosystem.config.cjs --env production
cd "$REPO_DIR/read-dash-api" && pm2 startOrRestart ecosystem.config.js --env production

# Success notification
send_notif "SUCCESS" 5763719 "Deploy completed successfully!"
echo "=== Deploy Complete ==="
