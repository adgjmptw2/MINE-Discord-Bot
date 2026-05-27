# MINE Soundroom Web Dashboard 운영 체크리스트

웹 대시보드를 **실제 운영(HTTPS 공개)** 하기 전·후에 확인할 항목을 한 곳에 모은 문서입니다.

이 문서는 **법률 자문**이나 **보안 감사 보고서**가 아니며, 운영자가 따라 할 **체크리스트·런북**입니다. 실제 공개 전에는 운영자가 내용·정책 페이지·Discord Portal 설정을 직접 확인해야 합니다.

민감 정보(Discord Bot Token, OAuth Client Secret, `WEB_DASHBOARD_SESSION_SECRET`, Lavalink 비밀번호, DB 경로, `.env` 전체)는 **문서·스크린샷·Git에 넣지 마세요.** 예시는 `example.com`, `your-client-id`, `operator@example.com` 같은 **placeholder**만 사용합니다.

관련 문서:

- [웹 대시보드 배포 가이드](./WEB_DASHBOARD_DEPLOYMENT.md) — 개발·정적 서빙·HTTPS·env 상세
- [개인정보처리방침 원문](./PRIVACY_POLICY.md) · [이용약관 원문](./TERMS_OF_SERVICE.md)
- [봇 전체 배포](./deployment.md) · [베타 운영 점검](./beta-ops-checklist.md)

---

## 1. 목적

- 배포 전 빌드·설정·보안 env가 맞는지 확인한다.
- 배포 후 로그인·조작·정책 페이지가 동작하는지 검증한다.
- 문제 발생 시 **백업·롤백**으로 이전 상태로 되돌릴 수 있게 한다.

---

## 2. 배포 전 필수 명령어

프로젝트 루트에서 **순서대로** 실행합니다.

```bash
npm run check
npm run build
npm run dashboard:build
npm run dashboard:preflight
```

| 명령 | 확인 내용 |
| --- | --- |
| `npm run check` | TypeScript 타입 검사 |
| `npm run build` | 봇 `dist` 빌드 |
| `npm run dashboard:build` | `dashboard/dist` (`index.html`, `assets/`) |
| `npm run dashboard:preflight` | `.env`·OAuth·보안 env·정적 빌드 (secret 값 **미출력**) |

`preflight` 별칭: `npm run preflight:web`

### preflight 결과 해석

- **하나라도 FAIL이면** 운영 배포 전에 수정한다. `preflight`에서 **FAIL은 반드시** 해결한다.
- **WARN**은 운영 정책에 맞게 확인한다 (로컬 개발 origin이면 Secure cookie WARN 등은 정상일 수 있음).
- **OK**만 있거나 WARN만 있으면 exit code 0이다.

