const fs = require('fs');
const path = require('path');

const inputPath = path.join(__dirname, 'scrape_homhee', 'videos.json');
const altInputPath = path.join(__dirname, 'scrape_homhee', 'progress.json');
const outputPath = path.join(__dirname, 'playlists', 'Homhee.json');

try {
  let fileToRead = null;
  if (fs.existsSync(inputPath)) {
    fileToRead = inputPath;
  } else if (fs.existsSync(altInputPath)) {
    fileToRead = altInputPath;
  }

  if (!fileToRead) {
    console.error(`Input file not found: Neither ${inputPath} nor ${altInputPath} exists.`);
    process.exit(1);
  }

  const content = fs.readFileSync(fileToRead, 'utf8');
  const parsed = JSON.parse(content);
  const videos = Array.isArray(parsed) ? parsed : (parsed.videos || []);

  const cachePath = path.join(__dirname, 'scrape_homhee', 'embed_cache.json');
  let cache = {};
  if (fs.existsSync(cachePath)) {
    try {
      cache = JSON.parse(fs.readFileSync(cachePath, 'utf8'));
    } catch (e) {}
  }

  const groupsMap = {};

  videos.forEach(video => {
    const category = video.category || 'ทั่วไป';
    if (!groupsMap[category]) {
      groupsMap[category] = {
        name: category,
        stations: []
      };
    }

    let url = video.embed_url || '';
    let duration = video.duration || '';

    if (cache[url]) {
      const cached = cache[url];
      if (cached.embed_url) url = cached.embed_url;
      if (cached.duration && !duration) duration = cached.duration;
    }

    groupsMap[category].stations.push({
      name: video.title || 'ไม่มีชื่อ',
      image: video.thumbnail || '',
      url: url,
      code: '',
      duration: duration
    });
  });

  const playlist = {
    name: "Homhee - คลิปหลุด หอมหี",
    groups: Object.values(groupsMap)
  };

  // Ensure playlists directory exists
  const destDir = path.dirname(outputPath);
  if (!fs.existsSync(destDir)) {
    fs.mkdirSync(destDir, { recursive: true });
  }

  fs.writeFileSync(outputPath, JSON.stringify(playlist, null, 2), 'utf8');
  console.log(`Successfully converted ${videos.length} videos into ${outputPath}`);
} catch (err) {
  console.error("Error converting homhee videos:", err);
  process.exit(1);
}
