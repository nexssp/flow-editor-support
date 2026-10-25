@echo off
setlocal
set "NFLOW_COMMAND=nflow"
if defined NFLOW_BIN set "NFLOW_COMMAND=%NFLOW_BIN%"
"%NFLOW_COMMAND%" fmt --write %*
exit /b %ERRORLEVEL%
