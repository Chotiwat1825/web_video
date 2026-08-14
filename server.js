const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');
const urlModule = require('url');
const zlib = require('zlib');

const PORT = 3000;
const PUBLIC_DIR = __dirname;
const PLAYLISTS_DIR = path.join(PUBLIC_DIR, 'playlists');
const INDEX_FILE = path.join(PUBLIC_DIR, 'playlists_index.json');

// MIME types mapping
const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
};

// Generate playlist index from current folder contents
function getDynamicIndex() {
  if (!fs.existsSync(PLAYLISTS_DIR)) return [];
  const files = fs.readdirSync(PLAYLISTS_DIR);
  const index = [];
  
  // Load health summary if exists
  let healthMap = {};
  const summaryPath = path.join(PUBLIC_DIR, 'playlists_detailed_summary.json');
  if (fs.existsSync(summaryPath)) {
    try {
      let text = fs.readFileSync(summaryPath, 'utf8');
      if (text.charCodeAt(0) === 0xFEFF) {
        text = text.substring(1);
      }
      const summaryData = JSON.parse(text);
      summaryData.forEach(item => {
        healthMap[item.fileName] = {
          health: parseFloat(item.healthScore),
          healthScore: item.healthScore,
          workingVideos: item.workingCount
        };
      });
    } catch (err) {
      console.error('[Error] Failed to read playlists_detailed_summary.json:', err.message);
    }
  }
  
  for (const file of files) {
    if (!file.endsWith('.json')) continue;
    const filePath = path.join(PLAYLISTS_DIR, file);
    try {
      const content = fs.readFileSync(filePath, 'utf8').trim();
      if (!content) continue;
      
      const data = JSON.parse(content);
      let totalVideos = 0;
      
      if (data.groups && Array.isArray(data.groups)) {
        data.groups.forEach(g => {
          if (g.stations && Array.isArray(g.stations)) {
            totalVideos += g.stations.length;
          }
        });
      } else if (data.stations && Array.isArray(data.stations)) {
        totalVideos = data.stations.length;
      }
      
      const name = data.name || path.basename(file, '.json');
      const healthInfo = healthMap[file] || { health: 100, healthScore: '100%', workingVideos: totalVideos };
      
      index.push({
        name: name,
        file: `playlists/${file}`,
        type: 'json',
        originalName: file,
        status: '🟢 LOADABLE',
        totalVideos: totalVideos,
        health: healthInfo.health,
        healthScore: healthInfo.healthScore,
        workingVideos: healthInfo.workingVideos
      });
    } catch (err) {
      // Skip invalid or partially written JSON files
      console.warn(`[Warning] Skipping invalid JSON file ${file}: ${err.message}`);
    }
  }
  
  function getPlaylistRank(file) {
    const f = (file || '').toLowerCase();
    if (f.includes('heedeng')) return 1;
    if (f.includes('lovehee')) return 2;
    if (f.includes('homhee')) return 3;
    return 99;
  }

  // Sort: Top priority playlists first (Heedeng, Lovehee, Homhee), then health score desc, then name asc
  return index.sort((a, b) => {
    const rankA = getPlaylistRank(a.file);
    const rankB = getPlaylistRank(b.file);
    if (rankA !== rankB) {
      return rankA - rankB;
    }

    const healthA = a.health !== undefined ? a.health : 100;
    const healthB = b.health !== undefined ? b.health : 100;
    if (healthB !== healthA) {
      return healthB - healthA;
    }
    return a.name.localeCompare(b.name, 'th');
  });
}

// Debounce helper to prevent rapid double-writes
let writeTimeout = null;
function syncIndexToDisk() {
  clearTimeout(writeTimeout);
  writeTimeout = setTimeout(() => {
    try {
      const indexData = getDynamicIndex();
      fs.writeFileSync(INDEX_FILE, JSON.stringify(indexData, null, 2), 'utf8');
      console.log(`[Auto-Sync] playlists_index.json updated on disk. Total playlists: ${indexData.length}`);
    } catch (err) {
      console.error('[Auto-Sync] Failed to sync index to disk:', err.message);
    }
  }, 300);
}

// Watch playlists directory for changes
if (fs.existsSync(PLAYLISTS_DIR)) {
  fs.watch(PLAYLISTS_DIR, (eventType, filename) => {
    if (filename && filename.endsWith('.json')) {
      console.log(`[Watcher] File change detected: ${filename} (${eventType})`);
      syncIndexToDisk();
    }
  });
  console.log(`[Watcher] Watching playlists folder: ${PLAYLISTS_DIR}`);
}

// Perform initial sync on startup
syncIndexToDisk();

