@echo off
chcp 65001 >nul
title Update Web Video Playlists
echo ======================================================
echo  กำลังเรียกใช้สคริปต์อัปเดตวิดีโอ (Heedeng, Lovehee, Homhee และ Jable)
echo ======================================================
node "%~dp0update_all.js"
echo.
echo เสร็จสิ้นการทำงานแล้ว
pause
