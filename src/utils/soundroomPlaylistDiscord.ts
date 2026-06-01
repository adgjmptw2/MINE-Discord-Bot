import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  StringSelectMenuBuilder,
  type APIEmbed,
  type MessageActionRowComponentBuilder,
} from "discord.js";
import { truncate } from "@/utils/discord";
import {
  getFavoriteCountsForPlaylists,
  getPlaylistFavoriteCount,
  listFavoriteWebPlaylists,
  listMyWebPlaylists,
  listPublicWebPlaylists,
  type WebPlaylistRecord,
  type WebPlaylistTrackRecord,
} from "@/web/playlistDb";
import { isWebDashboardBotOwner } from "@/web/playlistAuth";
import type { MineClient } from "@/types";

export const SR_PLAYLIST_OPEN_CUSTOM_ID = "sr_pl:open";

export const PLAYLIST_DISCORD_PAGE_SIZE = 10;
export const PLAYLIST_DISCORD_PREVIEW_TRACKS = 5;
export const PLAYLIST_DISCORD_QUEUE_MAX = 50;

export type PlaylistDiscordTab = "mine" | "public" | "favorites";

const TAB_LABELS: Record<PlaylistDiscordTab, string> = {
  mine: "내 플레이리스트",
  public: "공개 플레이리스트",
  favorites: "즐겨찾기",
};

const PLAYLIST_ID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function isValidPlaylistId(id: string): boolean {
  return PLAYLIST_ID_RE.test(id);
}

export function parsePlaylistDiscordTab(raw: string): PlaylistDiscordTab | null {
  if (raw === "mine" || raw === "public" || raw === "favorites") {
    return raw;
  }
  return null;
}

export function canViewWebPlaylistForDiscord(
  userId: string,
  playlist: WebPlaylistRecord,
  client: MineClient,
): boolean {
  if (playlist.is_deleted) {
    return false;
  }
  if (playlist.owner_user_id === userId) {
    return true;
  }
  if (isWebDashboardBotOwner(userId, client)) {
    return true;
  }
  if (playlist.visibility !== "public") {
    return false;
  }
  if (playlist.is_hidden_by_admin) {
    return false;
  }
  return true;
}

type PlaylistListRow = WebPlaylistRecord & { track_count: number };

function fetchAllForTab(
  userId: string,
  tab: PlaylistDiscordTab,
): PlaylistListRow[] {
  if (tab === "mine") {
    return listMyWebPlaylists(userId);
  }
  if (tab === "public") {
    return listPublicWebPlaylists({ limit: 500, offset: 0 });
  }
  return listFavoriteWebPlaylists(userId, { limit: 500, offset: 0 });
}

export function listDiscordPlayablePlaylists(
  userId: string,
  tab: PlaylistDiscordTab,
  page: number,
): {
  items: PlaylistListRow[];
  page: number;
  total: number;
  pageCount: number;
  hasPrev: boolean;
  hasNext: boolean;
} {
  const all = fetchAllForTab(userId, tab);
  const total = all.length;
  const pageCount = Math.max(1, Math.ceil(total / PLAYLIST_DISCORD_PAGE_SIZE));
  const clampedPage = Math.min(
    Math.max(0, Number.isFinite(page) ? Math.floor(page) : 0),
    pageCount - 1,
  );
  const start = clampedPage * PLAYLIST_DISCORD_PAGE_SIZE;
  const items = all.slice(start, start + PLAYLIST_DISCORD_PAGE_SIZE);
  return {
    items,
    page: clampedPage,
    total,
    pageCount,
    hasPrev: clampedPage > 0,
    hasNext: clampedPage < pageCount - 1,
  };
}

function formatVisibilityLabel(playlist: WebPlaylistRecord): string {
  return playlist.visibility === "public" ? "공개" : "비공개";
}

function formatListLine(
  index: number,
  playlist: PlaylistListRow,
  tab: PlaylistDiscordTab,
  favoriteCount: number,
): string {
  const n = index + 1;
  const title = truncate(playlist.title.trim() || "제목 없음", 48);
  const plays = Math.max(0, playlist.queue_add_count);
  let line = `${n}. **${title}** · ${playlist.track_count}곡 · 재생 ${plays}회`;
  if (tab === "public" || tab === "favorites") {
    line += ` · 즐겨찾기 ${favoriteCount}명`;
  }
  if (
    (tab === "public" || tab === "favorites") &&
    playlist.owner_name_snapshot?.trim()
  ) {
    line += ` · ${truncate(playlist.owner_name_snapshot.trim(), 24)}`;
  }
  return line;
}

