#!/usr/bin/env python3
"""
อัปเดต videos.json ด้วยคลิปใหม่จากหน้า 1-2 สำหรับ https://xn--y3ctbg6b.com (หอมหี.com)
- โหลดไฟล์เดิม
- ดึงเฉพาะหน้าแรก + หน้า 2
- เพิ่มเฉพาะคลิปที่ยังไม่มี (เช็คจาก page_url)
- บันทึกทับไฟล์เดิม
"""

import requests
from bs4 import BeautifulSoup
import json
import time
import re
import os
import sys
import functools
from urllib.parse import urljoin, unquote
from datetime import datetime

# บังคับให้แสดงผล log แบบเรียลไทม์ทันทีโดยไม่ค้างใน buffer
if sys.platform == "win32":
    import io
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace", line_buffering=True)
    sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding="utf-8", errors="replace", line_buffering=True)
else:
    sys.stdout.reconfigure(line_buffering=True)
    sys.stderr.reconfigure(line_buffering=True)

print = functools.partial(print, flush=True)

BASE_URL = "https://xn--y3ctbg6b.com"
OUTPUT_FILE = "videos.json"
HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/120.0.0.0 Safari/537.36"
    ),
    "Accept-Language": "th-TH,th;q=0.9,en;q=0.8",
}

DELAY = 1.2  # หน่วงระหว่างแต่ละคลิป

session = requests.Session()
session.headers.update(HEADERS)


def get_page_html(url: str) -> str | None:
    try:
        resp = session.get(url, timeout=20)
        resp.raise_for_status()
        resp.encoding = "utf-8"
        return resp.text
    except Exception as e:
        print(f"[ERROR] {url} → {e}")
        return None


def extract_video_links(html: str) -> list[str]:
    soup = BeautifulSoup(html, "html.parser")
    links = set()

    for a in soup.select("a.post-video[href]"):
        href = a.get("href", "").strip()
        if href and "/page/" not in href:
            links.add(urljoin(BASE_URL, href))

    # fallback
    for a in soup.select("div.loop-video a[href], .thumb-block a[href]"):
        href = a.get("href", "").strip()
        if re.search(r"/\d+/?$", href) or any(k in unquote(href) for k in ["onlyfans", "คลิปหลุด", "mlive"]):
            full = urljoin(BASE_URL, href)
            if "/page/" not in full:
                links.add(full)

    return sorted(links)


CACHE_FILE = "embed_cache.json"

def load_cache():
    if os.path.exists(CACHE_FILE):
        try:
            with open(CACHE_FILE, "r", encoding="utf-8") as f:
                return json.load(f)
        except Exception:
            pass
    return {}

def save_cache(cache_dict):
    try:
        with open(CACHE_FILE, "w", encoding="utf-8") as f:
            json.dump(cache_dict, f, ensure_ascii=False, indent=2)
    except Exception:
        pass

embed_cache = load_cache()

