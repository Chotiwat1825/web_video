const fs = require('fs');
const path = require('path');

const inputPath = path.join(__dirname, 'scrape_jable', 'progress.json');
const playlistFiles = [
  '4_JAV_Update.json',
  '18_JAV_MIX_1.json',
  '19_JAV_MIX_2.json'
];

try {
  let progressMap = {};
  if (fs.existsSync(inputPath)) {
    try {
      progressMap = JSON.parse(fs.readFileSync(inputPath, 'utf8'));
    } catch (e) {
      console.warn('Could not read progress.json, using existing playlist data.');
    }
  }

  playlistFiles.forEach(file => {
    const filePath = path.join(__dirname, 'playlists', file);
    if (!fs.existsSync(filePath)) return;

    const content = fs.readFileSync(filePath, 'utf8');
    const playlist = JSON.parse(content);

    let updatedCount = 0;
    if (playlist.groups && Array.isArray(playlist.groups)) {
      playlist.groups.forEach(g => {
        if (g.stations && Array.isArray(g.stations)) {
          g.stations.forEach(s => {
            const originalUrl = s.url;
            if (progressMap[originalUrl]) {
              const cached = progressMap[originalUrl];
              if (cached.status === 'active' && cached.m3u8) {
                s.url = cached.m3u8;
                if (cached.name) s.name = cached.name;
                if (cached.image && !s.image) s.image = cached.image;
                updatedCount++;
              }
            }
          });
        }
      });
    }

    fs.writeFileSync(filePath, JSON.stringify(playlist, null, 2), 'utf8');
    console.log(`[Sync] ${file}: ${updatedCount} stations synced.`);
  });

  console.log('Jable playlist sync complete!');
} catch (err) {
  console.error("Error converting jable playlist:", err);
  process.exit(1);
}
