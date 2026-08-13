const http = require('http');
const fs = require('fs');
const path = require('path');

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
      
      index.push({
        name: name,
        file: `playlists/${file}`,
        type: 'json',
        originalName: file,
        status: '๐ข LOADABLE',
        totalVideos: totalVideos
      });
    } catch (err) {
      // Skip invalid or partially written JSON files
      console.warn(`[Warning] Skipping invalid JSON file ${file}: ${err.message}`);
    }
  }
  
  // Sort alphabetically by Thai/English name
  return index.sort((a, b) => a.name.localeCompare(b.name, 'th'));
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
  server.listen(port, () => {
    console.log(`\n🚀 Dynamic Video streaming server running at http://localhost:${port}`);
    console.log(`📂 Playlists folder: ${PLAYLISTS_DIR}`);
  }).on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
      console.log(`Port ${port} is in use. Trying port ${port + 1}...`);
      startServer(port + 1);
    } else {
      console.error('Server error:', err);
    }
  });
}

startServer(PORT);
