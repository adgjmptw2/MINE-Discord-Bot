# Discord 봇 배포 가이드

## 개요

- 개발·기능 테스트는 **로컬 PC**에서도 충분히 할 수 있습니다.
- 친구 서버에 올리거나 **베타 운영**할 때는 **VM(가상 서버)** 을 권장합니다.
- 음악 봇은 **네트워크·전원 안정성**이 체감 품질에 크게 영향을 주므로, 상시 켜두는 용도에는 로컬 PC보다 **항상 켜 둔 VM**이 보통 더 적합합니다.
- 초기 구성은 **봇(Node)과 Lavalink를 같은 VM**에서 띄우는 것이 가장 단순합니다.

## 권장 구조

**VM 1대 예시**

- Node.js 봇 프로세스
- Lavalink 프로세스
- SQLite DB 파일(기본 `storage/mine.sqlite`)
- **systemd** 또는 **pm2**로 프로세스 감시·자동 재시작(선택)

초기 베타는 위 구조로 충분합니다. 트래픽이 커지면 나중에 **봇과 Lavalink를 서버를 나누는** 식으로 분리할 수 있습니다.

## 로컬 개발 실행

저장소 루트에서:

```bash
npm install
npm run check
npm run build
npm run start:bot
```

- **`.env`** 가 필요합니다. (`.env.example` 참고)
- **Lavalink** 가 먼저 떠 있어야 음악 기능이 정상 동작합니다.
- SQLite는 기본적으로 **`storage/mine.sqlite`** 를 사용합니다. (`storage/` 디렉터리는 봇이 필요 시 생성합니다.)

## VM 배포 준비

다음을 갖추는 것을 권장합니다.

- **Node.js 20 이상** (프로젝트 `engines`: `>=20 <25`)
- **Java**: Lavalink 배포본이 요구하는 버전(보통 **17+**). 사용하는 Lavalink 릴리스 README를 따르세요.
- **Git** (코드 배포용)
- **방화벽**: Discord·Lavalink·(필요 시) 시세 API 아웃바운드 허용
- **메모리**: Lavalink + Node + 여유
- **안정적인 네트워크**

OS별 설치 명령은 공식 문서가 가장 정확합니다. **Ubuntu 계열** 예시만 적으면 다음 정도입니다.

```bash
# Node 20+ (예: NodeSource 또는 nvm 사용 — 공식 가이드 권장)
# Java 17+ (예: apt install openjdk-17-jre-headless — 배포본에 맞게 조정)
```

## .env 설정

**실제 토큰·API 키 값은 문서에 적지 마세요.** `.env`는 **Git에 커밋하지 않습니다.** (`.gitignore`에 포함)

이 프로젝트에서 자주 쓰는 변수 이름 예시입니다. (값은 각자 생성·발급)

| 변수 | 용도 요약 |
| --- | --- |
| `TOKEN` | Discord 봇 토큰 |
| `CLIENT_ID` | 애플리케이션 ID (슬래시 등록 등) |
| `DEV_GUILD_ID` | (선택) 길드 단위로 슬래시 즉시 반영 테스트 |
| `RESET_SLASH_COMMANDS_ON_START` | (선택) 시작 시 명령 초기화 |
| `DISCORD_OWNER_IDS` | (선택) 봇 오너 ID 목록 — 일부 관리 명령 |
| `LAVALINK_NAME` | 노드 이름 |
| `LAVALINK_HOST` | Lavalink 호스트 |
| `LAVALINK_PORT` | Lavalink 포트 |
| `LAVALINK_PASSWORD` | Lavalink 비밀번호 |
| `LAVALINK_SECURE` | WSS 사용 여부 |
| `LAVALINK_ENGINE` | 검색 엔진(예: `ytsearch`) |
| `SHARD_COUNT` / `SHARD_LIST` | (선택) 샤딩 |
| `STOCK_PRICE_PROVIDER` | `mock` \| `yahoo` \| `twelvedata` |
| `STOCK_PRICE_REFRESH_INTERVAL_MS` | (선택) interval 모드 갱신 주기 |
| `STOCK_PRICE_REFRESH_MODE` | `interval` \| `scheduled-close` |
| `STOCK_SCHEDULED_CLOSE_REFRESH_TIMES_KST` | scheduled-close일 때 KST `HH:mm` 목록 |
| `TWELVE_DATA_API_KEY` | `twelvedata` 사용 시 |

