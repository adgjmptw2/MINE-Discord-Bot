import type { MineClient } from "@/types";
import { log } from "@/utils/logger";

type RiffyNodeLike = {
  name?: string;
  options?: {
    name?: string;
    identifier?: string;
    host?: string;
    port?: number;
  };
};

function getRiffyNodeLabel(node: unknown): string {
  const n = node as RiffyNodeLike;
  if (typeof n.name === "string" && n.name.trim() !== "") {
    return n.name;
  }
  const opt = n.options;
  if (opt) {
    if (typeof opt.name === "string" && opt.name.trim() !== "") {
      return opt.name;
    }
    if (typeof opt.identifier === "string" && opt.identifier.trim() !== "") {
      return opt.identifier;
    }
    if (typeof opt.host === "string" && opt.host.trim() !== "") {
      const port = typeof opt.port === "number" ? opt.port : "unknown-port";
      return `${opt.host}:${port}`;
    }
  }
  return "unknown";
}

export default function registerNodeReconnect(client: MineClient): void {
  client.riffy.on("nodeReconnect", (node) => {
    const nodeLabel = getRiffyNodeLabel(node);
    log("info", "riffy", `Node reconnecting: ${nodeLabel}`);
  });
}