function plButtonId(
  action: string,
  ownerUserId: string,
  ...rest: string[]
): string {
  return ["sr_pl", action, ownerUserId, ...rest].join(":");
}

function buildNavRows(
  ownerUserId: string,
  tab: PlaylistDiscordTab,
  page: number,
  hasPrev: boolean,
  hasNext: boolean,
): ActionRowBuilder<MessageActionRowComponentBuilder>[] {
  const tabs: PlaylistDiscordTab[] = ["mine", "public", "favorites"];
  const tabRow = new ActionRowBuilder<MessageActionRowComponentBuilder>().addComponents(
    ...tabs.map((t) =>
      new ButtonBuilder()
        .setCustomId(plButtonId("tab", ownerUserId, t, "0"))
        .setLabel(
          t === "mine" ? "My" : t === "public" ? "Public" : "즐겨찾기",
        )
        .setStyle(t === tab ? ButtonStyle.Primary : ButtonStyle.Secondary)
        .setDisabled(t === tab),
    ),
  );
  const navRow = new ActionRowBuilder<MessageActionRowComponentBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId(plButtonId("prev", ownerUserId, tab, String(page)))
      .setLabel("◀ 이전")
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(!hasPrev),
    new ButtonBuilder()
      .setCustomId(plButtonId("next", ownerUserId, tab, String(page)))
      .setLabel("다음 ▶")
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(!hasNext),
    new ButtonBuilder()
      .setCustomId(plButtonId("close", ownerUserId))
      .setLabel("닫기")
      .setStyle(ButtonStyle.Secondary),
  );
  return [tabRow, navRow];
}

export function buildPlaylistBrowserPayload(params: {
  ownerUserId: string;
  tab: PlaylistDiscordTab;
  page: number;
}): { embeds: APIEmbed[]; components: ActionRowBuilder<MessageActionRowComponentBuilder>[] } {
  const { ownerUserId, tab } = params;
  const listed = listDiscordPlayablePlaylists(
    ownerUserId,
    tab,
    params.page,
  );
  const favCounts = getFavoriteCountsForPlaylists(
    listed.items.map((p) => p.id),
  );

  const lines =
    listed.items.length > 0
      ? listed.items.map((p, i) =>
          formatListLine(i, p, tab, favCounts.get(p.id) ?? 0),
        )
      : ["표시할 플레이리스트가 없습니다."];

  const embed = new EmbedBuilder()
    .setTitle("📚 플레이리스트")
    .setColor(0x5865f2)
    .setDescription(
      [
        "내 플레이리스트와 공개 플레이리스트를 대기열에 추가할 수 있습니다.",
        "",
        `**${TAB_LABELS[tab]}** · ${listed.page + 1}/${listed.pageCount}페이지 · 총 ${listed.total}개`,
        "",
        lines.join("\n"),
      ].join("\n"),
    );

  const components: ActionRowBuilder<MessageActionRowComponentBuilder>[] =
    [];

  if (listed.items.length > 0) {
    const select = new StringSelectMenuBuilder()
      .setCustomId(plButtonId("sel", ownerUserId, tab, String(listed.page)))
      .setPlaceholder("플레이리스트를 선택하세요")
      .addOptions(
        listed.items.map((p) => ({
          label: truncate(p.title.trim() || "제목 없음", 100),
          description:
            `${p.track_count}곡 · 재생 ${Math.max(0, p.queue_add_count)}회`.slice(
              0,
              100,
            ),
          value: p.id,
        })),
      );
    components.push(
      new ActionRowBuilder<MessageActionRowComponentBuilder>().addComponents(
        select,
      ),
    );
  }

  components.push(...buildNavRows(ownerUserId, tab, listed.page, listed.hasPrev, listed.hasNext));

  return { embeds: [embed.toJSON()], components };
}

function formatTrackLine(track: WebPlaylistTrackRecord, index: number): string {
  const title = truncate(track.title.trim() || "제목 없음", 60);
  const author = track.author?.trim();
  return author
    ? `${index + 1}. ${title} — ${truncate(author, 40)}`
    : `${index + 1}. ${title}`;
}

