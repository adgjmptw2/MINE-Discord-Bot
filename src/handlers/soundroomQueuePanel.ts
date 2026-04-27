import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  MessageFlags,
  ModalBuilder,
  StringSelectMenuBuilder,
  TextInputBuilder,
  TextInputStyle,
  type ButtonInteraction,
  type Client,
  type Guild,
  type GuildMember,
  type MessageActionRowComponentBuilder,
  type ModalSubmitInteraction,
  type StringSelectMenuInteraction,
} from "discord.js";
import { getPlayer } from "@/utils/commands";
import { formatTrackDuration, truncate } from "@/utils/discord";
import { scheduleEphemeralReplyDelete, scheduleQueuePanelEphemeralDelete } from "@/utils/ephemeralCleanup";
import type { ExtendedPlayer, ExtendedTrack, MineClient } from "@/types";

/** 한 페이지에 보여줄 대기열 곡 수 */
export const SOUNDROOM_QUEUE_PAGE_SIZE = 5;

function queueToArray(player: ExtendedPlayer): ExtendedTrack[] {
  const tracks = [...player.queue];
  player.queue.clear();
  return tracks;
}

function arrayToQueue(player: ExtendedPlayer, tracks: ExtendedTrack[]): void {
  for (const t of tracks) {
    player.queue.add(t);
  }
}

function reverseQueue(player: ExtendedPlayer): void {
  const arr = queueToArray(player);
  arr.reverse();
  arrayToQueue(player, arr);
}

function moveQueueTrack(
  player: ExtendedPlayer,
  fromIndex: number,
  targetPosition1Based: number,
): boolean {
  const arr = queueToArray(player);
  if (fromIndex < 0 || fromIndex >= arr.length) {
    arrayToQueue(player, arr);
    return false;
  }
  const [item] = arr.splice(fromIndex, 1);
  if (!item) {
    arrayToQueue(player, arr);
    return false;
  }
  const to0 = Math.max(0, Math.min(arr.length, targetPosition1Based - 1));
  arr.splice(to0, 0, item);
  arrayToQueue(player, arr);
  return true;
}

function formatRequesterLine(
  guild: Guild,
  track: ExtendedTrack,
): string {
  const req = track.info.requester;
  if (!req) return "—";
  const id = req.id;
  const member = guild.members.cache.get(id);
  if (member) {
    return member.displayName;
  }
  return `<@${id}>`;
}

function formatNowPlayingLine(
  guild: Guild,
  player: ExtendedPlayer,
): string {
  const cur = player.current;
  if (!cur) return "재생 중인 곡이 없습니다.";
  const title = truncate(cur.info.title ?? "제목 없음", 80);
  const dur = formatTrackDuration(cur);
  const who = formatRequesterLine(guild, cur);
  return `**재생 중** · ${title} (${dur}) — ${who}`;
}

function formatQueueLine(
  guild: Guild,
  track: ExtendedTrack,
  globalIndex1Based: number,
): string {
  const title = truncate(track.info.title ?? "제목 없음", 70);
  const dur = formatTrackDuration(track);
  const who = formatRequesterLine(guild, track);
  return `${globalIndex1Based}. ${title} (${dur}) — ${who}`;
}

function buildQueueEmbed(
  guild: Guild,
  player: ExtendedPlayer,
  page: number,
): EmbedBuilder {
  const queueLen = player.queue.length;
  const totalPages = Math.max(1, Math.ceil(queueLen / SOUNDROOM_QUEUE_PAGE_SIZE));
  const safePage = Math.min(Math.max(0, page), totalPages - 1);
  const start = safePage * SOUNDROOM_QUEUE_PAGE_SIZE;
  const slice = player.queue.slice(
    start,
    start + SOUNDROOM_QUEUE_PAGE_SIZE,
  );

  const lines: string[] = [formatNowPlayingLine(guild, player), ""];
  if (slice.length === 0) {
    lines.push("이 페이지에 표시할 곡이 없습니다.");
  } else {
    for (let i = 0; i < slice.length; i++) {
      lines.push(formatQueueLine(guild, slice[i], start + i + 1));
    }
  }

  const embed = new EmbedBuilder()
    .setColor(0x5865f2)
    .setTitle(`대기열 — ${queueLen}개의 곡`)
    .setDescription(lines.join("\n"))
    .setFooter({ text: `마인 · 페이지 ${safePage + 1}/${totalPages}` });

  const thumb = player.current?.info.thumbnail;
  if (thumb) embed.setThumbnail(thumb);

  return embed;
}

