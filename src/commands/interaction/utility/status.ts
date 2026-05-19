import os from "node:os";
import {
  MessageFlags,
  Status,
  type InteractionEditReplyOptions,
  type InteractionReplyOptions,
} from "discord.js";
import { panelReply } from "@/utils/discord";
import { formatKstMinutesAsClock } from "@/utils/date";
import { formatMemory, truncateText } from "@/utils/runtimeFormat";
import { formatCoin, formatStockRefreshTime } from "@/utils/stockFormat";
import { checkDatabaseHealth } from "@/storage/db";
import { getOrCreateCoinGuildSettings } from "@/storage/stock";
import type { MineClient, SlashCommand } from "@/types";

const NO_MENTION = { parse: [] as const };

function replyToEditOptions(
  r: InteractionReplyOptions,
): InteractionEditReplyOptions {
  return {
    flags: MessageFlags.IsComponentsV2,
    components: r.components,
    allowedMentions: r.allowedMentions,
  };
}

function safeNumber(value: unknown, fallback = 0): number {
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function formatPercent(value: number): string {
  return `${Math.min(100, Math.max(0, value)).toFixed(1)}%`;
}

function buildUsageBar(percent: number, size = 12): string {
  const p = Math.min(100, Math.max(0, percent));
  const filled = Math.round((p / 100) * size);
  const f = Math.min(size, Math.max(0, filled));
  return `${"█".repeat(f)}${"░".repeat(size - f)} ${formatPercent(p)}`;
}

function formatLatencyLine(ms: number): string {
  if (!Number.isFinite(ms) || ms < 0) {
    return "⚪ 확인 불가";
  }
  const rounded = Math.round(ms);
  if (rounded <= 150) {
    return `${rounded}ms 🟢 좋음`;
  }
  if (rounded <= 300) {
    return `${rounded}ms 🟡 양호`;
  }
  return `${rounded}ms 🔴 지연`;
}

function formatHealthIcon(ok: boolean): string {
  return ok ? "🟢" : "🔴";
}

function formatUptimeWithSeconds(ms: number): string {
  const totalSec = Math.max(0, Math.floor(ms / 1000));
  const days = Math.floor(totalSec / 86_400);
  const hours = Math.floor((totalSec % 86_400) / 3600);
  const mins = Math.floor((totalSec % 3600) / 60);
  const secs = totalSec % 60;
  const hh = String(hours).padStart(2, "0");
  const mm = String(mins).padStart(2, "0");
  const ss = String(secs).padStart(2, "0");
  if (days > 0) {
    return `${days}일 ${hh}시간 ${mm}분 ${ss}초`;
  }
  if (hours > 0) {
    return `${hours}시간 ${mm}분 ${ss}초`;
  }
  if (mins > 0) {
    return `${mins}분 ${ss}초`;
  }
  return `${secs}초`;
}

function formatBytesGb(bytes: number): string {
  return `${(bytes / 1024 ** 3).toFixed(2)} GB`;
}

function wsStatusLabel(status: Status): string {
  switch (status) {
    case Status.Ready:
      return "🟢 준비됨";
    case Status.Connecting:
      return "🟡 연결 중";
    case Status.Reconnecting:
      return "🟡 재연결 중";
    case Status.Idle:
      return "⚪ 유휴";
    case Status.Nearly:
      return "🟡 거의 준비";
    case Status.Disconnected:
      return "🔴 끊김";
    case Status.WaitingForGuilds:
      return "🟡 길드 대기";
    case Status.Identifying:
      return "🟡 식별 중";
    case Status.Resuming:
      return "🟡 재개 중";
    default:
      return "⚪ 확인 중";
  }
}

function cpuIdleAndTotal(): { idle: number; total: number } {
  let idle = 0;
  let total = 0;
  for (const c of os.cpus()) {
    const t = c.times.user + c.times.nice + c.times.sys + c.times.idle + c.times.irq;
    idle += c.times.idle;
    total += t;
  }
  return { idle, total };
}

async function measureCpuUsagePercent(): Promise<number | null> {
  const a = cpuIdleAndTotal();
  await new Promise((r) => setTimeout(r, 380));
  const b = cpuIdleAndTotal();
  const idleDelta = b.idle - a.idle;
  const totalDelta = b.total - a.total;
  if (totalDelta <= 0) {
    return null;
  }
  const usage = 100 * (1 - idleDelta / totalDelta);
  return Math.min(100, Math.max(0, usage));
}

async function fetchHomepageStatusLine(): Promise<string | null> {
  const raw = process.env.MINE_STATUS_HOMEPAGE_URL?.trim();
  if (!raw) {
    return null;
  }
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return "홈페이지 ⚪ URL 형식 오류(환경 변수 확인)";
  }
  if (!["http:", "https:"].includes(url.protocol)) {
    return "홈페이지 ⚪ http(s)만 지원";
  }
  const started = Date.now();
  const doFetch = async (method: "HEAD" | "GET") => {
    return fetch(url.href, {
      method,
      signal: AbortSignal.timeout(2000),
      redirect: "follow",
    });
  };
  try {
    let res = await doFetch("HEAD");
    if (!res.ok) {
      res = await doFetch("GET");
    }
    const ms = Date.now() - started;
    if (res.ok) {
      return `홈페이지 🟢 응답 ${ms}ms`;
    }
    return `홈페이지 🟡 HTTP ${res.status}`;
  } catch {
    return "홈페이지 🔴 확인 실패";
  }
}

