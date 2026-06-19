@echo off
setlocal

set "SCRIPT_DIR=%~dp0"
set "ROOT_DIR=%SCRIPT_DIR%.."
set "DIST_DIR=%ROOT_DIR%\desktop\dist"
set "BACKEND_DIST_DIR=%DIST_DIR%\mofox-backend"
set "TAURI_DIR=%ROOT_DIR%\desktop\tauri"
set "TAURI_RELEASE_DIR=%TAURI_DIR%\target\release"
set "TAURI_BACKEND_DIR=%TAURI_RELEASE_DIR%\mofox-backend"
set "TAURI_BUNDLE_DIR=%TAURI_RELEASE_DIR%\bundle"

echo === Step 0: Clean stale package outputs ===
if exist "%BACKEND_DIST_DIR%" rmdir /s /q "%BACKEND_DIST_DIR%"
if exist "%TAURI_BACKEND_DIR%" rmdir /s /q "%TAURI_BACKEND_DIR%"
if exist "%TAURI_BUNDLE_DIR%" rmdir /s /q "%TAURI_BUNDLE_DIR%"

echo === Step 1: Build webui frontend ===
cd /d "%ROOT_DIR%\plugins\coding_agent_webui\frontend"
call npm run build
if %ERRORLEVEL% neq 0 exit /b %ERRORLEVEL%

echo === Step 2: PyInstaller build backend ===
cd /d "%ROOT_DIR%"
.venv\Scripts\python.exe -m PyInstaller desktop\mofox-backend.spec --distpath desktop\dist --workpath desktop\build --clean
if %ERRORLEVEL% neq 0 exit /b %ERRORLEVEL%

echo === Step 3: Copy plugins to output root ===
robocopy desktop\dist\mofox-backend\_internal\plugins desktop\dist\mofox-backend\plugins /E /NFL /NDL /NJH /NJS
if %ERRORLEVEL% geq 8 exit /b %ERRORLEVEL%

echo === Step 4: Tauri build ===
cd /d "%TAURI_DIR%"
cargo tauri build --bundles nsis
if %ERRORLEVEL% neq 0 (
    echo NSIS build failed, creating portable package...
    goto :portable
)
goto :done

:portable
cd /d "%ROOT_DIR%\desktop"
if exist "dist\MoFox-Code-portable" rmdir /s /q "dist\MoFox-Code-portable"
mkdir "dist\MoFox-Code-portable"
robocopy tauri\target\release dist\MoFox-Code-portable mofox-code-desktop.exe /NFL /NDL /NJH /NJS
robocopy dist\mofox-backend dist\MoFox-Code-portable\mofox-backend /E /NFL /NDL /NJH /NJS
echo Portable package: desktop\dist\MoFox-Code-portable\

:done
echo === Build complete ===
