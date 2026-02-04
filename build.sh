#!/usr/bin/env bash
set -euo pipefail
if ! command -v javac >/dev/null 2>&1; then
  echo "javac not found. Install JDK 21 and ensure javac is on PATH."
  exit 1
fi
if ! command -v jar >/dev/null 2>&1; then
  echo "jar not found. Install JDK 21 and ensure jar is on PATH."
  exit 1
fi
mkdir -p build/shared build/server build/client
find src/rpgshared -name "*.java" > build/shared-sources.txt
find src/rpgserver -name "*.java" > build/server-sources.txt
find src/rpgclient -name "*.java" > build/client-sources.txt
javac --release 21 -encoding UTF-8 -d build/shared @build/shared-sources.txt
javac --release 21 -encoding UTF-8 -cp build/shared -d build/server @build/server-sources.txt
javac --release 21 -encoding UTF-8 -cp build/shared -d build/client @build/client-sources.txt
if [[ ! -f build/server/rpgserver/GameServer.class ]]; then
  echo "Server classes were not generated. Ensure javac succeeded and the source paths are correct."
  exit 1
fi
if [[ ! -f build/client/rpgclient/RpgClientApp.class ]]; then
  echo "Client classes were not generated. Ensure javac succeeded and the source paths are correct."
  exit 1
fi
echo "Main-Class: rpgserver.GameServer" > build/server.mf
echo "Main-Class: rpgclient.RpgClientApp" > build/client.mf
jar cfm build/server.jar build/server.mf -C build/shared . -C build/server .
jar cfm build/client.jar build/client.mf -C build/shared . -C build/client .
echo "Built build/server.jar and build/client.jar"
