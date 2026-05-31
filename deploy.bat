@echo off
title Deploy CasalPay
cd /d "%~dp0"
echo ===================================================
echo   Iniciando o Deploy do CasalPay na Vercel
echo ===================================================
echo.
echo 1. Se for sua primeira vez, o terminal vai pedir para logar.
echo 2. Pressione ENTER para todas as perguntas seguintes para usar as configuracoes padrao.
echo.
npx vercel
echo.
echo ===================================================
echo   Pronto! Copie o link gerado acima para acessar.
echo ===================================================
pause
