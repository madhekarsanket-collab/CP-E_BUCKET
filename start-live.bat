@echo off
REM Starts the E-Bucket shop and its ngrok tunnel so https://e-bucket-shop.vercel.app works.
REM Needs: MySQL running, backend\.env filled in, ngrok signed in (ngrok config add-authtoken ...).
REM Keep this window open. Closing it takes the live site offline.
cd /d "%~dp0backend"
start "E-Bucket server" cmd /k python app.py
timeout /t 5 /nobreak >nul
ngrok http 5050 --url=https://slicer-liking-gravy.ngrok-free.dev