function buildSelectOptionsForPage(
  player: ExtendedPlayer,
  page: number,
): { label: string; value: string }[] {
  const queueLen = player.queue.length;
  const totalPages = Math.max(1, Math.ceil(queueLen / SOUNDROOM_QUEUE_PAGE_SIZE));
  const safePage = Math.min(Math.max(0, page), totalPages - 1);
  const start = safePage * SOUNDROOM_QUEUE_PAGE_SIZE;
  const slice = player.queue.slice(
    start,
    start + SOUNDROOM_QUEUE_PAGE_SIZE,
  );

  return slice.map((track, i) => {
    const globalIdx = start + i;
    const title = truncate(track.info.title ?? "제목 없음", 80);
    const label = truncate(`${globalIdx + 1}. ${title}`, 100);
    return { label, value: String(globalIdx) };
  });
}

function customIds(guildId: string, openerUserId: string, page: number) {
  const p = String(page);
  return {
    prev: `sq_p_${guildId}_${openerUserId}_${p}`,
    next: `sq_n_${guildId}_${openerUserId}_${p}`,
    pageInfo: `sq_i_${guildId}_${openerUserId}_${p}`,
    remove: `sq_rm_${guildId}_${openerUserId}_${p}`,
    move: `sq_mv_${guildId}_${openerUserId}_${p}`,
    reverse: `sq_rv_${guildId}_${openerUserId}_${p}`,
    shuffle: `sq_sh_${guildId}_${openerUserId}_${p}`,
    refresh: `sq_rf_${guildId}_${openerUserId}_${p}`,
  };
}

export function buildSoundroomQueuePanelPayload(
  client: Client,
  player: ExtendedPlayer,
  page: number,
  guildId: string,
  openerUserId: string,
): {
  embeds: EmbedBuilder[];
  components: ActionRowBuilder<MessageActionRowComponentBuilder>[];
} {
  const guild = client.guilds.cache.get(guildId);
  if (!guild) {
    return {
      embeds: [new EmbedBuilder().setColor(0xed4245).setDescription("서버 정보를 찾을 수 없습니다.")],
      components: [],
    };
  }

  const queueLen = player.queue.length;
  const totalPages = Math.max(1, Math.ceil(queueLen / SOUNDROOM_QUEUE_PAGE_SIZE));
  const safePage = Math.min(Math.max(0, page), totalPages - 1);
  const ids = customIds(guildId, openerUserId, safePage);

  const embed = buildQueueEmbed(guild, player, safePage);
  const selectOpts = buildSelectOptionsForPage(player, safePage);

  const rowNav = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId(ids.prev)
      .setStyle(ButtonStyle.Primary)
      .setLabel("◀ 이전")
      .setDisabled(safePage <= 0),
    new ButtonBuilder()
      .setCustomId(ids.pageInfo)
      .setStyle(ButtonStyle.Danger)
      .setLabel(`PAGE (${safePage + 1}/${totalPages})`)
      .setDisabled(true),
    new ButtonBuilder()
      .setCustomId(ids.next)
      .setStyle(ButtonStyle.Primary)
      .setLabel("다음 ▶")
      .setDisabled(safePage >= totalPages - 1),
  );

  const removeMenu =
    selectOpts.length > 0
      ? new StringSelectMenuBuilder()
          .setCustomId(ids.remove)
          .setPlaceholder("대기열에서 곡을 제거하려면 선택하세요")
          .addOptions(selectOpts)
      : new StringSelectMenuBuilder()
          .setCustomId(ids.remove)
          .setPlaceholder("제거할 곡이 없습니다")
          .setDisabled(true)
          .addOptions({ label: "—", value: "noop" });

  const moveMenu =
    selectOpts.length > 0
      ? new StringSelectMenuBuilder()
          .setCustomId(ids.move)
          .setPlaceholder("대기열에서 곡을 옮기려면 선택하세요")
          .addOptions(selectOpts)
      : new StringSelectMenuBuilder()
          .setCustomId(ids.move)
          .setPlaceholder("옮길 곡이 없습니다")
          .setDisabled(true)
          .addOptions({ label: "—", value: "noop" });

  const rowRemove = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(removeMenu);
  const rowMove = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(moveMenu);

  const rowActions = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId(ids.reverse)
      .setStyle(ButtonStyle.Secondary)
      .setLabel("대기열 뒤집기"),
    new ButtonBuilder()
      .setCustomId(ids.shuffle)
      .setStyle(ButtonStyle.Secondary)
      .setLabel("대기열 섞기"),
    new ButtonBuilder()
      .setCustomId(ids.refresh)
      .setStyle(ButtonStyle.Success)
      .setLabel("대기열 새로고침"),
  );

  return {
    embeds: [embed],
    components: [rowNav, rowRemove, rowMove, rowActions] as ActionRowBuilder<MessageActionRowComponentBuilder>[],
  };
}