export function buildPlaylistDetailPayload(params: {
  ownerUserId: string;
  tab: PlaylistDiscordTab;
  page: number;
  playlist: WebPlaylistRecord;
  trackCount: number;
  tracks: WebPlaylistTrackRecord[];
}): { embeds: APIEmbed[]; components: ActionRowBuilder<MessageActionRowComponentBuilder>[] } {
  const { ownerUserId, tab, page, playlist, trackCount, tracks } = params;
  const vis = formatVisibilityLabel(playlist);
  const plays = Math.max(0, playlist.queue_add_count);
  const favoriteCount =
    playlist.visibility === "public"
      ? getPlaylistFavoriteCount(playlist.id)
      : 0;
  const descLines = [
    `${trackCount}곡 · ${vis}`,
    `재생 ${plays}회 · 즐겨찾기 ${favoriteCount}명`,
  ];
  if (
    (tab === "public" || tab === "favorites") &&
    playlist.owner_name_snapshot?.trim()
  ) {
    descLines.push(
      `만든 사람: ${truncate(playlist.owner_name_snapshot.trim(), 48)}`,
    );
  }

  const preview = tracks.slice(0, PLAYLIST_DISCORD_PREVIEW_TRACKS);
  const bodyLines: string[] = [];
  if (trackCount === 0) {
    bodyLines.push("비어 있는 플레이리스트입니다.");
  } else {
    bodyLines.push(...preview.map((t, i) => formatTrackLine(t, i)));
    const rest = trackCount - preview.length;
    if (rest > 0) {
      bodyLines.push(`외 ${rest}곡`);
    }
  }

  const embed = new EmbedBuilder()
    .setTitle(`📚 ${truncate(playlist.title.trim() || "제목 없음", 200)}`)
    .setColor(0x5865f2)
    .setDescription([descLines.join("\n"), "", ...bodyLines].join("\n"));

  const canAdd = trackCount > 0;
  const actionRow =
    new ActionRowBuilder<MessageActionRowComponentBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId(plButtonId("queue", ownerUserId, playlist.id))
        .setLabel("대기열에 추가")
        .setStyle(ButtonStyle.Success)
        .setDisabled(!canAdd),
      new ButtonBuilder()
        .setCustomId(plButtonId("back", ownerUserId, tab, String(page)))
        .setLabel("목록으로")
        .setStyle(ButtonStyle.Secondary),
      new ButtonBuilder()
        .setCustomId(plButtonId("close", ownerUserId))
        .setLabel("닫기")
        .setStyle(ButtonStyle.Secondary),
    );

  return { embeds: [embed.toJSON()], components: [actionRow] };
}

export function parsePlaylistDiscordCustomId(
  customId: string,
):
  | { kind: "open" }
  | { kind: "close"; ownerUserId: string }
  | { kind: "tab"; ownerUserId: string; tab: PlaylistDiscordTab; page: number }
  | { kind: "prev" | "next"; ownerUserId: string; tab: PlaylistDiscordTab; page: number }
  | { kind: "sel"; ownerUserId: string; tab: PlaylistDiscordTab; page: number }
  | { kind: "back"; ownerUserId: string; tab: PlaylistDiscordTab; page: number }
  | { kind: "queue"; ownerUserId: string; playlistId: string }
  | null {
  if (customId === SR_PLAYLIST_OPEN_CUSTOM_ID) {
    return { kind: "open" };
  }
  if (!customId.startsWith("sr_pl:")) {
    return null;
  }
  const parts = customId.split(":");
  if (parts.length < 3) {
    return null;
  }
  const action = parts[1];
  const ownerUserId = parts[2];
  if (!ownerUserId) {
    return null;
  }

  if (action === "close") {
    return { kind: "close", ownerUserId };
  }
  if (action === "queue" && parts.length >= 4) {
    const playlistId = parts[3]!;
    if (!isValidPlaylistId(playlistId)) {
      return null;
    }
    return { kind: "queue", ownerUserId, playlistId };
  }

  const tab = parts[3] ? parsePlaylistDiscordTab(parts[3]) : null;
  if (!tab) {
    return null;
  }
  const page = parts[4] !== undefined ? Number(parts[4]) : 0;
  if (Number.isNaN(page)) {
    return null;
  }

  if (action === "tab") {
    return { kind: "tab", ownerUserId, tab, page: 0 };
  }
  if (action === "prev") {
    return { kind: "prev", ownerUserId, tab, page };
  }
  if (action === "next") {
    return { kind: "next", ownerUserId, tab, page };
  }
  if (action === "sel") {
    return { kind: "sel", ownerUserId, tab, page };
  }
  if (action === "back") {
    return { kind: "back", ownerUserId, tab, page };
  }

  return null;
}
