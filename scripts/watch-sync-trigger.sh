#!/bin/bash
# watch-sync-trigger.sh
# Host-side watcher: when sansan writes /data/ipc/main/sync-trigger, run sync.sh
# Runs as a LaunchAgent, polls every 10 seconds

TRIGGER="/Users/macbook/Dev/nanoclaw-private/data/ipc/main/sync-trigger"
SYNC_SCRIPT="/Users/macbook/Dev/sansan-knowledge/sync.sh"
LOG="/tmp/sansan-sync.log"

echo "[$(date -u +%Y-%m-%dT%H:%M:%SZ)] sync watcher started" >> "$LOG"

while true; do
  if [ -f "$TRIGGER" ]; then
    REQUESTED_AT=$(cat "$TRIGGER")
    echo "[$(date -u +%Y-%m-%dT%H:%M:%SZ)] sync trigger detected (requested: $REQUESTED_AT)" >> "$LOG"
    rm -f "$TRIGGER"
    bash "$SYNC_SCRIPT" >> "$LOG" 2>&1
    echo "[$(date -u +%Y-%m-%dT%H:%M:%SZ)] sync complete" >> "$LOG"
  fi
  sleep 10
done
