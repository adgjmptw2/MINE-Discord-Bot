import {
  MessageFlags,
  type ButtonInteraction,
  type StringSelectMenuInteraction,
} from "discord.js";
import { getSoundroom } from "@/storage/soundroom";
import {
  PlaylistActionError,
  addWebPlaylistTracksToSoundroomQueue,
} from "@/web/playlistActions";
import { getWebPlaylistById, getWebPlaylistTracks } from "@/web/playlistDb";
import {
  getBotVoiceChannelId,
  getGuildMemberVoiceChannelId,
} from "@/web/soundroomControlAuth";
import { sendSoundroomPlaylistAddNotice } from "@/web/soundroomChannelNotice";
import type { DiscordOAuthUserDto } from "@/web/types";
import {
  scheduleEphemeralReplyDelete,
} from "@/utils/ephemeralCleanup";
import {
  SR_PLAYLIST_OPEN_CUSTOM_ID,
  buildPlaylistBrowserPayload,
  buildPlaylistDetailPayload,
  canViewWebPlaylistForDiscord,
  listDiscordPlayablePlaylists,
  parsePlaylistDiscordCustomId,
  type PlaylistDiscordTab,
} from "@/utils/soundroomPlaylistDiscord";
import type { MineClient } from "@/types";

const WRONG_USER_MSG = "이 메뉴는 다른 사용자의 메뉴입니다.";

type PlaylistInteraction = ButtonInteraction | StringSelectMenuInteraction;

async function replyEphemeral(
  interaction: PlaylistInteraction,
  content: string,
): Promise<void> {
  if (interaction.replied || interaction.deferred) {
    await interaction.followUp({
      content,
      flags: MessageFlags.Ephemeral,
    });
    return;
  }
  await interaction.reply({
    content,
    flags: MessageFlags.Ephemeral,
  });
  scheduleEphemeralReplyDelete(interaction);
}

async function updateEphemeral(
  interaction: PlaylistInteraction,
  payload: ReturnType<typeof buildPlaylistBrowserPayload>,
): Promise<void> {
  if (interaction.deferred || interaction.replied) {
    await interaction.editReply({
      embeds: payload.embeds,
      components: payload.components,
    });
    return;
  }
  await interaction.update({
    embeds: payload.embeds,
    components: payload.components,
  });
}

function assertSoundroomChannel(
  interaction: PlaylistInteraction,
): { ok: true; guildId: string } | { ok: false } {
  const guildId = interaction.guildId;
  if (!guildId || !interaction.guild) {
    return { ok: false };
  }
  const lounge = getSoundroom(guildId);
  if (!lounge) {
    return { ok: false };
  }
  if (interaction.channelId !== lounge.channelId) {
    return { ok: false };
  }
  return { ok: true, guildId };
}

async function requireDiscordSoundroomQueueAccess(
  client: MineClient,
  guildId: string,
  userId: string,
): Promise<
  | {
      ok: true;
      userVoiceChannelId: string;
      soundroomChannelId: string;
    }
  | { ok: false; message: string }
> {
  const room = getSoundroom(guildId);
  if (!room) {
    return {
      ok: false,
      message: "이 서버에는 아직 노래채널이 설정되지 않았습니다.",
    };
  }

  const guild = client.guilds.cache.get(guildId);
  if (!guild) {
    return {
      ok: false,
      message: "이 서버에는 아직 노래채널이 설정되지 않았습니다.",
    };
  }

  const userVoice = await getGuildMemberVoiceChannelId(guild, userId);
  if (!userVoice) {
    return { ok: false, message: "먼저 노래채널에 들어가 주세요." };
  }

  const botVoice = getBotVoiceChannelId(client, guildId);
  if (botVoice && botVoice !== userVoice) {
    return {
      ok: false,
      message: "봇과 같은 노래채널에서만 사용할 수 있습니다.",
    };
  }

  return {
    ok: true,
    userVoiceChannelId: userVoice,
    soundroomChannelId: room.channelId,
  };
}

