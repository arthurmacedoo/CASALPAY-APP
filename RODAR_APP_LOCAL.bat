@echo off
title CasalPay - Servidor Local
echo ========================================================
echo   Iniciando o servidor local do CasalPay...
echo   Abrindo http://localhost:5173 no seu navegador...
echo ========================================================
echo.

cd /d "%~dp0"

:: Abre o navegador automaticamente apos 2 segundos
start "" cmd /c "timeout /t 2 /nobreak >nul && start http://localhost:5173"

:: Inicia o Vite dev server
npm run dev

pause
