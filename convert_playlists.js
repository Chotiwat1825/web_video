const fs = require('fs');
const path = require('path');

const PLAYLISTS_DIR = path.join(__dirname, 'playlists');

// Extract video code helper
function extractCode(name) {
  const m = name && name.match(/\b([A-Z0-9]+-\d+)\b/i);
  return m ? m[1].toUpperCase() : '';
}

// ── Custom Beautiful Naming Rules ──
function getBeautifulName(parsedName) {
  const name = parsedName.trim();
  
  const mappings = {
    "Heedeng - คลิปหลุด OnlyFans": {
      fileName: "Heedeng.json",
      title: "Heedeng - คลิปหลุด OnlyFans"
    },
    "Lovehee - คลิปหลุด รักหี": {
      fileName: "Lovehee.json",
      title: "Lovehee - คลิปหลุด รักหี"
    },
    "Homhee - คลิปหลุด หอมหี": {
      fileName: "Homhee.json",
      title: "Homhee - คลิปหลุด หอมหี"
    },
    "JAV อัปเดต - 4 ส.ค. 66": {
      fileName: "JAV_อัปเดต_-_4_ส_ค_66.json",
      title: "JAV อัปเดต - 4 ส.ค. 66"
    },
    "JAV อัพเดท4ส.ค/66": {
      fileName: "JAV_อัปเดต_-_4_ส_ค_66.json",
      title: "JAV อัปเดต - 4 ส.ค. 66"
    },
    "4__JAV_Update": {
      fileName: "4_JAV_Update.json",
      title: "4__JAV_Update"
    },
    "4_JAV_Update": {
      fileName: "4_JAV_Update.json",
      title: "4__JAV_Update"
    },
    "18_JAV_MIX_1": {
      fileName: "18_JAV_MIX_1.json",
      title: "18_JAV_MIX_1"
    },
    "19_JAV_MIX_2": {
      fileName: "19_JAV_MIX_2.json",
      title: "19_JAV_MIX_2"
    },
    "9__JAV_SubThai_3": {
      fileName: "9_JAV_SubThai_3.json",
      title: "9__JAV_SubThai_3"
    },
    "9_JAV_SubThai_3": {
      fileName: "9_JAV_SubThai_3.json",
      title: "9__JAV_SubThai_3"
    },
    "จากเว็ป av24flix": {
      fileName: "จากเว็ป_av24flix.json",
      title: "จากเว็ป av24flix"
    },
    "JAV": {
      fileName: "JAV.json",
      title: "JAV"
    }
  };

  if (mappings[name]) {
    return mappings[name];
  }

  // Fallback cleaning
  const clean = name
    .replace(/[^a-zA-Z0-9ก-๙_-]/g, '_')
    .replace(/__+/g, '_')
    .replace(/^_+|_+$/g, '');
  return {
    fileName: clean + '.json',
    title: name
  };
}

// ── Parse M3U ──
function parseM3U(text) {
  const lines = text.split(/\r?\n/);
  const stations = [];
  let current = null;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    if (line.startsWith('#EXTINF:')) {
      current = {};
      const grp = line.match(/group-title="([^"]+)"/) || line.match(/group="([^"]+)"/);
      current.group = grp ? grp[1].trim() : 'ทั่วไป';

      const logo = line.match(/tvg-logo="([^"]+)"/) || line.match(/logo="([^"]+)"/);
      current.image = logo ? logo[1].trim() : '';

      const commaIdx = line.lastIndexOf(',');
      if (commaIdx !== -1) {
        current.name = line.substring(commaIdx + 1).trim();
      } else {
        current.name = 'ไม่มีชื่อ';
      }
    } else if (line.startsWith('#')) {
      continue;
    } else {
      if (current) {
        current.url = line;
        if (current.url.startsWith('http') && current.url.length > 12) {
          current.code = extractCode(current.name);
          stations.push(current);
        }
        current = null;
      }
    }
  }

  const groupsMap = {};
  stations.forEach(s => {
    if (!groupsMap[s.group]) {
      groupsMap[s.group] = { name: s.group, stations: [] };
    }
    groupsMap[s.group].stations.push({
      name: s.name,
      image: s.image,
      url: s.url,
      code: s.code,
      duration: s.duration || ''
    });
  });

  return Object.values(groupsMap);
}

