import type { IncomingMessage, ServerResponse } from "node:http";
import type { WebDashboardConfig } from "@/web/config";
import { getHomePagePublicStats } from "@/web/homeStats";
import { escapeHtml } from "@/web/legalPages";
import type { HomePagePublicStats, WebDashboardPublicLinks } from "@/web/types";
import type { MineClient } from "@/types";

function isHomePath(pathname: string): boolean {
  return pathname === "/" || pathname === "/index.html";
}

/** 외부 링크는 http(s)만 허용한다. */
function safeHttpUrl(raw: string | undefined): string | undefined {
  const trimmed = raw?.trim();
  if (!trimmed) {
    return undefined;
  }
  const normalized = trimmed.replace(/\/+$/, "");
  if (!/^https?:\/\//i.test(normalized)) {
    return undefined;
  }
  return normalized;
}

function buildOAuthInviteUrl(clientId: string): string {
  const params = new URLSearchParams({
    client_id: clientId,
    scope: "bot applications.commands",
    permissions: "36700160",
  });
  return `https://discord.com/api/oauth2/authorize?${params.toString()}`;
}

function buildPublicLinks(config: WebDashboardConfig): WebDashboardPublicLinks | null {
  const origin = config.publicUrl;
  if (!origin) {
    return null;
  }
  const links: WebDashboardPublicLinks = {
    origin,
    dashboardUrl: `${origin}/dashboard`,
    privacyUrl: `${origin}/privacy`,
    termsUrl: `${origin}/terms`,
  };
  const inviteFromEnv = safeHttpUrl(process.env.WEB_DASHBOARD_INVITE_URL);
  if (inviteFromEnv) {
    links.inviteUrl = inviteFromEnv;
  } else if (config.discordOAuthClientId) {
    links.inviteUrl = buildOAuthInviteUrl(config.discordOAuthClientId);
  }
  return links;
}

function buildPublicLink(config: WebDashboardConfig, path: string): string {
  const normalized = path.startsWith("/") ? path : `/${path}`;
  if (config.publicUrl) {
    return `${config.publicUrl}${normalized}`;
  }
  return normalized;
}

function anchor(href: string, label: string, className?: string): string {
  const cls = className ? ` class="${className}"` : "";
  return `<a href="${escapeHtml(href)}"${cls}>${escapeHtml(label)}</a>`;
}

function externalAnchor(
  href: string | undefined,
  label: string,
  className?: string,
): string {
  if (!href) {
    return "";
  }
  return anchor(href, label, className);
}

function inviteCta(href: string | undefined, className: string): string {
  if (href) {
    return anchor(href, "봇 초대하기", className);
  }
  return `<span class="${className} btn-disabled" aria-disabled="true">초대 링크 준비 중</span>`;
}

function formatKoNumber(value: number): string {
  return value.toLocaleString("ko-KR");
}

function formatUpdatedLabel(iso: string): string {
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) {
      return "";
    }
    return d.toLocaleString("ko-KR", {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return "";
  }
}

type FeatureIconKind =
  | "monitor"
  | "shield"
  | "list"
  | "repeat"
  | "message-circle"
  | "lock";

/** 랜딩 전용 — 외부 아이콘 라이브러리 없이 Lucide 스타일 stroke SVG */
function featureIconSvg(kind: FeatureIconKind): string {
  const base =
    'xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"';
  switch (kind) {
    case "monitor":
      return `<svg ${base}><rect width="20" height="14" x="2" y="3" rx="2"/><line x1="8" x2="16" y1="21" y2="21"/><line x1="12" x2="12" y1="17" y2="21"/></svg>`;
    case "shield":
      return `<svg ${base}><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10"/></svg>`;
    case "list":
      return `<svg ${base}><line x1="8" x2="21" y1="6" y2="6"/><line x1="8" x2="21" y1="12" y2="12"/><line x1="8" x2="21" y1="18" y2="18"/><line x1="3" x2="3.01" y1="6" y2="6"/><line x1="3" x2="3.01" y1="12" y2="12"/><line x1="3" x2="3.01" y1="18" y2="18"/></svg>`;
    case "repeat":
      return `<svg ${base}><path d="m17 2 4 4-4 4"/><path d="M3 11v-1a4 4 0 0 1 4-4h14"/><path d="m7 22-4-4 4-4"/><path d="M21 13v1a4 4 0 0 1-4 4H3"/></svg>`;
    case "message-circle":
      return `<svg ${base}><path d="M7.9 20A9 9 0 1 0 4 16.1L2 22Z"/></svg>`;
    case "lock":
      return `<svg ${base}><rect width="18" height="11" x="3" y="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>`;
    default:
      return "";
  }
}

