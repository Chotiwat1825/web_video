#!/usr/bin/env python3
"""
Stable Async Playwright Resolver for Jable Playlists
- Resolves .m3u8 stream URLs, titles, and preview thumbnails for Jable videos
- Supports 4_JAV_Update.json, 18_JAV_MIX_1.json, 19_JAV_MIX_2.json, or any playlist
- 4 concurrent browser workers with Cloudflare challenge auto-handling
- Caches all resolved and dead links to progress.json
- Automatically syncs and saves progress to playlist files
"""

import os
import sys
import json
import re
import time
import asyncio
import functools

if sys.platform == "win32":
    import io
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace", line_buffering=True)
    sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding="utf-8", errors="replace", line_buffering=True)

print = functools.partial(print, flush=True)

ROOT_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PLAYLISTS_DIR = os.path.join(ROOT_DIR, 'playlists')
PROGRESS_FILE = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'progress.json')

CONCURRENCY = 4

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
    try:
        with open(tmp_path, 'w', encoding='utf-8') as f:
            json.dump(data, f, ensure_ascii=False, indent=2)
        for attempt in range(5):
            try:
                if os.path.exists(file_path):
                    os.replace(tmp_path, file_path)
                else:
                    os.rename(tmp_path, file_path)
                return
            except OSError:
                time.sleep(0.15)
        # Fallback to direct write
        with open(file_path, 'w', encoding='utf-8') as f:
            json.dump(data, f, ensure_ascii=False, indent=2)
        if os.path.exists(tmp_path):
            try:
                os.remove(tmp_path)
            except OSError:
                pass
    except Exception as e:
        print(f"[Warn] Could not save {file_path}: {e}")

def extract_code(text):
    if not text:
        return ''
    m = re.search(r'\b([A-Z0-9]+-\d+)\b', text, re.I)
    return m.group(1).upper() if m else ''

async def scrape_single_video(context, station, progress_cache, sem, stats):
    original_url = station['url']
    code = station.get('code') or extract_code(station.get('name', '')) or extract_code(original_url)

    if original_url in progress_cache:
        cached = progress_cache[original_url]
        if cached.get('status') == 'active' and cached.get('m3u8'):
            station['url'] = cached['m3u8']
            if cached.get('name'):
                station['name'] = cached['name']
            if cached.get('image') and not station.get('image'):
                station['image'] = cached['image']
            stats['cached'] += 1
            return
        elif cached.get('status') == 'dead':
            stats['cached_dead'] += 1
            return

    async with sem:
        page = None
        try:
            page = await context.new_page()

            async def route_filter(route):
                rtype = route.request.resource_type
                if rtype in ["image", "media", "font"]:
                    await route.abort()
                else:
                    await route.continue_()

            await page.route("**/*", route_filter)

            await page.goto(original_url, wait_until="domcontentloaded", timeout=25000)
            page_title = await page.title()

            # Handle Cloudflare challenge if triggered
            if "Just a moment" in page_title or "Attention Required" in page_title:
                for _ in range(6):
                    await page.wait_for_timeout(1500)
                    page_title = await page.title()
                    if "Just a moment" not in page_title:
                        break

            content = await page.content()
            hls_match = re.search(r"var\s+hlsUrl\s*=\s*['\"]([^'\"]+)['\"]", content)
            title_match = re.search(r"<meta\s+property=[\"']og:title[\"']\s+content=[\"']([^\"']+)[\"']", content)
            image_match = re.search(r"<meta\s+property=[\"']og:image[\"']\s+content=[\"']([^\"']+)[\"']", content)

            is_cf = "Cloudflare" in page_title or "Access denied" in page_title or "Just a moment" in page_title
            is_404 = not is_cf and ("404" in page_title or "頁面丟失" in page_title or "頁面不存在" in page_title)

            if hls_match:
                m3u8_url = hls_match.group(1)
                raw_title = title_match.group(1).strip() if title_match else station['name']
                clean_title = raw_title.replace(' - Jable.TV', '').strip()
                image = image_match.group(1).strip() if image_match else station.get('image', '')

                station['url'] = m3u8_url
                if clean_title:
                    station['name'] = clean_title
                if image and not station.get('image'):
                    station['image'] = image
                if not station.get('code'):
                    station['code'] = code

                progress_cache[original_url] = {
                    'code': code,
                    'name': clean_title,
                    'image': image or station.get('image', ''),
                    'm3u8': m3u8_url,
                    'status': 'active',
                    'resolved_at': time.time()
                }
                stats['resolved'] += 1
                print(f"[OK] {code} -> {m3u8_url[:60]}...")
            elif is_404:
                progress_cache[original_url] = {
                    'code': code,
                    'status': 'dead',
                    'resolved_at': time.time()
                }
                stats['dead'] += 1
                print(f"[DEAD 404] {code} ({original_url})")
            elif is_cf:
                stats['failed'] += 1
                print(f"[CF CHALLENGE] {code} - bypassed for later retry")
            else:
                stats['failed'] += 1
                print(f"[FAILED] {code} ({original_url})")

            await asyncio.sleep(0.2)

        except Exception as e:
            stats['error'] += 1
            print(f"[ERROR] {code} ({e})")
        finally:
            if page:
                try:
                    await page.close()
                except Exception:
                    pass

