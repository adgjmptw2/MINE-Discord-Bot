import type { MineClient } from "@/types";
import { log } from "@/utils/logger";

const reconnectTimers = new Map<string, NodeJS.Timeout>();
const reconnectDelayMs = 5_000;
const maxAttempts = 12;

export default function registerNodeDisconnect(client: MineClient): void {
  client.riffy.on("nodeDisconnect", (node, reason) => {
    const reconnectableNode = node as { options?: { identifier?: string }; connect?: () => Promise<void> | void };
    const identifier = reconnectableNode.options?.identifier ?? "unknown";
    log("warn", "riffy", `Node disconnected: ${identifier}`, reason);

    if (typeof reconnectableNode.connect !== "function") {
      log("warn", "riffy", `Node ${identifier} does not expose connect(); skipping auto-reconnect.`);
      return;
    }

    const active = reconnectTimers.get(identifier);
    if (active) {
      clearTimeout(active);
      reconnectTimers.delete(identifier);
    }

    let attempt = 0;

    const tryReconnect = () => {
      const timer = setTimeout(async () => {
        attempt += 1;

        try {
          await reconnectableNode.connect?.();
          log("success", "riffy", `Node reconnect successful: ${identifier} (attempt ${attempt})`);
          reconnectTimers.delete(identifier);
          return;
        } catch (error) {
          log("warn", "riffy", `Node reconnect failed: ${identifier} (attempt ${attempt})`, error);
        }

        if (attempt >= maxAttempts) {
          reconnectTimers.delete(identifier);
          log("error", "riffy", `Node reconnect exhausted for ${identifier} after ${maxAttempts} attempts`);
          return;
        }

        tryReconnect();
      }, reconnectDelayMs);

      reconnectTimers.set(identifier, timer);
    };

    tryReconnect();
  });
}