function oauthUserFromInteraction(
  interaction: PlaylistInteraction,
): DiscordOAuthUserDto {
  const u = interaction.user;
  return {
    id: u.id,
    username: u.username,
    globalName: u.globalName ?? null,
    avatar: u.avatar,
    avatarUrl: u.displayAvatarURL({ size: 64 }),
  };
}

function playlistActionErrorMessage(error: unknown): string {
  if (error instanceof PlaylistActionError) {
    switch (error.code) {
      case "USER_NOT_IN_VOICE_CHANNEL":
        return "먼저 노래채널에 들어가 주세요.";
      case "NOT_SAME_VOICE_CHANNEL":
        return "봇과 같은 노래채널에서만 사용할 수 있습니다.";
      case "PLAYLIST_EMPTY":
        return "비어 있는 플레이리스트입니다.";
      case "PLAYLIST_NOT_FOUND":
      case "PLAYLIST_DELETED":
        return "플레이리스트를 찾을 수 없습니다.";
      case "PLAYLIST_ACCESS_DENIED":
      case "PLAYLIST_HIDDEN":
        return "이 플레이리스트를 사용할 권한이 없습니다.";
      case "LAVALINK_UNAVAILABLE":
        return "음악 서버가 응답하지 않습니다. 잠시 후 다시 시도해 주세요.";
      default:
        return error.message;
    }
  }
  return "대기열에 추가하지 못했습니다. 잠시 후 다시 시도해 주세요.";
}

async function showBrowser(
  interaction: PlaylistInteraction,
  ownerUserId: string,
  tab: PlaylistDiscordTab,
  page: number,
  deferFirst: boolean,
): Promise<void> {
  const payload = buildPlaylistBrowserPayload({ ownerUserId, tab, page });
  if (deferFirst) {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    await interaction.editReply({
      embeds: payload.embeds,
      components: payload.components,
    });
    return;
  }
  await updateEphemeral(interaction, payload);
}

async function showDetail(
  interaction: PlaylistInteraction,
  client: MineClient,
  ownerUserId: string,
  tab: PlaylistDiscordTab,
  page: number,
  playlistId: string,
): Promise<void> {
  const playlist = getWebPlaylistById(playlistId);
  if (!playlist || !canViewWebPlaylistForDiscord(ownerUserId, playlist, client)) {
    await replyEphemeral(
      interaction,
      "이 플레이리스트를 사용할 권한이 없습니다.",
    );
    return;
  }

  const tracks = getWebPlaylistTracks(playlist.id);
  const payload = buildPlaylistDetailPayload({
    ownerUserId,
    tab,
    page,
    playlist,
    trackCount: tracks.length,
    tracks,
  });

  if (interaction.deferred || interaction.replied) {
    await interaction.editReply({
      embeds: payload.embeds,
      components: payload.components,
    });
  } else if (interaction.isStringSelectMenu()) {
    await interaction.update({
      embeds: payload.embeds,
      components: payload.components,
    });
  } else {
    await interaction.update({
      embeds: payload.embeds,
      components: payload.components,
    });
  }
}

async function handleQueueAdd(
  interaction: ButtonInteraction,
  client: MineClient,
  guildId: string,
  ownerUserId: string,
  playlistId: string,
): Promise<void> {
  const access = await requireDiscordSoundroomQueueAccess(
    client,
    guildId,
    ownerUserId,
  );
  if (!access.ok) {
    await replyEphemeral(interaction, access.message);
    return;
  }

  const playlist = getWebPlaylistById(playlistId);
  if (!playlist || !canViewWebPlaylistForDiscord(ownerUserId, playlist, client)) {
    await replyEphemeral(
      interaction,
      "이 플레이리스트를 사용할 권한이 없습니다.",
    );
    return;
  }

  const tracks = getWebPlaylistTracks(playlist.id);
  if (tracks.length === 0) {
    await replyEphemeral(interaction, "비어 있는 플레이리스트입니다.");
    return;
  }

  await interaction.deferUpdate();

  try {
    await addWebPlaylistTracksToSoundroomQueue(
      client,
      guildId,
      access.soundroomChannelId,
      access.userVoiceChannelId,
      oauthUserFromInteraction(interaction),
      playlist,
      undefined,
    );

    const title = playlist.title.trim() || "제목 없음";

    await interaction.editReply({
      content: "대기열에 추가했습니다.",
      embeds: [],
      components: [],
    });
    scheduleEphemeralReplyDelete(interaction);

    void sendSoundroomPlaylistAddNotice(
      client,
      guildId,
      ownerUserId,
      title,
    );
  } catch (error) {
    await interaction.editReply({
      content: playlistActionErrorMessage(error),
      embeds: [],
      components: [],
    });
  }
}

