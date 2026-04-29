import {
  ActionRowBuilder,
  EmbedBuilder,
  MessageFlags,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  type ButtonInteraction,
  type GuildTextBasedChannel,
  type GuildMember,
  type ModalSubmitInteraction,
} from "discord.js";
import { listGuildRecentPlays } from "@/storage/guildMusicRecent";
import { getSoundroom } from "@/storage/soundroom";
import { getMelonChartSource } from "@/storage/soundroomCharts";
import { buildSoundroomResolveQuery } from "@/events/bot/client/soundroomMessages";
import { ensurePlayerConnection, getActivePlayer, getPlayer, hasCurrentTrack } from "@/utils/commands";
import { convertHmsToMs } from "@/utils/convert";
import { formatDuration, truncate } from "@/utils/discord";
import { stopSoundroomProgress } from "@/utils/soundroomProgress";
import { editSoundroomIdlePanel, editSoundroomPlayingPanel, sendSoundroomAddNotification } from "@/utils/soundroomPanel";
import { prioritizeYoutubeTracks } from "@/utils/youtubePlaylist";
import { buildSoundroomQueuePanelPayload } from "@/handlers/soundroomQueuePanel";
import { scheduleEphemeralReplyDelete, scheduleQueuePanelEphemeralDelete } from "@/utils/ephemeralCleanup";
import type { ExtendedPlayer, ExtendedTrack, MineClient } from "@/types";

async function resolveSoundroomChannel(
  client: MineClient,
  channelId: string,
  fallback?: ButtonInteraction["channel"],
): Promise<GuildTextBasedChannel | null> {
  if (fallback?.isTextBased() && !fallback.isDMBased() && fallback.id === channelId) {
    return fallback;
  }

  const cached = client.channels.cache.get(channelId);
  if (cached?.isTextBased() && !cached.isDMBased()) {
    return cached;
  }

  const fetched = await client.channels.fetch(channelId).catch(() => null);
  return fetched?.isTextBased() && !fetched.isDMBased() ? fetched : null;
}

async function requirePlayerSameVoice(
  interaction: ButtonInteraction | ModalSubmitInteraction,
  client: MineClient,
): Promise<ExtendedPlayer | null> {
  const guild = interaction.guild!;
  const guildId = interaction.guildId ?? guild.id;
  const member = interaction.member as GuildMember;
  const player = getActivePlayer(client, guildId);
  if (!player) {
    await interaction.reply({ content: "활성화된 플레이어가 없습니다.", flags: MessageFlags.Ephemeral });
    scheduleEphemeralReplyDelete(interaction);
    return null;
  }

  const memberChannelId = member.voice.channelId;
  const botChannelId = guild.members.me?.voice.channelId ?? null;
  if (!memberChannelId || (botChannelId && memberChannelId !== botChannelId)) {
    await interaction.reply({ content: "봇과 같은 음성 채널에 있어야 합니다.", flags: MessageFlags.Ephemeral });
    scheduleEphemeralReplyDelete(interaction);
    return null;
  }

  return getPlayer(client, guildId)!;
}

