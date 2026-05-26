# MINE Soundroom Web Dashboard 배포 가이드

웹 대시보드는 **Discord OAuth 로그인**, 서버별 **노래채널 상태 조회**, **재생·스킵·볼륨·자동재생**, **검색/추가**, **대기열 삭제·순서 변경**을 브라우저에서 할 수 있게 합니다.

이 문서는 **개발**, **로컬 정적 서빙**, **HTTPS + reverse proxy 운영** 준비를 정리합니다. 실제 Nginx/Caddy 설정 파일은 레포에 포함하지 않으며, 아래는 **예시**입니다.

민감 정보(`TOKEN`, OAuth Client Secret, Lavalink 비밀번호, 실제 서버 IP/도메인, `.env` 전체)는 **문서·커밋에 넣지 마세요.**

---

## 1. 모드 구분

| 모드 | API | UI | `WEB_DASHBOARD_STATIC_ENABLED` |
| --- | --- | --- | --- |
| **개발** | `http://127.0.0.1:3077` | Vite dev (`:3000/dashboard`) | `false` |
| **정적 서빙 (로컬·단일 프로세스)** | 같은 호스트 `:3077` | `http://127.0.0.1:3077/dashboard` | `true` |
| **reverse proxy 운영** | 프록시 뒤 HTTPS | `https://<your-domain>/dashboard` | `true` |

---

## 2. 개발 모드

로컬에서 UI를 빠르게 수정할 때 사용합니다. API는 봇 프로세스, UI는 Vite dev server가 담당합니다.

### 환경 변수 (`.env` 예시)

```env
WEB_DASHBOARD_ENABLED=true
WEB_DASHBOARD_STATIC_ENABLED=false
WEB_DASHBOARD_HOST=127.0.0.1
WEB_DASHBOARD_PORT=3077
WEB_DASHBOARD_ALLOWED_ORIGIN=http://localhost:3000
WEB_DASHBOARD_AUTH_ENABLED=true
DISCORD_OAUTH_CLIENT_ID=<your-application-id>
DISCORD_OAUTH_CLIENT_SECRET=<never-commit-this>
DISCORD_OAUTH_REDIRECT_URI=http://127.0.0.1:3077/api/auth/discord/callback
WEB_DASHBOARD_SESSION_SECRET=<long-random-hex-or-base64>
```

Vite용 (프로젝트 루트 `.env` 또는 `dashboard/.env` — **secret은 `VITE_` 접두사에 넣지 마세요**):

```env
VITE_WEB_API_BASE_URL=http://127.0.0.1:3077
```

### Discord Developer Portal

1. **OAuth2 → Redirects**에 다음 URI를 **정확히** 등록합니다.  
   `http://127.0.0.1:3077/api/auth/discord/callback`  
   (`localhost`와 `127.0.0.1`은 Origin이 다르므로, `WEB_DASHBOARD_ALLOWED_ORIGIN`과 맞춥니다.)
2. **Client Secret**은 Discord 포털에서만 관리하고, Git·문서·스크린샷에 올리지 않습니다.

### 명령어

```bash
npm run check
npm run build
# 터미널 1: 봇 + 웹 API
npm run start:bot
# 터미널 2: 대시보드 UI
npm run dashboard:dev
```

브라우저: `http://localhost:3000/dashboard/` (또는 `http://127.0.0.1:3000/dashboard/` — Origin은 `.env`의 `WEB_DASHBOARD_ALLOWED_ORIGIN`과 동일해야 합니다.)

---

## 3. 정적 서빙 모드 (로컬·운영 단일 포트)

`dashboard/dist`를 빌드한 뒤, 웹 API 서버가 `/dashboard` 경로로 정적 파일을 서빙합니다.

### 빌드

```bash
npm run build:all
# 또는
npm run build && npm run dashboard:build
```

배포 전 검증:

```bash
npm run check:all
```

### 환경 변수 (`.env` 예시)

```env
WEB_DASHBOARD_ENABLED=true
WEB_DASHBOARD_STATIC_ENABLED=true
WEB_DASHBOARD_STATIC_DIR=dashboard/dist
WEB_DASHBOARD_HOST=127.0.0.1
WEB_DASHBOARD_PORT=3077
WEB_DASHBOARD_ALLOWED_ORIGIN=http://127.0.0.1:3077
WEB_DASHBOARD_AUTH_ENABLED=true
DISCORD_OAUTH_REDIRECT_URI=http://127.0.0.1:3077/api/auth/discord/callback
WEB_DASHBOARD_SESSION_SECRET=<long-random-string>
```

정적 빌드 시 `VITE_WEB_API_BASE_URL`을 **비우면** 브라우저가 **같은 Origin**(`http://127.0.0.1:3077`)으로 API를 호출합니다. 개발용으로 API만 다른 포트에 둘 때만 `VITE_WEB_API_BASE_URL`을 지정하세요.

### 실행

