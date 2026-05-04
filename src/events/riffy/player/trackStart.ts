import { ActionRowBuilder, ButtonBuilder, ButtonStyle, MessageFlags } from "discord.js";
import { recordGuildRecentPlay } from "@/storage/guildMusicRecent";
import { isSoundroomTextChannel } from "@/storage/soundroom";
import { startSoundroomProgress } from "@/utils/soundroomProgress";
import { buildPanel, formatTrackDuration, truncate } from "@/utils/discord";
import { buildSoundroomPlayingPayload, editSoundroomPlayingPanel, fetchSoundroomPanelMessage } from "@/utils/soundroomPanel";
import { prefetchAutoplayNextHint } from "@/utils/soundroomAutoplay";
import type { ExtendedPlayer, ExtendedTrack, MineClient } from "@/types";

function controlsRow(paused = false): ActionRowBuilder<ButtonBuilder> {
  return new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder().setCustomId("player_toggle_pause").setLabel(paused ? "재개" : "일시정지").setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId("player_skip").setLabel("건너뛰기").setStyle(ButtonStyle.Primary),
    new ButtonBuilder().setCustomId("player_stop").setLabel("정지").setStyle(ButtonStyle.Danger),
    new ButtonBuilder().setCustomId("player_queue").setLabel("대기열").setStyle(ButtonStyle.Secondary),
  );
}

export default function registerTrackStart(client: MineClient): void {
  client.riffy.on("trackStart", async (rawPlayer, rawTrack) => {
    const player = rawPlayer as ExtendedPlayer;
    const track = rawTrack as ExtendedTrack;

    recordGuildRecentPlay(
      player.guildId,
      track.info.title || "제목 없음",
      track.info.uri || "",
      track.info.author || "",
    );

    if (isSoundroomTextChannel(player.guildId, player.textChannel)) {
      const msg = await fetchSoundroomPanelMessage(client, player.guildId);
      if (msg?.editable) {
        player.message = msg as never;
        await msg.edit(buildSoundroomPlayingPayload(client, player));
        startSoundroomProgress(client, player.guildId);
        void prefetchAutoplayNextHint(client, player).then(() => {
          void editSoundroomPlayingPanel(client, player.guildId).catch(() => undefined);
        });
        return;
      }
    }

    const channel = client.channels.cache.get(player.textChannel);

    if (!channel || !("send" in channel) || typeof channel.send !== "function") {
      return;
    }

    const panel = buildPanel({
      eyebrow: "마인 노래 봇",
      title: "지금 재생",
      imageUrl: track.info.thumbnail,
      lines: [
        `[${truncate(track.info.title || "제목 없음", 70)}](${track.info.uri})`,
        `아티스트: ${truncate(track.info.author || "알 수 없음", 48)}`,
        `길이: ${formatTrackDuration(track)}`,
        `신청: ${track.info.requester?.user.username ?? "알 수 없음"}`,
      ],
    });

    panel.addActionRowComponents(controlsRow(player.paused));

    const message = await channel.send({
      flags: MessageFlags.IsComponentsV2,
      components: [panel] as never,
    });

    player.message = message as never;
  });
}
