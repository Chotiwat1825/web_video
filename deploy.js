/**
 * PlayIDTV / Web Video - Automatic Deploy & PWA Version Bumper
 * 
 * Workflow:
 * 1. Syntax checking across JS files
 * 2. Auto-bump patch version in package.json, sw.js, and index.html
 * 3. Git add, commit, and push to origin master
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

console.log('======================================================');
console.log('🚀 เริ่มต้นกระบวนการ Deploy & Bump Version');
console.log('======================================================\n');

// ── 1. Pre-flight Syntax Checks ───────────────────────────
console.log('▶ [1/4] ตรวจสอบ Syntax ไฟล์ JavaScript...');
const filesToCheck = ['app.js', 'sw.js', 'server.js', 'convert_homhee.js', 'convert_playlists.js'];

for (const file of filesToCheck) {
  const filePath = path.join(__dirname, file);
  if (fs.existsSync(filePath)) {
    try {
      execSync(`node --check "${filePath}"`, { stdio: 'pipe' });
      console.log(`  ✓ ${file} ผ่านการตรวจสอบ`);
    } catch (err) {
      console.error(`  ❌ Syntax error ใน ${file}:`, err.message);
      process.exit(1);
    }
  }
}

// ── 2. Determine & Bump Version ───────────────────────────
console.log('\n▶ [2/4] ปรับเวอร์ชัน (Version Bumping & Cache-Busting)...');

const pkgPath = path.join(__dirname, 'package.json');
const swPath = path.join(__dirname, 'sw.js');
const indexPath = path.join(__dirname, 'index.html');

let pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
const currentVersion = pkg.version || '1.0.0';

// Custom version or bump patch
let nextVersion = process.argv[2];
let customCommitMsg = process.argv[3];

// If argument is commit message instead of version
if (nextVersion && !/^\d+\.\d+\.\d+$/.test(nextVersion)) {
  customCommitMsg = nextVersion;
  nextVersion = null;
}

if (!nextVersion) {
  const parts = currentVersion.split('.').map(Number);
  parts[2] = (parts[2] || 0) + 1;
  nextVersion = parts.join('.');
}

console.log(`  เวอร์ชันปัจจุบัน: v${currentVersion}`);
console.log(`  เวอร์ชันใหม่:     v${nextVersion}`);

// 2.1 Update package.json
pkg.version = nextVersion;
fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + '\n', 'utf8');
console.log(`  ✓ อัปเดต package.json -> ${nextVersion}`);

// 2.2 Update sw.js
if (fs.existsSync(swPath)) {
  let swContent = fs.readFileSync(swPath, 'utf8');
  swContent = swContent.replace(/const CACHE_VERSION = ['"]v?[^'"]+['"];/, `const CACHE_VERSION = 'v${nextVersion}';`);
  swContent = swContent.replace(/style\.css\?v=[a-zA-Z0-9\._\-]+/g, `style.css?v=${nextVersion}`);
  swContent = swContent.replace(/app\.js\?v=[a-zA-Z0-9\._\-]+/g, `app.js?v=${nextVersion}`);
  fs.writeFileSync(swPath, swContent, 'utf8');
  console.log(`  ✓ อัปเดต sw.js -> v${nextVersion}`);
}

// 2.3 Update index.html
if (fs.existsSync(indexPath)) {
  let indexContent = fs.readFileSync(indexPath, 'utf8');
  indexContent = indexContent.replace(/style\.css\?v=[a-zA-Z0-9\._\-]+/g, `style.css?v=${nextVersion}`);
  indexContent = indexContent.replace(/app\.js\?v=[a-zA-Z0-9\._\-]+/g, `app.js?v=${nextVersion}`);
  fs.writeFileSync(indexPath, indexContent, 'utf8');
  console.log(`  ✓ อัปเดต index.html -> v${nextVersion}`);
}

// ── 3. Git Staging & Commit ───────────────────────────────
console.log('\n▶ [3/4] กำลังบันทึก Git Commit...');

const defaultMsg = `chore(release): bump version to v${nextVersion} & update playlists/preview`;
const commitMessage = customCommitMsg ? `${customCommitMsg} (v${nextVersion})` : defaultMsg;

try {
  execSync('git add -A', { cwd: __dirname, stdio: 'inherit' });
  execSync(`git commit -m "${commitMessage.replace(/"/g, '\\"')}"`, { cwd: __dirname, stdio: 'inherit' });
  console.log(`  ✓ สร้าง Commit: "${commitMessage}"`);
} catch (err) {
  // If nothing to commit
  console.log('  ℹ️ ไม่มีไฟล์ที่มีการเปลี่ยนแปลงเพิ่มเติมสำหรับ commit');
}

// ── 4. Git Push ───────────────────────────────────────────
console.log('\n▶ [4/4] กำลัง Push ขึ้นสู่ Remote Repository...');

try {
  // Get current branch
  const branch = execSync('git branch --show-current', { cwd: __dirname, encoding: 'utf8' }).trim() || 'master';
  execSync(`git push origin ${branch}`, { cwd: __dirname, stdio: 'inherit' });
  console.log(`\n🎉 Deploy สำเร็จเรียบร้อย!`);
  console.log(`  สาขา:    ${branch}`);
  console.log(`  เวอร์ชัน: v${nextVersion}`);
  console.log(`  ข้อความ:  "${commitMessage}"`);
  console.log(`\n⏳ GitHub Pages จะทำการ Deploy อัปเดตขึ้นหน้าเว็บภายใน 1-2 นาที`);
} catch (err) {
  console.error('\n❌ เกิดข้อผิดพลาดในการ Push ขึ้น GitHub:', err.message);
  process.exit(1);
}
