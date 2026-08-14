const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');

console.log('=== เริ่มต้นการอัปเดตข้อมูลวิดีโอและเพลย์ลิสต์ทั้งหมด ===\n');

function runCommand(command, cwd) {
  console.log(`> รันคำสั่ง: ${command} (ในโฟลเดอร์: ${cwd})`);
  try {
    execSync(command, { cwd: path.join(__dirname, cwd), stdio: 'inherit' });
    console.log(`[สำเร็จ]\n`);
  } catch (error) {
    console.error(`[เกิดข้อผิดพลาด] ในการรันคำสั่ง ${command}:`, error.message);
    process.exit(1);
  }
}

// 1. อัปเดตข้อมูล Heedeng
console.log('--- [1/7] กำลังอัปเดตข้อมูลวิดีโอ Heedeng ---');
runCommand('python scrape_heedeng_update.py', 'scrape_heedeng');

// 2. แปลงเพลย์ลิสต์ Heedeng
console.log('--- [2/7] กำลังแปลงข้อมูลเพลย์ลิสต์ Heedeng ---');
runCommand('node convert_heedeng.js', '.');

// 3. อัปเดตข้อมูล Lovehee
console.log('--- [3/7] กำลังอัปเดตข้อมูลวิดีโอ Lovehee ---');
runCommand('python scrape_lovehee_update.py', 'scrape_lovehee');

// 4. แปลงเพลย์ลิสต์ Lovehee
console.log('--- [4/7] กำลังแปลงข้อมูลเพลย์ลิสต์ Lovehee ---');
runCommand('node convert_lovehee.js', '.');

// 5. อัปเดตข้อมูล Homhee
console.log('--- [5/7] กำลังอัปเดตข้อมูลวิดีโอ Homhee ---');
runCommand('python scrape_homhee_update.py', 'scrape_homhee');

// 6. แปลงเพลย์ลิสต์ Homhee
console.log('--- [6/7] กำลังแปลงข้อมูลเพลย์ลิสต์ Homhee ---');
runCommand('node convert_homhee.js', '.');

// 7. รวบรวมและอัปเดตดัชนีเพลย์ลิสต์ทั้งหมด
console.log('--- [7/7] กำลังรวมเพลย์ลิสต์และสร้างดัชนีใหม่ ---');
runCommand('node convert_playlists.js', '.');

console.log('=== อัปเดตข้อมูลเพลย์ลิสต์เสร็จสิ้นสมบูรณ์! ===');
