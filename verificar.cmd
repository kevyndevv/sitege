@echo off
REM ==========================================================================
REM  Verificacao do projeto: instala dependencias, procura vulnerabilidades,
REM  confere tipos, lint e compila. O resultado fica em verificacao.log
REM  Basta dar dois cliques neste arquivo.
REM ==========================================================================
cd /d "%~dp0"
where npm >nul 2>nul
if errorlevel 1 (
  echo.
  echo O Node.js nao esta instalado neste computador.
  echo Instale a versao LTS em https://nodejs.org e rode este arquivo de novo.
  echo Node.js nao encontrado: instale a versao LTS em https://nodejs.org > verificacao.log
  pause
  exit /b 1
)
echo Verificando o projeto. Isso pode levar alguns minutos...
echo ===== %date% %time% ===== > verificacao.log

echo.>> verificacao.log
echo ===== npm install ===== >> verificacao.log
call npm install >> verificacao.log 2>&1
echo [npm install] codigo de saida: %errorlevel% >> verificacao.log
if not exist "node_modules\@supabase\ssr" (
  echo ===== npm install @supabase/ssr ===== >> verificacao.log
  call npm install @supabase/ssr >> verificacao.log 2>&1
)

echo.>> verificacao.log
echo ===== npm audit fix (correcoes sem quebra) ===== >> verificacao.log
call npm audit fix >> verificacao.log 2>&1
echo.>> verificacao.log
echo ===== npm audit (dependencias de producao) ===== >> verificacao.log
call npm audit --omit=dev >> verificacao.log 2>&1
echo [npm audit] codigo de saida: %errorlevel% >> verificacao.log

echo.>> verificacao.log
echo ===== typecheck ===== >> verificacao.log
call npx tsc --noEmit >> verificacao.log 2>&1
echo [typecheck] codigo de saida: %errorlevel% >> verificacao.log

echo.>> verificacao.log
echo ===== lint ===== >> verificacao.log
call npm run lint >> verificacao.log 2>&1
echo [lint] codigo de saida: %errorlevel% >> verificacao.log

echo.>> verificacao.log
echo ===== build ===== >> verificacao.log
call npm run build >> verificacao.log 2>&1
echo [build] codigo de saida: %errorlevel% >> verificacao.log

echo.>> verificacao.log
echo ===== FIM ===== >> verificacao.log
echo Pronto! O resultado esta em verificacao.log
pause
