#!/usr/bin/env python3
"""
Scraper เต็มรูปแบบสำหรับ https://xn--12c1ezaww.com (รักหี.com)
ดึงทุกหน้าอัตโนมัติ → เข้าไปในแต่ละคลิป → รวมเป็น JSON
"""

import requests
from bs4 import BeautifulSoup
import json
import time
import re
import os
from urllib.parse import urljoin, unquote

BASE_URL = "https://xn--12c1ezaww.com"
HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/120.0.0.0 Safari/537.36"
    ),
    "Accept-Language": "th-TH,th;q=0.9,en;q=0.8",
}

# ปรับความเร็วได้ตรงนี้
DELAY_BETWEEN_LIST = 1.5      # หน่วงระหว่างหน้า list
DELAY_BETWEEN_VIDEO = 1.2     # หน่วงระหว่างแต่ละคลิป
OUTPUT_FILE = "videos.json"
PROGRESS_FILE = "progress.json"   # บันทึกความคืบหน้าเผื่อรันต่อ

session = requests.Session()
session.headers.update(HEADERS)


def get_page_html(url: str) -> str | None:
    try:
        resp = session.get(url, timeout=25)
        resp.raise_for_status()
        resp.encoding = "utf-8"
        return resp.text
    except Exception as e:
        print(f"[ERROR] โหลดไม่สำเร็จ: {url} → {e}")
        return None


def get_max_page(html: str) -> int:
    """หาหมายเลขหน้าสุดท้ายจาก pagination"""
    soup = BeautifulSoup(html, "html.parser")
    max_page = 1

    for a in soup.select("a.pagination-link, .pagination a, a.page-numbers, .pagination-list a"):
        href = a.get("href", "")
        m = re.search(r"/page/(\d+)/?", href)
        if m:
            max_page = max(max_page, int(m.group(1)))
        # บางทีเลขหน้าอยู่ใน text
        text = a.get_text(strip=True)
        if text.isdigit():
            max_page = max(max_page, int(text))

    return max_page


def extract_video_links_from_listing(html: str) -> list[str]:
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


def scrape_video_detail(url: str) -> dict | None:
    html = get_page_html(url)
    if not html:
        return None

    soup = BeautifulSoup(html, "html.parser")

    title_tag = soup.select_one("h1.is-size-5") or soup.select_one("h1")
    title = title_tag.get_text(strip=True) if title_tag else ""

    # embed URL
    embed_url = None
    meta_embed = soup.find("meta", attrs={"itemprop": "embedURL"})
    if meta_embed and meta_embed.get("content"):
        embed_url = meta_embed["content"].strip()
    if not embed_url:
        iframe = soup.select_one("iframe[src*='lumierecore.com']")
        if iframe and iframe.get("src"):
            embed_url = iframe["src"].split("?")[0].strip()

    # thumbnail
    thumb = None
    meta_thumb = soup.find("meta", attrs={"itemprop": "thumbnailUrl"})
    if meta_thumb and meta_thumb.get("content"):
        thumb = meta_thumb["content"].strip()
    if not thumb:
        og = soup.find("meta", property="og:image")
        if og and og.get("content"):
            thumb = og["content"].strip()

    # duration
    duration = None
    meta_dur = soup.find("meta", attrs={"itemprop": "duration"})
    if meta_dur and meta_dur.get("content"):
        m = re.match(r"PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?", meta_dur["content"])
        if m:
            h, mi, s = (int(x) if x else 0 for x in m.groups())
            duration = f"{h}:{mi:02d}:{s:02d}" if h else f"{mi}:{s:02d}"

    views = soup.select_one("#views")
    likes = soup.select_one("#likes")
    views = views.get_text(strip=True) if views else None
    likes = likes.get_text(strip=True) if likes else None

    category = None
    cat = soup.select_one(".video-categories a.tag, a.tag.is-warning")
    if cat:
        category = cat.get_text(strip=True)

    tags = []
    for t in soup.select(".video-tags a.tag"):
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
    }


def load_progress():
    if os.path.exists(PROGRESS_FILE):
        with open(PROGRESS_FILE, "r", encoding="utf-8") as f:
            return json.load(f)
    return {"done_pages": [], "videos": [], "seen_urls": []}


def save_progress(data):
    with open(PROGRESS_FILE, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)


def main():
    print("กำลังตรวจสอบจำนวนหน้าทั้งหมด...")
    first_html = get_page_html(BASE_URL + "/")
    if not first_html:
        print("โหลดหน้าแรกไม่ได้ ออกจากโปรแกรม")
        return

    max_page = get_max_page(first_html)
    print(f"พบทั้งหมดประมาณ {max_page} หน้า")

    # โหลดความคืบหน้าเดิม (ถ้ามี)
    progress = load_progress()
    all_videos = progress.get("videos", [])
    seen_urls = set(progress.get("seen_urls", []))
    done_pages = set(progress.get("done_pages", []))

    print(f"มีข้อมูลเดิมอยู่แล้ว {len(all_videos)} คลิป (หน้าทำไปแล้ว {len(done_pages)} หน้า)")

    for page_num in range(1, max_page + 1):
        if page_num in done_pages:
            print(f"ข้ามหน้า {page_num} (ทำไปแล้ว)")
            continue

        list_url = BASE_URL + "/" if page_num == 1 else f"{BASE_URL}/page/{page_num}/"
        print(f"\n=== หน้า {page_num}/{max_page} → {list_url} ===")

        html = get_page_html(list_url)
        if not html:
            print("ข้ามหน้านี้เพราะโหลดไม่ได้")
            time.sleep(DELAY_BETWEEN_LIST)
            continue

        video_links = extract_video_links_from_listing(html)
        print(f"พบ {len(video_links)} คลิปในหน้านี้")

        if not video_links:
            print("ไม่มีคลิปแล้ว หยุด")
            break

        for i, link in enumerate(video_links, 1):
            if link in seen_urls:
                continue
            seen_urls.add(link)

            print(f"  [{i}/{len(video_links)}] {link}")
            detail = scrape_video_detail(link)
            if detail:
                all_videos.append(detail)
                print(f"      ✓ {detail.get('title', '')[:55]}...")
            else:
                print("      ✗ ดึงไม่สำเร็จ")

            time.sleep(DELAY_BETWEEN_VIDEO)

        # บันทึกความคืบหน้าทุกหน้า
        done_pages.add(page_num)
        progress = {
            "done_pages": sorted(done_pages),
            "videos": all_videos,
            "seen_urls": list(seen_urls),
        }
        save_progress(progress)

        # บันทึก videos.json ด้วย
        with open(OUTPUT_FILE, "w", encoding="utf-8") as f:
            json.dump(all_videos, f, ensure_ascii=False, indent=2)

        print(f"บันทึกความคืบหน้าแล้ว (รวม {len(all_videos)} คลิป)")
        time.sleep(DELAY_BETWEEN_LIST)

    print(f"\n✅ เสร็จสิ้นทั้งหมด!")
    print(f"รวมวิดีโอ: {len(all_videos)} คลิป")
    print(f"ไฟล์หลัก: {OUTPUT_FILE}")
    print(f"ไฟล์ความคืบหน้า: {PROGRESS_FILE}")


if __name__ == "__main__":
    main()
