@echo off
setlocal
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
javac --release 21 -d build\shared @build\shared-sources.txt
if errorlevel 1 exit /b 1
javac --release 21 -cp build\shared -d build\server @build\server-sources.txt
if errorlevel 1 exit /b 1
javac --release 21 -cp build\shared -d build\client @build\client-sources.txt
if errorlevel 1 exit /b 1
echo Main-Class: rpgserver.GameServer> build\server.mf
echo Main-Class: rpgclient.RpgClientApp> build\client.mf
jar --create --file build\server.jar --manifest build\server.mf -C build\shared . -C build\server .
jar --create --file build\client.jar --manifest build\client.mf -C build\shared . -C build\client .
echo Built build\server.jar and build\client.jar
endlocal
