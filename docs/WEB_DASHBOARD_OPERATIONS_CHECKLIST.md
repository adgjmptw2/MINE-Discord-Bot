# MINE Soundroom Web Dashboard 운영 체크리스트

웹 대시보드를 **실제 운영(HTTPS 공개)** 하기 전에 확인할 항목을 한 곳에 모은 문서입니다.

이 문서는 **법률 자문**이나 **보안 감사 보고서**가 아니며, 운영자가 따라 할 **체크리스트·런북**입니다. 실제 공개 전에는 운영자가 내용·정책 페이지·Discord Portal 설정을 직접 확인해야 합니다.

민감 정보(Discord Bot Token, OAuth Client Secret, `WEB_DASHBOARD_SESSION_SECRET`, Lavalink 비밀번호, DB 경로, `.env` 전체)는 **문서·스크린샷·Git에 넣지 마세요.** 예시는 `example.com`, `your-client-id` 같은 placeholder만 사용합니다.

관련 문서:

- [웹 대시보드 배포 가이드](./WEB_DASHBOARD_DEPLOYMENT.md) — 개발·정적 서빙·HTTPS·env 상세
- [개인정보처리방침 원문](./PRIVACY_POLICY.md) · [이용약관 원문](./TERMS_OF_SERVICE.md)
- [봇 전체 배포](./deployment.md) · [베타 운영 점검](./beta-ops-checklist.md)

---

## 1. 목적

- 배포 전 빌드·설정·보안 env가 맞는지 확인한다.
- 배포 후 로그인·조작·정책 페이지가 동작하는지 최소한으로 검증한다.
- 문제 발생 시 **최소 롤백**으로 이전 상태로 되돌릴 수 있게 한다.

---

## 2. 배포 전 필수 명령어

프로젝트 루트에서 순서대로 실행합니다. **FAIL이 하나라도 있으면 운영 공개를 미룹니다.**

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
| `npm run dashboard:build` | `dashboard/dist` (index.html, assets) |
| `npm run dashboard:preflight` | `.env` 웹 대시보드·OAuth·보안 env·정적 빌드 (secret 값 미출력) |

`preflight` 별칭: `npm run preflight:web`

