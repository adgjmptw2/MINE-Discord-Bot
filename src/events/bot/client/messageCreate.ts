import { tryHandleSoundroomMessage } from "@/events/bot/client/soundroomMessages";
import type { MineClient } from "@/types";

export default function registerMessageCreate(client: MineClient): void {
  client.on("messageCreate", async (message) => {
    await tryHandleSoundroomMessage(client, message);
  });
}