def resolve_masteplayer(embed_url: str | None) -> tuple[str | None, str | None]:
    if not embed_url:
        return embed_url, None
    if embed_url in embed_cache and embed_cache[embed_url].get("embed_url") and "mixapi" not in embed_cache[embed_url]["embed_url"]:
        return embed_cache[embed_url].get("embed_url", embed_url), embed_cache[embed_url].get("duration")

    embed_clean = embed_url
    if "mixapi.masteplayers.com/e/" in embed_url or "masteplayers.com/e/" in embed_url:
        try:
            r = session.get(embed_url, headers={
                "User-Agent": HEADERS["User-Agent"],
                "Referer": BASE_URL + "/"
            }, timeout=8)
            uid_m = re.search(r'const uid = "([^"]+)"', r.text)
            ts_m = re.search(r'const timestamp = "([^"]+)"', r.text)
            token_m = re.search(r'const token = "([^"]+)"', r.text)
            if uid_m and ts_m and token_m:
                post_headers = {
                    "User-Agent": HEADERS["User-Agent"],
                    "Referer": embed_url,
                    "X-Player-Host": "mixapi.masteplayers.com",
                    "X-Player-Origin": "https://mixapi.masteplayers.com",
                    "X-Player-Referer": BASE_URL + "/",
                    "X-Ref-Host": "xn--y3ctbg6b.com"
                }
                resp = session.post("https://mixapi.masteplayers.com/api/player-data", data={
                    "uid": uid_m.group(1),
                    "timestamp": ts_m.group(1),
                    "token": token_m.group(1),
                    "page_host": "mixapi.masteplayers.com",
                    "page_origin": "https://mixapi.masteplayers.com",
                    "page_href": embed_url,
                    "ref_host": "xn--y3ctbg6b.com"
                }, headers=post_headers, timeout=8)
                j = resp.json()
                if j.get("playlistIframe") and len(j["playlistIframe"]) > 0:
                    embed_clean = j["playlistIframe"][0]
        except Exception:
            pass

    dur_str = None
    m = re.search(r'/embed/([a-f0-9]+)', embed_clean)
    if m:
        video_id = m.group(1)
        try:
            master_url = f"https://masteplayers.com/hlsr2/{video_id}/master.m3u8"
            mr = session.get(master_url, headers={"Referer": "https://masteplayers.com/"}, timeout=6)
            if mr.status_code == 200:
                index_urls = [line.strip() for line in mr.text.split("\n") if line.strip().startswith("http") or "/index" in line]
                if index_urls:
                    ir = session.get(index_urls[0], headers={"Referer": "https://masteplayers.com/"}, timeout=6)
                    if ir.status_code == 200:
                        extinfs = [float(x) for x in re.findall(r'#EXTINF:([0-9\.]+),', ir.text)]
                        if extinfs:
                            total_sec = int(sum(extinfs))
                            h = total_sec // 3600
                            mi = (total_sec % 3600) // 60
                            s = total_sec % 60
                            dur_str = f"{h}:{mi:02d}:{s:02d}" if h else f"{mi}:{s:02d}"
        except Exception:
            pass

    embed_cache[embed_url] = {"embed_url": embed_clean, "duration": dur_str}
    save_cache(embed_cache)
    return embed_clean, dur_str


def scrape_video_detail(url: str) -> dict | None:
    html = get_page_html(url)
    if not html:
        return None

    soup = BeautifulSoup(html, "html.parser")

    title_tag = soup.select_one("h1.is-size-5") or soup.select_one("h1")
    title = title_tag.get_text(strip=True) if title_tag else ""

    embed_url = None
    meta_embed = soup.find("meta", attrs={"itemprop": "embedURL"})
    if meta_embed and meta_embed.get("content"):
        embed_url = meta_embed["content"].strip()
    if not embed_url:
        for ifr in soup.select("iframe[src]"):
            src = ifr["src"]
            if any(k in src for k in ["masteplayers", "lumierecore", "mixapi", "embed", "player"]):
                embed_url = src.split("?")[0].strip()
                break
    if not embed_url:
        ifr = soup.select_one("div.video-player-wrapper iframe, #main-player-wrapper iframe, .responsive-player iframe, iframe")
        if ifr and ifr.get("src"):
            embed_url = ifr["src"].split("?")[0].strip()

    thumb = None
    meta_thumb = soup.find("meta", attrs={"itemprop": "thumbnailUrl"})
    if meta_thumb and meta_thumb.get("content"):
        thumb = meta_thumb["content"].strip()
    if not thumb:
        og = soup.find("meta", property="og:image")
        if og and og.get("content"):
            thumb = og["content"].strip()

    duration = None
    meta_dur = soup.find("meta", attrs={"itemprop": "duration"})
    if meta_dur and meta_dur.get("content"):
        m = re.match(r"PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?", meta_dur["content"])
        if m:
            h, mi, s = (int(x) if x else 0 for x in m.groups())
            duration = f"{h}:{mi:02d}:{s:02d}" if h else f"{mi}:{s:02d}"

    # Resolve masteplayer clean embed and exact duration if not present
    if embed_url and ("masteplayer" in embed_url or "mixapi" in embed_url):
        embed_url, resolved_dur = resolve_masteplayer(embed_url)
        if not duration and resolved_dur:
            duration = resolved_dur

    views_el = soup.select_one("#views-count") or soup.select_one("#views")
    likes_el = soup.select_one("#likes-count") or soup.select_one("#likes")
    views = views_el.get_text(strip=True) if views_el else None
    likes = likes_el.get_text(strip=True) if likes_el else None

    category = None
    cat = soup.select_one(".video-categories a.tag") or soup.select_one("a.tag.is-warning") or soup.select_one(".post-category span")
    if cat:
        category = cat.get_text(strip=True)

    tags = []
    for t in soup.select(".video-tags a.tag, .video-tags a"):
        txt = t.get_text(strip=True)
        if txt and txt not in tags:
            tags.append(txt)

    author = None
    author_a = soup.select_one(".video-author a")
    if author_a:
        author = author_a.get_text(strip=True)

    if not embed_url and not title:
        return None

    return {
        "title": title,
        "page_url": url,
        "embed_url": embed_url,
        "thumbnail": thumb,
        "duration": duration,
        "views": views,
        "likes": likes,
        "category": category,
        "tags": tags,
        "author": author,
        "scraped_at": datetime.now().isoformat(timespec="seconds"),
    }


