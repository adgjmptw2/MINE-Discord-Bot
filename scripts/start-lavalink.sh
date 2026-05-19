#!/usr/bin/env bash
#
# Lavalink.jar 및 application.yml 이 있는 디렉터리에서 실행하세요.
#
# npm 사용(Windows 포함): 프로젝트 루트에서 .env에 LAVALINK_JAR_DIR 설정 후
#   npm run start:lavalink
#
# 사용 예 (Linux / macOS):
#   cd /path/to/your/lavalink
#   bash /path/to/MINE-Discord-main/scripts/start-lavalink.sh
#
# 또는 이 스크립트를 Lavalink 디렉터리에 복사한 뒤:
#   cd /path/to/your/lavalink
#   chmod +x start-lavalink.sh
#   ./start-lavalink.sh
#
set -euo pipefail

if [[ ! -f ./Lavalink.jar ]]; then
  echo "Lavalink.jar 가 현재 디렉터리에 없습니다. jar 가 있는 폴더로 cd 한 뒤 다시 실행하세요." >&2
  exit 1
fi

exec java -Xms512m -Xmx1024m -jar Lavalink.jar
