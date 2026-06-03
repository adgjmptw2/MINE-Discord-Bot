import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  MessageFlags,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  type ButtonInteraction,
  type InteractionEditReplyOptions,
  type InteractionReplyOptions,
  type InteractionUpdateOptions,
  type ModalSubmitInteraction,
} from "discord.js";
import { buildPanel, isSendableChannel, panelReply } from "@/utils/discord";
import { scheduleEphemeralReplyDelete } from "@/utils/ephemeralCleanup";
import { getKstDateString } from "@/utils/date";
import {
  compactFortunePanelFields,
  computeFortune,
} from "@/utils/fortuneGenerate";
import {
  parseBirthDateInput,
  parseGenderInput,
} from "@/utils/fortuneInput";
import {
  deleteFortuneProfile,
  getFortuneProfile,
  upsertFortuneProfile,
} from "@/storage/fortuneProfile";
import { getFortuneEncryptionKey } from "@/utils/fortuneCrypto";
import type { FortuneProfilePlain } from "@/utils/fortuneInput";
import type { MineClient } from "@/types";

const NO_MENTION = { parse: [] as const };
const FORTUNE_EPHEMERAL_DELETE_MS = 60_000;

function replyToEditOptions(
  r: InteractionReplyOptions,
): InteractionEditReplyOptions & InteractionUpdateOptions {
  return {
    flags: MessageFlags.IsComponentsV2,
    components: r.components,
    allowedMentions: r.allowedMentions,
  };
}

const FIELD_BIRTH = "fortune_field_birth";
const FIELD_GENDER = "fortune_field_gender";

function buildFortuneModal(customId: string, title: string): ModalBuilder {
  const birth = new TextInputBuilder()
    .setCustomId(FIELD_BIRTH)
    .setLabel("생년월일")
    .setStyle(TextInputStyle.Short)
    .setPlaceholder("20000101 또는 2000-01-01")
    .setRequired(true)
    .setMinLength(8)
    .setMaxLength(10);

  const gender = new TextInputBuilder()
    .setCustomId(FIELD_GENDER)
    .setLabel("성별")
    .setStyle(TextInputStyle.Short)
    .setPlaceholder("남성 / 여성 / 기타 / 비공개 (선택)")
    .setRequired(false)
    .setMaxLength(10);

  return new ModalBuilder()
    .setCustomId(customId)
    .setTitle(title)
    .addComponents(
      new ActionRowBuilder<TextInputBuilder>().addComponents(birth),
      new ActionRowBuilder<TextInputBuilder>().addComponents(gender),
    );
}

function profileActionRow(): ActionRowBuilder<ButtonBuilder> {
  return new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId("fortune_publish")
      .setLabel("공개하기")
      .setStyle(ButtonStyle.Success),
    new ButtonBuilder()
      .setCustomId("fortune_change")
      .setLabel("변경하기")
      .setStyle(ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId("fortune_delete")
      .setLabel("삭제하기")
      .setStyle(ButtonStyle.Danger),
  );
}

export function buildFortuneIntroReply() {
  return panelReply({
    ephemeral: true,
    panel: {
      title: "🔮 오늘의 운세",
      description: "아직 운세 설정이 없습니다.",
      lines: [
        "**설정하기** — 생년월일 저장 후 조회  ·  **일회용** — 저장 없이 1회",
      ],
    },
    components: [
      new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder()
          .setCustomId("fortune_setup")
          .setLabel("설정하기")
          .setStyle(ButtonStyle.Primary),
        new ButtonBuilder()
          .setCustomId("fortune_once")
          .setLabel("일회용")
          .setStyle(ButtonStyle.Secondary),
      ),
    ],
    allowedMentions: NO_MENTION,
  });
}

export function buildFortuneProfileLoadFailedReply() {
  return panelReply({
    ephemeral: true,
    panel: {
      title: "🔮 오늘의 운세",
      description:
        "저장된 프로필을 불러오지 못했습니다. 키가 바뀌었거나 데이터가 손상되었을 수 있어요. **설정하기**에서 다시 저장해 주세요.",
    },
    components: [
      new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder()
          .setCustomId("fortune_setup")
          .setLabel("설정하기")
          .setStyle(ButtonStyle.Primary),
        new ButtonBuilder()
          .setCustomId("fortune_once")
          .setLabel("일회용")
          .setStyle(ButtonStyle.Secondary),
      ),
    ],
    allowedMentions: NO_MENTION,
  });
}