function parseSoundQueueCustomId(customId: string): {
  kind: string;
  guildId: string;
  openerUserId: string;
  page: number;
} | null {
  const parts = customId.split("_");
  if (parts.length < 5 || parts[0] !== "sq") return null;
  const kind = parts[1];
  const guildId = parts[2];
  const openerUserId = parts[3];
  const page = Number(parts[4]);
  if (!guildId || !openerUserId || Number.isNaN(page)) return null;
  return { kind, guildId, openerUserId, page };
}

async function sameVoiceAsBot(member: GuildMember): Promise<boolean> {
  const me = member.guild.members.me;
  const voiceId = me?.voice?.channelId;
  if (!voiceId) return false;
  return member.voice.channelId === voiceId;
}

async function respondUnauthorized(
  interaction: ButtonInteraction | StringSelectMenuInteraction,
): Promise<void> {
  if (interaction.replied || interaction.deferred) return;
  await interaction.reply({
    flags: MessageFlags.Ephemeral,
    content: "이 대기열 패널은 열었던 사용자만 조작할 수 있어요.",
  });
}

async function respondVoice(
  interaction: ButtonInteraction | StringSelectMenuInteraction,
): Promise<void> {
  if (interaction.replied || interaction.deferred) return;
  await interaction.reply({
    flags: MessageFlags.Ephemeral,
    content: "봇과 같은 음성 채널에 있어야 이 버튼을 사용할 수 있어요.",
  });
}

export async function handleSoundroomQueuePanelInteraction(
  client: MineClient,
  interaction: ButtonInteraction | StringSelectMenuInteraction,
): Promise<boolean> {
  if (!interaction.customId.startsWith("sq_")) return false;
  if (!interaction.guildId || !interaction.guild) return false;

  const parsed = parseSoundQueueCustomId(interaction.customId);
  if (!parsed) return false;

  if (interaction.user.id !== parsed.openerUserId) {
    await respondUnauthorized(interaction);
    return true;
  }

  const member = interaction.member;
  if (!member || typeof member === "string" || !("voice" in member)) {
    await interaction.reply({ flags: MessageFlags.Ephemeral, content: "멤버 정보를 확인할 수 없어요." });
    return true;
  }

  if (!(await sameVoiceAsBot(member))) {
    await respondVoice(interaction);
    return true;
  }

  const player = getPlayer(client, interaction.guildId);
  if (!player) {
    await interaction.reply({ flags: MessageFlags.Ephemeral, content: "재생 중인 플레이어가 없어요." });
    return true;
  }

  const { kind, guildId, openerUserId, page } = parsed;
  let newPage = page;

  if (interaction.isButton()) {
    if (kind === "p") newPage = Math.max(0, page - 1);
    else if (kind === "n") {
      const totalPages = Math.max(
        1,
        Math.ceil(player.queue.length / SOUNDROOM_QUEUE_PAGE_SIZE),
      );
      newPage = Math.min(totalPages - 1, page + 1);
    } else if (kind === "i") {
      await interaction.deferUpdate();
      return true;
    } else if (kind === "rv") {
      reverseQueue(player);
    } else if (kind === "sh") {
      player.queue.shuffle();
    } else if (kind === "rf") {
      /* refresh — same page */
    } else {
      return false;
    }

    const payload = buildSoundroomQueuePanelPayload(
      client,
      player,
      newPage,
      guildId,
      openerUserId,
    );
    const updated = await interaction.update({ ...payload, fetchReply: true });
    scheduleQueuePanelEphemeralDelete(interaction, updated);
    return true;
  }

  if (interaction.isStringSelectMenu()) {
    const val = interaction.values[0];
    if (val === "noop") {
      await interaction.deferUpdate();
      return true;
    }
    const queueIndex = Number(val);
    if (Number.isNaN(queueIndex)) {
      await interaction.reply({ flags: MessageFlags.Ephemeral, content: "잘못된 선택이에요." });
      return true;
    }

    if (kind === "rm") {
      player.queue.remove(queueIndex);
      const totalPages = Math.max(
        1,
        Math.ceil(player.queue.length / SOUNDROOM_QUEUE_PAGE_SIZE),
      );
      newPage = Math.min(page, totalPages - 1);
      const payload = buildSoundroomQueuePanelPayload(
        client,
        player,
        newPage,
        guildId,
        openerUserId,
      );
      const updated = await interaction.update({ ...payload, fetchReply: true });
      scheduleQueuePanelEphemeralDelete(interaction, updated);
      return true;
    }

    if (kind === "mv") {
      const modal = new ModalBuilder()
        .setCustomId(`sq_ms_${guildId}_${openerUserId}_${queueIndex}_${page}`)
        .setTitle("대기열에서 곡 옮기기");

      const input = new TextInputBuilder()
        .setCustomId("sq_mt")
        .setLabel("몇 번째로 옮길까요? (1부터)")
        .setStyle(TextInputStyle.Short)
        .setRequired(true)
        .setMinLength(1)
        .setMaxLength(4)
        .setPlaceholder("예: 1");

      modal.addComponents(
        new ActionRowBuilder<TextInputBuilder>().addComponents(input),
      );

      await interaction.showModal(modal);
      return true;
    }
  }

  return false;
}