자세한 항목: [배포 가이드 §5 preflight](./WEB_DASHBOARD_DEPLOYMENT.md#5-운영 전-preflight-점검)

---

## 3. 운영 권장 env (placeholder)

아래는 **문서용 예시**입니다. 실제 값은 서버의 `.env`에만 넣고 **커밋하지 마세요.**

```env
WEB_DASHBOARD_ENABLED=true
WEB_DASHBOARD_AUTH_ENABLED=true
WEB_DASHBOARD_STATIC_ENABLED=true
WEB_DASHBOARD_STATIC_DIR=dashboard/dist

WEB_DASHBOARD_PUBLIC_STATE_ENABLED=false
WEB_DASHBOARD_COOKIE_SECURE=true
WEB_DASHBOARD_REQUIRE_STRONG_SESSION_SECRET=true
WEB_DASHBOARD_RATE_LIMIT_ENABLED=true

WEB_DASHBOARD_ALLOWED_ORIGIN=https://example.com
WEB_DASHBOARD_PUBLIC_URL=https://example.com
WEB_DASHBOARD_HOME_STATS_ENABLED=false
DISCORD_OAUTH_REDIRECT_URI=https://example.com/api/auth/discord/callback
WEB_DASHBOARD_SESSION_SECRET=replace-with-long-random-secret
WEB_DASHBOARD_CONTACT_EMAIL=operator@example.com
```

추가로 운영에서 흔히 쓰는 값 (placeholder):

```env
WEB_DASHBOARD_HOST=127.0.0.1
WEB_DASHBOARD_PORT=3077
DISCORD_OAUTH_CLIENT_ID=your-client-id
DISCORD_OAUTH_CLIENT_SECRET=your-client-secret
```

주의:

- **실제 secret**(`DISCORD_OAUTH_CLIENT_SECRET`, `WEB_DASHBOARD_SESSION_SECRET`, Bot Token)을 Git·문서·채팅에 올리지 않는다.
- `WEB_DASHBOARD_COOKIE_SECURE=true`는 **HTTPS** 환경에서 사용한다.
- **로컬 http** 테스트(`http://127.0.0.1:3077` 등)에서는 Secure 쿠키 때문에 **로그인이 안 될 수 있으므로** 개발 시에는 `WEB_DASHBOARD_COOKIE_SECURE=false`를 쓴다.

세션 시크릿 생성(로컬 터미널에서만, 출력값을 문서에 붙여넣지 마세요):

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

---

## 4. Discord Developer Portal 체크리스트

Application → **OAuth2** 및 앱 설정:

- [ ] **Redirect URI**: `https://example.com/api/auth/discord/callback`  
  (`.env`의 `DISCORD_OAUTH_REDIRECT_URI`와 **문자열 완전 일치**)
- [ ] **Privacy Policy URL**: `https://example.com/privacy`
- [ ] **Terms of Service URL**: `https://example.com/terms`
- [ ] Redirect URI와 Privacy/Terms는 **서로 다른 항목**
- [ ] **OAuth scope**: `identify`, `guilds` (봇 OAuth 설정과 일치하는지 확인)
- [ ] **Client Secret**은 Discord Portal·서버 `.env`에만 저장
- [ ] **Discord Bot Token**은 `.env`의 `TOKEN` 등에만 두고 **커밋·문서·로그에 출력하지 않음**
- [ ] Client ID는 `.env`의 `DISCORD_OAUTH_CLIENT_ID`와 일치

로컬 개발용 Redirect 예 (운영 URL과 별도 등록 가능):

`http://127.0.0.1:3077/api/auth/discord/callback`

---

## 5. 웹 경로 확인

브라우저 또는 `curl`로 확인합니다. 호스트는 운영 placeholder `https://example.com` 기준입니다.

| 경로 | 기대 |
| --- | --- |
| `/` | 공개 랜딩 HTML (로그인 불필요). `HOME_STATS_ENABLED=true` 시 집계 수치만 표시 |
| `/health` | JSON `{ "ok": true, ... }` |
| `/dashboard` | 대시보드 UI (로그인 화면 또는 SPA) |
| `/privacy` | 개인정보처리방침 HTML, **로그인 불필요** |
| `/terms` | 이용약관 HTML, **로그인 불필요** |
| `/api/auth/me` | 로그인 전 401, 로그인 후 사용자 JSON |
| `/api/auth/csrf` | 로그인 전 **401**, 로그인 후 `{ "ok": true, "csrfToken": ... }` |

예시 (placeholder):

```bash
curl -s https://example.com/health
curl -s -o /dev/null -w "%{http_code}" https://example.com/privacy
curl -s -o /dev/null -w "%{http_code}" https://example.com/terms
curl -s -o /dev/null -w "%{http_code}" https://example.com/api/auth/csrf
```

주의:

- `/privacy`, `/terms`는 **로그인 없이** 열려야 한다 (`SESSION_SECRET_WEAK`여도 차단되지 않음).
- `/api/auth/csrf`는 **로그인 전 401** (`UNAUTHORIZED`)이어야 한다.
- `GET /api/soundroom/guilds/:guildId/state` (비인증)는 운영에서 **404** (`WEB_DASHBOARD_PUBLIC_STATE_ENABLED=false`).

---

## 6. CSRF 수동 테스트

대시보드는 `GET /api/auth/csrf` 후 POST에 `X-CSRF-Token`을 붙입니다. 문서·로그에 **실제 csrfToken 값을 넣지 마세요.** 예시는 `<csrf-token>` placeholder만 사용합니다.

### 로그인 전

```bash
curl -s -o /dev/null -w "%{http_code}" https://example.com/api/auth/csrf
```

기대: **401** `UNAUTHORIZED`

### 로그인 후

브라우저로 OAuth 로그인 후, curl에 세션 쿠키 파일(`cookies.txt`)을 사용합니다.

| 테스트 | 기대 |
| --- | --- |
| `GET /api/auth/csrf` | `{ "ok": true, "csrfToken": "<csrf-token>" }` 형태 (값 기록 금지) |
| `POST .../soundroom/control` **CSRF 헤더 없음** | **403** `CSRF_TOKEN_REQUIRED`, **음악 조작 실행 안 됨** |
| `POST` + `X-CSRF-Token: wrong-token` | **403** `CSRF_TOKEN_INVALID` |
| `POST` + `X-CSRF-Token: <csrf-token>` (GET 응답 값) | 같은 노래채널 권한이 맞으면 **성공** |

예시 (placeholder, `GUILD_ID`·쿠키 파일은 실제 값으로 교체):

```bash
curl -s -b cookies.txt https://example.com/api/auth/csrf

curl -s -b cookies.txt -X POST \
  -H "Content-Type: application/json" \
  -d '{"action":"togglePause"}' \
  https://example.com/api/auth/guilds/GUILD_ID/soundroom/control

curl -s -b cookies.txt -X POST \
  -H "Content-Type: application/json" \
  -H "X-CSRF-Token: wrong-token" \
  -d '{"action":"togglePause"}' \
  https://example.com/api/auth/guilds/GUILD_ID/soundroom/control
```

### 프론트·로그아웃

- [ ] DevTools → Network: POST 요청에 **`X-CSRF-Token`** 헤더 존재
- [ ] 로그아웃 후: CSRF 캐시 비움(프론트 메모리), `/api/auth/me`·`/api/auth/csrf`가 **401**
- [ ] `CSRF_TOKEN_*` 오류 시 페이지 **새로고침** (프론트는 토큰 1회 재발급 후 재시도)

reverse proxy가 **`X-CSRF-Token` 헤더를 제거하지 않는지** 확인한다.

---

## 7. 주요 기능 수동 테스트

Discord **음성 채널(노래채널)** 에 들어간 상태에서 조작이 필요한 항목이 있습니다.

- [ ] Discord OAuth 로그인
- [ ] 서버 목록 표시
- [ ] Soundroom(노래채널) 상태 표시
- [ ] 같은 노래채널에서 **재생/일시정지**
- [ ] **스킵**
- [ ] **정지**
- [ ] **볼륨** 적용
- [ ] **자동재생** 토글
- [ ] 자동재생 ON 시 **같은 곡·유사 제목**(official/audio/lyrics 등)만 반복되지 않음
- [ ] 자동재생이 **아티스트 radio/similar** 후보를 쓰고 같은 아티스트가 과도하게 연속되지 않음
- [ ] YouTube **Mix/Radio** URL(`list=RD…`, `start_radio=1`) 후 자동재생이 같은 영상만 반복하지 않음 (Lavalink resolve 환경에 따라 best-effort)
- [ ] 유사 후보만 있을 때 봇이 **오류 없이** 자동재생을 포기하거나 idle로 넘어감
- [ ] 사용자가 **같은 곡을 직접 다시 추가**하는 것은 막히지 않음
- [ ] **레이아웃**: 서버 사이드바 접기/펼치기·선택 후 자동 접힘·메인 상단 서버명·작업 탭(노래 추가/플레이리스트/대기열)·대기열 내부 스크롤
- [ ] **노래 검색**
- [ ] **노래 추가** (단일 곡)
- [ ] **URL 재생목록 추가** (최대 50곡; `watch?v=…&list=PL…` 허용, `list=RD…` Mix는 거절)
- [ ] 예시: `https://www.youtube.com/watch?v=pYD9J0PsA6g&list=PLRlPVY9e8wsBNFvXxH8m-gSWpWOM7z8fk` → 재생목록으로 추가
- [ ] **플레이리스트** 섹션: 내/공개/즐겨찾기 **검색·정렬**, 공개·즐겨찾기 **목록에서 바로 대기열 추가**, 생성·수정·soft delete·곡 관리
- [ ] 공개 플레이리스트 **즐겨찾기/해제** (`POST`/`DELETE …/:id/favorite`, CSRF 필수) · 중복 즐겨찾기 없음
- [ ] 즐겨찾기 목록(`GET …/favorites`)에 숨김·삭제된 공개 플레이리스트 미표시
- [ ] 즐겨찾기/해제 시 Discord 채널 안내 없음 · 해제는 **삭제 아님** · 즐겨찾기는 **canManage 아님**
- [ ] 목록 바로 대기열 추가 성공 시 state 갱신·노래채널 안내 1건(30초 삭제) · `canControl`/0곡 시 버튼 비활성
- [ ] public·즐겨찾기 목록에 **ownerUserId·userId 미노출**, `ownerNameSnapshot`만 표시
- [ ] 상세에서 **canManage=false**이면 수정·삭제·곡 관리 버튼 숨김
- [ ] **현재 대기열에 추가**(10/25/50) · `canControl`/노래채널 권한 없으면 비활성
- [ ] `POST …/soundroom/playlists/:id/add-to-queue` 성공 시 state 즉시 반영·노래채널 안내 1건·30초 삭제·멘션 무알림
- [ ] 플레이리스트 CRUD·곡 관리만으로는 Discord 안내 없음
- [ ] 일반 사용자: `GET …/admin/public`·`GET …/admin/reports`·`POST …/admin/hide` → 403
- [ ] 공개 플레이리스트 **신고** (본인 플레이리스트·중복 신고 거절, detail 300자)
- [ ] 신고 제출·처리 완료·숨김/해제 시 Discord 채널 안내 없음
- [ ] 신고/관리 UI에 **reporterUserId·ownerUserId 미노출**
- [ ] `DISCORD_OWNER_IDS` 운영자: **운영자** 탭(공개 관리·신고 목록)·숨김/해제·처리 완료
- [ ] 숨김 플레이리스트는 일반 공개 목록에서 제외, 운영자 목록에서는 조회
- [ ] **본인이 추가한 곡** 대기열 삭제
- [ ] 대기열 **위/아래** 이동 (queue/swap)
- [ ] Soundroom 패널 **🌐 웹 리모컨** 링크 (`WEB_DASHBOARD_PUBLIC_URL` 설정 시)
- [ ] 웹 리모컨 **조작·추가·대기열 변경** 시 노래채널 안내가 잠시 표시되고 **약 30초 뒤 삭제**
- [ ] **검색만**·**상태/control-status 조회** 시에는 안내 메시지가 뜨지 않음
- [ ] 안내에 `<@userId>`가 있어도 **`allowedMentions: { parse: [] }`** 로 멘션 알림이 울리지 않음
- [ ] Discord Soundroom 패널 **패치노트** 버튼
- [ ] 대시보드 하단 **개인정보처리방침**·**이용약관** 링크

---

## 8. 보안 확인

- [ ] **비인증 state API 차단**: `GET /api/soundroom/guilds/:guildId/state` → 404 (`PUBLIC_STATE_ENABLED=false`)
- [ ] **SESSION_SECRET_WEAK**: 약한 `WEB_DASHBOARD_SESSION_SECRET` + `REQUIRE_STRONG_SESSION_SECRET=true` → `/api/auth/*` 503, `/privacy`·`/terms`는 열림
- [ ] **Secure cookie**: HTTPS에서 `Set-Cookie`에 `Secure` 포함
- [ ] **rate limit**: 과도한 POST 반복 시 **429** `RATE_LIMITED`, `Retry-After` 헤더
- [ ] **path traversal**: `/dashboard/../.env` 등 위험 경로 차단
- [ ] **`.env`, DB, 소스 파일**이 웹으로 노출되지 않음
- [ ] API 응답에 **stack trace** 없음
- [ ] 로그·API 응답에 **Bot Token, OAuth Secret, session secret, csrfToken** 과다 출력 없음

---

## 9. SQLite 백업 (운영 전 권장)

코드·설정 롤백 전에 **DB를 백업**합니다. 실제 DB 파일 경로는 환경마다 다르므로 문서에는 **placeholder**만 사용합니다.

```bash
mkdir -p backups
cp path/to/your-database.sqlite backups/database-$(date +%Y%m%d-%H%M%S).sqlite
```

주의:

- **실제 DB 경로**를 이 문서에 적지 마세요.
- Git 롤백 시 **SQLite 파일을 실수로 덮어쓰지** 마세요. DB는 별도 백업·복구한다.

---

## 10. 업데이트 절차

권장 순서 (placeholder):

```bash
git pull
npm ci
npm run check
npm run build
npm run dashboard:build
npm run dashboard:preflight
```

그다음 **봇 프로세스 재시작** (예: PM2·systemd — 실제 프로세스 이름은 환경에 맞게):

```bash
# 예: pm2 restart <your-bot-process-name>
# 예: sudo systemctl restart <your-bot-service-name>
```

- `dashboard:build`만 바꿨다면: 재시작 후 브라우저 **강력 새로고침**
- 인메모리 **세션·CSRF**는 재시작 시 초기화됨 → 사용자는 다시 로그인할 수 있음

---

## 11. 문제 발생 시 롤백

### 11.1 Git·빌드 롤백

이전에 동작하던 커밋으로 되돌린 뒤 다시 빌드합니다.

```bash
git log --oneline -5
git checkout <previous-commit-hash>
npm ci
npm run build
npm run dashboard:build
npm run dashboard:preflight
```

`git reset --hard` 등은 **데이터·설정을 되돌릴 수 있으므로** 운영자가 변경 내용을 이해한 뒤에만 사용하세요. 불확실하면 `git checkout <commit>`으로 detached 상태에서 빌드·검증 후 브랜치를 정리하는 편이 안전합니다.

### 11.2 DB·설정

- 롤백 **전** §9 백업본이 있으면 DB 복구
- `.env` 백업본으로 복구
- Discord Portal Redirect / Privacy / Terms가 **현재 공개 Origin**과 일치하는지 재확인

### 11.3 긴급 차단 (웹만)

```env
WEB_DASHBOARD_ENABLED=false
```

봇 재시작 후 `/dashboard`, `/api/auth/*` 비활성. Discord 슬래시·패널 음악은 별도 설정입니다.

### 11.4 롤백 후 확인

- [ ] `npm run dashboard:preflight` FAIL 없음
- [ ] 로그인·조작 또는 의도한 비활성 상태
- [ ] secret·토큰이 로그에 출력되지 않음

---

## 12. 운영 정책 고지

서비스·Discord 서버 안내와 정책 페이지에 다음을 유지합니다.

- **코인**, 아이템, 칭호, 랭킹, 시즌, **주식 모의투자**는 Discord 서버 **내 가상 기능**이다.
- **실제 돈**, 현물, 상품권, 포인트, 암호화폐, **환전**, **현금화**, 현물 보상, 캐시 아웃과 **연결되지 않으며** 현금 가치가 없다.
- **주식** 기능은 **모의투자**이며, 실제 증권·투자 자문·매매가 아니다.
- **개인정보처리방침**·**이용약관** URL을 Discord Developer Portal에 등록한다 (`https://example.com/privacy`, `https://example.com/terms` placeholder).

원문: [TERMS_OF_SERVICE.md](./TERMS_OF_SERVICE.md), [PRIVACY_POLICY.md](./PRIVACY_POLICY.md)

---

## 13. 한 페이지 요약

| 단계 | 확인 |
| --- | --- |
| **배포 전** | 4개 npm 명령 성공 · preflight FAIL 0 · 운영 env · Portal URL · `dashboard/dist` |
| **경로** | `/health`, `/dashboard`, `/privacy`, `/terms`, `/api/auth/csrf` (미로그인 401) |
| **CSRF·기능** | §6·§7 수동 테스트 |
| **보안** | §8 · DB 백업 §9 |
| **배포** | §10 업데이트 · 문제 시 §11 롤백 |

---

*상세 env·프록시·CSRF 개요: [WEB_DASHBOARD_DEPLOYMENT.md](./WEB_DASHBOARD_DEPLOYMENT.md)*