```bash
npm run start:bot
```

접속: `http://127.0.0.1:3077/dashboard`

### 동작 요약

- `GET /dashboard`, `/dashboard/` → `index.html` (SPA)
- `GET /dashboard/assets/*` → 빌드된 JS/CSS (장기 캐시)
- 그 외 `/dashboard/*` 경로 → SPA fallback (`index.html`)
- `/api/*`, `/health` → 기존 JSON API (정적 라우트보다 우선)
- `GET /privacy`, `/terms` (및 trailing slash) → 공개 HTML 정책 페이지 (로그인 불필요, API·정적보다 앞서 처리)
- `dashboard/dist`가 없으면 서버는 종료하지 않고 `/dashboard`는 404, warn 로그만 출력

코드·설정 변경 후에는 **봇 프로세스 재시작**이 필요합니다. `dashboard:build`만 다시 했다면 재시작 후 브라우저 새로고침(강력 새로고침)으로 asset을 받으면 됩니다.

---

## 4. reverse proxy 운영 모드 (HTTPS)

인터넷에 공개하기 전에 **HTTPS**와 **reverse proxy**를 두는 것을 권장합니다. API 서버를 `0.0.0.0`에 직접 노출하지 마세요.

### 원칙

1. **TLS 종료**는 Nginx, Caddy, Cloudflare Tunnel 등 프록시에서 처리합니다.
2. 봇 웹 API는 기본적으로 `WEB_DASHBOARD_HOST=127.0.0.1`로 **루프백만** listen 합니다.  
   `WEB_DASHBOARD_HOST=0.0.0.0`은 방화벽·인증·HTTPS 설정을 마친 뒤에만 검토하세요.
3. `WEB_DASHBOARD_ALLOWED_ORIGIN`은 사용자가 브라우저에 입력하는 **공개 URL의 Origin**과 같아야 합니다.  
   예: `https://soundroom.example.com` (경로 `/dashboard`는 Origin에 포함하지 않음)
4. `DISCORD_OAUTH_REDIRECT_URI`는 **항상 API 콜백 URL**입니다.  
   프록시가 TLS를 처리하면: `https://soundroom.example.com/api/auth/discord/callback`  
   Discord Redirects에 **동일 문자열**을 등록합니다.
5. OAuth 성공 후 리다이렉트: `{WEB_DASHBOARD_ALLOWED_ORIGIN}/dashboard`  
   open redirect 방지를 위해 임의 `?next=` 파라미터를 받지 않습니다.

### 4.1 Discord Developer Portal — 정책 URL

OAuth **Redirect URI**와 **Privacy Policy / Terms of Service URL**은 서로 다른 항목입니다.

| 항목 | 용도 | 로컬 예 | 운영 예 (placeholder) |
| --- | --- | --- | --- |
| Redirect URI | OAuth 콜백 | `http://127.0.0.1:3077/api/auth/discord/callback` | `https://soundroom.example.com/api/auth/discord/callback` |
| Privacy Policy URL | 개인정보처리방침 | `http://127.0.0.1:3077/privacy` | `https://soundroom.example.com/privacy` |
| Terms of Service URL | 이용약관 | `http://127.0.0.1:3077/terms` | `https://soundroom.example.com/terms` |

- 정책 페이지는 **로그인 없이** 공개됩니다. reverse proxy 뒤에서는 위와 같이 **같은 공개 Origin**으로 접근 가능해야 합니다.
- (선택) `.env`의 `WEB_DASHBOARD_CONTACT_EMAIL`을 설정하면 `/privacy`, `/terms`에 문의 이메일이 표시됩니다. 비우면 일반 문의 안내만 표시됩니다.
- 원문 편집용 Markdown: [docs/PRIVACY_POLICY.md](./PRIVACY_POLICY.md), [docs/TERMS_OF_SERVICE.md](./TERMS_OF_SERVICE.md) (실제 HTML은 API 서버 `src/web/legalPages.ts`에서 제공)

### 4.2 웹 보안 env (운영 권장)

| 변수 | 운영 권장 | 로컬 개발 |
| --- | --- | --- |
| `WEB_DASHBOARD_PUBLIC_STATE_ENABLED` | `false` | `false` (수동 API 테스트 시만 `true`) |
| `WEB_DASHBOARD_COOKIE_SECURE` | `true` | `false` |
| `WEB_DASHBOARD_REQUIRE_STRONG_SESSION_SECRET` | `true` | `false` 가능 |
| `WEB_DASHBOARD_RATE_LIMIT_ENABLED` | `true` | `true` (문제 시 `false`) |