function estimateMemberCount(client: MineClient): number {
  return client.guilds.cache.reduce(
    (sum, g) => sum + safeNumber(g.memberCount, 0),
    0,
  );
}

function estimateVoiceHumans(client: MineClient): number {
  return client.guilds.cache.reduce((sum, guild) => {
    let n = 0;
    for (const vs of guild.voiceStates.cache.values()) {
      if (!vs.channelId) {
        continue;
      }
      if (vs.member?.user?.bot === true) {
        continue;
      }
      n += 1;
    }
    return sum + n;
  }, 0);
}

function summarizeMusic(client: MineClient): string[] {
  try {
    const riffy = client.riffy as unknown as {
      initiated?: boolean;
      nodeMap?: Map<string, { connected: boolean }>;
      players?: Map<string, unknown>;
    };
    if (!riffy) {
      return ["Lavalink ⚪ 확인 불가", "플레이어 —"];
    }
    if (!riffy.initiated) {
      return ["Lavalink ⚪ 초기화 전", "플레이어 —"];
    }
    let total = 0;
    let connected = 0;
    const map = riffy.nodeMap;
    if (map) {
      for (const node of map.values()) {
        total += 1;
        if (node.connected) {
          connected += 1;
        }
      }
    }
    const players = riffy.players?.size ?? 0;
    if (total === 0) {
      return ["Lavalink ⚪ 노드 정보 없음", `플레이어 **${players}**개`];
    }
    const lavOk = connected === total && total > 0;
    return [
      `${formatHealthIcon(lavOk)} Lavalink 연결 **${connected}/${total}**노드`,
      `플레이어 **${players}**개`,
    ];
  } catch {
    return ["Lavalink ⚪ 확인 불가", "플레이어 —"];
  }
}

function summarizeStock(client: MineClient): string[] {
  const market = client.stockMarket;
  const stock = client.config.stock;
  const provider = stock.stockPriceProvider;
  const mode = stock.stockPriceRefreshMode;

  if (!market) {
    return [
      `Provider **${provider}**`,
      "캐시 ⚪ 서비스 없음",
      "마지막 갱신 —",
      "최근 오류 —",
    ];
  }

  const ready = market.isReady();
  const last = formatStockRefreshTime(market.getLastRefreshAt());
  const errRaw = market.getLastError();
  const err = errRaw ? truncateText(errRaw, 100) : "없음";

  const lines = [
    `Provider **${provider}**`,
    `갱신 모드 **${mode}**`,
    `${formatHealthIcon(ready)} 캐시 ${ready ? "준비됨" : "비어 있음"}`,
    `마지막 갱신 **${last}**`,
    `최근 오류: ${err}`,
  ];

  if (mode === "scheduled-close") {
    const clocks = stock.stockScheduledCloseRefreshTimesKst
      .map((m) => formatKstMinutesAsClock(m))
      .join(", ");
    lines.push(`예약 시각(KST): ${clocks || "—"}`);
  }

  lines.push(
    stock.stockTradingHoursEnabled
      ? `모의 매수·매도 시간: 평일 **${formatKstMinutesAsClock(stock.stockTradingStartMinutesKst)}~${formatKstMinutesAsClock(stock.stockTradingEndMinutesKst)}** KST`
      : "모의 매수·매도 시간: **제한 없음**",
  );

  return lines;
}

