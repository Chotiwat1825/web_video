const fs = require('fs');
const path = require('path');

const inputPath = path.join(__dirname, 'scrape_heedeng', 'progress.json');
const outputPath = path.join(__dirname, 'playlists', 'Heedeng.json');

try {
  if (!fs.existsSync(inputPath)) {
    console.error(`Input file not found: ${inputPath}`);
    process.exit(1);
  }

  const content = fs.readFileSync(inputPath, 'utf8');
  const parsed = JSON.parse(content);
  const videos = Array.isArray(parsed) ? parsed : (parsed.videos || []);

  const groupsMap = {};

  videos.forEach(video => {
    const category = video.category || 'ทั่วไป';
    if (!groupsMap[category]) {
      groupsMap[category] = {
        name: category,
        stations: []
      };
    }

    groupsMap[category].stations.push({
      name: video.title,
      image: video.thumbnail || '',
      url: video.embed_url || '',
      code: '',
      duration: video.duration || ''
    });
  });

  const playlist = {
    name: "Heedeng - คลิปหลุด OnlyFans",
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
  console.error("Error converting heedeng videos:", err);
  process.exit(1);
}