function metricCard(
  value: string,
  label: string,
  hint: string,
  live: boolean,
  featured = false,
): string {
  const featuredCls = featured ? " metric-card-featured" : "";
  void live;
  return `<article class="metric-card${featuredCls}">
    <p class="metric-value">${escapeHtml(value)}</p>
    <h3 class="metric-label">${escapeHtml(label)}</h3>
    <p class="metric-hint">${escapeHtml(hint)}</p>
  </article>`;
}

function renderLiveStatusSection(
  config: WebDashboardConfig,
  client: MineClient | undefined,
): string {
  const useLiveStats =
    config.homeStatsEnabled && client !== undefined && client.isReady();

  if (useLiveStats && client) {
    const s: HomePagePublicStats = getHomePagePublicStats(client);
    const updated = formatUpdatedLabel(s.updatedAt);
    const cards: string[] = [
      metricCard(formatKoNumber(s.guildCount), "서버", "봇이 참여 중인 서버", true, true),
      metricCard(
        formatKoNumber(s.estimatedMemberCount),
        "추정 멤버",
        "Discord cache 기준 합산",
        true,
      ),
      metricCard(
        formatKoNumber(s.configuredSoundroomCount),
        "노래채널 설정",
        "DB에 등록된 Soundroom",
        true,
      ),
      metricCard(
        formatKoNumber(s.activePlayerCount),
        "음성 연결",
        "플레이어가 붙은 세션",
        true,
      ),
      metricCard(
        formatKoNumber(s.playingPlayerCount),
        "재생 중",
        "현재 재생 중인 세션",
        true,
      ),
      metricCard(
        formatKoNumber(s.queuedTrackCount),
        "대기열",
        "플레이어 대기 곡 합계",
        true,
      ),
    ];

    if (s.activeVoiceListenerCount !== undefined && s.activeVoiceListenerCount > 0) {
      cards.push(
        metricCard(
          formatKoNumber(s.activeVoiceListenerCount),
          "음성 참여",
          "연결된 채널 참가자 합산(봇 제외)",
          true,
        ),
      );
    }

    return `
      <section class="live-section" aria-label="운영 현황">
        <div class="container">
          <header class="live-head">
            <div>
              <span class="pill pill-live">Soundroom Live</span>
              <h2 class="live-title">운영 현황</h2>
              <p class="live-desc">봇 cache 기준 집계입니다. 서버·채널·유저 이름은 표시하지 않습니다.</p>
            </div>
            ${updated ? `<p class="live-updated">최근 갱신 ${escapeHtml(updated)}</p>` : ""}
          </header>
          <div class="metric-grid">${cards.join("")}</div>
        </div>
      </section>`;
  }

  const staticCards = [
    metricCard("웹", "웹 리모컨", "브라우저에서 조작", false),
    metricCard("OAuth", "로그인", "Discord 계정", false),
    metricCard("CSRF", "POST 보호", "조작 API 검증", false),
    metricCard("정책", "개인정보·약관", "공개 페이지 제공", false),
  ];

  return `
    <section class="live-section" aria-label="소개">
      <div class="container">
        <header class="live-head">
          <div>
            <span class="pill">Soundroom</span>
            <h2 class="live-title">운영 현황</h2>
            <p class="live-desc">봇이 실행 중이면 집계 수치가 표시됩니다. 운영 설정에 따라 비활성일 수 있습니다.</p>
          </div>
        </header>
        <div class="metric-grid">${staticCards.join("")}</div>
      </div>
    </section>`;
}

