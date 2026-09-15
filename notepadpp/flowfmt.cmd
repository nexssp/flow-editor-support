@echo off
setlocal
set "ROOT=%~dp0.."
node "%ROOT%\fmt\cli.js" --write %*
exit /b %ERRORLEVEL%
