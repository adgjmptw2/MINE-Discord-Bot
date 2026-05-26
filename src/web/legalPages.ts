import type { IncomingMessage, ServerResponse } from "node:http";
import type { WebDashboardConfig } from "@/web/config";

const EFFECTIVE_DATE = "2026년 5월 26일";

const CONTACT_FALLBACK =
  "운영자 또는 봇이 설치된 Discord 서버 관리자에게 문의해 주세요.";

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function contactBlock(contactEmail: string | null): string {
  if (contactEmail && contactEmail.trim().length > 0) {
    const mail = escapeHtml(contactEmail.trim());
    return `<p>문의: <a href="mailto:${mail}">${mail}</a></p>`;
  }
  return `<p>문의: ${escapeHtml(CONTACT_FALLBACK)}</p>`;
}

function operatorNotice(): string {
  return `<p class="notice">본 문서는 운영 정책 안내이며, 실제 공개 운영 전에 운영자가 내용을 확인·수정해야 합니다.</p>`;
}

function renderLegalLayout(title: string, bodyHtml: string): string {
  return `<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${escapeHtml(title)}</title>
  <style>
    :root { color-scheme: dark; }
    body {
      margin: 0;
      font-family: system-ui, -apple-system, "Segoe UI", Roboto, "Noto Sans KR", sans-serif;
      background: #0f1117;
      color: #e8ecf4;
      line-height: 1.65;
    }
    .wrap { max-width: 720px; margin: 0 auto; padding: 1.5rem 1.25rem 2.5rem; }
    header { margin-bottom: 1.5rem; padding-bottom: 1rem; border-bottom: 1px solid #2a3344; }
    header a.brand { color: #c5caff; text-decoration: none; font-weight: 700; font-size: 1.1rem; }
    h1 { font-size: 1.5rem; margin: 0.75rem 0 0.35rem; }
    .meta { color: #9aa6bc; font-size: 0.875rem; }
    .notice {
      font-size: 0.8125rem;
      color: #8a94a8;
      margin: 0.5rem 0 1rem;
      padding: 0.5rem 0.75rem;
      border-left: 3px solid #3d4a63;
    }
    h2 { font-size: 1.05rem; margin: 1.35rem 0 0.5rem; color: #d0d6e4; }
    p, li { font-size: 0.9375rem; color: #c8d0e0; }
    ul { padding-left: 1.25rem; }
    .emphasis {
      padding: 0.75rem 1rem;
      border-radius: 8px;
      background: rgba(250, 168, 26, 0.12);
      border: 1px solid rgba(250, 168, 26, 0.35);
      color: #f0d090;
      font-weight: 600;
    }
    footer {
      margin-top: 2rem;
      padding-top: 1rem;
      border-top: 1px solid #2a3344;
      font-size: 0.8125rem;
      color: #9aa6bc;
    }
    footer a { color: #aeb6ff; margin-right: 0.75rem; }
    a { color: #aeb6ff; }
  </style>
</head>
<body>
  <div class="wrap">
    <header>
      <a class="brand" href="/dashboard">MINE Soundroom</a>
    </header>
    <main>
      ${bodyHtml}
    </main>
    <footer>
      <a href="/dashboard">대시보드</a>
      <a href="/privacy">개인정보처리방침</a>
      <a href="/terms">이용약관</a>
    </footer>
  </div>
</body>
</html>`;
}