const command: SlashCommand = {
  name: "상태",
  description: "봇의 주요 운영 상태를 확인합니다.",
  category: "utility",
  guildOnly: false,

  async run(client: MineClient, interaction) {
    await interaction.deferReply();

    const homepageLinePromise = fetchHomepageStatusLine();
    const cpuPromise = measureCpuUsagePercent();

    const guildCount = client.guilds.cache.size;
    const memberEst = estimateMemberCount(client);
    const voiceN = estimateVoiceHumans(client);
    const cmdN = client.slashCommands.size;
    const ping = client.ws.ping;
    const wsLabel = wsStatusLabel(client.ws.status);
    const rss = process.memoryUsage().rss;
    const heap = process.memoryUsage();

    const totalMem = os.totalmem();
    const freeMem = os.freemem();
    const usedMem = totalMem - freeMem;
    const memPct = (usedMem / totalMem) * 100;

    const heapTotal = Math.max(1, heap.heapTotal);
    const heapPct = (heap.heapUsed / heapTotal) * 100;

    const cpus = os.cpus();
    const cpuModel = cpus[0]?.model?.trim() || "확인 불가";
    const cpuCores = cpus.length;

    const [cpuPct, homepageLine] = await Promise.all([
      cpuPromise,
      homepageLinePromise,
    ]);

    const musicLines = summarizeMusic(client);
    const stockLines = summarizeStock(client);
    const dbOk = checkDatabaseHealth();

    let coinLines: string[];
    if (!interaction.inGuild() || !interaction.guildId) {
      coinLines = [
        "DM에서는 이 서버의 코인 설정을 표시하지 않습니다.",
        "서버 채널에서 `/상태`를 사용하면 출석·가위바위보 설정을 볼 수 있어요.",
      ];
    } else {
      try {
        const s = getOrCreateCoinGuildSettings(interaction.guildId);
        coinLines = [
          `출석 보상 **${formatCoin(s.attendanceReward)}** 코인`,
          `가위바위보 **${formatCoin(s.rpsMinBet)}~${formatCoin(s.rpsMaxBet)}** 코인`,
          `쿨다운 **${s.rpsCooldownSeconds}**초`,
        ];
      } catch {
        coinLines = ["코인 설정 ⚪ 조회 실패"];
      }
    }

    const osLine = `${os.type()} ${os.release()} · ${os.arch()}`;
    const runtimeLines = [
      osLine,
      `Node.js **${process.version}**`,
      `CPU **${cpuModel}** · **${cpuCores}**코어`,
    ];

    if (cpuPct !== null) {
      runtimeLines.push(
        `CPU 사용률 **${formatPercent(cpuPct)}**`,
        buildUsageBar(cpuPct, 12),
      );
    } else {
      runtimeLines.push("CPU 사용률 ⚪ 측정 생략");
    }

    runtimeLines.push(
      `MEM **${formatBytesGb(usedMem)}** / **${formatBytesGb(totalMem)}** (${formatPercent(memPct)})`,
      buildUsageBar(memPct, 12),
      `HEAP **${formatMemory(heap.heapUsed)}** / **${formatMemory(heap.heapTotal)}** (${formatPercent(heapPct)})`,
      buildUsageBar(heapPct, 12),
    );

    const serviceLines = [
      `서버 **${guildCount}**개 · 유저 추정 **${memberEst.toLocaleString("ko-KR")}**명 · 음성 이용 **${voiceN.toLocaleString("ko-KR")}**명`,
      `커맨드 **${cmdN}**개 · 레이턴시 ${formatLatencyLine(ping)}`,
      `WebSocket ${wsLabel} · 봇 메모리 **${formatMemory(rss)}**`,
    ];
    if (homepageLine) {
      serviceLines.push(homepageLine);
    }

    const lines: string[] = [
      "### ⏱️ 업타임",
      formatUptimeWithSeconds(process.uptime() * 1000),
      "",
      "### 📡 서비스",
      ...serviceLines,
      "",
      "### 🎵 음악",
      ...musicLines,
      "",
      "### 🖥️ 런타임",
      ...runtimeLines,
      "",
      "### 💾 저장소",
      `SQLite ${formatHealthIcon(dbOk)} ${dbOk ? "정상" : "오류"}`,
      "",
      "### 📈 모의주식",
      ...stockLines,
      "",
      "### 🪙 코인 설정",
      ...coinLines,
      "",
      "※ 가상 경제·시세는 게임용입니다. 토큰·API 키·DB 경로는 표시하지 않습니다.",
      "※ 주식 기능은 서버 내 모의투자이며 실제 투자용이 아닙니다.",
    ];

    await interaction.editReply(
      replyToEditOptions(
        panelReply({
          ephemeral: false,
          panel: {
            title: "🛠️ MINE 상태",
            description: "운영 상태 요약입니다.",
            lines,
          },
          allowedMentions: NO_MENTION,
        }),
      ),
    );
  },
};

export default command;
