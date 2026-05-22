import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  type ButtonInteraction,
} from "discord.js";
import { getCoinShopItems, type CoinShopItem } from "@/settings/coinShopItems";
import { panelEdit, panelReply, type PanelMessageOptions } from "@/utils/discord";

const NO_MENTION = { parse: [] as const };
const PAGE_SIZE = 5;
const DESC_PREVIEW_MAX = 36;
const CUSTOM_PREFIX = "coin_shop:pg:";

function shortConsumableDescription(desc: string): string {
  const t = desc.trim();
  if (t.length <= DESC_PREVIEW_MAX) {
    return t;
  }
  return `${t.slice(0, DESC_PREVIEW_MAX)}…`;
}

function flatCatalog(): CoinShopItem[] {
  const items = getCoinShopItems();
  return [
    ...items.filter((i) => i.itemType === "TITLE"),
    ...items.filter((i) => i.itemType === "CONSUMABLE"),
  ];
}

function buildShopPageLines(page: number): string[] {
  const catalog = flatCatalog();
  const totalPages = Math.max(1, Math.ceil(catalog.length / PAGE_SIZE));
  const p = Math.max(0, Math.min(totalPages - 1, page));
  const start = p * PAGE_SIZE;
  const slice = catalog.slice(start, start + PAGE_SIZE);

  const lines: string[] = [];
  let prevType: CoinShopItem["itemType"] | null = null;

  for (let i = 0; i < slice.length; i++) {
    const it = slice[i]!;
    const globalN = start + i + 1;
    if (it.itemType !== prevType) {
      lines.push(it.itemType === "TITLE" ? "**칭호**" : "**소비 아이템**");
      prevType = it.itemType;
    }
    if (it.itemType === "TITLE") {
      lines.push(
        `${globalN}. **${it.name}** — \`${it.price.toLocaleString("ko-KR")} 코인\``,
      );
      lines.push(it.description);
    } else {
      lines.push(
        `${globalN}. ${it.name} — \`${it.price.toLocaleString("ko-KR")} 코인\``,
      );
      lines.push(`  ${shortConsumableDescription(it.description)}`);
    }
    lines.push("");
  }

  lines.push("구매:", "`/구매 아이템:초보 투자자`", "`/구매 아이템:하락 방지권`");
  return lines;
}

function shopNavRow(page: number): ActionRowBuilder<ButtonBuilder> {
  const catalog = flatCatalog();
  const totalPages = Math.max(1, Math.ceil(catalog.length / PAGE_SIZE));
  const p = Math.max(0, Math.min(totalPages - 1, page));
  const prev = Math.max(0, p - 1);
  const next = Math.min(totalPages - 1, p + 1);
  return new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId(`${CUSTOM_PREFIX}${prev}`)
      .setLabel("<")
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(p === 0),
    new ButtonBuilder()
      .setCustomId(`${CUSTOM_PREFIX}${next}`)
      .setLabel(">")
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(p >= totalPages - 1),
  );
}

export function buildCoinShopPanelOptions(page: number): PanelMessageOptions {
  const catalog = flatCatalog();
  const totalPages = Math.max(1, Math.ceil(catalog.length / PAGE_SIZE));
  const p = Math.max(0, Math.min(totalPages - 1, page));
  return {
    ephemeral: false,
    panel: {
      title: "🛒 코인 상점",
      description:
        totalPages > 1 ? `페이지 **${p + 1}** / **${totalPages}**` : undefined,
      lines: buildShopPageLines(p),
    },
    components: totalPages > 1 ? [shopNavRow(p)] : [],
    allowedMentions: NO_MENTION,
  };
}

export async function handleCoinShopButton(
  interaction: ButtonInteraction,
): Promise<boolean> {
  if (!interaction.customId.startsWith(CUSTOM_PREFIX)) {
    return false;
  }
  const raw = interaction.customId.slice(CUSTOM_PREFIX.length);
  const page = Number.parseInt(raw, 10);
  if (!Number.isFinite(page) || page < 0) {
    return false;
  }

  const opts = buildCoinShopPanelOptions(page);
  try {
    await interaction.update(
      panelEdit({
        panel: opts.panel,
        components: opts.components,
      }),
    );
  } catch {
    await interaction.reply(
      panelReply({
        ephemeral: true,
        panel: {
          title: "상점",
          description:
            "메시지를 업데이트할 수 없습니다. `/상점`을 다시 실행해 주세요.",
        },
        allowedMentions: NO_MENTION,
      }),
    );
  }
  return true;
}