// Start HTTP server
const server = http.createServer((req, res) => {
  // CORS Headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  // Intercept playlists_index.json to serve dynamic content
  let reqUrl = req.url.split('?')[0];
  try {
    reqUrl = decodeURIComponent(reqUrl);
  } catch (err) {
    console.error('[Error] Failed to decode URL:', err.message);
  }

  if (reqUrl === '/playlists_index.json') {
    const indexData = getDynamicIndex();
    res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify(indexData, null, 2));
    return;
  }

  if (reqUrl === '/proxy') {
    const query = urlModule.parse(req.url, true).query;
    const targetUrl = query.url;
    if (!targetUrl) {
      res.writeHead(400, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('Missing url parameter');
      return;
    }

    let parsedTarget;
    try {
      parsedTarget = new URL(targetUrl);
    } catch (err) {
      res.writeHead(400, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('Invalid url');
      return;
    }

    const client = parsedTarget.protocol === 'https:' ? https : http;
    const headers = {};
    if (req.headers['user-agent']) headers['User-Agent'] = req.headers['user-agent'];
    if (req.headers['range']) headers['Range'] = req.headers['range'];
    if (req.headers['accept']) headers['Accept'] = req.headers['accept'];
    headers['Accept-Encoding'] = 'identity'; // Force uncompressed response to bypass any zlib issues
    if (req.headers['accept-language']) headers['Accept-Language'] = req.headers['accept-language'];

    const agent = parsedTarget.protocol === 'https:' ? new https.Agent({ rejectUnauthorized: false }) : null;

    const targetReq = client.get(targetUrl, { headers, agent }, (targetRes) => {
      if (targetRes.statusCode >= 300 && targetRes.statusCode < 400 && targetRes.headers.location) {
        const redirectUrl = new URL(targetRes.headers.location, targetUrl).href;
        res.writeHead(302, {
          'Location': `/proxy?url=${encodeURIComponent(redirectUrl)}`,
          'Access-Control-Allow-Origin': '*'
        });
        res.end();
        return;
      }

      const contentType = targetRes.headers['content-type'] || '';
      const resHeaders = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': '*',
        'Access-Control-Allow-Methods': 'GET, OPTIONS',
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0',
      };
      if (targetRes.headers['content-type']) resHeaders['Content-Type'] = targetRes.headers['content-type'];
      if (targetRes.headers['content-length']) resHeaders['Content-Length'] = targetRes.headers['content-length'];
      if (targetRes.headers['content-range']) resHeaders['Content-Range'] = targetRes.headers['content-range'];
      if (targetRes.headers['accept-ranges']) resHeaders['Accept-Ranges'] = targetRes.headers['accept-ranges'];

      const isSegment = targetUrl.endsWith('.jpg') || targetUrl.endsWith('.jpeg') || targetUrl.endsWith('.png') || targetUrl.endsWith('.ts') || targetUrl.endsWith('.m4s') || targetUrl.endsWith('.mp4');
      const isM3u8 = !isSegment && (
        targetUrl.includes('.m3u8') || 
        targetUrl.endsWith('/index') || 
        targetUrl.includes('/index?') || 
        targetUrl.endsWith('/audio_0') || 
        targetUrl.includes('/audio_0?') || 
        contentType.includes('mpegurl') || 
        contentType.includes('mpegURL') || 
        contentType.includes('application/x-mpegurl')
      );

      if (isM3u8) {
        let body = '';
        let stream = targetRes;
        const enc = (targetRes.headers['content-encoding'] || '').toLowerCase();
        if (enc.includes('gzip') || enc.includes('deflate')) {
          stream = targetRes.pipe(zlib.createUnzip());
        } else if (enc.includes('br')) {
          stream = targetRes.pipe(zlib.createBrotliDecompress());
        }

        stream.on('data', chunk => body += chunk);
        stream.on('end', () => {
          const proto = req.headers['x-forwarded-proto'] || 'http';
          const host = req.headers.host;
          const proxyPrefix = `${proto}://${host}/proxy?url=`;
          const lines = body.split(/\r?\n/);
          const rewrittenLines = lines.map(line => {
            const trimmed = line.trim();
            if (trimmed && !trimmed.startsWith('#')) {
              try {
                const absoluteUrl = new URL(trimmed, targetUrl).href;
                return proxyPrefix + encodeURIComponent(absoluteUrl);
              } catch (e) {
                return line;
              }
            }
            if (trimmed && trimmed.startsWith('#EXT-X-MEDIA') && trimmed.includes('URI="')) {
              return trimmed.replace(/URI="([^"]+)"/, (match, uri) => {
                try {
                  const absoluteUri = new URL(uri, targetUrl).href;
                  return `URI="${proxyPrefix}${encodeURIComponent(absoluteUri)}"`;
                } catch (e) {
                  return match;
                }
              });
            }
            return line;
          });
          const rewrittenBody = rewrittenLines.join('\n');
          resHeaders['Content-Type'] = 'application/vnd.apple.mpegurl';
          resHeaders['Content-Length'] = Buffer.byteLength(rewrittenBody);
          res.writeHead(targetRes.statusCode, resHeaders);
          res.end(rewrittenBody);
        });
        stream.on('error', (err) => {
          console.error('[Decompression Error]', err.message, 'for URL:', targetUrl);
          res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' });
          res.end('Decompression error: ' + err.message);
        });
      } else {
        const isDisguisedTs = targetUrl.includes('masteplayers.com') || targetUrl.includes('/files/') || targetUrl.includes('/filesr2/') || targetUrl.endsWith('.jpg') || targetUrl.endsWith('.png');
        if (isDisguisedTs) {
          const chunks = [];
          targetRes.on('data', chunk => chunks.push(chunk));
          targetRes.on('end', () => {
            let buffer = Buffer.concat(chunks);
            // Check and strip fake PNG header
            if (buffer.length > 545 && buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4E && buffer[3] === 0x47) {
              const iendIdx = buffer.indexOf(Buffer.from('IEND'));
              if (iendIdx !== -1 && iendIdx + 8 < buffer.length) {
                if (buffer[iendIdx + 8] === 0x47) {
                  buffer = buffer.subarray(iendIdx + 8);
                  resHeaders['Content-Type'] = 'video/mp2t';
                }
              }
            } else if (buffer.length > 4 && buffer[0] === 0xFF && buffer[1] === 0xD8) { // Fake JPEG
              const eoiIdx = buffer.indexOf(Buffer.from([0xFF, 0xD9]));
              if (eoiIdx !== -1 && eoiIdx + 2 < buffer.length) {
                if (buffer[eoiIdx + 2] === 0x47) {
                  buffer = buffer.subarray(eoiIdx + 2);
                  resHeaders['Content-Type'] = 'video/mp2t';
                }
              }
            } else if (buffer.length > 188 * 3 && buffer[0] !== 0x47) {
              // Generic scan for 0x47 TS sync byte
              for (let i = 0; i < Math.min(2048, buffer.length - 188 * 3); i++) {
                if (buffer[i] === 0x47 && buffer[i + 188] === 0x47 && buffer[i + 376] === 0x47) {
                  buffer = buffer.subarray(i);
                  resHeaders['Content-Type'] = 'video/mp2t';
                  break;
                }
              }
            }
            resHeaders['Content-Length'] = buffer.length;
            res.writeHead(targetRes.statusCode, resHeaders);
            res.end(buffer);
          });
          targetRes.on('error', (err) => {
            console.error('[Segment Stream Error]', err.message);
            res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' });
            res.end('Stream error: ' + err.message);
          });
        } else {
          res.writeHead(targetRes.statusCode, resHeaders);
          targetRes.pipe(res);
        }
      }
    });

    targetReq.on('error', (err) => {
      console.error('[Proxy Error]', err.message, 'for URL:', targetUrl);
      res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('Proxy error: ' + err.message);
    });
    return;
  }

  // Serve static files
  if (reqUrl === '/') reqUrl = '/index.html';
  const filePath = path.join(PUBLIC_DIR, reqUrl);

  // Prevent directory traversal attacks
  if (!filePath.startsWith(PUBLIC_DIR)) {
    res.writeHead(403, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('403 Forbidden');
    return;
  }

  fs.stat(filePath, (err, stats) => {
    if (err || !stats.isFile()) {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('404 Not Found');
      return;
    }

    const ext = path.extname(filePath).toLowerCase();
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';
    
    res.writeHead(200, { 'Content-Type': contentType });
    fs.createReadStream(filePath).pipe(res);
  });
});

function startServer(port) {
  server.removeAllListeners('listening');
  server.removeAllListeners('error');

  server.once('error', (err) => {
    if (err.code === 'EADDRINUSE') {
      console.log(`[Port Busy] Port ${port} is in use. Trying port ${port + 1}...`);
      startServer(port + 1);
    } else {
      console.error('Server error:', err);
    }
  });

  server.listen(port, () => {
    console.log(`\n🚀 Dynamic Video streaming server running at http://localhost:${port}`);
    console.log(`📁 Playlists folder: ${PLAYLISTS_DIR}`);
  });
}

startServer(PORT);
