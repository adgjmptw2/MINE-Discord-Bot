import type { MineClient } from "@/types";
import { log } from "@/utils/logger";

export default function registerNodeConnect(client: MineClient): void {
  client.riffy.on("nodeConnect", async (node) => {
    log("success", "riffy", `Node connected: ${(node as { name?: string }).name ?? "unknown"}`);
  });
}