def load_existing() -> list[dict]:
    if not os.path.exists(OUTPUT_FILE):
        print(f"ไม่พบไฟล์ {OUTPUT_FILE} → จะสร้างใหม่")
        return []
    with open(OUTPUT_FILE, "r", encoding="utf-8") as f:
        data = json.load(f)
    print(f"โหลดคลิปเดิม: {len(data)} รายการ")
    return data


def main():
    existing = load_existing()
    existing_urls = {v["page_url"] for v in existing if "page_url" in v}

    pages = [
        BASE_URL + "/",
        BASE_URL + "/page/2/",
    ]

    new_videos = []
    checked = 0

    for list_url in pages:
        print(f"\n=== ตรวจสอบ: {list_url} ===")
        html = get_page_html(list_url)
        if not html:
            continue

        links = extract_video_links(html)
        print(f"พบ {len(links)} ลิงก์")

        for i, link in enumerate(links, 1):
            checked += 1
            if link in existing_urls:
                print(f"  [{i}] มีอยู่แล้ว → ข้าม")
                continue

            print(f"  [{i}] คลิปใหม่! → {link}")
            detail = scrape_video_detail(link)
            if detail:
                detail["is_new"] = True
                new_videos.append(detail)
                existing_urls.add(link)  # กันซ้ำในรอบนี้
                print(f"       ✓ {detail['title'][:60]}...")
            else:
                print("       ✗ ดึงไม่สำเร็จ")

            time.sleep(DELAY)

    if not new_videos:
        print("\nไม่มีคลิปใหม่")
        return

    # ล้างแท็ก is_new ของคลิปเก่าทั้งหมดในฐานข้อมูล
    for v in existing:
        v["is_new"] = False

    # ใส่คลิปใหม่ไว้ด้านหน้า (คลิปใหม่ขึ้นก่อน)
    updated = new_videos + existing

    with open(OUTPUT_FILE, "w", encoding="utf-8") as f:
        json.dump(updated, f, ensure_ascii=False, indent=2)

    # อัปเดต progress.json ด้วยถ้ามี
    progress_file = "progress.json"
    try:
        if os.path.exists(progress_file):
            with open(progress_file, "r", encoding="utf-8") as f:
                pdata = json.load(f)
            pdata["videos"] = updated
            pdata["seen_urls"] = list(existing_urls)
            with open(progress_file, "w", encoding="utf-8") as f:
                json.dump(pdata, f, ensure_ascii=False, indent=2)
        else:
            with open(progress_file, "w", encoding="utf-8") as f:
                json.dump(updated, f, ensure_ascii=False, indent=2)
    except Exception as e:
        print(f"[WARN] ไม่สามารถอัปเดต {progress_file}: {e}")

    print(f"\n✅ อัปเดตเสร็จ!")
    print(f"   คลิปใหม่ที่เพิ่ม: {len(new_videos)} (ติดแท็ก NEW)")
    print(f"   รวมทั้งหมดตอนนี้: {len(updated)}")
    print(f"   บันทึกที่: {OUTPUT_FILE}")


if __name__ == "__main__":
    main()