function renderHomePageHtml(
  config: WebDashboardConfig,
  client: MineClient | undefined,
): string {
  const links = buildPublicLinks(config);
  const dashboardHref =
    links?.dashboardUrl ?? buildPublicLink(config, "/dashboard");
  const privacyHref = buildPublicLink(config, "/privacy");
  const termsHref = buildPublicLink(config, "/terms");
  const inviteHref =
    safeHttpUrl(process.env.WEB_DASHBOARD_INVITE_URL) ??
    (config.discordOAuthClientId
      ? buildOAuthInviteUrl(config.discordOAuthClientId)
      : undefined);
  const githubHref = safeHttpUrl(process.env.WEB_DASHBOARD_GITHUB_URL);
  const supportHref = safeHttpUrl(process.env.WEB_DASHBOARD_SUPPORT_URL);

  const body = `
    <div class="bg-orb bg-orb-a" aria-hidden="true"></div>
    <div class="bg-orb bg-orb-b" aria-hidden="true"></div>

    <header class="site-header">
      <div class="container header-inner">
        <a class="brand" href="/"><span class="brand-mark">M</span> MINE Soundroom</a>
        <nav class="nav" aria-label="주요 링크">
          ${anchor(dashboardHref, "웹 리모컨", "nav-link")}
          ${anchor(privacyHref, "개인정보처리방침", "nav-link")}
          ${anchor(termsHref, "이용약관", "nav-link")}
          ${inviteCta(inviteHref, "btn btn-secondary btn-sm")}
        </nav>
      </div>
    </header>

    <main>
      <section class="hero">
        <div class="container hero-grid">
          <div class="hero-copy">
            <span class="pill">Discord Music Bot</span>
            <h1>서버의 음악을<br />더 쉽게.</h1>
            <p class="lead">
              Discord 노래채널의 재생 상태, 대기열, 볼륨을 웹에서 확인하고
              같은 노래채널에서 바로 조작할 수 있습니다.
            </p>
            <div class="hero-cta">
              ${anchor(dashboardHref, "웹 리모컨 열기", "btn btn-primary")}
              ${inviteCta(inviteHref, "btn btn-secondary")}
            </div>
            <p class="trust-line">
              Discord OAuth · 같은 노래채널 권한 검사 · CSRF · rate limit
            </p>
          </div>

          <aside class="hero-card glass" aria-label="웹 리모컨 데모">
            <div class="hero-art" aria-hidden="true"></div>
            <div class="hero-card-head">
              <span class="live-dot" aria-hidden="true"></span>
              <span class="live-label">Web Control Live</span>
              <span class="badge-demo">Demo</span>
            </div>
            <p class="hero-card-title">Now Playing</p>
            <p class="hero-card-track">Night Session · Preview</p>
            <div class="meter" role="presentation">
              <span class="meter-fill" style="width:52%"></span>
            </div>
            <div class="mini-stats">
              <div class="mini-stat"><span>대기열</span><strong>3곡</strong></div>
              <div class="mini-stat"><span>볼륨</span><strong>72%</strong></div>
              <div class="mini-stat"><span>자동재생</span><strong>ON</strong></div>
            </div>
            <p class="hero-badge">같은 노래채널 권한 확인</p>
            <div class="demo-actions">
              <span>일시정지</span><span>스킵</span><span>검색</span><span>대기열</span>
            </div>
          </aside>
        </div>
      </section>

      ${renderLiveStatusSection(config, client)}

      <section class="section">
        <div class="container">
          <header class="section-head">
            <h2 class="section-title">Soundroom 기능</h2>
            <p class="section-desc">노래채널과 웹 대시보드가 함께 동작합니다.</p>
          </header>
          <div class="feature-grid">
            <article class="feature-card">
              <span class="feature-icon" aria-hidden="true">${featureIconSvg("monitor")}</span>
              <h3>웹 리모컨</h3>
              <p>재생·스킵·검색·대기열·볼륨·자동재생을 브라우저에서 조작합니다.</p>
            </article>
            <article class="feature-card">
              <span class="feature-icon" aria-hidden="true">${featureIconSvg("shield")}</span>
              <h3>같은 노래채널 권한</h3>
              <p>음성 채널 참여와 노래채널 멤버 여부를 확인한 뒤 조작을 허용합니다.</p>
            </article>
            <article class="feature-card">
              <span class="feature-icon" aria-hidden="true">${featureIconSvg("list")}</span>
              <h3>대기열 관리</h3>
              <p>본인이 추가한 곡 삭제, 위·아래 순서 변경을 지원합니다.</p>
            </article>
            <article class="feature-card">
              <span class="feature-icon" aria-hidden="true">${featureIconSvg("repeat")}</span>
              <h3>자동재생 제어</h3>
              <p>패널·웹에서 자동재생 ON/OFF와 대기열 흐름을 확인합니다.</p>
            </article>
            <article class="feature-card">
              <span class="feature-icon" aria-hidden="true">${featureIconSvg("message-circle")}</span>
              <h3>한국어 중심</h3>
              <p>패널, 웹 UI, <code>/도움말</code> 음악 카테고리를 한국어로 제공합니다.</p>
            </article>
            <article class="feature-card">
              <span class="feature-icon" aria-hidden="true">${featureIconSvg("lock")}</span>
              <h3>운영 보안</h3>
              <p>Secure cookie, rate limit, CSRF 보호, 비인증 state 차단을 적용했습니다.</p>
            </article>
          </div>
        </div>
      </section>

      <section class="section section-alt">
        <div class="container">
          <header class="section-head">
            <h2 class="section-title">지원 소스</h2>
            <p class="section-desc">코드에서 처리하는 범위만 안내합니다.</p>
          </header>
          <div class="source-list">
            <div class="source-item">
              <span class="source-badge">YouTube</span>
              <p class="source-desc">영상 URL, 검색어, 재생목록(playlist URL) 입력</p>
            </div>
            <div class="source-item">
              <span class="source-badge">Spotify</span>
              <p class="source-desc">단일 곡(track) 링크 처리 — 앨범·재생목록 URL은 지원하지 않음</p>
            </div>
            <div class="source-item">
              <span class="source-badge">채널 검색</span>
              <p class="source-desc">노래채널에 제목·URL을 내면 YouTube 검색으로 재생</p>
            </div>
          </div>
        </div>
      </section>

      <section class="section">
        <div class="container">
          <header class="section-head">
            <h2 class="section-title">자주 쓰는 방법</h2>
            <p class="section-desc">Discord 명령과 웹 리모컨 역할을 구분합니다. 자세한 관리는 웹 리모컨에서 이어서 할 수 있습니다.</p>
          </header>
          <dl class="command-dl">
            <div class="command-row">
              <dt>
                <span class="cmd-pill">slash</span>
                <code>/세팅</code>
              </dt>
              <dd>노래채널과 패널을 설정합니다.</dd>
            </div>
            <div class="command-row">
              <dt>
                <span class="cmd-pill">slash</span>
                <code>/플레이리스트</code>
              </dt>
              <dd>저장한 목록을 불러옵니다.</dd>
            </div>
            <div class="command-row">
              <dt>
                <span class="cmd-pill">slash</span>
                <code>/도움말</code>
              </dt>
              <dd>사용 가능한 명령어를 확인합니다.</dd>
            </div>
            <div class="command-row">
              <dt>
                <span class="cmd-pill">기능</span>
                <code>채널 메시지</code>
              </dt>
              <dd>노래채널에서 검색어와 URL을 바로 처리합니다.</dd>
            </div>
            <div class="command-row">
              <dt>
                <span class="cmd-pill">기능</span>
                <code>패널 버튼</code>
              </dt>
              <dd>정지·스킵·대기열·자동 재생을 Discord에서 조작합니다.</dd>
            </div>
            <div class="command-row">
              <dt>
                <span class="cmd-pill">웹</span>
                <code>웹 리모컨</code>
              </dt>
              <dd>대기열과 볼륨을 브라우저에서 조작합니다.</dd>
            </div>
          </dl>
        </div>
      </section>

      <section class="section section-alt">
        <div class="container">
          <header class="section-head">
            <h2 class="section-title">운영을 위한 기본 보호</h2>
            <p class="section-desc">보안 감사 완료가 아닌, 현재 적용·선택 가능한 운영 옵션입니다.</p>
          </header>
          <div class="security-grid">
            <div class="security-item glass">
              <h3>Discord OAuth</h3>
              <p>웹 리모컨은 Discord 로그인 후 사용합니다. access token은 세션에 저장하지 않습니다.</p>
            </div>
            <div class="security-item glass">
              <h3>CSRF 보호</h3>
              <p>POST 조작 요청에 세션 기반 CSRF 토큰을 검사합니다.</p>
            </div>
            <div class="security-item glass">
              <h3>세션 쿠키</h3>
              <p>HttpOnly·SameSite·Secure(HTTPS) 운영 옵션을 지원합니다.</p>
            </div>
            <div class="security-item glass">
              <h3>비인증 state 차단</h3>
              <p>운영에서는 비로그인 상태 API를 끄는 설정을 권장합니다.</p>
            </div>
            <div class="security-item glass">
              <h3>rate limit</h3>
              <p>로그인·조작·검색 API에 요청 제한을 적용할 수 있습니다.</p>
            </div>
            <div class="security-item glass">
              <h3>정책 페이지</h3>
              <p>${anchor(privacyHref, "개인정보처리방침")} · ${anchor(termsHref, "이용약관")}을 제공합니다.</p>
            </div>
          </div>
          <p class="policy-note">
            음악 조작은 같은 노래채널 권한을 기준으로 제한됩니다.
            코인·주식 기능은 서버 내 가상 기능이며 실제 돈, 환전, 현물 보상, 실제 투자와 무관합니다.
          </p>
        </div>
      </section>
    </main>

    <footer class="site-footer">
      <div class="container footer-inner">
        <div class="footer-brand-col">
          <p class="footer-brand">MINE</p>
          <p class="footer-tagline">
            가상 코인·모의 주식은 실제 돈·환전·투자와 무관합니다.
            상세 내용은 정책 페이지를 참고하세요.
          </p>
        </div>
        <nav class="footer-nav" aria-label="사이트 링크">
          <div class="footer-links">
            ${anchor(dashboardHref, "웹 리모컨")}
            ${anchor(privacyHref, "개인정보처리방침")}
            ${anchor(termsHref, "이용약관")}
            ${externalAnchor(githubHref, "GitHub")}
            ${externalAnchor(supportHref, "지원 서버")}
          </div>
        </nav>
      </div>
    </footer>
  `;

  return renderHomeLayout(body, config);
}

