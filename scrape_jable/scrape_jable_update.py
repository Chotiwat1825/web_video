#!/usr/bin/env python3
"""
Scraper for latest updates from Jable.tv (Pages 1-2)
- Scrapes new video links from https://jable.tv/latest-updates/
- Extracts .m3u8 streams, titles, actors, duration, and covers
- Adds new videos to progress.json and playlists/4_JAV_Update.json
"""

import os
import sys
import json
import re
import time
import functools
from playwright.sync_api import sync_playwright

if sys.platform == "win32":
    import io
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace", line_buffering=True)
    sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding="utf-8", errors="replace", line_buffering=True)

print = functools.partial(print, flush=True)

ROOT_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PLAYLIST_FILE = os.path.join(ROOT_DIR, 'playlists', '4_JAV_Update.json')
PROGRESS_FILE = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'progress.json')

def load_json(file_path):
    if not os.path.exists(file_path):
        return None
    try:
        with open(file_path, 'r', encoding='utf-8') as f:
            return json.load(f)
    except Exception as e:
        print(f"[Error] Failed to load {file_path}: {e}")
        return None

def save_json(file_path, data):
    tmp_path = file_path + '.tmp'
    with open(tmp_path, 'w', encoding='utf-8') as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
    if os.path.exists(file_path):
        os.replace(tmp_path, file_path)
    else:
        os.rename(tmp_path, file_path)

def extract_code(title):
    m = re.search(r'\b([A-Z0-9]+-\d+)\b', title, re.I)
    return m.group(1).upper() if m else ''

def update_latest_jable(max_pages=2):
    print(f"=== [Jable] Checking latest updates from pages 1-{max_pages} ===")

    playlist_data = load_json(PLAYLIST_FILE) or {
        "name": "4__JAV_Update",
        "groups": [{"name": "JAV", "stations": []}]
    }

    if not playlist_data.get('groups'):
        playlist_data['groups'] = [{"name": "JAV", "stations": []}]

    existing_urls = set()
    existing_codes = set()
    stations = playlist_data['groups'][0].get('stations', [])
    for s in stations:
        if s.get('url'):
            existing_urls.add(s['url'])
        if s.get('code'):
            existing_codes.add(s['code'].upper())

    progress_cache = load_json(PROGRESS_FILE) or {}

    new_video_pages = []

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        context = browser.new_context(
            user_agent="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
        )
        page = context.new_page()

        def route_filter(route):
            rtype = route.request.resource_type
            url = route.request.url
            if rtype in ["image", "media", "font", "stylesheet"]:
                route.abort()
            elif any(ad in url for ad in ["google", "syndication", "exosrv", "magsrv", "adxadserv", "labadena"]):
                route.abort()
            else:
                route.continue_()

        page.route("**/*", route_filter)

        # 1. Fetch latest-updates pages to find video URLs
        for pg in range(1, max_pages + 1):
            list_url = f"https://jable.tv/latest-updates/{pg}/" if pg > 1 else "https://jable.tv/latest-updates/"
            print(f"[List] Checking {list_url}...")
            try:
                page.goto(list_url, wait_until="commit", timeout=20000)
                content = page.content()
                links = re.findall(r'href=[\"|\'](https://jable\.tv/videos/[a-zA-Z0-9\-]+/)[\"|\']', content)
                unique_links = []
                for l in links:
                    if l not in unique_links and not l.endswith('/videos/'):
                        unique_links.append(l)

                print(f"  --> Found {len(unique_links)} videos on page {pg}")
                for link in unique_links:
                    if link not in new_video_pages and link not in progress_cache:
                        new_video_pages.append(link)
            except Exception as e:
                print(f"  --> Error on page {pg}: {e}")

        print(f"\n[Info] Total new video links to scrape: {len(new_video_pages)}")

        added_stations = []
        for i, video_page_url in enumerate(new_video_pages, 1):
            print(f"[{i}/{len(new_video_pages)}] Scraping: {video_page_url}...", end=' ')
            try:
                page.goto(video_page_url, wait_until="commit", timeout=20000)
                content = page.content()
                hls_match = re.search(r"var\s+hlsUrl\s*=\s*['\"]([^'\"]+)['\"]", content)
                title_match = re.search(r"<meta\s+property=[\"']og:title[\"']\s+content=[\"']([^\"']+)[\"']", content)
                image_match = re.search(r"<meta\s+property=[\"']og:image[\"']\s+content=[\"']([^\"']+)[\"']", content)

                if not hls_match:
                    page.wait_for_load_state("domcontentloaded", timeout=5000)
                    content = page.content()
                    hls_match = re.search(r"var\s+hlsUrl\s*=\s*['\"]([^'\"]+)['\"]", content)
                    title_match = re.search(r"<meta\s+property=[\"']og:title[\"']\s+content=[\"']([^\"']+)[\"']", content)
                    image_match = re.search(r"<meta\s+property=[\"']og:image[\"']\s+content=[\"']([^\"']+)[\"']", content)

                if hls_match:
                    m3u8_url = hls_match.group(1)
                    title = title_match.group(1).replace(' - Jable.TV', '').strip() if title_match else ''
                    image = image_match.group(1).strip() if image_match else ''
                    code = extract_code(title) or extract_code(video_page_url)

                    station = {
                        "name": title or code or "JAV Video",
                        "image": image,
                        "url": m3u8_url,
                        "code": code,
                        "duration": "",
                        "is_new": True
                    }

                    progress_cache[video_page_url] = {
                        'code': code,
                        'name': title,
                        'image': image,
                        'm3u8': m3u8_url,
                        'resolved_at': time.time(),
                        'is_new': True
                    }

                    added_stations.append(station)
                    print(f"OK -> {code} ({m3u8_url})")
                else:
                    print("FAILED")
            except Exception as e:
                print(f"ERROR ({e})")

            time.sleep(0.05)

        browser.close()

    if added_stations:
        print(f"\n[Success] Adding {len(added_stations)} new videos to 4_JAV_Update.json (with NEW tag)")
        # ล้างแท็ก is_new ของคลิปเก่า
        for s in stations:
            s['is_new'] = False
        playlist_data['groups'][0]['stations'] = added_stations + stations
        save_json(PLAYLIST_FILE, playlist_data)
        save_json(PROGRESS_FILE, progress_cache)
    else:
        print("\n[Info] No new videos to add.")

if __name__ == '__main__':
    pages = int(sys.argv[1]) if len(sys.argv) > 1 else 2
    update_latest_jable(max_pages=pages)
