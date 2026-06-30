import { ActivityType } from "discord.js";
import type { MineClient } from "@/types";

const PRESENCE_SETTING = "마인 노래 봇 | /세팅";
const PRESENCE_ROTATE_MS = 15_000;

let showTogetherActivity = false;
let rotationTimer: NodeJS.Timeout | null = null;

function getEstimatedMemberCount(client: MineClient): number {
  let total = 0;
  for (const guild of client.guilds.cache.values()) {
    total += guild.memberCount ?? 0;
  }
  return total;
}

function buildActivityName(client: MineClient): string {
  if (!showTogetherActivity) {
    return PRESENCE_SETTING;
  }
  const members = getEstimatedMemberCount(client);
  const formatted = members.toLocaleString("ko-KR");
  return `${formatted}명과 함께하는 중`;
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
