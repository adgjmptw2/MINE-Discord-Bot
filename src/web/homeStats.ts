import { listSoundroomRecords } from "@/storage/soundroom";
import type { ExtendedPlayer, MineClient } from "@/types";
import type { HomePagePublicStats } from "@/web/types";

const STATS_CACHE_MS = 30_000;

let statsCache: { stats: HomePagePublicStats; at: number } | null = null;

function emptyStats(): HomePagePublicStats {
  return {
    guildCount: 0,
    estimatedMemberCount: 0,
    configuredSoundroomCount: 0,
    activePlayerCount: 0,
    playingPlayerCount: 0,
    queuedTrackCount: 0,
    updatedAt: new Date().toISOString(),
  };
}

function iteratePlayers(client: MineClient): ExtendedPlayer[] {
  const riffy = client.riffy as unknown as {
    players?: Map<string, ExtendedPlayer>;
  };
  const map = riffy?.players;
  if (!map) {
    return [];
  }
  return [...map.values()];
}

function computeHomePagePublicStats(client: MineClient): HomePagePublicStats {
  try {
    const guildCount = client.guilds.cache.size;
    let estimatedMemberCount = 0;
    for (const guild of client.guilds.cache.values()) {
      estimatedMemberCount += guild.memberCount ?? 0;
    }

    const guildIds = new Set(client.guilds.cache.keys());
    let configuredSoundroomCount = 0;
    for (const row of listSoundroomRecords()) {
      if (guildIds.has(row.guildId)) {
        configuredSoundroomCount += 1;
      }
    }

    const players = iteratePlayers(client);
    let activePlayerCount = 0;
    let playingPlayerCount = 0;
    let queuedTrackCount = 0;
    let activeVoiceListenerCount = 0;
    const botId = client.user?.id;

    for (const player of players) {
      if (player.voiceChannel) {
        activePlayerCount += 1;
        const guild = client.guilds.cache.get(player.guildId);
        if (guild && botId) {
          const ch = guild.channels.cache.get(String(player.voiceChannel));
          if (ch?.isVoiceBased() && "members" in ch) {
            for (const member of ch.members.values()) {
              if (member.id !== botId) {
                activeVoiceListenerCount += 1;
              }
            }
          }
        }
      }

      const hasCurrent = Boolean(player.current);
      const isPlaying =
        Boolean(player.playing) || (hasCurrent && !player.paused);
      if (isPlaying && hasCurrent) {
        playingPlayerCount += 1;
      }

      const qLen = player.queue?.length ?? 0;
      if (qLen > 0) {
        queuedTrackCount += qLen;
      }
    }

    const stats: HomePagePublicStats = {
      guildCount,
      estimatedMemberCount,
      configuredSoundroomCount,
      activePlayerCount,
      playingPlayerCount,
      queuedTrackCount,
      updatedAt: new Date().toISOString(),
    };

    if (activeVoiceListenerCount > 0) {
      stats.activeVoiceListenerCount = activeVoiceListenerCount;
    }

    return stats;
  } catch {
    return emptyStats();
  }
}

export function getHomePagePublicStats(client: MineClient): HomePagePublicStats {
  const now = Date.now();
  if (statsCache && now - statsCache.at < STATS_CACHE_MS) {
    return statsCache.stats;
  }
  const stats = computeHomePagePublicStats(client);
  statsCache = { stats, at: now };
  return stats;
}