- **비인증 상태 API**: `GET /api/soundroom/guilds/:guildId/state`는 `WEB_DASHBOARD_PUBLIC_STATE_ENABLED=false`(기본)이면 **404**로 응답합니다. 대시보드는 인증 API `GET /api/auth/guilds/:guildId/soundroom-state`를 사용합니다.
- **세션 시크릿**: `change-me` 계열·32자 미만은 약한 값입니다. `WEB_DASHBOARD_REQUIRE_STRONG_SESSION_SECRET=true`이면 `/api/auth/*`가 `SESSION_SECRET_WEAK`(503)로 차단됩니다. `/health`, `/dashboard`, `/privacy`, `/terms`는 계속 동작합니다.
- **Secure 쿠키**: `WEB_DASHBOARD_COOKIE_SECURE=true`이면 `Set-Cookie`에 `Secure`가 붙습니다. **로컬 http**에서는 브라우저가 쿠키를 저장하지 않을 수 있으므로 개발 시 `false`를 유지하세요.
- **rate limit**: 과도한 요청 시 **429** `RATE_LIMITED`와 `Retry-After` 헤더가 반환됩니다. 키는 **세션 userId**(로그인 후) 또는 **소켓 IP**(로그인 전)이며, `X-Forwarded-For`는 신뢰하지 않습니다.
- `WEB_DASHBOARD_SESSION_SECRET`은 **32자 이상 랜덤 문자열**로 교체하세요 (예: `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`).

### Nginx 예시 (문서용, 레포 미포함)

```nginx
server {
    listen 443 ssl http2;
    server_name soundroom.example.com;

    # ssl_certificate / ssl_certificate_key — 인증서 경로는 환경에 맞게 설정

    location / {
        proxy_pass http://127.0.0.1:3077;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

- 프록시는 **루트(`/`)** 를 API 서버로 넘기면 `/dashboard`, `/privacy`, `/terms`, `/api`, `/health`가 함께 동작합니다.
- WebSocket은 이 대시보드에서 사용하지 않습니다.

### Caddy 예시 (문서용)

```caddy
soundroom.example.com {
    reverse_proxy 127.0.0.1:3077
}
```

### 운영 `.env` 체크리스트

- [ ] `WEB_DASHBOARD_ENABLED=true`
- [ ] `WEB_DASHBOARD_STATIC_ENABLED=true`
- [ ] `npm run build:all` 실행 후 `dashboard/dist` 존재
- [ ] `WEB_DASHBOARD_ALLOWED_ORIGIN` = 공개 HTTPS Origin
- [ ] `DISCORD_OAUTH_REDIRECT_URI` = `https://<domain>/api/auth/discord/callback`
- [ ] Discord Redirects에 위 URI 등록
- [ ] Discord Portal Privacy Policy URL · Terms of Service URL 등록 (§4.1)
- [ ] `WEB_DASHBOARD_SESSION_SECRET` 기본값·32자 미만 미사용
- [ ] `WEB_DASHBOARD_PUBLIC_STATE_ENABLED=false`
- [ ] `WEB_DASHBOARD_COOKIE_SECURE=true`
- [ ] `WEB_DASHBOARD_REQUIRE_STRONG_SESSION_SECRET=true`
- [ ] `WEB_DASHBOARD_RATE_LIMIT_ENABLED=true`
- [ ] `DISCORD_OAUTH_CLIENT_SECRET` 커밋·로그·문서 미포함
- [ ] 방화벽에서 3077 포트 외부 직접 노출 차단 (프록시만 공개)

---

## 5. npm scripts 참고

| script | 설명 |
| --- | --- |
| `npm run dashboard:dev` | Vite 개발 서버 (`:3000/dashboard`) |
| `npm run dashboard:build` | `dashboard/dist` 프로덕션 빌드 |
| `npm run build:dashboard` | `dashboard:build` 별칭 |
| `npm run build:all` | 봇 `dist` + 대시보드 `dist` |
| `npm run check:all` | typecheck + 대시보드 빌드 검증 |

---

## 6. 보안·운영 주의

- **path traversal**: `/dashboard/../.env` 등은 차단됩니다. 그래도 `.env`·DB 파일은 웹 루트 밖에 두세요.
- **정적 서빙 범위**: `WEB_DASHBOARD_STATIC_DIR` 안의 빌드 결과만 노출됩니다.
- **CORS**: 개발 모드(Origin `:3000`)에서만 cross-origin API가 필요합니다. 정적 서빙·프록시 운영은 same-origin이면 CORS 없이 동작합니다.
- **8초 polling**: 대시보드는 Soundroom 상태를 주기적으로 갱신합니다. `state-read` bucket(10초 30회)으로 일반 폴링은 막히지 않도록 여유를 둡니다.
- **외부 공개 전**: HTTPS, Secure 쿠키, 강한 세션 시크릿, 비인증 state API 비활성, OAuth Redirect 정합성을 먼저 확인하세요.

---

## 7. 관련 문서

- [.env.example](../.env.example) — 변수 목록·주석
- [deployment.md](./deployment.md) — 봇·VM 전체 배포
- [beta-ops-checklist.md](./beta-ops-checklist.md) — 베타 운영 점검
