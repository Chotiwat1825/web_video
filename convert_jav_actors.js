/**
 * convert_jav_actors.js
 * ดาวน์โหลด M3U จาก Google Drive ทุก actor ใน JAV.json
 * แล้วแปลงเป็น playlist format มาตรฐานที่เว็บใช้ได้
 */

process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

const fs    = require('fs');
const https = require('https');
const path  = require('path');

// ── Helpers ───────────────────────────────────────────

function fetchUrl(url) {
  return new Promise((resolve, reject) => {
    const req = https.get(url, { headers: { 'User-Agent': 'Mozilla/5.0' } }, res => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        return fetchUrl(res.headers.location).then(resolve).catch(reject);
      }
      let body = '';
      res.on('data', c => body += c);
      res.on('end', () => resolve({ status: res.statusCode, body }));
    });
    req.on('error', reject);
    req.setTimeout(20000, () => { req.destroy(); reject(new Error('timeout')); });
  });
}

// Google Drive: uc?export=download -> usercontent
function toDirectUrl(url) {
  const m = url.match(/[?&]id=([^&]+)/);
  if (m) return `https://drive.usercontent.google.com/download?id=${m[1]}&export=download`;
  return url;
}

/**
 * Parse M3U text into array of { name, logo, url }
 */
function parseM3U(text) {
  const lines  = text.split(/\r?\n/);
  const videos = [];
  let pending  = null;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    if (line.startsWith('#EXTINF')) {
      // Extract tvg-logo and title
      const logoMatch = line.match(/tvg-logo="([^"]+)"/);
      const nameMatch = line.match(/,(.+)$/);
      pending = {
        name:  nameMatch  ? nameMatch[1].trim()  : '',
        image: logoMatch  ? logoMatch[1].trim()  : '',
      };
    } else if (!line.startsWith('#') && pending) {
      if (line.startsWith('http')) {
        videos.push({ ...pending, url: line });
      }
      pending = null;
    }
  }
  return videos;
}

// ── Main ──────────────────────────────────────────────

async function main() {
  const javPath = 'playlists/JAV.json';
  const outPath = 'playlists/JAV_converted.json';

  console.log('Reading JAV.json...');
  const javData = JSON.parse(fs.readFileSync(javPath, 'utf8'));
  const actors  = javData.groups[0].stations;

  console.log(`Found ${actors.length} actors. Starting download...\n`);

  const groups        = [];
  const allVideos     = [];  // flat list for "วิดีโอทั้งหมด" group
  let totalVideos     = 0;
  let failCount       = 0;

  // Process in small batches to avoid hammering Google Drive
  const BATCH = 5;
  for (let i = 0; i < actors.length; i += BATCH) {
    const batch = actors.slice(i, i + BATCH);
    const results = await Promise.all(batch.map(async actor => {
      const directUrl = toDirectUrl(actor.url);
      try {
        const res = await fetchUrl(directUrl);
        if (res.status !== 200) throw new Error(`HTTP ${res.status}`);

        const videos = parseM3U(res.body);
        if (videos.length === 0) throw new Error('No videos parsed from M3U');

        // Use actor image as fallback for videos that have no logo
        const stations = videos.map(v => ({
          name:  v.name  || actor.name,
          image: v.image || actor.image || '',
          url:   v.url,
          code:  '',
        }));

        console.log(`✅ [${String(i+1).padStart(2)}/${actors.length}] ${actor.name} — ${stations.length} วิดีโอ`);
        return { actor, stations };
      } catch (err) {
        console.log(`❌ [${String(i+1).padStart(2)}/${actors.length}] ${actor.name} — FAILED: ${err.message}`);
        failCount++;
        return { actor, stations: [] };
      }
    }));

    for (const { actor, stations } of results) {
      if (stations.length > 0) {
        groups.push({
          name:     actor.name,
          image:    actor.image || '',
          stations,
        });
        allVideos.push(...stations);
        totalVideos += stations.length;
      }
    }
  }

  // Build output JSON — first group = "วิดีโอทั้งหมด", then per-actor groups
  const output = {
    name:   'JAV',
    groups: [
      {
        name:     'วิดีโอทั้งหมด',
        stations: allVideos,
      },
      ...groups,
    ],
  };

  fs.writeFileSync(outPath, JSON.stringify(output, null, 2), 'utf8');

  console.log('\n' + '='.repeat(60));
  console.log(`✅ Done! Total videos: ${totalVideos} from ${groups.length} actors`);
  console.log(`❌ Failed actors: ${failCount}`);
  console.log(`📁 Saved to: ${outPath}`);
}

main().catch(console.error);
