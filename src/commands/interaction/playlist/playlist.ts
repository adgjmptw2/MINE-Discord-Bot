import { ApplicationCommandOptionType, type GuildMember } from "discord.js";
import {
  addTrackToPlaylist,
  createPlaylist,
  deletePlaylist,
  getPlaylist,
  listPlaylists,
  removeTrackFromPlaylist,
} from "@/storage/playlists";
import { ensurePlayerConnection, getPlayer } from "@/utils/commands";
import { panelEdit, panelReply } from "@/utils/discord";
import type { ExtendedTrack, MineClient, SlashCommand } from "@/types";

const command: SlashCommand = {
  name: "playlist",
  nameLocalizations: { ko: "플레이리스트" },
  description: "Create, edit, load, or list your saved playlists.",
  descriptionLocalizations: { ko: "저장된 플레이리스트를 만들고, 수정하고, 불러오고, 목록을 봅니다." },
  category: "playlist",
  options: [
    {
      type: ApplicationCommandOptionType.Subcommand,
      name: "create",
      description: "Create a saved playlist.",
      descriptionLocalizations: { ko: "새 플레이리스트를 만듭니다." },
      options: [{ name: "name", description: "Playlist name", type: ApplicationCommandOptionType.String, required: true }],
    },
    {
      type: ApplicationCommandOptionType.Subcommand,
      name: "add",
      description: "Add the current track to a playlist.",
      descriptionLocalizations: { ko: "지금 재생 중인 곡을 플레이리스트에 넣습니다." },
      options: [{ name: "name", description: "Playlist name", type: ApplicationCommandOptionType.String, required: true }],
    },
    {
      type: ApplicationCommandOptionType.Subcommand,
      name: "load",
      description: "Load a playlist into the queue (join a voice channel first).",
      descriptionLocalizations: { ko: "플레이리스트를 대기열에 넣습니다. (음성 채널에 들어가 있어야 합니다.)" },
      options: [{ name: "name", description: "Playlist name", type: ApplicationCommandOptionType.String, required: true }],
    },
    {
      type: ApplicationCommandOptionType.Subcommand,
      name: "view",
      description: "List playlists or show one playlist's tracks.",
      descriptionLocalizations: { ko: "목록을 보거나 한 플레이리스트의 곡을 봅니다." },
      options: [{ name: "name", description: "Playlist name (omit to list all)", type: ApplicationCommandOptionType.String, required: false }],
    },
    {
      type: ApplicationCommandOptionType.Subcommand,
      name: "remove",
      description: "Remove a track from a playlist by position.",
      descriptionLocalizations: { ko: "플레이리스트에서 순번으로 곡을 뺍니다." },
      options: [
        { name: "name", description: "Playlist name", type: ApplicationCommandOptionType.String, required: true },
        {
          name: "position",
          description: "Track position (1-based)",
          type: ApplicationCommandOptionType.Integer,
          required: true,
          min_value: 1,
        },
      ],
    },
    {
      type: ApplicationCommandOptionType.Subcommand,
      name: "delete",
      description: "Delete a saved playlist.",
      descriptionLocalizations: { ko: "플레이리스트를 삭제합니다." },
      options: [{ name: "name", description: "Playlist name", type: ApplicationCommandOptionType.String, required: true }],
    },
  ],

  async run(client: MineClient, interaction) {
    const sub = interaction.options.getSubcommand(true);

    if (sub === "create") {
      const name = interaction.options.getString("name", true);
      createPlaylist(interaction.user.id, name);
      await interaction.reply(
        panelReply({ panel: { eyebrow: "플레이리스트", title: "만들었습니다", description: `「${name}」 플레이리스트를 만들었습니다.` } }),
      );
      return;
    }

    if (sub === "add") {
      const name = interaction.options.getString("name", true);
      const player = getPlayer(client, interaction.guildId);
      if (!player?.current || (!player.playing && !player.paused)) {
        await interaction.reply(
          panelReply({
            ephemeral: true,
            panel: { eyebrow: "플레이리스트", title: "재생 중인 곡 없음", description: "재생 중인 곡이 있을 때만 플레이리스트에 담을 수 있습니다." },
          }),
        );
        return;
      }
      const track = player.current;
      const playlist = addTrackToPlaylist(interaction.user.id, name, {
        title: track.info.title,
        uri: track.info.uri,
        author: track.info.author,
      });
      await interaction.reply(panelReply({
        panel: {
          eyebrow: "플레이리스트",
          title: "곡 추가됨",
          description: `「${track.info.title}」을(를) 「${name}」에 넣었습니다.`,
          lines: [`현재 이 목록 곡 수: ${playlist.tracks.length}`],
        },
      }));
      return;
    }

    if (sub === "load") {
      if (!interaction.inGuild()) {
        await interaction.reply(
          panelReply({
            ephemeral: true,
            panel: { eyebrow: "플레이리스트", title: "서버 전용", description: "이 명령은 서버 안에서만 사용할 수 있습니다." },
          }),
        );
        return;
      }
      const name = interaction.options.getString("name", true);
      const member = interaction.member as GuildMember;
      const voiceChannel = member.voice.channel;
      if (!voiceChannel) {
        await interaction.reply(
          panelReply({
            ephemeral: true,
            panel: { eyebrow: "플레이리스트", title: "음성 채널 필요", description: "플레이리스트를 불러오려면 먼저 음성 채널에 들어가 주십시오." },
          }),
        );
        return;
      }
      const playlist = getPlaylist(interaction.user.id, name);
      if (!playlist) {
        await interaction.reply(
          panelReply({
            ephemeral: true,
            panel: { eyebrow: "플레이리스트", title: "없는 목록", description: `「${name}」 이름의 플레이리스트를 찾을 수 없습니다.` },
          }),
        );
        return;
      }
      await interaction.deferReply();
      const player = await ensurePlayerConnection(client, interaction.guildId, voiceChannel.id, interaction.channelId);
      let added = 0;
      for (const entry of playlist.tracks) {
        const resolve = await client.riffy.resolve({ query: entry.uri, requester: member });
        const resolved = resolve.tracks[0] as ExtendedTrack | undefined;
        if (!resolved) {
          continue;
        }
        resolved.info.requester = member;
        player.queue.add(resolved);
        added += 1;
      }
      await interaction.editReply(
        panelEdit({ panel: { eyebrow: "플레이리스트", title: "불러오기 완료", lines: [`목록: ${name}`, `대기열에 넣은 곡: ${added}곡`] } }),
      );
      if (added > 0 && player.queue.length > 0 && !player.playing && !player.paused) {
        try {
          await player.play();
        } catch (error) {
          await interaction.followUp(
            panelReply({
              ephemeral: true,
              panel: {
                eyebrow: "재생",
                title: "재생 시작 실패",
                description: error instanceof Error ? error.message : String(error),
              },
            }),
          );
        }
      }
      return;
    }

    if (sub === "view") {
      const name = interaction.options.getString("name");
      if (!name) {
        const names = listPlaylists(interaction.user.id);
        await interaction.reply(
          panelReply({
            panel: {
              eyebrow: "플레이리스트",
              title: "내 목록",
              lines: names.length > 0 ? names : ["저장된 플레이리스트가 없습니다."],
            },
          }),
        );
        return;
      }
      const playlist = getPlaylist(interaction.user.id, name);
      if (!playlist) {
        await interaction.reply(
          panelReply({
            ephemeral: true,
            panel: { eyebrow: "플레이리스트", title: "없는 목록", description: `「${name}」 이름의 플레이리스트를 찾을 수 없습니다.` },
          }),
        );
        return;
      }
      await interaction.reply(panelReply({
        panel: {
          eyebrow: "플레이리스트",
          title: name,
          lines: playlist.tracks.length > 0 ? playlist.tracks.map((t, index) => `${index + 1}. ${t.title} - ${t.author}`) : ["이 플레이리스트는 비어 있습니다."],
        },
      }));
      return;
    }

    if (sub === "remove") {
      const name = interaction.options.getString("name", true);
      const position = interaction.options.getInteger("position", true);
      const playlist = removeTrackFromPlaylist(interaction.user.id, name, position);
      await interaction.reply(
        panelReply({
          panel: {
            eyebrow: "플레이리스트",
            title: "곡 제거됨",
            lines: [`목록: ${name}`, `남은 곡 수: ${playlist.tracks.length}`],
          },
        }),
      );
      return;
    }

    if (sub === "delete") {
      const name = interaction.options.getString("name", true);
      deletePlaylist(interaction.user.id, name);
      await interaction.reply(panelReply({ panel: { eyebrow: "플레이리스트", title: "삭제됨", description: `「${name}」 플레이리스트를 지웠습니다.` } }));
    }
  },
};

export default command;