export function buildStoredProfileFortuneReply(
  userId: string,
  profile: FortuneProfilePlain,
) {
  const f = computeFortune(
    userId,
    profile.birthDate,
    profile.gender,
    getKstDateString(),
  );
  const fortunePanel = compactFortunePanelFields(f, profile.birthDate);
  return panelReply({
    ephemeral: true,
    panel: fortunePanel,
    components: [profileActionRow()],
    allowedMentions: NO_MENTION,
  });
}

function buildIntroAfterDeleteReply() {
  return panelReply({
    ephemeral: true,
    panel: {
      title: "🔮 오늘의 운세",
      description: "저장된 운세 프로필을 삭제했습니다.",
    },
    components: [
      new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder()
          .setCustomId("fortune_setup")
          .setLabel("설정하기")
          .setStyle(ButtonStyle.Primary),
        new ButtonBuilder()
          .setCustomId("fortune_once")
          .setLabel("일회용")
          .setStyle(ButtonStyle.Secondary),
      ),
    ],
    allowedMentions: NO_MENTION,
  });
}

async function readModalProfile(
  interaction: ModalSubmitInteraction,
): Promise<
  | { ok: true; profile: FortuneProfilePlain; genderNote: string | null }
  | { ok: false; message: string }
> {
  const birthRaw = interaction.fields.getTextInputValue(FIELD_BIRTH);
  let genderRaw = "";
  try {
    genderRaw = interaction.fields.getTextInputValue(FIELD_GENDER);
  } catch {
    genderRaw = "";
  }
  const parsed = parseBirthDateInput(birthRaw);
  if (!parsed.ok) {
    return {
      ok: false,
      message:
        "생년월일 형식이 올바르지 않습니다. 예: `20000101` 또는 `2000-01-01`",
    };
  }
  const { gender, unknownAsPrivate } = parseGenderInput(genderRaw);
  let genderNote: string | null = null;
  if (unknownAsPrivate) {
    genderNote = "성별은 비공개로 저장했습니다.";
  }
  return {
    ok: true,
    profile: { birthDate: parsed.normalized, gender },
    genderNote,
  };
}

async function sendPublicFortune(
  interaction: ButtonInteraction | ModalSubmitInteraction,
  profile: FortuneProfilePlain,
): Promise<void> {
  const ch = interaction.channel;
  if (!ch || !isSendableChannel(ch)) {
    await interaction.followUp({
      flags: MessageFlags.Ephemeral,
      content: "이 채널에는 공개 메시지를 보낼 수 없습니다.",
      allowedMentions: NO_MENTION,
    });
    scheduleEphemeralReplyDelete(interaction, FORTUNE_EPHEMERAL_DELETE_MS);
    return;
  }

  const f = computeFortune(
    interaction.user.id,
    profile.birthDate,
    profile.gender,
    getKstDateString(),
  );
  const fortunePanel = compactFortunePanelFields(f, profile.birthDate);

  await ch.send({
    flags: MessageFlags.IsComponentsV2,
    components: [buildPanel(fortunePanel)],
    allowedMentions: NO_MENTION,
  });
}

