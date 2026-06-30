import { ActivityType } from "discord.js";
import type { ExtendedPlayer, MineClient } from "@/types";

const PRESENCE_SETTING = "마인 노래 봇 | /세팅";
const PRESENCE_ROTATE_MS = 15_000;

let showTogetherActivity = false;
let rotationTimer: NodeJS.Timeout | null = null;

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

function countActiveVoiceListeners(client: MineClient): number {
  const botId = client.user?.id;
  if (!botId) {
    return 0;
  }

  let count = 0;
  for (const player of iteratePlayers(client)) {
    if (!player.voiceChannel) {
      continue;
    }
    const guild = client.guilds.cache.get(player.guildId);
    if (!guild) {
      continue;
    }
    const ch = guild.channels.cache.get(String(player.voiceChannel));
    if (!ch?.isVoiceBased() || !("members" in ch)) {
      continue;
    }
    for (const member of ch.members.values()) {
      if (member.id !== botId) {
        count += 1;
      }
    }
  }
  return count;
}

function buildActivityName(client: MineClient): string {
  if (!showTogetherActivity) {
    return PRESENCE_SETTING;
  }
  const listeners = countActiveVoiceListeners(client);
  return `${listeners}명과 함께하는 중 | /세팅`;
}

export function refreshBotPresence(
  client: MineClient,
  options?: { toggle?: boolean },
): void {
  const user = client.user;
  if (!user) {
    return;
  }
  if (options?.toggle) {
    showTogetherActivity = !showTogetherActivity;
  }
  user.setPresence({
    activities: [
      { name: buildActivityName(client), type: ActivityType.Listening },
    ],
    status: "online",
  });
}

export function startBotPresenceRotation(client: MineClient): void {
  if (rotationTimer) {
    clearInterval(rotationTimer);
    rotationTimer = null;
  }
  showTogetherActivity = false;
  refreshBotPresence(client);
  rotationTimer = setInterval(() => {
    refreshBotPresence(client, { toggle: true });
  }, PRESENCE_ROTATE_MS);
}
