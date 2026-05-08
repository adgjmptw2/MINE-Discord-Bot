import type { MineClient } from "@/types";
import { log } from "@/utils/logger";

export default function registerNodeError(client: MineClient): void {
  client.riffy.on("nodeError", (node, error) => {
    log(
      "error",
      "riffy",
      `Node error: ${(node as { name?: string }).name ?? "unknown"}`,
      error,
    );
  });
}
