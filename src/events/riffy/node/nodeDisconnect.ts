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

function disconnectCloseSummary(reason: unknown): string {
  if (reason === null || reason === undefined) {
    return "";
  }
  if (typeof reason === "object") {
    const o = reason as Record<string, unknown>;
    const parts: string[] = [];
    if (typeof o.event === "number") {
      parts.push(`event=${o.event}`);
    }
    if (typeof o.code === "number") {
      parts.push(`code=${o.code}`);
    }
    if (Buffer.isBuffer(o.reason)) {
      parts.push(
        o.reason.length === 0
          ? "reason=(empty buffer)"
          : `reason=${o.reason.toString("utf8") || "(binary)"}`,
      );
    } else if (typeof o.reason === "string" && o.reason !== "") {
      parts.push(`reason=${o.reason}`);
    }
    return parts.length > 0 ? ` (${parts.join(", ")})` : "";
  }
  return "";
}

export default function registerNodeDisconnect(client: MineClient): void {
  client.riffy.on("nodeDisconnect", (node, reason) => {
    const nodeLabel = getRiffyNodeLabel(node);
    const summary = disconnectCloseSummary(reason);
    log(
      "warn",
      "riffy",
      `Node disconnected: ${nodeLabel}${summary}. Waiting for Riffy internal reconnect (no manual connect).`,
      reason,
    );
  });
}
