import { PermissionFlagsBits } from "discord.js";
import { getPlayer } from "@/utils/commands";
import { log } from "@/utils/logger";
import { listSoundroomRecords, setSoundroom } from "@/storage/soundroom";
import type { MineClient } from "@/types";
import {
  buildSoundroomIdlePayload,
  buildSoundroomPlayingPayload,
  fetchSoundroomPanelMessage,
} from "@/utils/soundroomPanel";

let soundroomPanelReadyRefreshDone = false;

const mentionNone = { parse: [] as const };

export async function refreshSoundroomPanelsOnReady(
  client: MineClient,
): Promise<void> {
  if (soundroomPanelReadyRefreshDone) {
    return;
  }
  const uid = client.user?.id;
  if (!uid) {
    return;
  }
  soundroomPanelReadyRefreshDone = true;

  log("info", "client", "Refreshing Soundroom panels...");
  const rooms = listSoundroomRecords();
  let edited = 0;
  let recreated = 0;
  let skipped = 0;
  let failed = 0;

  for (const room of rooms) {
    await new Promise<void>((resolve) => {
      setTimeout(resolve, 350);
    });
    try {
      const guild =
        client.guilds.cache.get(room.guildId) ??
        (await client.guilds.fetch(room.guildId).catch(() => null));
      if (!guild) {
        skipped += 1;
        continue;
      }

      const me = guild.members.me;
      if (!me) {
        skipped += 1;
        continue;
      }

      const ch =
        guild.channels.cache.get(room.channelId) ??
        (await guild.channels.fetch(room.channelId).catch(() => null));
      if (!ch?.isTextBased() || ch.isDMBased()) {
        skipped += 1;
        continue;
      }

      const perms = ch.permissionsFor(me);
      const need =
        PermissionFlagsBits.ViewChannel |
        PermissionFlagsBits.SendMessages |
        PermissionFlagsBits.EmbedLinks;
      if (!perms?.has(need)) {
        skipped += 1;
        continue;
      }

      const player = getPlayer(client, room.guildId);
      const payload = player?.current
        ? buildSoundroomPlayingPayload(client, player)
        : buildSoundroomIdlePayload(client);

      const msg = await fetchSoundroomPanelMessage(client, room.guildId);

      if (msg) {
        if (!msg.editable || msg.author.id !== uid) {
          failed += 1;
          continue;
        }
        try {
          await msg.edit({ ...payload, allowedMentions: mentionNone });
          edited += 1;
        } catch {
          failed += 1;
        }
      } else {
        try {
          const sent = await ch.send({
            ...payload,
            allowedMentions: mentionNone,
          });
          setSoundroom(room.guildId, ch.id, sent.id);
          recreated += 1;
        } catch {
          failed += 1;
        }
      }
    } catch {
      failed += 1;
    }
  }

  log(
    "info",
    "client",
    `Soundroom panel refresh done: edited ${edited}, recreated ${recreated}, skipped ${skipped}, failed ${failed}`,
  );
}