자세한 preflight 항목: [배포 가이드 §5](./WEB_DASHBOARD_DEPLOYMENT.md#5-운영 전-preflight-점검)

---

## 3. 운영 `.env` 권장값 (HTTPS 공개)

로컬 개발(`http://127.0.0.1:3000` + Vite)과 **운영 HTTPS**는 값이 다릅니다. 아래는 **운영 placeholder** 기준입니다.

| 변수 | 운영 권장 | 비고 |
| --- | --- | --- |
| `WEB_DASHBOARD_ENABLED` | `true` | 웹 API 서버 활성화 |
| `WEB_DASHBOARD_AUTH_ENABLED` | `true` | Discord OAuth 로그인 |
| `WEB_DASHBOARD_STATIC_ENABLED` | `true` | `/dashboard` 정적 서빙 |
| `WEB_DASHBOARD_STATIC_DIR` | `dashboard/dist` | `npm run dashboard:build` 후 존재 |
| `WEB_DASHBOARD_HOST` | `127.0.0.1` | 프록시 뒤 루프백 listen 권장 |
| `WEB_DASHBOARD_PORT` | `3077` | 외부 직접 노출 금지, 프록시만 공개 |
| `WEB_DASHBOARD_ALLOWED_ORIGIN` | `https://soundroom.example.com` | **경로 없음** (Origin만) |
| `DISCORD_OAUTH_CLIENT_ID` | Application ID | Portal에서 확인 |
| `DISCORD_OAUTH_CLIENT_SECRET` | (비공개) | Git·문서·로그 금지 |
| `DISCORD_OAUTH_REDIRECT_URI` | `https://soundroom.example.com/api/auth/discord/callback` | Portal Redirects와 **완전 일치** |
| `WEB_DASHBOARD_SESSION_SECRET` | 32자 이상 랜덤 | `change-me*` 금지 |
| `WEB_DASHBOARD_PUBLIC_STATE_ENABLED` | `false` | 비인증 state API 차단 |
| `WEB_DASHBOARD_COOKIE_SECURE` | `true` | HTTPS + Secure 쿠키 |
| `WEB_DASHBOARD_REQUIRE_STRONG_SESSION_SECRET` | `true` | 약한 시크릿 시 `/api/auth/*` 차단 |
| `WEB_DASHBOARD_RATE_LIMIT_ENABLED` | `true` | 기본 권장 |
| `WEB_DASHBOARD_CONTACT_EMAIL` | (선택) | `/privacy`, `/terms` 문의 표시 |

생성 예 (로컬 터미널에서만 실행, 값을 문서에 붙여넣지 마세요):

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

---

## 4. HTTPS · Secure cookie · 세션 시크릿

### HTTPS

- TLS는 **Nginx / Caddy / Cloudflare Tunnel** 등 reverse proxy에서 종료합니다.
- API 서버(3077)를 인터넷에 직접 노출하지 않습니다.
- 사용자가 접속하는 URL은 `https://soundroom.example.com/dashboard` 형태입니다.

### Secure cookie

- 운영: `WEB_DASHBOARD_COOKIE_SECURE=true`
- 로컬 http 개발: `false` (브라우저가 Secure 쿠키를 http에 저장하지 않음)
- OAuth 로그인 후 `Set-Cookie`에 `Secure`가 포함되는지 DevTools → Application → Cookies에서 확인합니다.

### 강한 session secret

- `WEB_DASHBOARD_REQUIRE_STRONG_SESSION_SECRET=true`일 때 약한 값이면 `SESSION_SECRET_WEAK`(503)로 `/api/auth/*`가 차단됩니다.
- `/health`, `/dashboard`, `/privacy`, `/terms`는 계속 열립니다.

---

## 5. Discord Developer Portal 체크리스트

Application → **OAuth2** (및 앱 설정의 정책 URL 항목):

- [ ] **Redirects**: `https://soundroom.example.com/api/auth/discord/callback` (실제 운영 URL과 **문자열 일치**)
- [ ] **Privacy Policy URL**: `https://soundroom.example.com/privacy`
- [ ] **Terms of Service URL**: `https://soundroom.example.com/terms`
- [ ] Redirect URI와 Privacy/Terms URL은 **서로 다른 항목**임을 인지
- [ ] Client ID는 `.env`의 `DISCORD_OAUTH_CLIENT_ID`와 일치
- [ ] Client Secret은 Portal에서만 관리, 커밋·문서·채팅에 공유하지 않음

로컬 개발용 Redirect 예 (운영과 별도 등록 가능):

`http://127.0.0.1:3077/api/auth/discord/callback`

---

## 6. preflight 사용 절차

1. `.env`를 운영 값으로 준비한다 (실제 secret은 로컬 파일만).
2. `npm run dashboard:build`로 `dashboard/dist`를 만든다.
3. `npm run dashboard:preflight`를 실행한다.
4. **FAIL**이 있으면 메시지에 따라 `.env` 또는 빌드를 수정한다.
5. **WARN**은 운영 정책에 맞게 판단한다 (예: 로컬 origin이면 Secure cookie WARN은 정상).
6. **INFO**에 나온 Privacy/Terms URL을 Portal에 등록했는지 확인한다.

preflight는 `.env`를 **자동 수정하지 않으며**, Discord API·HTTP 요청도 하지 않습니다.

---

## 7. CSRF 수동 테스트 (선택·권장)

대시보드 UI는 `GET /api/auth/csrf` 후 POST에 `X-CSRF-Token`을 자동으로 붙입니다. 운영 전에 아래를 **curl 등으로** 확인할 수 있습니다. (쿠키·토큰 값은 문서에 기록하지 마세요.)

### 7.1 로그인 전

```bash
curl -s -o /dev/null -w "%{http_code}" http://127.0.0.1:3077/api/auth/csrf
```

기대: `401` (UNAUTHORIZED)

### 7.2 로그인 후 (브라우저로 OAuth 로그인 후 쿠키 파일 사용)

브라우저에서 로그인한 뒤, DevTools에서 세션 쿠키를 확인합니다. curl 테스트 시 `-b cookies.txt` 형태로 전달합니다.

**CSRF 토큰 발급 (GET):**

```bash
curl -s -b cookies.txt http://127.0.0.1:3077/api/auth/csrf
```

기대: JSON `{ "ok": true, "csrfToken": "..." }` — **토큰 값을 로그·문서에 남기지 마세요.**

**CSRF 없이 POST (차단 확인):**

```bash
curl -s -b cookies.txt -X POST \
  -H "Content-Type: application/json" \
  -d '{"action":"togglePause"}' \
  http://127.0.0.1:3077/api/auth/guilds/GUILD_ID/soundroom/control
```

기대: `403`, code `CSRF_TOKEN_REQUIRED` — **음악 조작이 실행되지 않아야 합니다.**

**잘못된 CSRF (차단 확인):**

```bash
curl -s -b cookies.txt -X POST \
  -H "Content-Type: application/json" \
  -H "X-CSRF-Token: wrong-token" \
  -d '{"action":"togglePause"}' \
  http://127.0.0.1:3077/api/auth/guilds/GUILD_ID/soundroom/control
```

기대: `403`, code `CSRF_TOKEN_INVALID`

**올바른 CSRF (성공 가능):**

위 GET `/api/auth/csrf` 응답의 토큰을 `X-CSRF-Token`에 넣고 동일 POST를 호출합니다. 같은 노래채널 권한이 맞으면 기존과 같이 동작합니다.

### 7.3 프록시 확인

reverse proxy가 **`X-CSRF-Token` 헤더를 제거하지 않는지** 확인합니다. 제거되면 대시보드 POST가 모두 `CSRF_TOKEN_REQUIRED`로 실패합니다.

### 7.4 UI 스모크 (권장)

브라우저에서 로그인 후:

- [ ] 재생/일시정지, 스킵, 정지, 볼륨, 자동재생
- [ ] 노래 검색·추가
- [ ] 대기열 삭제(본인 곡), 위/아래 순서 변경
- [ ] 로그아웃
- [ ] DevTools Network에서 POST 요청에 `X-CSRF-Token` 헤더 존재

CSRF 오류 시: 페이지 **새로고침** 후 재시도 (프론트는 1회 토큰 재발급 후 재시도).

---

## 8. 배포 후 최소 확인 (스모크)

HTTPS 공개 URL 기준 (`https://soundroom.example.com` placeholder):

- [ ] `GET /health` → JSON `{ "ok": true, ... }`
- [ ] `GET /privacy`, `GET /terms` → 로그인 없이 HTML (약한 session secret이어도 접근 가능)
- [ ] `GET /dashboard` → 로그인 화면
- [ ] Discord OAuth 로그인 → `/dashboard`로 리다이렉트
- [ ] 서버 목록·노래채널 상태 표시
- [ ] (음성 채널 입장 후) 조작·검색·대기열 동작
- [ ] `GET /api/soundroom/guilds/:id/state` (비인증) → **404** (`PUBLIC_STATE_ENABLED=false`일 때)
- [ ] 패치노트 버튼(Discord 패널) 기존 동작

---

## 9. 보안·정책 요약 (변경 없음)

- **코인·가상 경제**: 서버 내 가상 기능이며, 실제 돈·환전·현물 보상·캐시 아웃과 무관합니다.
- **주식**: 서버 내 **모의투자**이며 실제 투자·증권 자문이 아닙니다.
- 정책 페이지: [이용약관](./TERMS_OF_SERVICE.md) 참고.

---

## 10. 최소 롤백 절차

문제 발생 시 아래 순서로 **이전에 동작하던 상태**로 되돌립니다.

### 10.1 설정·빌드만 롤백

1. `.env` 백업본으로 복구 (또는 문제가 된 변수만 되돌림).
2. 이전에 동작하던 Git 커밋/태그로 체크아웃한다.
3. `npm run build:all` 재실행.
4. `npm run dashboard:preflight`로 FAIL 없음 확인.
5. **봇 프로세스 재시작** (인메모리 세션·CSRF는 재시작 시 초기화됨).
6. 브라우저 강력 새로고침 후 로그인·조작 재확인.

### 10.2 프록시·Portal 롤백

1. reverse proxy 설정을 이전 버전으로 복구.
2. Discord Portal Redirect / Privacy / Terms URL이 **현재 공개 Origin**과 일치하는지 재확인.
3. OAuth Redirect와 `WEB_DASHBOARD_ALLOWED_ORIGIN` 불일치 시 로그인 실패.

### 10.3 긴급 차단 (대시보드만 끄기)

웹 대시보드만 빠르게 끄려면 (Discord 봇 음악 기능은 유지):

```env
WEB_DASHBOARD_ENABLED=false
```

봇 재시작 후 `/dashboard`, `/api/auth/*`는 더 이상 서빙되지 않습니다. Discord 슬래시·패널 음악 기능은 별도 설정입니다.

### 10.4 롤백 후 확인

- [ ] `/health` (웹 API가 켜져 있을 때만)
- [ ] 로그인·조작 또는 의도한 비활성 상태
- [ ] secret·토큰이 로그에 출력되지 않음

---

## 11. 체크리스트 한 페이지 요약

**배포 전**

- [ ] `npm run check` / `build` / `dashboard:build` / `dashboard:preflight` 성공
- [ ] 운영 HTTPS Origin · OAuth Redirect · Portal Privacy/Terms URL 일치
- [ ] 강한 `WEB_DASHBOARD_SESSION_SECRET`, `COOKIE_SECURE=true`, `PUBLIC_STATE_ENABLED=false`
- [ ] `dashboard/dist` 존재, 3077 외부 직접 노출 없음

**배포 후**

- [ ] HTTPS `/dashboard` 로그인·조작
- [ ] `/privacy`, `/terms` 공개
- [ ] CSRF·rate limit·비인증 state 차단 정상 (필요 시 §7 수동 테스트)

**문제 시**

- [ ] `.env` / Git / 프록시 / Portal 순으로 롤백 → 재빌드 → 봇 재시작

---

*문서 버전: 웹 대시보드 CSRF·preflight·보안 하드닝 반영 기준. 상세 설정은 [WEB_DASHBOARD_DEPLOYMENT.md](./WEB_DASHBOARD_DEPLOYMENT.md)를 따릅니다.*
