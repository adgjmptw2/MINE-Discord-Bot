import { ActivityType, Events } from "discord.js";
import { createStockMarketService } from "@/services/stock/createStockMarketService";
import type { MineClient } from "@/types";
import { log } from "@/utils/logger";
import { refreshSoundroomPanelsOnReady } from "@/utils/soundroomPanelRefresh";

export default function registerReady(client: MineClient): void {
  client.on(Events.ClientReady, async (readyClient) => {
    client.riffy.init(readyClient.user.id);
    readyClient.user.setPresence({
      activities: [
        { name: "마인 노래 봇 | /세팅", type: ActivityType.Listening },
      ],
      status: "online",
    });
    log("success", "client", `Logged in as ${readyClient.user.tag}`);

    try {
      if (!client.stockMarket) {
        client.stockMarket = createStockMarketService(client.config.stock);
        client.stockMarket.start();
      }
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      log("warn", "stock", `Stock market service disabled: ${msg}`);
    }

    setTimeout(() => {
      void refreshSoundroomPanelsOnReady(client).catch((err) => {
        const m = err instanceof Error ? err.message : String(err);
        log("warn", "client", `Soundroom panel refresh: ${m}`);
      });
    }, 3000);
  });
}
