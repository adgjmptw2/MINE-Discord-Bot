import {
  MessageFlags,
  PermissionsBitField,
  type ChatInputCommandInteraction,
  type GuildTextBasedChannel,
  type GuildMember,
} from "discord.js";
import {
  handleSoundroomQueueMoveModalSubmit,
  handleSoundroomQueuePanelInteraction,
} from "@/handlers/soundroomQueuePanel";
import { handleFortuneInteraction } from "@/handlers/fortuneInteractions";
import {
  handleSoundroomButton,
  handleSoundroomModal,
} from "@/handlers/soundroomInteractions";
import { getActivePlayer, hasCurrentTrack } from "@/utils/commands";
import { panelReply } from "@/utils/discord";
import { isSoundroomTextChannel } from "@/storage/soundroom";
import { scheduleEphemeralReplyDelete } from "@/utils/ephemeralCleanup";
import type { MineClient, SlashCommand } from "@/types";

const SOUNDROOM_SLASH_NAME = "세팅";
/** 슬래시 등록명 별칭 → `세팅`과 동일 핸들러 */
const SOUNDROOM_SLASH_ALIASES = new Set([
  "노래채널",
  "music_lounge",
  "music-lounge",
]);

function resolveSlashCommand(
  client: MineClient,
  interaction: ChatInputCommandInteraction,
): SlashCommand | undefined {
  const name = interaction.commandName;
  const direct = client.slashCommands.get(name);
  if (direct) {
    return direct;
  }

  if (SOUNDROOM_SLASH_ALIASES.has(name)) {
    return client.slashCommands.get(SOUNDROOM_SLASH_NAME);
  }

  if (name === "melon_chart" || name === "인기차트-관리") {
    return client.slashCommands.get("melon_chart");
  }

  for (const cmd of client.slashCommands.values()) {
    const locs = cmd.nameLocalizations;
    if (!locs) {
      continue;
    }
    for (const localized of Object.values(locs)) {
      if (localized === name) {
        return cmd;
      }
    }
  }

  return undefined;
}

function isSoundroomSlashCommand(client: MineClient, name: string): boolean {
  if (name === "melon_chart") {
    return true;
  }
  const melon = client.slashCommands.get("melon_chart");
  if (
    melon?.nameLocalizations &&
    Object.values(melon.nameLocalizations).includes(name)
  ) {
    return true;
  }
  if (SOUNDROOM_SLASH_ALIASES.has(name)) {
    return true;
  }
  if (name === SOUNDROOM_SLASH_NAME) {
    return true;
  }
  const base = client.slashCommands.get(SOUNDROOM_SLASH_NAME);
  const locs = base?.nameLocalizations;
  if (!locs) {
    return false;
  }
  return Object.values(locs).includes(name);
}

