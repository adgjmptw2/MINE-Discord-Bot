import { GatewayDispatchEvents } from "discord.js";
import type { MineClient } from "@/types";

interface RawVoicePayload {
  t?: string;
}

export default function registerRaw(client: MineClient): void {
  client.on("raw", (payload: RawVoicePayload) => {
    const type = payload.t as GatewayDispatchEvents | undefined;

    if (
      !type ||
      ![
        GatewayDispatchEvents.VoiceStateUpdate,
        GatewayDispatchEvents.VoiceServerUpdate,
      ].includes(type)
    ) {
      return;
    }

    client.riffy.updateVoiceState(payload);
  });
}