async def resolve_playlist_file(file_path, limit=None):
    if not os.path.exists(file_path):
        print(f"[Error] File not found: {file_path}")
        return

    playlist_data = load_json(file_path)
    if not playlist_data or 'groups' not in playlist_data:
        print(f"[Error] Invalid playlist structure in {file_path}")
        return

    progress_cache = load_json(PROGRESS_FILE) or {}
    print(f"\n=======================================================")
    print(f" Processing: {os.path.basename(file_path)}")
    print(f" Loaded {len(progress_cache)} total cached videos from progress.json")
    print(f"=======================================================")

    stations = []
    for g in playlist_data.get('groups', []):
        for s in g.get('stations', []):
            stations.append(s)

    # Filter targets
    unresolved_stations = []
    cached_active = 0
    cached_dead = 0

    for s in stations:
        url = s.get('url', '')
        if 'jable.tv' in url:
            if url in progress_cache:
                cached = progress_cache[url]
                if cached.get('status') == 'active' and cached.get('m3u8'):
                    s['url'] = cached['m3u8']
                    if cached.get('name'):
                        s['name'] = cached['name']
                    if cached.get('image') and not s.get('image'):
                        s['image'] = cached['image']
                    cached_active += 1
                elif cached.get('status') == 'dead':
                    cached_dead += 1
            else:
                unresolved_stations.append(s)

    print(f"Total stations in playlist: {len(stations)}")
    print(f"Already resolved in cache (Active): {cached_active}")
    print(f"Already marked dead in cache: {cached_dead}")
    print(f"Unresolved stations remaining: {len(unresolved_stations)}")

    save_json(file_path, playlist_data)

    if not unresolved_stations:
        print("[Done] All stations in this playlist are already resolved in cache!")
        return

    targets = unresolved_stations if limit is None else unresolved_stations[:limit]
    print(f"Launching {CONCURRENCY} parallel Playwright workers for {len(targets)} targets...\n")

    stats = {
        'cached': 0,
        'cached_dead': 0,
        'resolved': 0,
        'dead': 0,
        'failed': 0,
        'error': 0
    }

    sem = asyncio.Semaphore(CONCURRENCY)

    from playwright.async_api import async_playwright
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        context = await browser.new_context(
            user_agent="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
        )

        batch_size = 25
        for i in range(0, len(targets), batch_size):
            chunk = targets[i:i + batch_size]
            t_chunk_start = time.time()
            tasks = [scrape_single_video(context, s, progress_cache, sem, stats) for s in chunk]
            await asyncio.gather(*tasks)

            save_json(PROGRESS_FILE, progress_cache)
            save_json(file_path, playlist_data)
            duration = time.time() - t_chunk_start
            done_count = min(i + batch_size, len(targets))
            print(f"--> Progress: [{done_count}/{len(targets)}] saved to disk. (Batch time: {duration:.2f}s, Rate: {len(chunk)/max(duration,0.01):.1f} v/s)")

        await browser.close()

    save_json(PROGRESS_FILE, progress_cache)
    save_json(file_path, playlist_data)
    print(f"\n[Completed {os.path.basename(file_path)}] Active Resolved: {stats['resolved']}, Dead: {stats['dead']}, Errors: {stats['error']}")

async def main():
    args = sys.argv[1:]
    target_files = []
    limit = None

    for a in args:
        if a.isdigit():
            limit = int(a)
        elif a.endswith('.json'):
            if os.path.exists(a):
                target_files.append(a)
            else:
                p = os.path.join(PLAYLISTS_DIR, a)
                if os.path.exists(p):
                    target_files.append(p)

    if not target_files:
        target_files = [
            os.path.join(PLAYLISTS_DIR, '19_JAV_MIX_2.json'),
            os.path.join(PLAYLISTS_DIR, '18_JAV_MIX_1.json'),
            os.path.join(PLAYLISTS_DIR, '4_JAV_Update.json')
        ]

    for f in target_files:
        if os.path.exists(f):
            await resolve_playlist_file(f, limit=limit)

if __name__ == '__main__':
    asyncio.run(main())