function renderHomeLayout(bodyHtml: string, config: WebDashboardConfig): string {
  const description =
    "Discord 노래채널을 웹에서 확인하고 조작하는 MINE Soundroom 음악봇 리모컨";
  const canonical = config.publicUrl ? `${config.publicUrl}/` : "";
  const ogUrl = canonical;
  const canonicalTag = canonical
    ? `<link rel="canonical" href="${escapeHtml(canonical)}" />`
    : "";
  const ogUrlTag = ogUrl
    ? `<meta property="og:url" content="${escapeHtml(ogUrl)}" />`
    : "";

  return `<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <meta name="description" content="${escapeHtml(description)}" />
  <meta name="theme-color" content="#06080d" />
  ${canonicalTag}
  <meta property="og:title" content="MINE Soundroom" />
  <meta property="og:description" content="${escapeHtml(description)}" />
  <meta property="og:type" content="website" />
  ${ogUrlTag}
  <meta name="twitter:card" content="summary" />
  <meta name="twitter:title" content="MINE Soundroom" />
  <meta name="twitter:description" content="${escapeHtml(description)}" />
  <title>MINE Soundroom</title>
  <style>
    :root {
      color-scheme: dark;
      --bg: #06080d;
      --bg-alt: #0c1018;
      --text: #eef1f8;
      --text-muted: #94a0b8;
      --accent: #3ecf8e;
      --accent-dim: rgba(62, 207, 142, 0.14);
      --purple: #7c5cff;
      --purple-dim: rgba(124, 92, 255, 0.12);
      --border: rgba(255, 255, 255, 0.08);
      --glass: rgba(18, 22, 32, 0.72);
      --radius: 16px;
      --radius-sm: 10px;
      --max: 1160px;
      --color-accent: #5865f2;
      --color-accent-hover: #4752c4;
      --color-accent-muted: rgba(88, 101, 242, 0.15);
      --color-text-secondary: #8b929a;
      --color-border: rgba(255, 255, 255, 0.08);
      --color-surface: #0e1117;
      --color-text-primary: #f0f0f0;
      --color-text-muted: #4a5060;
      --radius-lg: 16px;
      --spacing-section: 5rem;
    }
    * { box-sizing: border-box; }
    html { scroll-behavior: smooth; }
    body {
      margin: 0;
      font-family: system-ui, -apple-system, "Segoe UI", Roboto, "Noto Sans KR", sans-serif;
      background: var(--bg);
      color: var(--text);
      line-height: 1.6;
      position: relative;
      overflow-x: hidden;
    }
    a { color: #b8c4ff; text-decoration: none; }
    a:hover { color: #d4dcff; }
    a:focus-visible, .btn:focus-visible {
      outline: 2px solid var(--accent);
      outline-offset: 2px;
    }
    code {
      font-family: ui-monospace, "Cascadia Code", Consolas, monospace;
      font-size: 0.9em;
      color: #d8e0ff;
    }
    .container { max-width: var(--max); margin: 0 auto; padding: 0 1.25rem; }
    .bg-orb {
      position: fixed;
      border-radius: 50%;
      filter: blur(80px);
      pointer-events: none;
      z-index: 0;
    }
    .bg-orb-a {
      width: 420px; height: 420px;
      top: -120px; right: -80px;
      background: radial-gradient(circle, var(--accent-dim), transparent 70%);
    }
    .bg-orb-b {
      width: 380px; height: 380px;
      bottom: 10%; left: -100px;
      background: radial-gradient(circle, var(--purple-dim), transparent 70%);
    }
    .site-header, main, .site-footer { position: relative; z-index: 1; }
    .site-header {
      position: sticky;
      top: 0;
      z-index: 20;
      border-bottom: 1px solid var(--border);
      background: rgba(6, 8, 13, 0.85);
      backdrop-filter: blur(12px);
    }
    .header-inner {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 0.75rem 1rem;
      min-height: 3.75rem;
      flex-wrap: wrap;
      padding: 0.6rem 0;
    }
    .brand {
      display: inline-flex;
      align-items: center;
      gap: 0.5rem;
      font-weight: 700;
      color: var(--text);
      text-decoration: none;
    }
    .brand:hover { text-decoration: none; color: #fff; }
    .brand-mark {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 1.75rem;
      height: 1.75rem;
      border-radius: 8px;
      background: linear-gradient(135deg, var(--accent), #2aa86a);
      color: #041208;
      font-size: 0.9rem;
      font-weight: 800;
    }
    .nav {
      display: flex;
      align-items: center;
      flex-wrap: wrap;
      gap: 0.35rem 0.65rem;
      justify-content: flex-end;
    }
    .nav-link {
      font-size: 0.8125rem;
      color: var(--text-muted);
      padding: 0.35rem 0.5rem;
      border-radius: 6px;
    }
    .nav-link:hover { color: var(--text); background: rgba(255,255,255,0.04); text-decoration: none; }
    .btn {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      padding: 0.55rem 1.1rem;
      border-radius: var(--radius-sm);
      font-size: 0.875rem;
      font-weight: 600;
      text-decoration: none;
      border: 1px solid transparent;
      white-space: nowrap;
    }
    .btn:hover { text-decoration: none; filter: brightness(1.06); }
    .btn-sm { padding: 0.4rem 0.75rem; font-size: 0.8125rem; }
    .btn-primary {
      background: linear-gradient(135deg, #45e09a, var(--accent));
      color: #052214;
      box-shadow: 0 4px 24px rgba(62, 207, 142, 0.25);
    }
    .btn-glass, .btn-secondary {
      background: var(--glass);
      border-color: var(--border);
      color: var(--text);
      backdrop-filter: blur(8px);
    }
    .btn-disabled {
      display: inline-flex;
      padding: 0.4rem 0.75rem;
      font-size: 0.8125rem;
      color: #6b758a;
      border: 1px dashed var(--border);
      border-radius: var(--radius-sm);
      cursor: not-allowed;
    }
    .glass {
      background: var(--glass);
      border: 1px solid var(--border);
      backdrop-filter: blur(10px);
    }
    .hero {
      position: relative;
      padding: 3.5rem 0 2rem;
      overflow: hidden;
    }
    .hero::before {
      content: "";
      position: absolute;
      inset: 0;
      background: radial-gradient(
        ellipse 75% 55% at 50% 35%,
        var(--color-accent-muted),
        transparent 68%
      );
      pointer-events: none;
      z-index: 0;
    }
    .hero-grid {
      position: relative;
      z-index: 1;
      display: grid;
      grid-template-columns: 1fr;
      gap: 2rem;
      align-items: center;
    }
    @media (min-width: 900px) {
      .hero-grid { grid-template-columns: 1.05fr 0.95fr; gap: 2.5rem; }
    }
    .pill {
      display: inline-block;
      font-size: 0.75rem;
      font-weight: 600;
      letter-spacing: 0.03em;
      text-transform: uppercase;
      color: var(--accent);
      background: var(--accent-dim);
      border: 1px solid rgba(62, 207, 142, 0.35);
      padding: 0.3rem 0.65rem;
      border-radius: 999px;
      margin-bottom: 1rem;
    }
    .hero h1 {
      font-size: clamp(2rem, 5vw, 3rem);
      font-weight: 700;
      line-height: 1.12;
      margin: 0 0 1rem;
      letter-spacing: -0.02em;
    }
    .hero .lead {
      color: var(--color-text-secondary);
      font-size: 1.0625rem;
      max-width: 32rem;
      margin: 0 0 1.5rem;
    }
    .hero-cta {
      display: flex;
      flex-wrap: wrap;
      gap: 0.75rem;
      margin-bottom: 1rem;
    }
    .hero .btn-primary {
      background: var(--color-accent);
      color: #fff;
      border: none;
      box-shadow: 0 4px 24px rgba(88, 101, 242, 0.35);
    }
    .hero .btn-primary:hover {
      background: var(--color-accent-hover);
      filter: none;
    }
    .hero .btn-secondary {
      background: transparent;
      border: 1px solid var(--color-border);
      color: var(--color-text-secondary);
      backdrop-filter: none;
    }
    .hero .btn-secondary:hover {
      color: var(--text);
      border-color: rgba(255, 255, 255, 0.14);
      background: rgba(255, 255, 255, 0.04);
      filter: none;
    }
    @media (max-width: 640px) {
      .hero-cta { flex-direction: column; align-items: stretch; }
      .hero-cta .btn { width: 100%; text-align: center; }
    }
    .trust-line {
      font-size: 0.8125rem;
      color: #6f7d96;
      margin: 0;
    }
    .hero-card {
      border-radius: var(--radius);
      padding: 1.35rem 1.4rem;
      box-shadow: 0 20px 50px rgba(0, 0, 0, 0.35);
    }
    .hero-card-head {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      margin-bottom: 1rem;
    }
    .live-dot {
      width: 8px; height: 8px;
      border-radius: 50%;
      background: var(--accent);
      box-shadow: 0 0 8px var(--accent);
    }
    .live-label {
      font-size: 0.75rem;
      font-weight: 600;
      color: var(--accent);
      text-transform: uppercase;
      letter-spacing: 0.06em;
    }
    .badge-demo {
      margin-left: auto;
      font-size: 0.6875rem;
      padding: 0.2rem 0.45rem;
      border-radius: 6px;
      background: rgba(124, 92, 255, 0.2);
      color: #c4b8ff;
      border: 1px solid rgba(124, 92, 255, 0.35);
    }
    .hero-card-title {
      font-size: 0.75rem;
      color: var(--text-muted);
      margin: 0 0 0.25rem;
      text-transform: uppercase;
      letter-spacing: 0.04em;
    }
    .hero-card-track {
      font-size: 1.125rem;
      font-weight: 700;
      margin: 0 0 1rem;
    }
    .meter {
      height: 8px;
      background: rgba(0, 0, 0, 0.35);
      border-radius: 999px;
      overflow: hidden;
      margin-bottom: 1rem;
    }
    .meter-fill {
      display: block;
      height: 100%;
      background: linear-gradient(90deg, var(--accent), #6ee7b7);
      border-radius: 999px;
    }
    .mini-stats {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 0.5rem;
      margin-bottom: 1rem;
    }
    .mini-stat {
      padding: 0.5rem;
      border-radius: 8px;
      background: rgba(0, 0, 0, 0.2);
      border: 1px solid var(--border);
    }
    .mini-stat span {
      display: block;
      font-size: 0.6875rem;
      color: var(--text-muted);
    }
    .mini-stat strong { font-size: 0.875rem; }
    .demo-actions {
      display: flex;
      flex-wrap: wrap;
      gap: 0.4rem;
    }
    .demo-actions span {
      font-size: 0.75rem;
      padding: 0.3rem 0.55rem;
      border-radius: 6px;
      background: rgba(255, 255, 255, 0.04);
      border: 1px solid var(--border);
      color: var(--text-muted);
    }
    .live-section {
      padding-top: var(--spacing-section);
      padding-bottom: var(--spacing-section);
      border-top: 1px solid var(--border);
      border-bottom: 1px solid var(--border);
      background: rgba(8, 12, 18, 0.75);
    }
    .live-head {
      display: flex;
      flex-wrap: wrap;
      justify-content: space-between;
      gap: 0.75rem 1.5rem;
      margin-bottom: 0;
      align-items: flex-end;
    }
    .pill-live {
      background: rgba(62, 207, 142, 0.12);
      border-color: rgba(62, 207, 142, 0.4);
      color: #6ee7b7;
    }
    .live-title {
      font-size: 1.75rem;
      font-weight: 700;
      margin: 0.35rem 0 0.5rem;
    }
    .live-desc {
      margin: 0 0 2.5rem;
      font-size: 0.9375rem;
      color: var(--color-text-secondary);
      max-width: 36rem;
    }
    .live-updated {
      margin: 0;
      font-size: 0.75rem;
      color: #6f7d96;
    }
    .live-section .metric-grid {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 1rem;
    }
    @media (min-width: 720px) {
      .live-section .metric-grid {
        grid-template-columns: repeat(3, 1fr);
      }
    }
    .live-section .metric-card {
      background: var(--color-surface);
      border: 1px solid var(--color-border);
      border-radius: var(--radius-lg);
      padding: 1.5rem;
    }
    .live-section .metric-value {
      margin: 0 0 0.4rem;
      font-size: 2.5rem;
      font-weight: 700;
      line-height: 1.1;
      letter-spacing: -0.03em;
      color: var(--color-text-primary);
    }
    .live-section .metric-card-featured .metric-value {
      color: var(--color-accent);
    }
    .live-section .metric-label {
      margin: 0 0 0.35rem;
      font-size: 0.8rem;
      font-weight: 600;
      color: var(--color-text-muted);
      letter-spacing: 0.05em;
      text-transform: uppercase;
    }
    .live-section .metric-hint {
      margin: 0;
      font-size: 0.75rem;
      color: var(--color-text-secondary);
      line-height: 1.45;
    }
    .hero-art {
      height: 4.5rem;
      border-radius: 10px;
      margin-bottom: 1rem;
      background: linear-gradient(135deg, rgba(62, 207, 142, 0.35), rgba(124, 92, 255, 0.45));
      border: 1px solid rgba(255, 255, 255, 0.08);
    }
    .hero-badge {
      margin: 0 0 0.75rem;
      font-size: 0.75rem;
      color: #8ed4b0;
      padding: 0.25rem 0.5rem;
      border-radius: 6px;
      display: inline-block;
      background: rgba(62, 207, 142, 0.1);
      border: 1px solid rgba(62, 207, 142, 0.25);
    }
    .hero-card { position: relative; overflow: hidden; }
    .section {
      padding-top: var(--spacing-section);
      padding-bottom: var(--spacing-section);
    }
    .section-alt { background: var(--bg-alt); }
    .section-head { margin-bottom: 0; }
    .section-title {
      font-size: 1.75rem;
      font-weight: 700;
      margin: 0 0 0.5rem;
      letter-spacing: -0.01em;
    }
    .section-desc {
      margin: 0 0 2.5rem;
      color: var(--color-text-secondary);
      font-size: 0.9375rem;
      max-width: 40rem;
    }
    .feature-grid {
      display: grid;
      grid-template-columns: 1fr;
      gap: 1rem;
    }
    @media (min-width: 640px) {
      .feature-grid { grid-template-columns: repeat(2, 1fr); }
    }
    @media (min-width: 900px) {
      .feature-grid { grid-template-columns: repeat(3, 1fr); }
    }
    .feature-card {
      background: var(--color-surface);
      border: 1px solid var(--color-border);
      border-radius: var(--radius-lg);
      padding: 1.25rem 1.3rem;
      transition:
        border-color 0.2s ease,
        transform 0.2s ease;
    }
    .feature-card:hover {
      border-color: var(--color-accent);
      transform: translateY(-2px);
    }
    .feature-icon {
      display: inline-flex;
      margin-bottom: 0.75rem;
      color: var(--color-accent);
    }
    .feature-icon svg {
      display: block;
    }
    .feature-card h3 {
      margin: 0 0 0.4rem;
      font-size: 1rem;
    }
    .feature-card p {
      margin: 0;
      font-size: 0.875rem;
      color: var(--text-muted);
    }
    .source-list {
      display: flex;
      flex-direction: row;
      flex-wrap: wrap;
      gap: 1rem 1.25rem;
    }
    .source-item {
      flex: 1 1 min(100%, 16rem);
      min-width: 0;
    }
    .source-badge {
      display: inline-block;
      background: var(--color-accent-muted);
      color: var(--color-accent);
      border-radius: 99px;
      padding: 0.4rem 1rem;
      font-size: 0.875rem;
      font-weight: 600;
    }
    .source-desc {
      margin: 0.5rem 0 0;
      font-size: 0.875rem;
      color: var(--text-muted);
      line-height: 1.5;
    }
    .command-dl {
      margin: 0;
      padding: 0;
    }
    .command-row {
      display: grid;
      grid-template-columns: 1fr;
      gap: 0.35rem 1rem;
      padding: 0.85rem 0;
      border-bottom: 1px solid var(--color-border);
    }
    .command-row:last-child {
      border-bottom: none;
    }
    @media (min-width: 640px) {
      .command-row {
        grid-template-columns: minmax(10rem, 1fr) 2fr;
        align-items: baseline;
        gap: 1rem 1.5rem;
      }
    }
    .command-row dt {
      margin: 0;
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 0.35rem 0.5rem;
    }
    .command-row dd {
      margin: 0;
      font-size: 0.875rem;
      color: var(--color-text-secondary);
      line-height: 1.5;
    }
    .cmd-pill {
      display: inline-block;
      font-size: 0.625rem;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      color: #8a94a8;
    }
    .command-dl code {
      font-family: ui-monospace, "Cascadia Code", Consolas, monospace;
      font-size: 0.9375rem;
      color: var(--color-accent);
    }
    .security-item {
      border-radius: var(--radius);
      padding: 1.15rem 1.2rem;
    }
    .security-item h3 {
      margin: 0 0 0.4rem;
      font-size: 1rem;
    }
    .security-item p {
      margin: 0;
      font-size: 0.875rem;
      color: var(--text-muted);
    }
    .security-grid {
      display: grid;
      grid-template-columns: 1fr;
      gap: 0.85rem;
    }
    @media (min-width: 640px) {
      .security-grid { grid-template-columns: repeat(2, 1fr); }
    }
    @media (min-width: 900px) {
      .security-grid { grid-template-columns: repeat(3, 1fr); }
    }
    .policy-note {
      margin: 1.25rem 0 0;
      font-size: 0.8125rem;
      color: #7a869c;
      max-width: 48rem;
    }
    .site-footer {
      background: var(--color-surface);
      border-top: 1px solid var(--color-border);
      padding-top: var(--spacing-section);
      padding-bottom: var(--spacing-section);
    }
    .footer-inner {
      display: flex;
      flex-wrap: wrap;
      justify-content: space-between;
      align-items: flex-start;
      gap: 1.5rem 2rem;
      font-size: 0.8125rem;
    }
    .footer-brand-col {
      flex: 1 1 16rem;
      max-width: 28rem;
    }
    .footer-brand {
      margin: 0 0 0.4rem;
      font-size: 1.125rem;
      font-weight: 700;
      color: var(--color-text-primary);
    }
    .footer-tagline {
      margin: 0;
      font-size: 0.8125rem;
      line-height: 1.55;
      color: var(--color-text-muted);
    }
    .footer-nav {
      flex: 0 1 auto;
      align-self: center;
    }
    .footer-links {
      display: flex;
      flex-direction: row;
      flex-wrap: wrap;
      align-items: center;
      gap: 0.5rem 1.25rem;
    }
    .footer-links a {
      color: var(--color-text-muted);
      text-decoration: none;
    }
    .footer-links a:hover {
      color: var(--color-text-primary);
      text-decoration: none;
    }
  </style>
</head>
<body>
${bodyHtml}
</body>
</html>`;
}

function sendHomeHtml(res: ServerResponse, html: string, headOnly: boolean): void {
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

/** 로그인·rate limit·SESSION_SECRET_WEAK 없이 공개 HTML */
export function handleHomePageRequest(
  req: IncomingMessage,
  res: ServerResponse,
  pathname: string,
  config: WebDashboardConfig,
  client?: MineClient,
): boolean {
  if (!isHomePath(pathname)) {
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

  const html = renderHomePageHtml(config, client);
  sendHomeHtml(res, html, method === "HEAD");
  return true;
}