export async function handleSoundroomButton(client: MineClient, interaction: ButtonInteraction): Promise<boolean> {
  if (!interaction.customId.startsWith("sr_")) {
    return false;
  }

  const guildId = interaction.guildId ?? interaction.guild?.id;
  if (!guildId) {
    return true;
  }

  const lounge = getSoundroom(guildId);
  if (!lounge) {
    await interaction.reply({ content: "노래 채널이 설정되어 있지 않습니다.", flags: MessageFlags.Ephemeral });
    scheduleEphemeralReplyDelete(interaction);
    return true;
  }

  if (interaction.channelId !== lounge.channelId) {
    await interaction.reply({ content: "노래 채널에서만 버튼을 사용할 수 있습니다.", flags: MessageFlags.Ephemeral });
    scheduleEphemeralReplyDelete(interaction);
    return true;
  }

  if (interaction.customId === "sr_pick_alt" || interaction.customId === "sr_error_log") {
    const text =
      interaction.customId === "sr_pick_alt"
        ? "채팅으로 넣은 곡은 **한 곡**만 대기열에 들어갑니다. 관련 재생목록 전체는 **자동 재생** 버튼을 사용해 주세요."
        : "저장된 오류 기록이 없습니다.";
    await interaction.reply({ content: text, flags: MessageFlags.Ephemeral });
    scheduleEphemeralReplyDelete(interaction);
    return true;
  }

  if (interaction.customId === "sr_recent") {
    const rows = listGuildRecentPlays(guildId, 20);
    if (rows.length === 0) {
      await interaction.reply({
        flags: MessageFlags.Ephemeral,
        embeds: [
          new EmbedBuilder()
            .setTitle("📋 이 서버 최근 재생")
            .setColor(0x5865f2)
            .setDescription("아직 이 서버에서 재생된 곡이 없습니다."),
        ],
      });
      scheduleEphemeralReplyDelete(interaction);
      return true;
    }

    const lines = rows.map((r, i) => {
      const t = truncate(r.title, 56);
      const a = r.author ? ` — ${truncate(r.author, 28)}` : "";
      const linkable = r.uri.startsWith("http://") || r.uri.startsWith("https://");
      const titlePart = linkable ? `[${t}](${r.uri})` : t;
      return `${i + 1}. ${titlePart}${a}`;
    });
    const rawDesc = lines.join("\n");
    const desc = rawDesc.length > 4096 ? `${rawDesc.slice(0, 4093)}…` : rawDesc;
    await interaction.reply({
      flags: MessageFlags.Ephemeral,
      embeds: [
        new EmbedBuilder()
          .setTitle("📋 이 서버 최근 재생")
          .setColor(0x5865f2)
          .setDescription(desc)
          .setFooter({ text: "맨 위가 가장 최근에 재생된 곡입니다." }),
      ],
    });
    scheduleEphemeralReplyDelete(interaction);
    return true;
  }

  if (interaction.customId === "sr_melon") {
    const stored = getMelonChartSource();
    if (!stored) {
      await interaction.reply({
        content:
          "전역 인기차트 재생목록이 아직 없습니다. 봇 제작자가 `.env`의 `DISCORD_OWNER_IDS`에 본인 ID를 넣은 뒤 `/melon_chart 등록`(또는 `/인기차트-관리 등록`)으로 `playlist?list=…` 또는 `watch?v=…&list=…` 링크를 등록해야 합니다.",
        flags: MessageFlags.Ephemeral,
      });
      scheduleEphemeralReplyDelete(interaction);
      return true;
    }

    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    const member = interaction.member as GuildMember;
    if (!member.voice.channel) {
      await interaction.editReply({ content: "음성 채널에 먼저 들어가 주십시오." });
      scheduleEphemeralReplyDelete(interaction);
      return true;
    }

    const player = await ensurePlayerConnection(client, guildId, member.voice.channel.id, lounge.channelId);
    try {
      const resolve = await client.riffy.resolve({ query: stored.playlistUrl, requester: member });
      const rawTracks = resolve.tracks as ExtendedTrack[];

      if (rawTracks.length === 0) {
        await interaction.editReply({
          content:
            "재생목록을 불러오지 못했습니다. Lavalink·유튜브 설정을 확인하거나, 봇 제작자가 `/melon_chart 등록`으로 주소를 다시 넣어 주십시오.",
        });
        scheduleEphemeralReplyDelete(interaction);
        return true;
      }

      const tracks =
        resolve.loadType === "playlist" ? prioritizeYoutubeTracks(rawTracks, stored.priorityVideoId) : rawTracks;

      if (resolve.loadType === "playlist") {
        for (const t of tracks) {
          t.info.requester = member;
          player.queue.add(t);
        }
      } else {
        const t = tracks[0]!;
        t.info.requester = member;
        player.queue.add(t);
      }

      const ch = await resolveSoundroomChannel(client, lounge.channelId, interaction.channel);
      const first = tracks[0]!;
      if (ch) {
        const playlistCount = resolve.loadType === "playlist" ? tracks.length : undefined;
        const playlistName = resolve.loadType === "playlist" ? resolve.playlistInfo?.name : undefined;
        await sendSoundroomAddNotification(ch, first, Math.round(player.volume ?? 100), playlistCount, playlistName);
      }

      if (player.queue.length > 0 && !player.playing && !player.paused) {
        await Promise.resolve(player.play()).catch(() => undefined);
      }

      await interaction.editReply({
        content:
          resolve.loadType === "playlist"
            ? `**${tracks.length}곡**을 대기열에 넣었습니다.`
            : `**${first.info.title}** 1곡을 넣었습니다.`,
      });
      scheduleEphemeralReplyDelete(interaction);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      await interaction.editReply({ content: `재생에 실패했습니다.\n${msg}` });
      scheduleEphemeralReplyDelete(interaction);
    }
    return true;
  }

  if (interaction.customId === "sr_search") {
    const modal = new ModalBuilder().setCustomId("sr_search_modal").setTitle("자동 재생");

    const input = new TextInputBuilder()
      .setCustomId("sr_search_query")
      .setLabel("한 곡 (제목 또는 링크)")
      .setStyle(TextInputStyle.Short)
      .setRequired(true)
      .setMaxLength(200);

    modal.addComponents(new ActionRowBuilder<TextInputBuilder>().addComponents(input));
    await interaction.showModal(modal);
    return true;
  }

  if (interaction.customId === "sr_seek") {
    const seekPlayer = await requirePlayerSameVoice(interaction, client);
    if (!seekPlayer) {
      return true;
    }

    const modal = new ModalBuilder().setCustomId("sr_seek_modal").setTitle("구간 이동");

    const input = new TextInputBuilder()
      .setCustomId("sr_seek_input")
      .setLabel("시간 (예: 1:30 또는 00:02:10)")
      .setStyle(TextInputStyle.Short)
      .setRequired(true)
      .setMaxLength(12);

    modal.addComponents(new ActionRowBuilder<TextInputBuilder>().addComponents(input));
    await interaction.showModal(modal);
    return true;
  }

  if (interaction.customId === "sr_queue") {
    const player = getPlayer(client, guildId);
    if (!player || (!player.current && player.queue.length === 0)) {
      await interaction.reply({ content: "재생 중인 곡도, 대기열도 없습니다.", flags: MessageFlags.Ephemeral });
      scheduleEphemeralReplyDelete(interaction);
      return true;
    }

    const panel = buildSoundroomQueuePanelPayload(
      client,
      player,
      0,
      guildId,
      interaction.user.id,
    );
    const panelMsg = await interaction.reply({
      flags: MessageFlags.Ephemeral,
      fetchReply: true,
      ...panel,
    });
    scheduleQueuePanelEphemeralDelete(interaction, panelMsg);
    return true;
  }

  const player = await requirePlayerSameVoice(interaction, client);
  if (!player) {
    return true;
  }

  if (interaction.customId === "sr_stop") {
    player.queue.clear();
    stopSoundroomProgress(guildId);
    player.message = undefined;
    await player.destroy();
    if (getSoundroom(guildId)) {
      await editSoundroomIdlePanel(client, guildId).catch(() => undefined);
    }
    await interaction.reply({ content: "재생을 종료했습니다.", flags: MessageFlags.Ephemeral });
    scheduleEphemeralReplyDelete(interaction);
    return true;
  }

  if (interaction.customId === "sr_pause") {
    if (!hasCurrentTrack(player)) {
      await interaction.reply({ content: "재생 중인 곡이 없습니다.", flags: MessageFlags.Ephemeral });
      scheduleEphemeralReplyDelete(interaction);
      return true;
    }

    await player.pause(!player.paused);
    await editSoundroomPlayingPanel(client, guildId);
    await interaction.reply({ content: player.paused ? "일시정지했습니다." : "다시 재생했습니다.", flags: MessageFlags.Ephemeral });
    scheduleEphemeralReplyDelete(interaction);
    return true;
  }

  if (interaction.customId === "sr_skip") {
    if (!hasCurrentTrack(player)) {
      await interaction.reply({ content: "건너뛸 곡이 없습니다.", flags: MessageFlags.Ephemeral });
      scheduleEphemeralReplyDelete(interaction);
      return true;
    }

    await player.stop();
    await interaction.reply({ content: "다음 곡으로 넘겼습니다.", flags: MessageFlags.Ephemeral });
    scheduleEphemeralReplyDelete(interaction);
    return true;
  }

  return true;
}

