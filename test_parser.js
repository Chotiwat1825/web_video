const fs = require('fs');
const path = require('path');

function verify() {
  const index = JSON.parse(fs.readFileSync('playlists_index.json', 'utf8'));
  console.log(`Verifying ${index.length} pre-processed JSON playlists...\n`);

  let passed = 0;

  index.forEach(item => {
    try {
      const text = fs.readFileSync(item.file, 'utf8');
      const data = JSON.parse(text);

      let totalStations = 0;
      if (data.groups && Array.isArray(data.groups)) {
        data.groups.forEach(g => {
          totalStations += g.stations ? g.stations.length : 0;
        });
      }

      console.log(`[PASS] ${item.name} -> Loaded Standard JSON. Groups: ${data.groups.length}, Videos: ${totalStations}. Status: ${item.status || 'Unknown'}`);
      passed++;
    } catch (err) {
      console.log(`[FAIL] ${item.name} -> Error: ${err.message}`);
    }
  });

  console.log(`\nVerification Summary: ${passed}/${index.length} passed.`);
}

verify();