export function renderPrivacyPolicyHtml(contactEmail: string | null): string {
  const body = `
      <h1>MINE Soundroom 개인정보처리방침</h1>
      <p class="meta">시행일: ${EFFECTIVE_DATE}</p>
      <p>본 문서는 MINE Soundroom Discord 봇 및 웹 대시보드(이하 “서비스”) 운영에 관한 개인정보 처리 안내입니다. 법률 자문이 아닌 운영 정책 문서입니다.</p>
      ${operatorNotice()}

      <h2>1. 수집하는 정보</h2>
      <ul>
        <li>Discord 사용자 ID, 사용자명, 표시 이름, 아바타 URL</li>
        <li>사용자가 속한 Discord 서버 ID, 서버명, 서버 아이콘 URL</li>
        <li>서버 내 권한 정보(관리자·관리 권한 등)</li>
        <li>노래채널(Soundroom) 설정·채널 정보</li>
        <li>재생·대기열 상태, 곡 제목·URI, 신청자 ID·이름</li>
        <li>웹 대시보드 로그인 세션 쿠키(HttpOnly)</li>
        <li>오류·접속 관련 운영 로그(민감한 secret은 기록하지 않도록 운영)</li>
      </ul>

      <h2>2. 수집 목적</h2>
      <ul>
        <li>Discord OAuth 로그인 및 본인 확인</li>
        <li>접근 가능한 서버 목록 표시</li>
        <li>노래채널 상태 조회·음악 조작·검색/추가·대기열 관리</li>
        <li>같은 노래채널 권한 확인 및 부정 이용 방지</li>
        <li>오류 대응 및 서비스 안정화</li>
      </ul>

      <h2>3. 보관 기간</h2>
      <ul>
        <li>로그인 세션: 설정된 TTL 만료, 로그아웃, 또는 세션 삭제 시까지</li>
        <li>봇·서버 운영 데이터: 해당 Discord 서버에서 봇이 제거되거나 삭제 요청이 처리될 때까지 보관될 수 있음</li>
        <li>운영 로그: 문제 해결에 필요한 기간 동안 보관 후 삭제·축소할 수 있음</li>
      </ul>

      <h2>4. 제3자 제공</h2>
      <p>원칙적으로 개인정보를 판매하거나 무관한 제3자에게 제공하지 않습니다. 다만 서비스 운영을 위해 Discord API, 음악 재생 인프라(Lavalink 등), 호스팅 환경을 사용할 수 있습니다.</p>

      <h2>5. 쿠키</h2>
      <p>로그인 상태 유지를 위한 세션 쿠키를 사용합니다. 광고·행동 추적 목적의 쿠키는 사용하지 않습니다.</p>

      <h2>6. 이용자 권리</h2>
      <p>본인 정보의 열람·정정·삭제를 요청할 수 있습니다. Discord에서 봇을 제거하거나 웹에서 로그아웃한 뒤에도 서버에 남아 있는 데이터는 운영자에게 삭제를 요청할 수 있습니다.</p>

      <h2>7. 파기</h2>
      <p>목적 달성, 보관 기간 만료, 삭제 요청 처리 시 가능한 범위에서 지체 없이 삭제합니다.</p>

      <h2>8. 보호 조치</h2>
      <ul>
        <li>OAuth Client Secret, Bot Token 등은 서버 환경 변수로만 관리</li>
        <li>세션 쿠키 서명 및 HttpOnly 적용</li>
        <li>필요 최소한의 정보만 처리</li>
        <li>웹 대시보드 공개 운영 시 HTTPS 사용 권장</li>
      </ul>

      <h2>9. 문의</h2>
      ${contactBlock(contactEmail)}

      <h2>10. 정책 변경</h2>
      <p>내용이 변경되면 본 페이지 또는 서비스 내 안내를 통해 알릴 수 있습니다.</p>
  `;
  return renderLegalLayout("MINE Soundroom 개인정보처리방침", body);
}