export async function handleSoundroomModal(client: MineClient, interaction: ModalSubmitInteraction): Promise<boolean> {
  const guildId = interaction.guildId ?? interaction.guild?.id;
  if (!guildId) {
    return false;
  }

  if (interaction.customId === "sr_queue_modal") {
    await interaction.reply({
      flags: MessageFlags.Ephemeral,
      content: "대기열은 **📋 대기열** 버튼을 누르면 목록만 표시됩니다. (이전 버전 모달은 더 이상 사용되지 않습니다.)",
    });
    scheduleEphemeralReplyDelete(interaction);
    return true;
  }

  if (interaction.customId === "sr_search_modal") {
    const raw = interaction.fields.getTextInputValue("sr_search_query").trim();
    if (!raw) {
      await interaction.reply({ content: "검색어가 비어 있습니다.", flags: MessageFlags.Ephemeral });
      scheduleEphemeralReplyDelete(interaction);
      return true;
    }

    const member = interaction.member as GuildMember;
    if (!member.voice.channel) {
      await interaction.reply({ content: "음성 채널에 입장한 뒤에 시도해 주십시오.", flags: MessageFlags.Ephemeral });
      scheduleEphemeralReplyDelete(interaction);
      return true;
    }

    const lounge = getSoundroom(guildId);
    if (!lounge) {
      await interaction.reply({ content: "노래 채널이 없습니다. 먼저 `/세팅`으로 채널을 만드십시오.", flags: MessageFlags.Ephemeral });
      scheduleEphemeralReplyDelete(interaction);
      return true;
    }

    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    const query = buildSoundroomResolveQuery(raw);
    const player = await ensurePlayerConnection(client, guildId, member.voice.channel.id, lounge.channelId);
    const resolve = await client.riffy.resolve({ query, requester: member });
    const tracks = resolve.tracks as ExtendedTrack[];

    if (tracks.length === 0) {
      await interaction.editReply({ content: "결과를 찾지 못했습니다." });
      scheduleEphemeralReplyDelete(interaction);
      return true;
    }

    let addedLabel: string;
    if (resolve.loadType === "playlist") {
      for (const t of tracks) {
        t.info.requester = member;
        player.queue.add(t);
      }
      addedLabel = `재생목록 **${tracks.length}곡**`;
    } else {
      const track = tracks.shift()!;
      track.info.requester = member;
      player.queue.add(track);
      addedLabel = `**${track.info.title}**`;
    }

    const ch = await resolveSoundroomChannel(client, lounge.channelId, interaction.channel);
    const notifyTrack = (resolve.loadType === "playlist" ? tracks[0]! : player.queue[player.queue.length - 1]!) as ExtendedTrack;
    if (ch) {
      const playlistCount = resolve.loadType === "playlist" ? tracks.length : undefined;
      const playlistName = resolve.loadType === "playlist" ? resolve.playlistInfo?.name : undefined;
      await sendSoundroomAddNotification(ch, notifyTrack, Math.round(player.volume ?? 100), playlistCount, playlistName);
    }

    if (player.queue.length > 0 && !player.playing && !player.paused) {
      await Promise.resolve(player.play()).catch(() => undefined);
    }

    await interaction.editReply({ content: `추가했습니다: ${addedLabel}` });
    scheduleEphemeralReplyDelete(interaction);
    return true;
  }

  if (interaction.customId === "sr_seek_modal") {
    const player = await requirePlayerSameVoice(interaction, client);
    if (!player) {
      return true;
    }

    if (!hasCurrentTrack(player)) {
      await interaction.reply({ content: "재생 중인 곡이 없습니다.", flags: MessageFlags.Ephemeral });
      scheduleEphemeralReplyDelete(interaction);
      return true;
    }

    const raw = interaction.fields.getTextInputValue("sr_seek_input").trim();
    const position = convertHmsToMs(raw);
    const max = player.current!.info.length;

    if (Number.isNaN(position) || position < 0 || position > max) {
      await interaction.reply({
        content: `0:00 ~ ${formatDuration(max)} 사이로 입력해 주십시오.`,
        flags: MessageFlags.Ephemeral,
      });
      scheduleEphemeralReplyDelete(interaction);
      return true;
    }

    player.seek(position);
    await editSoundroomPlayingPanel(client, guildId);
    await interaction.reply({ content: `이동했습니다: ${raw}`, flags: MessageFlags.Ephemeral });
    scheduleEphemeralReplyDelete(interaction);
    return true;
  }

  return false;
}
