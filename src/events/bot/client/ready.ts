import { ActivityType, Events } from "discord.js";
import type { MineClient } from "@/types";
import { log } from "@/utils/logger";

export default function registerReady(client: MineClient): void {
  client.on(Events.ClientReady, async (readyClient) => {
    client.riffy.init(readyClient.user.id);
    readyClient.user.setPresence({
      activities: [{ name: "마인 노래 봇 | /세팅", type: ActivityType.Listening }],
      status: "online",
    });
    log("success", "client", `Logged in as ${readyClient.user.tag}`);
  });
}
