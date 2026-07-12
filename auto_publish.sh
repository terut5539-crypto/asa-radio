#!/bin/bash
# 音声(feed/audio/*.m4a)が揃うのを待って RSS再生成→push する。
FEED="/Users/hainodaiki/asa-radio-feed"
LOG="$FEED/auto_publish.log"
export PATH="/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin"
echo "=== $(date) auto_publish start ===" >> "$LOG"
for i in $(seq 1 55); do
  n=$(ls "$FEED/audio/ep002"*.m4a "$FEED/audio/ep003"*.m4a "$FEED/audio/ep004"*.m4a 2>/dev/null | wc -l | tr -d ' ')
  echo "$(date) new audios=$n" >> "$LOG"
  [ "$n" -ge 3 ] && break
  sleep 60
done
python3 "$FEED/publish.py" >> "$LOG" 2>&1
cd "$FEED" || exit 1
git config http.postBuffer 524288000
git add -A >> "$LOG" 2>&1
git -c user.name="灰野" -c user.email="terut5539@gmail.com" commit -m "朝ラジオ 自動更新 $(date +%F)" >> "$LOG" 2>&1
git push origin main >> "$LOG" 2>&1 && echo "$(date) PUSH OK" >> "$LOG" || echo "$(date) PUSH FAILED" >> "$LOG"
launchctl unload "$HOME/Library/LaunchAgents/com.haino.asa-radio-publish.plist" 2>/dev/null
echo "=== $(date) done ===" >> "$LOG"