export async function handleSoundroomQueueMoveModalSubmit(
  client: MineClient,
  interaction: ModalSubmitInteraction,
): Promise<boolean> {
  if (!interaction.customId.startsWith("sq_ms_")) return false;
  if (!interaction.guildId) return false;

  const parts = interaction.customId.split("_");
  if (parts.length < 6) return false;
  const guildId = parts[2];
  const openerUserId = parts[3];
  const fromIdx = Number(parts[4]);
  const page = Number(parts[5]);
  if (!guildId || !openerUserId || Number.isNaN(fromIdx) || Number.isNaN(page)) return false;

  if (interaction.user.id !== openerUserId) {
    await interaction.reply({
      flags: MessageFlags.Ephemeral,
      content: "이 양식은 열었던 사용자만 제출할 수 있어요.",
    });
    return true;
  }

  const member = interaction.member;
  if (!member || typeof member === "string" || !("voice" in member)) {
    await interaction.reply({ flags: MessageFlags.Ephemeral, content: "멤버 정보를 확인할 수 없어요." });
    return true;
  }

  if (!(await sameVoiceAsBot(member))) {
    await interaction.reply({
      flags: MessageFlags.Ephemeral,
      content: "봇과 같은 음성 채널에 있어야 해요.",
    });
    return true;
  }

  const raw = interaction.fields.getTextInputValue("sq_mt").trim();
  const target = Number(raw);
  if (!Number.isFinite(target) || target < 1) {
    await interaction.reply({
      flags: MessageFlags.Ephemeral,
      content: "올바른 위치 숫자를 입력해 주세요. (1 이상)",
    });
    return true;
  }

  const player = getPlayer(client, interaction.guildId);
  if (!player) {
    await interaction.reply({ flags: MessageFlags.Ephemeral, content: "재생 중인 플레이어가 없어요." });
    return true;
  }

  const ok = moveQueueTrack(player, fromIdx, target);
  if (!ok) {
    await interaction.reply({ flags: MessageFlags.Ephemeral, content: "해당 위치의 곡을 옮길 수 없어요." });
    return true;
  }

  const totalPages = Math.max(
    1,
    Math.ceil(player.queue.length / SOUNDROOM_QUEUE_PAGE_SIZE),
  );
  const safePage = Math.min(Math.max(0, page), totalPages - 1);
  const payload = buildSoundroomQueuePanelPayload(
    client,
    player,
    safePage,
    guildId,
    openerUserId,
  );

  let panelRefreshed = false;
  const panelMessage = interaction.message;
  if (panelMessage) {
    try {
      await panelMessage.edit(payload);
      panelRefreshed = true;
      scheduleQueuePanelEphemeralDelete(null, panelMessage);
    } catch {
      if (interaction.channel?.isTextBased()) {
        try {
          const msg = await interaction.channel.messages.fetch(panelMessage.id);
          await msg.edit(payload);
          panelRefreshed = true;
          scheduleQueuePanelEphemeralDelete(null, msg);
        } catch {
          /* ignore */
        }
      }
    }
  }

  if (panelRefreshed) {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    await interaction.deleteReply();
  } else {
    await interaction.reply({
      flags: MessageFlags.Ephemeral,
      content: "곡 위치는 옮겼어요. 패널을 갱신하려면 **대기열 새로고침**을 눌러 주세요.",
    });
    scheduleEphemeralReplyDelete(interaction, 10_000);
  }

  return true;
}
