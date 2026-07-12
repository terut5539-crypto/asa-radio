#!/usr/bin/env python3
# episodes.json + feed/audio の音声から podcast.xml を再生成する。
import json, os, subprocess, html
FEED = "/Users/hainodaiki/asa-radio-feed"
OWNER, REPO = "terut5539-crypto", "asa-radio"
BASE = f"https://{OWNER}.github.io/{REPO}"
eps = json.load(open(f"{FEED}/episodes.json"))

def ffdur(path):
    try:
        out = subprocess.check_output(["ffprobe","-v","error","-show_entries","format=duration","-of","csv=p=0",path]).decode().strip()
        s = int(float(out)); return s, f"{s//3600:02d}:{(s%3600)//60:02d}:{s%60:02d}"
    except Exception: return 0, "00:00:00"

items = []
for ep in eps:
    audio = f"{FEED}/audio/{ep['slug']}.m4a"
    if not os.path.exists(audio):        # まだ生成できてない回は飛ばす
        continue
    size = os.path.getsize(audio); dur_s, dur = ffdur(audio)
    t = html.escape(ep["title"]); d = html.escape(ep["desc"])
    items.append(f"""    <item>
      <title>{t}</title>
      <description>{d}</description>
      <itunes:summary>{d}</itunes:summary>
      <pubDate>{ep['pubDate']}</pubDate>
      <enclosure url="{BASE}/audio/{ep['slug']}.m4a" length="{size}" type="audio/x-m4a"/>
      <guid isPermaLink="false">asa-radio-{ep['slug']}</guid>
      <itunes:duration>{dur}</itunes:duration>
      <itunes:image href="{BASE}/cover.png"/>
      <itunes:explicit>false</itunes:explicit>
    </item>""")

desc = "フリーランスのマーケター向けに、広告運用・AI・マーケの最新を2人のホストが深掘りする朝の音声番組。要約ではなく、いつの情報か・出典・こう使えるまで。"
xml = f"""<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:itunes="http://www.itunes.com/dtds/podcast-1.0.dtd" xmlns:content="http://purl.org/rss/1.0/modules/content/">
  <channel>
    <title>朝ラジオ（ハイノ専用）</title>
    <link>{BASE}/</link>
    <language>ja</language>
    <description>{desc}</description>
    <itunes:author>灰野</itunes:author>
    <itunes:summary>{desc}</itunes:summary>
    <itunes:explicit>false</itunes:explicit>
    <itunes:image href="{BASE}/cover.png"/>
    <itunes:category text="Business"><itunes:category text="Marketing"/></itunes:category>
    <itunes:owner><itunes:name>灰野</itunes:name><itunes:email>terut5539@gmail.com</itunes:email></itunes:owner>
{chr(10).join(items)}
  </channel>
</rss>
"""
open(f"{FEED}/podcast.xml","w").write(xml)
print(f"podcast.xml 再生成: {len(items)}エピソード")
for ep in eps:
    print("  -", "OK " if os.path.exists(f"{FEED}/audio/{ep['slug']}.m4a") else "無 ", ep["slug"])