// ── Parse Loose JSON Regex Fallback ──
function regexFallbackJSON(text) {
  const stations = [];
  const objRegex = /\{[^{}]+\}/g;
  const matches = text.match(objRegex) || [];

  matches.forEach(block => {
    const nameMatch = block.match(/(?:"name"|name)\s*:\s*["']([^"']+)["']/);
    const imageMatch = block.match(/(?:"image"|image)\s*:\s*["']([^"']+)["']/);
    const urlMatch = block.match(/(?:"url"|url)\s*:\s*["']([^"']+)["']/);
    const groupMatch = block.match(/(?:"group"|group)\s*:\s*["']([^"']+)["']/);
    const durationMatch = block.match(/(?:"duration"|duration)\s*:\s*["']([^"']+)["']/);

    if (nameMatch && urlMatch) {
      const urlStr = urlMatch[1];
      if (urlStr.startsWith('http') && urlStr.length > 12) {
        stations.push({
          name: nameMatch[1],
          image: imageMatch ? imageMatch[1] : '',
          url: urlStr,
          group: groupMatch ? groupMatch[1] : 'ทั่วไป',
          code: extractCode(nameMatch[1]),
          duration: durationMatch ? durationMatch[1] : ''
        });
      }
    }
  });

  const groupsMap = {};
  stations.forEach(s => {
    if (!groupsMap[s.group]) {
      groupsMap[s.group] = { name: s.group, stations: [] };
    }
    groupsMap[s.group].stations.push({
      name: s.name,
      image: s.image,
      url: s.url,
      code: s.code,
      duration: s.duration || ''
    });
  });

  return Object.values(groupsMap);
}

// ── Parse JSON / Loose JSON ──
function parseJSON(text) {
  let parsed = null;
  try {
    parsed = JSON.parse(text);
  } catch (e) {
    try {
      let cleaned = text;
      cleaned = cleaned.replace(/\/\*[\s\S]*?\*\/|([^\\:]|^)\/\/.*$/gm, '$1');
      cleaned = cleaned.replace(/([{,]\s*)([a-zA-Z0-9_]+)\s*:/g, '$1"$2":');
      cleaned = cleaned.replace(/,(\s*[\]}])/g, '$1');
      parsed = JSON.parse(cleaned);
    } catch (e2) {
      return regexFallbackJSON(text);
    }
  }

  let groups = parsed.groups || [];

  if (!groups.length && parsed.stations && Array.isArray(parsed.stations)) {
    groups = [{ name: 'วิดีโอทั้งหมด', stations: parsed.stations }];
  }

  const hasNestedStations = groups.some(g => g.stations && Array.isArray(g.stations));
  if (groups.length && !hasNestedStations) {
    const stations = groups.map(g => ({
      name: g.name,
      image: g.image || '',
      url: g.url,
      code: extractCode(g.name),
      duration: g.duration || ''
    }));
    groups = [{ name: 'วิดีโอทั้งหมด', stations: stations }];
  }

  return groups.map(g => ({
    name: g.name || 'ทั่วไป',
    stations: (g.stations || []).map(s => {
      const stationObj = {
        name: s.name || 'ไม่มีชื่อ',
        image: s.image || '',
        url: s.url || '',
        code: s.code || extractCode(s.name),
        duration: s.duration || ''
      };
      if (s.is_new) {
        stationObj.is_new = true;
      }
      return stationObj;
    }).filter(s => s.url.startsWith('http') && s.url.length > 12)
  })).filter(g => g.stations.length > 0);
}