export async function handleFortuneInteraction(
  _client: MineClient,
  interaction: ButtonInteraction | ModalSubmitInteraction,
): Promise<boolean> {
  if (!interaction.customId.startsWith("fortune_")) {
    return false;
  }
  if (!interaction.inGuild()) {
    return false;
  }

  if (interaction.isButton()) {
    const id = interaction.customId;

    if (id === "fortune_setup") {
      if (!getFortuneEncryptionKey()) {
        await interaction.reply({
          flags: MessageFlags.Ephemeral,
          content:
            "운세 프로필을 저장하려면 서버 관리자가 `FORTUNE_PROFILE_ENCRYPTION_KEY_BASE64` 환경 변수를 설정해야 합니다. 일회용은 그대로 이용할 수 있어요.",
          allowedMentions: NO_MENTION,
        });
        scheduleEphemeralReplyDelete(
          interaction,
          FORTUNE_EPHEMERAL_DELETE_MS,
        );
        return true;
      }
      await interaction.reply(
        panelReply({
          ephemeral: true,
          panel: {
            title: "운세 공개 범위 선택",
            description: [
              "저장된 정보로 오늘의 운세를 볼 때 사용할 공개 범위를 선택하세요.",
              "공개를 선택해도 생년월일과 성별은 채팅에 표시되지 않습니다.",
            ].join("\n\n"),
          },
          components: [
            new ActionRowBuilder<ButtonBuilder>().addComponents(
              new ButtonBuilder()
                .setCustomId("fortune_scope_setup_private")
                .setLabel("나만 보기")
                .setStyle(ButtonStyle.Primary),
              new ButtonBuilder()
                .setCustomId("fortune_scope_setup_public")
                .setLabel("공개")
                .setStyle(ButtonStyle.Secondary),
            ),
          ],
          allowedMentions: NO_MENTION,
        }),
      );
      scheduleEphemeralReplyDelete(
        interaction,
        FORTUNE_EPHEMERAL_DELETE_MS,
      );
      return true;
    }

    if (id === "fortune_once") {
      await interaction.reply(
        panelReply({
          ephemeral: true,
          panel: {
            title: "일회용 운세 공개 범위 선택",
            description: [
              "일회용 운세는 생년월일과 성별을 저장하지 않습니다.",
              "공개를 선택해도 생년월일과 성별은 채팅에 표시되지 않습니다.",
            ].join("\n\n"),
          },
          components: [
            new ActionRowBuilder<ButtonBuilder>().addComponents(
              new ButtonBuilder()
                .setCustomId("fortune_scope_once_private")
                .setLabel("나만 보기")
                .setStyle(ButtonStyle.Primary),
              new ButtonBuilder()
                .setCustomId("fortune_scope_once_public")
                .setLabel("공개")
                .setStyle(ButtonStyle.Secondary),
            ),
          ],
          allowedMentions: NO_MENTION,
        }),
      );
      scheduleEphemeralReplyDelete(
        interaction,
        FORTUNE_EPHEMERAL_DELETE_MS,
      );
      return true;
    }

    if (id === "fortune_scope_setup_private") {
      await interaction.showModal(
        buildFortuneModal("fortune_modal_setup_private", "운세 설정하기"),
      );
      return true;
    }
    if (id === "fortune_scope_setup_public") {
      await interaction.showModal(
        buildFortuneModal("fortune_modal_setup_public", "운세 설정하기"),
      );
      return true;
    }
    if (id === "fortune_scope_once_private") {
      await interaction.showModal(
        buildFortuneModal("fortune_modal_once_private", "일회용 운세"),
      );
      return true;
    }
    if (id === "fortune_scope_once_public") {
      await interaction.showModal(
        buildFortuneModal("fortune_modal_once_public", "일회용 운세"),
      );
      return true;
    }

    if (id === "fortune_change") {
      if (!getFortuneEncryptionKey()) {
        await interaction.reply({
          flags: MessageFlags.Ephemeral,
          content:
            "암호화 키가 설정되어 있지 않아 프로필을 변경할 수 없습니다. 서버 관리자에게 문의하세요.",
          allowedMentions: NO_MENTION,
        });
        scheduleEphemeralReplyDelete(
          interaction,
          FORTUNE_EPHEMERAL_DELETE_MS,
        );
        return true;
      }
      await interaction.showModal(
        buildFortuneModal("fortune_modal_change", "운세 설정하기"),
      );
      return true;
    }

    if (id === "fortune_publish") {
      const profile = getFortuneProfile(interaction.user.id);
      if (!profile) {
        await interaction.reply({
          flags: MessageFlags.Ephemeral,
          content:
            "저장된 운세 프로필이 없습니다. `/오늘운세`로 다시 설정해 주세요.",
          allowedMentions: NO_MENTION,
        });
        scheduleEphemeralReplyDelete(
          interaction,
          FORTUNE_EPHEMERAL_DELETE_MS,
        );
        return true;
      }
      await interaction.deferReply({ flags: MessageFlags.Ephemeral });
      await sendPublicFortune(interaction, profile);
      await interaction.editReply(
        replyToEditOptions(
          panelReply({
            ephemeral: true,
            panel: {
              title: "공개 완료",
              description: "채널에 오늘의 운세를 올렸습니다.",
            },
            allowedMentions: NO_MENTION,
          }),
        ),
      );
      scheduleEphemeralReplyDelete(
        interaction,
        FORTUNE_EPHEMERAL_DELETE_MS,
      );
      return true;
    }

    if (id === "fortune_delete") {
      deleteFortuneProfile(interaction.user.id);
      await interaction.update(replyToEditOptions(buildIntroAfterDeleteReply()));
      return true;
    }

    return false;
  }

  if (interaction.isModalSubmit()) {
    const id = interaction.customId;
    const read = await readModalProfile(interaction);
    if (!read.ok) {
      await interaction.reply({
        flags: MessageFlags.Ephemeral,
        content: read.message,
        allowedMentions: NO_MENTION,
      });
      scheduleEphemeralReplyDelete(
        interaction,
        FORTUNE_EPHEMERAL_DELETE_MS,
      );
      return true;
    }

    const { profile, genderNote } = read;
    const isPublic =
      id === "fortune_modal_setup_public" || id === "fortune_modal_once_public";
    const isOnce =
      id === "fortune_modal_once_private" || id === "fortune_modal_once_public";
    const isStoredModal =
      id === "fortune_modal_setup_private" ||
      id === "fortune_modal_setup_public" ||
      id === "fortune_modal_change";

    if (isStoredModal) {
      if (!getFortuneEncryptionKey()) {
        await interaction.reply({
          flags: MessageFlags.Ephemeral,
          content:
            "암호화 키가 설정되어 있지 않아 저장할 수 없습니다. 서버 관리자에게 문의하세요.",
          allowedMentions: NO_MENTION,
        });
        scheduleEphemeralReplyDelete(
          interaction,
          FORTUNE_EPHEMERAL_DELETE_MS,
        );
        return true;
      }
      try {
        upsertFortuneProfile(interaction.user.id, profile);
      } catch (e) {
        const code = e instanceof Error ? e.message : "";
        if (code === "FORTUNE_CRYPTO_NO_KEY") {
          await interaction.reply({
            flags: MessageFlags.Ephemeral,
            content:
              "암호화 키가 올바르지 않아 저장할 수 없습니다. 서버 관리자에게 문의하세요.",
            allowedMentions: NO_MENTION,
          });
        } else {
          await interaction.reply({
            flags: MessageFlags.Ephemeral,
            content: "프로필 저장에 실패했습니다. 잠시 후 다시 시도해 주세요.",
            allowedMentions: NO_MENTION,
          });
        }
        scheduleEphemeralReplyDelete(
          interaction,
          FORTUNE_EPHEMERAL_DELETE_MS,
        );
        return true;
      }
    }

    const f = computeFortune(
      interaction.user.id,
      profile.birthDate,
      profile.gender,
      getKstDateString(),
    );
    const fortunePanel = compactFortunePanelFields(f, profile.birthDate);
    const linesBlock = genderNote ? [genderNote] : undefined;

    if (isOnce) {
      if (isPublic) {
        await interaction.deferReply({ flags: MessageFlags.Ephemeral });
        await sendPublicFortune(interaction, profile);
        await interaction.editReply(
          replyToEditOptions(
            panelReply({
              ephemeral: true,
              panel: {
                title: "공개 완료",
                description: ["채널에 오늘의 운세를 올렸습니다.", "", genderNote]
                  .filter(Boolean)
                  .join("\n"),
              },
              allowedMentions: NO_MENTION,
            }),
          ),
        );
      } else {
        await interaction.reply(
          panelReply({
            ephemeral: true,
            panel: {
              ...fortunePanel,
              lines: linesBlock ?? fortunePanel.lines,
            },
            allowedMentions: NO_MENTION,
          }),
        );
      }
      scheduleEphemeralReplyDelete(
        interaction,
        FORTUNE_EPHEMERAL_DELETE_MS,
      );
      return true;
    }

    if (isStoredModal) {
      if (isPublic) {
        await interaction.deferReply({ flags: MessageFlags.Ephemeral });
        await sendPublicFortune(interaction, profile);
        await interaction.editReply(
          replyToEditOptions(
            panelReply({
              ephemeral: true,
              panel: {
                title: "공개 완료",
                description: [
                  "채널에 오늘의 운세를 올렸습니다.",
                  "다음부터 `/오늘운세`로 바로 조회할 수 있어요.",
                  "",
                  genderNote ?? "",
                ]
                  .filter(Boolean)
                  .join("\n"),
              },
              components: [profileActionRow()],
              allowedMentions: NO_MENTION,
            }),
          ),
        );
      } else {
        await interaction.reply(
          panelReply({
            ephemeral: true,
            panel: {
              ...fortunePanel,
              lines: linesBlock ?? fortunePanel.lines,
            },
            components: [profileActionRow()],
            allowedMentions: NO_MENTION,
          }),
        );
      }
      scheduleEphemeralReplyDelete(
        interaction,
        FORTUNE_EPHEMERAL_DELETE_MS,
      );
      return true;
    }

    return false;
  }

  return false;
}
