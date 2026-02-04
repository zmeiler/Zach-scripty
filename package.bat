@echo off
setlocal EnableExtensions
pushd "%~dp0"
if not exist build\client.jar (
  echo build\client.jar not found. Run build.bat first.
  popd
  exit /b 1
)
if not exist build\server.jar (
  echo build\server.jar not found. Run build.bat first.
  popd
  exit /b 1
)
where jpackage >nul 2>nul
if errorlevel 1 (
  echo jpackage not found. Install JDK 21+ with jpackage support and try again.
  popd
  exit /b 1
)
jpackage --type exe --name OakridgeOnline --input build --main-jar client.jar --main-class rpgclient.RpgClientApp --java-options "-Xmx512m"
jpackage --type exe --name OakridgeServer --input build --main-jar server.jar --main-class rpgserver.GameServer
jpackage --type msi --name OakridgeOnline --input build --main-jar client.jar --main-class rpgclient.RpgClientApp --java-options "-Xmx512m"
echo Packaging complete. Check the current folder for OakridgeOnline and OakridgeServer installers.
popd
endlocal
