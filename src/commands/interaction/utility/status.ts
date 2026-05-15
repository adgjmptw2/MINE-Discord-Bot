import { panelReply } from "@/utils/discord";
import { formatKstMinutesAsClock } from "@/utils/date";
import { formatMemory, formatUptime, truncateText } from "@/utils/runtimeFormat";
import { formatCoin, formatStockRefreshTime } from "@/utils/stockFormat";
import { checkDatabaseHealth } from "@/storage/db";
import { getOrCreateCoinGuildSettings } from "@/storage/stock";
import type { MineClient, SlashCommand } from "@/types";

function summarizeMusic(client: MineClient): string[] {
  try {
    /** Riffy 런타임 필드 — 패키지 `.d.ts`와 불일치할 수 있어 최소 필드만 조회 */
    const riffy = client.riffy as unknown as {
      initiated?: boolean;
      nodeMap?: Map<string, { connected: boolean }>;
      players?: Map<string, unknown>;
    };
    if (!riffy) {
      return ["Lavalink: 확인 불가"];
    }
    if (!riffy.initiated) {
      return ["Lavalink: 초기화 전"];
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
      return ["Lavalink: 노드 정보 없음", `플레이어: ${players}개`];
    }
    return [
      `Lavalink: 연결 ${connected}/${total}노드`,
      `플레이어: ${players}개`,
    ];
  } catch {
    return ["Lavalink: 확인 불가"];
  }
}

function summarizeStock(client: MineClient): string[] {
  const market = client.stockMarket;
  const stock = client.config.stock;
  const provider = stock.stockPriceProvider;
  const mode = stock.stockPriceRefreshMode;

  if (!market) {
    return [
      `Provider: ${provider}`,
      "캐시: 서비스 없음",
      "마지막 갱신: —",
      "최근 오류: —",
    ];
  }

  const ready = market.isReady() ? "준비됨" : "캐시 비어 있음";
  const last = formatStockRefreshTime(market.getLastRefreshAt());
  const errRaw = market.getLastError();
  const err = errRaw ? truncateText(errRaw, 100) : "없음";

  const lines = [
    `Provider: ${provider}`,
    `갱신 모드: ${mode}`,
    `캐시: ${ready}`,
    `마지막 갱신: ${last}`,
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
      ? `모의 매수·매도 시간: 평일 ${formatKstMinutesAsClock(stock.stockTradingStartMinutesKst)}~${formatKstMinutesAsClock(stock.stockTradingEndMinutesKst)} KST`
      : "모의 매수·매도 시간: 제한 없음",
  );

  return lines;
}

const command: SlashCommand = {
  name: "상태",
  description: "봇의 주요 운영 상태를 확인합니다.",
  category: "utility",
  guildOnly: false,

  async run(client: MineClient, interaction) {
    const botName = client.user?.tag ?? "봇";
    const guildCount = client.guilds.cache.size;
    const uptime = formatUptime(process.uptime() * 1000);
    const mem = formatMemory(process.memoryUsage().rss);
    const nodeVer = process.version;

    const botLines = [
      `봇: **${botName}**`,
      `업타임: ${uptime}`,
      `서버 수: ${guildCount}`,
      `Node.js: ${nodeVer}`,
      `메모리(RSS): ${mem}`,
    ];

    const musicLines = summarizeMusic(client);

    const stockLines = summarizeStock(client);

    const dbOk = checkDatabaseHealth();
    const dbLines = [`SQLite: ${dbOk ? "정상" : "오류"}`];

    let coinLines: string[];
    if (!interaction.inGuild() || !interaction.guildId) {
      coinLines = [
        "서버 코인 설정: DM에서는 표시하지 않습니다.",
        "(서버 채널에서 `/상태`를 사용하세요.)",
      ];
    } else {
      try {
        const s = getOrCreateCoinGuildSettings(interaction.guildId);
        coinLines = [
          "서버 코인 설정: 조회됨",
          `출석 보상: ${formatCoin(s.attendanceReward)}`,
          `가위바위보: ${formatCoin(s.rpsMinBet)}~${formatCoin(s.rpsMaxBet)}`,
          `쿨다운: ${s.rpsCooldownSeconds}초`,
        ];
      } catch {
        coinLines = ["서버 코인 설정: 조회 실패"];
      }
    }

    const lines = [
      "### 봇",
      ...botLines,
      "",
      "### 음악",
      ...musicLines,
      "",
      "### 주식 시세",
      ...stockLines,
      "",
      "### 코인 설정",
      ...coinLines,
      "",
      "### DB",
      ...dbLines,
      "",
      "—",
      "가상 경제·시세는 게임용입니다. 토큰·API 키·DB 경로는 표시하지 않습니다.",
    ];

    await interaction.reply(
      panelReply({
        ephemeral: false,
        panel: {
          title: "🛠️ MINE 봇 상태",
          lines,
        },
      }),
    );
  },
};

export default command;