export function renderTermsOfServiceHtml(contactEmail: string | null): string {
  const body = `
      <h1>MINE Soundroom 이용약관</h1>
      <p class="meta">시행일: ${EFFECTIVE_DATE}</p>
      <p>본 약관은 MINE Soundroom Discord 봇 및 웹 대시보드 이용에 관한 운영 정책입니다.</p>
      ${operatorNotice()}

      <h2>1. 서비스 설명</h2>
      <p>Discord 서버용 음악·노래채널(Soundroom) 봇과, 브라우저에서 상태를 확인·조작할 수 있는 웹 대시보드를 제공합니다.</p>

      <h2>2. 계정·로그인</h2>
      <p>웹 대시보드는 Discord OAuth로 로그인합니다. 본인 Discord 계정으로만 이용해야 합니다.</p>

      <h2>3. Soundroom·웹 기능</h2>
      <ul>
        <li>재생 상태 조회, 재생/일시정지, 스킵, 정지, 볼륨, 자동재생</li>
        <li>노래 검색·추가, 대기열 삭제(본인이 추가한 곡), 대기열 순서 변경(같은 노래채널 권한)</li>
        <li>봇과 같은 노래채널에 있을 때만 일부 조작이 가능할 수 있음</li>
      </ul>

      <h2>4. 금지 행위</h2>
      <ul>
        <li>봇·API 악용, 비정상적 자동 요청, 취약점 악용</li>
        <li>타인의 이용 방해, Discord 이용 약관·정책 위반</li>
        <li>저작권 등 제3자 권리 침해에 해당하는 이용</li>
      </ul>

      <h2>5. 가상 경제·모의투자 고지</h2>
      <p class="emphasis">코인, 아이템, 칭호, 랭킹, 시즌, 주식 모의투자 등은 Discord 서버 안의 가상 기능입니다. 실제 돈, 현물, 상품권, 포인트, 암호화폐, 환전, 현금화, 현물 보상, 캐시 아웃과 연결되지 않으며 현금 가치가 없습니다.</p>
      <p class="emphasis">주식 관련 기능은 서버 내 모의투자이며, 실제 증권·투자 자문·매매가 아닙니다. 시세는 지연·오류될 수 있으며 투자 판단에 사용할 수 없습니다.</p>

      <h2>6. 서비스 변경·중단</h2>
      <p>개인·취미 또는 소규모 운영 프로젝트일 수 있으며, 예고 없이 기능이 변경·중단될 수 있습니다.</p>

      <h2>7. 외부 서비스</h2>
      <p>Discord, Lavalink, YouTube·Spotify 등 외부 서비스 장애·정책 변경의 영향을 받을 수 있습니다.</p>

      <h2>8. 책임 제한</h2>
      <p>서비스는 “있는 그대로” 제공됩니다. 음악 재생 실패, 데이터 손실, 서버 설정 오류 등으로 인한 손해에 대해 법이 허용하는 범위에서 책임을 제한할 수 있습니다. 서버 관리자는 권한·채널 설정을 스스로 관리해야 합니다.</p>

      <h2>9. 이용 제한</h2>
      <p>약관 위반·악용이 확인되면 접근을 제한할 수 있습니다.</p>

      <h2>10. 문의</h2>
      ${contactBlock(contactEmail)}

      <h2>11. 약관 변경</h2>
      <p>변경 시 본 페이지 등을 통해 안내할 수 있으며, 변경 후에도 서비스를 계속 이용하면 변경된 약관에 동의한 것으로 볼 수 있습니다.</p>
  `;
  return renderLegalLayout("MINE Soundroom 이용약관", body);
}

function isLegalPath(pathname: string): boolean {
  return (
    pathname === "/privacy" ||
    pathname === "/privacy/" ||
    pathname === "/terms" ||
    pathname === "/terms/"
  );
}

function sendLegalHtml(res: ServerResponse, html: string, headOnly: boolean): void {
  res.statusCode = 200;
  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("Referrer-Policy", "no-referrer");
  if (headOnly) {
    res.end();
    return;
  }
  res.end(html);
}

/** 로그인·SESSION_SECRET_WEAK·rate limit 없이 공개. API 처리 후, /dashboard 정적 전에 연결한다. */
export function handleLegalPageRequest(
  req: IncomingMessage,
  res: ServerResponse,
  pathname: string,
  config: WebDashboardConfig,
): boolean {
  if (!isLegalPath(pathname)) {
    return false;
  }

  const method = req.method?.toUpperCase() ?? "GET";
  if (method !== "GET" && method !== "HEAD") {
    res.statusCode = 405;
    res.setHeader("Allow", "GET, HEAD");
    res.setHeader("Content-Type", "text/plain; charset=utf-8");
    res.end("Method Not Allowed");
    return true;
  }

  const contact = config.contactEmail;
  const html =
    pathname === "/terms" || pathname === "/terms/"
      ? renderTermsOfServiceHtml(contact)
      : renderPrivacyPolicyHtml(contact);

  sendLegalHtml(res, html, method === "HEAD");
  return true;
}
