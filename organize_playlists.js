const fs = require('fs');
const path = require('path');

const ROOT_DIR = __dirname;
const PLAYLISTS_DIR = path.join(ROOT_DIR, 'playlists');

// Ensure playlists folder exists
if (!fs.existsSync(PLAYLISTS_DIR)) {
  fs.mkdirSync(PLAYLISTS_DIR);
}

// Files to ignore
const IGNORE_FILES = new Set([
  'app.js',
  'organize_playlists.js',
  'playlists_index.json',
  'package.json',
  'package-lock.json',
  'playlists_detailed_summary.json',
]);

function getPlaylistName(content, fileName) {
  // Check if it's M3U
  if (content.includes('#EXTM3U')) {
    return { name: path.basename(fileName, path.extname(fileName)), type: 'm3u' };
  }

  // Regex to match "name": "something" or name: "something" (loose quotes)
  const nameMatch = content.match(/"name"\s*:\s*"([^"]+)"/) || content.match(/name\s*:\s*"([^"]+)"/);
  if (nameMatch) {
    return { name: nameMatch[1].trim(), type: 'json' };
  }

  return { name: path.basename(fileName, path.extname(fileName)), type: 'json' };
}

function run() {
  const files = fs.readdirSync(ROOT_DIR);
  const playlists = [];

  files.forEach(file => {
    const filePath = path.join(ROOT_DIR, file);
    const stat = fs.statSync(filePath);

    if (stat.isFile() && !IGNORE_FILES.has(file)) {
      const ext = path.extname(file).toLowerCase();
      if (ext === '.json' || ext === '.txt' || ext === '.w3u') {
        try {
          const content = fs.readFileSync(filePath, 'utf8');
          const { name, type } = getPlaylistName(content, file);

          // Move file to playlists directory
          const destPath = path.join(PLAYLISTS_DIR, file);
          fs.renameSync(filePath, destPath);

          playlists.push({
            name: name,
            file: `playlists/${file}`,
            type: type,
            originalName: file
          });
          console.log(`Moved and cataloged: ${file} (${type}) -> "${name}"`);
        } catch (err) {
          console.error(`Error processing file ${file}:`, err);
        }
      }
    }
  });

  // Sort descending by: Heedeng & Lovehee first, then alphabetically by name
  playlists.sort((a, b) => {
    const isHeedengA = a.file && a.file.toLowerCase().includes('heedeng');
    const isHeedengB = b.file && b.file.toLowerCase().includes('heedeng');
    const isLoveheeA = a.file && a.file.toLowerCase().includes('lovehee');
    const isLoveheeB = b.file && b.file.toLowerCase().includes('lovehee');

    if (isHeedengA && !isHeedengB) return -1;
    if (isHeedengB && !isHeedengA) return 1;
    if (isLoveheeA && !isLoveheeB) return -1;
    if (isLoveheeB && !isLoveheeA) return 1;

    return a.name.localeCompare(b.name, 'th');
  });

  // Write index file
  const indexFilePath = path.join(ROOT_DIR, 'playlists_index.json');
  fs.writeFileSync(indexFilePath, JSON.stringify(playlists, null, 2), 'utf8');
  console.log(`\nSuccessfully created playlists_index.json with ${playlists.length} playlists.`);
}

run();
