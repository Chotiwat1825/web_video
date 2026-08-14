@echo off
chcp 65001 >nul
title PlayIDTV - Deploy & Push to GitHub
echo ======================================================
echo   ระบบ Deploy, Commit และ Push ขึ้น GitHub อัตโนมัติ
echo ======================================================
echo.

set /p msg="พิมพ์ข้อความ Commit (กด Enter หากต้องการใช้ข้อความอัตโนมัติ): "

echo.
if "%msg%"=="" (
    node "%~dp0deploy.js"
) else (
    node "%~dp0deploy.js" "%msg%"
)

echo.
echo ======================================================
echo  เสร็จสิ้นการทำงาน
echo ======================================================
pause