export default function registerInteractionCreate(client: MineClient): void {
  client.on("interactionCreate", async (interaction) => {
    if (!interaction.inGuild()) {
      return;
    }

    if (interaction.isModalSubmit()) {
      const queueMoveHandled = await handleSoundroomQueueMoveModalSubmit(
        client,
        interaction,
      );
      if (queueMoveHandled) {
        return;
      }
      const handled = await handleSoundroomModal(client, interaction);
      if (handled) {
        return;
      }
      if (interaction.customId.startsWith("fortune_")) {
        if (await handleFortuneInteraction(client, interaction)) {
          return;
        }
      }
    }

    if (
      (interaction.isButton() || interaction.isStringSelectMenu()) &&
      interaction.customId.startsWith("sq_")
    ) {
      const handled = await handleSoundroomQueuePanelInteraction(
        client,
        interaction,
      );
      if (handled) {
        return;
      }
    }

    if (interaction.isButton() && interaction.customId.startsWith("sr_")) {
      await handleSoundroomButton(client, interaction);
      return;
    }

    if (interaction.isButton() && interaction.customId.startsWith("fortune_")) {
      if (await handleFortuneInteraction(client, interaction)) {
        return;
      }
    }

    if (interaction.isButton() && interaction.customId.startsWith("player_")) {
      const member = interaction.member as GuildMember;
      const guild = interaction.guild!;
      const player = getActivePlayer(client, interaction.guildId);

      if (!player) {
        await interaction.reply(
          panelReply({
            ephemeral: true,
            panel: {
              eyebrow: "재생",
              title: "플레이어 없음",
              description: "이 서버에 활성화된 음악 플레이어가 없습니다.",
            },
          }),
        );
        return;
      }

      const memberChannelId = member.voice.channelId;
      const botChannelId = guild.members.me?.voice.channelId ?? null;

      if (
        !memberChannelId ||
        (botChannelId && memberChannelId !== botChannelId)
      ) {
        await interaction.reply(
          panelReply({
            ephemeral: true,
            panel: {
              eyebrow: "음성",
              title: "음성 채널 불일치",
              description:
                "플레이어 버튼은 봇과 **같은 음성 채널**에 있을 때만 사용할 수 있습니다.",
            },
          }),
        );
        return;
      }

      if (interaction.customId === "player_toggle_pause") {
        if (!hasCurrentTrack(player)) {
          await interaction.reply(
            panelReply({
              ephemeral: true,
              panel: {
                eyebrow: "재생",
                title: "재생 중인 곡 없음",
                description:
                  "재생 중인 곡이 있을 때만 일시정지·재개할 수 있습니다.",
              },
            }),
          );
          return;
        }

        await player.pause(!player.paused);
        await interaction.reply(
          panelReply({
            ephemeral: true,
            panel: {
              eyebrow: "재생",
              title: player.paused ? "일시정지됨" : "다시 재생",
              description: player.paused
                ? "현재 곡을 일시정지했습니다."
                : "현재 곡을 다시 재생합니다.",
            },
          }),
        );
        return;
      }

      if (interaction.customId === "player_skip") {
        if (!hasCurrentTrack(player)) {
          await interaction.reply(
            panelReply({
              ephemeral: true,
              panel: {
                eyebrow: "재생",
                title: "재생 중인 곡 없음",
                description: "건너뛸 곡이 있을 때만 사용할 수 있습니다.",
              },
            }),
          );
          return;
        }

        const skippedTitle = player.current?.info.title ?? "현재 곡";
        await player.stop();
        await interaction.reply(
          panelReply({
            ephemeral: true,
            panel: {
              eyebrow: "재생",
              title: "건너뛰기",
              description: `「${skippedTitle}」을(를) 건너뛰었습니다.`,
            },
          }),
        );
        return;
      }

      if (interaction.customId === "player_stop") {
        player.queue.clear();
        await player.destroy();
        await interaction.reply(
          panelReply({
            ephemeral: true,
            panel: {
              eyebrow: "재생",
              title: "재생 종료",
              description:
                "재생을 멈추고 대기열을 비운 뒤 음성 채널에서 나갔습니다.",
            },
          }),
        );
        return;
      }

      if (interaction.customId === "player_queue") {
        const lines =
          player.queue.length > 0
            ? player.queue
                .slice(0, 10)
                .map(
                  (track, index) =>
                    `${index + 1}. ${track.info.title} - ${track.info.author}`,
                )
            : ["대기열에 곡이 없습니다."];

        await interaction.reply(
          panelReply({
            ephemeral: true,
            panel: {
              eyebrow: "대기열",
              title: "현재 대기열",
              lines: [
                `지금 재생: ${player.current?.info.title ?? "없음"}`,
                `대기 곡 수: ${player.queue.length}`,
                ...lines,
              ],
            },
          }),
        );
      }

      return;
    }

    if (!interaction.isChatInputCommand()) {
      return;
    }

    if (
      isSoundroomTextChannel(interaction.guildId, interaction.channelId) &&
      !isSoundroomSlashCommand(client, interaction.commandName)
    ) {
      await interaction.reply({
        flags: MessageFlags.Ephemeral,
        content:
          "이 노래 채널에서는 `/` 명령 대신 **채팅으로 검색어**만 입력해 주세요.",
      });
      scheduleEphemeralReplyDelete(interaction);
      return;
    }

    const command = resolveSlashCommand(client, interaction);
    if (!command) {
      await interaction.reply(
        panelReply({
          ephemeral: true,
          panel: {
            eyebrow: "요청",
            title: "알 수 없는 명령",
            description: `「/${interaction.commandName}」은(는) 이 빌드에 없습니다.`,
          },
        }),
      );
      return;
    }

    try {
      const guild = interaction.guild!;
      const member = interaction.member as GuildMember;
      const player = getActivePlayer(client, interaction.guildId);
      const memberChannelId = member.voice.channelId;
      const botChannelId = guild.members.me?.voice.channelId ?? null;
      const permissionChannel =
        interaction.channel as GuildTextBasedChannel | null;

      if (
        command.developerOnly &&
        !client.config.developers.includes(interaction.user.id)
      ) {
        await interaction.reply(
          panelReply({
            ephemeral: true,
            panel: {
              eyebrow: "제한",
              title: "제작자 전용",
              description: `「/${interaction.commandName}」은(는) 봇 제작자(.env의 DISCORD_OWNER_IDS)만 사용할 수 있습니다.`,
            },
          }),
        );
        return;
      }

      if (command.userPermissions?.length) {
        const permissions = PermissionsBitField.resolve(
          command.userPermissions,
        );
        if (!permissionChannel?.permissionsFor(member)?.has(permissions)) {
          await interaction.reply(
            panelReply({
              ephemeral: true,
              panel: {
                eyebrow: "권한",
                title: "권한 부족",
                description: `이 명령을 쓰려면 다음 권한이 필요합니다: ${command.userPermissions.join(", ")}`,
              },
            }),
          );
          return;
        }
      }

      if (command.clientPermissions?.length) {
        const permissions = PermissionsBitField.resolve(
          command.clientPermissions,
        );
        const me = guild.members.me;
        if (!me || !permissionChannel?.permissionsFor(me)?.has(permissions)) {
          await interaction.reply(
            panelReply({
              ephemeral: true,
              panel: {
                eyebrow: "권한",
                title: "봇 권한 부족",
                description: `봇에게 다음 권한이 필요합니다: ${command.clientPermissions.join(", ")}`,
              },
            }),
          );
          return;
        }
      }

      if (command.inVoice && !memberChannelId) {
        await interaction.reply(
          panelReply({
            ephemeral: true,
            panel: {
              eyebrow: "음성",
              title: "음성 채널 필요",
              description: "이 명령을 쓰려면 먼저 음성 채널에 들어가 주세요.",
            },
          }),
        );
        return;
      }

      if (
        command.sameVoice &&
        botChannelId &&
        memberChannelId !== botChannelId
      ) {
        await interaction.reply(
          panelReply({
            ephemeral: true,
            panel: {
              eyebrow: "음성",
              title: "음성 채널 불일치",
              description:
                "봇과 **같은 음성 채널**에 있어야 이 명령을 사용할 수 있습니다.",
            },
          }),
        );
        return;
      }

      if (command.player && !player) {
        await interaction.reply(
          panelReply({
            ephemeral: true,
            panel: {
              eyebrow: "재생",
              title: "플레이어 없음",
              description: "이 서버에 활성화된 음악 플레이어가 없습니다.",
            },
          }),
        );
        return;
      }

      if (command.current && !hasCurrentTrack(player)) {
        await interaction.reply(
          panelReply({
            ephemeral: true,
            panel: {
              eyebrow: "재생",
              title: "재생 중인 곡 없음",
              description:
                "재생 중인 곡이 있을 때만 이 명령을 사용할 수 있습니다.",
            },
          }),
        );
        return;
      }

      await command.run(client, interaction);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);

      if (interaction.deferred || interaction.replied) {
        await interaction.followUp(
          panelReply({
            ephemeral: true,
            panel: {
              eyebrow: "오류",
              title: "명령 실패",
              description: message,
            },
          }),
        );
        return;
      }

      await interaction.reply(
        panelReply({
          ephemeral: true,
          panel: { eyebrow: "오류", title: "명령 실패", description: message },
        }),
      );
    }
  });
}