async function run() {
  console.log('Starting playlist conversion, validation and deduplication...\n');

  if (!fs.existsSync(PLAYLISTS_DIR)) {
    console.error('Playlists directory not found!');
    return;
  }

  const files = fs.readdirSync(PLAYLISTS_DIR);
  const parsedPlaylists = [];

  // 1. Parse all files
  for (const file of files) {
    const filePath = path.join(PLAYLISTS_DIR, file);
    let text = fs.readFileSync(filePath, 'utf8').trim();
    if (text.charCodeAt(0) === 0xFEFF) {
      text = text.substring(1);
    }
    if (!text) continue;

    const isM3u = file.toLowerCase().endsWith('.m3u') || text.startsWith('#EXTM3U');
    let groups = [];
    let name = path.basename(file, path.extname(file));

    // Try extracting playlist name from inside
    const nameMatch = text.match(/"name"\s*:\s*"([^"]+)"/) || text.match(/name\s*:\s*"([^"]+)"/);
    if (nameMatch && !isM3u) {
      name = nameMatch[1].trim();
    }

    try {
      groups = isM3u ? parseM3U(text) : parseJSON(text);
    } catch (err) {
      console.error(`❌ Failed to parse ${file}: ${err.message}`);
      continue;
    }

    const urls = [];
    groups.forEach(g => g.stations.forEach(s => urls.push(s.url)));

    if (urls.length === 0) {
      console.log(`⚠️ Playlist ${file} is empty, skipping.`);
      continue;
    }

    parsedPlaylists.push({
      originalFile: file,
      originalPath: filePath,
      name: name,
      groups: groups,
      urls: new Set(urls),
      urlArray: urls
    });
  }

  console.log(`Parsed ${parsedPlaylists.length} playlists successfully. Checking for duplicates...\n`);

  // 2. Identify and flag duplicates
  const duplicates = new Set();
  const keepPlaylists = [];

  for (let i = 0; i < parsedPlaylists.length; i++) {
    if (duplicates.has(i)) continue;

    const p1 = parsedPlaylists[i];
    keepPlaylists.push(p1);

    for (let j = i + 1; j < parsedPlaylists.length; j++) {
      if (duplicates.has(j)) continue;

      const p2 = parsedPlaylists[j];
      
      let intersectionCount = 0;
      p2.urlArray.forEach(url => {
        if (p1.urls.has(url)) intersectionCount++;
      });

      const unionSize = p1.urls.size + p2.urls.size - intersectionCount;
      const similarity = intersectionCount / unionSize;
      const sizeDiff = Math.abs(p1.urls.size - p2.urls.size);

      // Strict duplicate detection (excludes subsets like Japan list vs All list)
      if (similarity > 0.98 || (similarity > 0.90 && sizeDiff < 15)) {
        duplicates.add(j);
        console.log(`♻️ Found duplicate: "${p2.originalFile}" matches "${p1.originalFile}" (${(similarity * 100).toFixed(1)}% match, size diff: ${sizeDiff}).`);
      }
    }
  }

  console.log(`\nRemaining unique playlists: ${keepPlaylists.length}. Safe writing standard JSON files...\n`);

  // 3. Clear ALL files in playlists directory to prevent naming collisions
  const filesToDelete = fs.readdirSync(PLAYLISTS_DIR);
  filesToDelete.forEach(file => {
    fs.unlinkSync(path.join(PLAYLISTS_DIR, file));
  });
  console.log('🧹 Cleaned playlists/ directory for clean write.');

  // Load health summary if exists
  let healthMap = {};
  const summaryPath = path.join(__dirname, 'playlists_detailed_summary.json');
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
      console.log(`Loaded health summary for ${Object.keys(healthMap).length} playlists.`);
    } catch (err) {
      console.error('[Error] Failed to read playlists_detailed_summary.json:', err.message);
    }
  }

  const finalIndex = [];

  // 4. Write Standard JSON
  for (const pl of keepPlaylists) {
    const info = getBeautifulName(pl.name);
    console.log(`Processing "${pl.name}" -> Renaming to "${info.title}" (${info.fileName})`);

    const statusBadge = '🟢 LOADABLE';
    const newPath = path.join(PLAYLISTS_DIR, info.fileName);

    const standardJSON = {
      name: info.title,
      groups: pl.groups
    };

    fs.writeFileSync(newPath, JSON.stringify(standardJSON, null, 2), 'utf8');
    console.log(`   Saved JSON: ${info.fileName}`);

    const healthInfo = healthMap[info.fileName] || { health: 100, healthScore: '100%', workingVideos: pl.urlArray.length };

    finalIndex.push({
      name: info.title,
      file: `playlists/${info.fileName}`,
      type: 'json',
      originalName: pl.originalFile,
      status: statusBadge,
      totalVideos: pl.urlArray.length,
      health: healthInfo.health,
      healthScore: healthInfo.healthScore,
      workingVideos: healthInfo.workingVideos
    });
  }

  function getPlaylistRank(file) {
    const f = decodeURIComponent(file || '').toLowerCase();
    if (f.includes('heedeng')) return 1;
    if (f.includes('lovehee')) return 2;
    if (f.includes('homhee')) return 3;
    if (f.includes('jav_อัปเดต') || f.includes('4_ส_ค_66')) return 4;
    return 99;
  }

  // Sort: Top priority playlists first (Heedeng, Lovehee, Homhee), then health score desc, then name asc
  finalIndex.sort((a, b) => {
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

  // Re-write playlists_index.json
  const indexFilePath = path.join(__dirname, 'playlists_index.json');
  fs.writeFileSync(indexFilePath, JSON.stringify(finalIndex, null, 2), 'utf8');

  console.log(`\nAll done! Standardized index created at playlists_index.json with ${finalIndex.length} sources.`);
}

run();