## Lavalink 운영

- **Lavalink를 봇보다 먼저** 기동하는 편이 안전합니다.
- `.env`의 `LAVALINK_HOST` / `PORT` / `PASSWORD` 가 Lavalink 서버 설정과 **일치**해야 합니다.
- 음악이 자주 끊기면: **VM 네트워크**, **Lavalink 로그**, **Node 봇 로그** 순으로 확인합니다.
- **YouTube 소스**·정책·플러그인 이슈일 수 있습니다.
- 동일 사양이라도 **상시 VM**이 로컬 PC보다 안정적인 경우가 많습니다.

## SQLite 운영

- 기본 DB 파일: **`storage/mine.sqlite`**
- 여기에는 지갑·거래·출석·시즌·코인 설정·게임 로그 등 **서버 가상 경제 데이터**가 쌓입니다.
- **배포 전·주기적으로 백업**하세요. 실수로 지우면 복구가 어렵습니다.
- **자동 백업 기능은 아직 없습니다.**

백업 예시(Linux/macOS):

```bash
cp storage/mine.sqlite storage/mine.sqlite.bak
```

## 재시작 전략

- 개발 중: `npm run start:bot` (스크립트가 빌드 후 `node dist/index.js` 실행)
- 운영: **pm2** 또는 **systemd** 권장(프로세스 재시작·로그)

이 레포에는 **운영용 unit 파일·Docker Compose는 포함하지 않습니다.** 아래는 **예시**입니다.

**pm2 예시** (`package.json`의 `start:bot`과 동일하게 빌드+실행):

```bash
pm2 start "npm run start:bot" --name mine-discord-bot
pm2 logs mine-discord-bot
pm2 restart mine-discord-bot
```

이미 빌드된 `dist`만 돌리고 싶다면 `node dist/index.js`만 pm2에 넣고, 배포 파이프에서 `npm run build`를 분리하는 방식도 가능합니다.

## 배포 전 체크리스트

- [ ] `npm run check` 성공
- [ ] `npm run build` 성공
- [ ] `.env` 설정 완료
- [ ] Lavalink 실행 확인
- [ ] `/상태` 정상
- [ ] `/도움말` 정상
- [ ] `/출석` 정상
- [ ] `/알바` 정상
- [ ] `/주식목록` 정상
- [ ] `/가위바위보` 정상
- [ ] `/랭킹` 정상
- [ ] SQLite DB 백업 완료

상세 점검 항목은 [베타 운영 체크리스트](./beta-ops-checklist.md)를 함께 보세요.

## 장애 대응

### 음악 끊김

- VM·서버 **네트워크** 상태
- **Lavalink** 로그(연결·재연결·소스 로드 오류)
- **Node 봇** 로그
- **YouTube 소스**·Lavalink 플러그인 이슈 가능성

### 주식 시세가 안 뜸

- `/상태`에서 provider·최근 오류 메시지 확인
- **`STOCK_PRICE_PROVIDER=mock`** 으로 전환해 기능·명령만 빠르게 검증 가능

### DB 오류

- `/상태`의 DB 항목 확인
- `storage/mine.sqlite` 존재·권한 확인
- 최근 **백업**에서 복구 검토

## 알려진 한계

- **자동 DB 백업** 없음
- **systemd / pm2 설정 파일**은 레포에 포함하지 않음(문서 예시만)
- **Docker** 배포 구성 없음
- **웹 대시보드** 없음
- Yahoo provider는 **demo / delayed** 성격의 시세 소스이며 실제 투자용이 아님
- **실제 돈·현물·환전** 기능 없음