export async function handleSoundroomPlaylistInteraction(
  client: MineClient,
  interaction: PlaylistInteraction,
): Promise<boolean> {
  const customId = interaction.customId;
  if (
    customId !== SR_PLAYLIST_OPEN_CUSTOM_ID &&
    !customId.startsWith("sr_pl:")
  ) {
    return false;
  }

  if (!interaction.inGuild() || !interaction.guild) {
    await replyEphemeral(interaction, "서버에서만 사용할 수 있습니다.");
    return true;
  }

  const channelCheck = assertSoundroomChannel(interaction);
  if (!channelCheck.ok) {
    const lounge = getSoundroom(interaction.guildId!);
    const msg = !lounge
      ? "이 서버에는 아직 노래채널이 설정되지 않았습니다."
      : "노래 채널에서만 버튼을 사용할 수 있습니다.";
    await replyEphemeral(interaction, msg);
    return true;
  }

  const { guildId } = channelCheck;
  const userId = interaction.user.id;

  if (customId === SR_PLAYLIST_OPEN_CUSTOM_ID) {
    await showBrowser(interaction, userId, "mine", 0, true);
    return true;
  }

  const parsed = parsePlaylistDiscordCustomId(customId);
  if (!parsed) {
    return true;
  }

  if (parsed.kind !== "open" && parsed.ownerUserId !== userId) {
    await replyEphemeral(interaction, WRONG_USER_MSG);
    return true;
  }

  if (parsed.kind === "close") {
    if (interaction.deferred || interaction.replied) {
      await interaction.deleteReply().catch(async () => {
        await interaction.editReply({
          content: "닫았습니다.",
          embeds: [],
          components: [],
        });
      });
    } else {
      await interaction.update({
        content: "닫았습니다.",
        embeds: [],
        components: [],
      });
    }
    return true;
  }

  if (parsed.kind === "tab") {
    await showBrowser(interaction, userId, parsed.tab, 0, false);
    return true;
  }

  if (parsed.kind === "prev") {
    const listed = listDiscordPlayablePlaylists(
      userId,
      parsed.tab,
      parsed.page,
    );
    const newPage = Math.max(0, listed.page - 1);
    await showBrowser(interaction, userId, parsed.tab, newPage, false);
    return true;
  }

  if (parsed.kind === "next") {
    const listed = listDiscordPlayablePlaylists(
      userId,
      parsed.tab,
      parsed.page,
    );
    const newPage = listed.hasNext ? listed.page + 1 : listed.page;
    await showBrowser(interaction, userId, parsed.tab, newPage, false);
    return true;
  }

  if (parsed.kind === "back") {
    await showBrowser(interaction, userId, parsed.tab, parsed.page, false);
    return true;
  }

  if (parsed.kind === "sel" && interaction.isStringSelectMenu()) {
    const playlistId = interaction.values[0];
    if (!playlistId) {
      return true;
    }
    await showDetail(
      interaction,
      client,
      userId,
      parsed.tab,
      parsed.page,
      playlistId,
    );
    return true;
  }

  if (parsed.kind === "queue" && interaction.isButton()) {
    await handleQueueAdd(
      interaction,
      client,
      guildId,
      userId,
      parsed.playlistId,
    );
    return true;
  }

  return true;
}
