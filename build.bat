@echo off
setlocal EnableExtensions
pushd "%~dp0"
if not exist build mkdir build
if not exist build\shared mkdir build\shared
if not exist build\server mkdir build\server
if not exist build\client mkdir build\client
where javac >nul 2>nul
if errorlevel 1 (
  echo javac not found. Install JDK 21 and try again.
  exit /b 1
)
where jar >nul 2>nul
if errorlevel 1 (
  echo jar not found. Install JDK 21 and try again.
  exit /b 1
)
del /q build\shared-sources.txt build\server-sources.txt build\client-sources.txt 2>nul
for /r src\rpgshared %%f in (*.java) do echo %%f>> build\shared-sources.txt
for /r src\rpgserver %%f in (*.java) do echo %%f>> build\server-sources.txt
for /r src\rpgclient %%f in (*.java) do echo %%f>> build\client-sources.txt
for %%f in (build\shared-sources.txt build\server-sources.txt build\client-sources.txt) do (
  if not exist %%f (
    echo Failed to generate %%f. Ensure the src folder is present.
    popd
    exit /b 1
  )
)
javac --release 21 -encoding UTF-8 -d build\shared @build\shared-sources.txt
if errorlevel 1 exit /b 1
javac --release 21 -encoding UTF-8 -cp build\shared -d build\server @build\server-sources.txt
if errorlevel 1 exit /b 1
javac --release 21 -encoding UTF-8 -cp build\shared -d build\client @build\client-sources.txt
if errorlevel 1 exit /b 1
if not exist build\server\rpgserver\GameServer.class (
  echo Server classes were not generated. Ensure javac succeeded and the source paths are correct.
  exit /b 1
)
if not exist build\client\rpgclient\RpgClientApp.class (
  echo Client classes were not generated. Ensure javac succeeded and the source paths are correct.
  exit /b 1
)
echo Main-Class: rpgserver.GameServer> build\server.mf
echo Main-Class: rpgclient.RpgClientApp> build\client.mf
jar cfm build\server.jar build\server.mf -C build\shared . -C build\server .
jar cfm build\client.jar build\client.mf -C build\shared . -C build\client .
echo Built build\server.jar and build\client.jar
popd
endlocal
