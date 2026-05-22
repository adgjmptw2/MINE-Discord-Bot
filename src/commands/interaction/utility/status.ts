import os from "node:os";
import {
  MessageFlags,
  Status,
  type InteractionEditReplyOptions,
  type InteractionReplyOptions,
} from "discord.js";
import { panelReply } from "@/utils/discord";
import { formatMemory, truncateText } from "@/utils/runtimeFormat";
import { formatStockRefreshTime } from "@/utils/stockFormat";
import { checkDatabaseHealth } from "@/storage/db";
import type { MineClient, SlashCommand } from "@/types";

const NO_MENTION = { parse: [] as const };
const STATUS_ACCENT_GREEN = 0x22c55e;

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

function formatLatencyShort(ms: number): string {
  if (!Number.isFinite(ms) || ms < 0) {
    return "지연 ⚪";
  }
  const rounded = Math.round(ms);
  if (rounded <= 150) {
    return `${rounded}ms 🟢`;
  }
  if (rounded <= 300) {
    return `${rounded}ms 🟡`;
  }
  return `${rounded}ms 🔴`;
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
  return `${(bytes / 1024 ** 3).toFixed(1)} GB`;
}

function wsStatusShort(status: Status): string {
  switch (status) {
    case Status.Ready:
      return "🟢";
    case Status.Connecting:
    case Status.Reconnecting:
    case Status.Nearly:
    case Status.WaitingForGuilds:
    case Status.Identifying:
    case Status.Resuming:
      return "🟡";
    case Status.Idle:
      return "⚪";
    case Status.Disconnected:
      return "🔴";
    default:
      return "⚪";
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

function summarizeMusic(client: MineClient): string {
  try {
    const riffy = client.riffy as unknown as {
      initiated?: boolean;
      nodeMap?: Map<string, { connected: boolean }>;
      players?: Map<string, unknown>;
    };
    if (!riffy) {
      return "Lavalink ⚪ 확인 불가 · 플레이어 —";
    }
    if (!riffy.initiated) {
      return "Lavalink ⚪ 초기화 전 · 플레이어 —";
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
      return `Lavalink ⚪ 노드 정보 없음 · 플레이어 ${players}개`;
    }
    const lavOk = connected === total && total > 0;
    return `Lavalink ${connected}/${total} ${formatHealthIcon(lavOk)} · 플레이어 ${players}개`;
  } catch {
    return "Lavalink ⚪ 확인 불가 · 플레이어 —";
  }
}

function summarizeStockCompact(client: MineClient): { line1: string; line2: string } {
  const market = client.stockMarket;
  const stock = client.config.stock;
  const provider = stock.stockPriceProvider;

  if (!market) {
    return {
      line1: `${provider} · 캐시 ⚪ 서비스 없음 · 최근 오류 —`,
      line2: "마지막 갱신 —",
    };
  }

  const ready = market.isReady();
  const last = formatStockRefreshTime(market.getLastRefreshAt());
  const errRaw = market.getLastError();
  const errShort = errRaw ? truncateText(errRaw, 80) : null;
  const errLabel = errShort ? `최근 오류 ${errShort}` : "최근 오류 없음";
  const cacheLabel = ready ? `캐시 ${formatHealthIcon(ready)}` : "캐시 ⚪ 준비 중";

  return {
    line1: `${provider} · ${cacheLabel} · ${errLabel}`,
    line2: `마지막 갱신 ${last}`,
  };
}

const command: SlashCommand = {
  name: "상태",
  description: "봇의 주요 운영 상태를 확인합니다.",
  category: "utility",
  guildOnly: false,

  async run(client: MineClient, interaction) {
    await interaction.deferReply();

    const guildCount = client.guilds.cache.size;
    const memberEst = estimateMemberCount(client);
    const voiceN = estimateVoiceHumans(client);
    const cmdN = client.slashCommands.size;
    const ping = client.ws.ping;
    const rss = process.memoryUsage().rss;
    const heap = process.memoryUsage();

    const totalMem = os.totalmem();
    const usedMem = totalMem - os.freemem();

    const cpus = os.cpus();
    const cpuCores = cpus.length;

    const musicLine = summarizeMusic(client);
    const stock = summarizeStockCompact(client);
    const dbOk = checkDatabaseHealth();

    const serviceLine1 = `서버 **${guildCount}**개 · 유저 **${memberEst.toLocaleString("ko-KR")}**명 · 음성 **${voiceN.toLocaleString("ko-KR")}**명`;
    const serviceLine2 = `커맨드 **${cmdN}**개 · ${formatLatencyShort(ping)} · WS ${wsStatusShort(client.ws.status)}`;

    const runtimeLine1 = `${os.type()} ${os.arch()} · ${process.version} · CPU **${cpuCores}**코어`;
    const runtimeLine2 = `RSS **${formatMemory(rss)}** · MEM **${formatBytesGb(usedMem)}** / **${formatBytesGb(totalMem)}** · HEAP **${formatMemory(heap.heapUsed)}** / **${formatMemory(heap.heapTotal)}**`;

    const lines: string[] = [
      `**⏱️**\n${formatUptimeWithSeconds(process.uptime() * 1000)}`,
      `**📡 서비스**\n${serviceLine1}\n${serviceLine2}`,
      `**🎵 음악**\n${musicLine}`,
      `**🖥️ 런타임**\n${runtimeLine1}\n${runtimeLine2}`,
      `**💾 저장소**\nSQLite ${formatHealthIcon(dbOk)} ${dbOk ? "정상" : "오류"}`,
      `**📈 모의주식**\n${stock.line1}\n${stock.line2}`,
    ];

    await interaction.editReply(
      replyToEditOptions(
        panelReply({
          ephemeral: false,
          panel: {
            title: "🟢 MINE 상태",
            lines,
            accentColor: STATUS_ACCENT_GREEN,
          },
          allowedMentions: NO_MENTION,
        }),
      ),
    );
  },
};

export default command;
