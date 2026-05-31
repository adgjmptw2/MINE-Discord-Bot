/** 공개 랜딩 운영 현황 집계 (서버명·유저명·ID 없음). */
export interface HomePagePublicStats {
  guildCount: number;
  estimatedMemberCount: number;
  configuredSoundroomCount: number;
  activePlayerCount: number;
  playingPlayerCount: number;
  queuedTrackCount: number;
  activeVoiceListenerCount?: number;
  updatedAt: string;
}

/** 공개 랜딩·패널 링크용 URL 묶음 (secret 아님). */
export interface WebDashboardPublicLinks {
  origin: string;
  dashboardUrl: string;
  privacyUrl: string;
  termsUrl: string;
  inviteUrl?: string;
}

export interface SoundroomTrackDto {
  title: string;
  uri: string | null;
  author: string | null;
  durationMs: number | null;
  isStream: boolean;
  thumbnailUrl: string | null;
  requesterId: string | null;
  requesterName: string | null;
}

export interface SoundroomQueueItemDto {
  index: number;
  title: string;
  uri: string | null;
  author: string | null;
  durationMs: number | null;
  requesterId: string | null;
  requesterName: string | null;
}

export interface SoundroomGuildStateDto {
  guildId: string;
  soundroomConfigured: boolean;
  channelId: string | null;
  panelMessageId: string | null;
  playerConnected: boolean;
  playing: boolean;
  paused: boolean;
  volume: number;
  autoplay: boolean;
  positionMs: number;
  current: SoundroomTrackDto | null;
  queue: SoundroomQueueItemDto[];
  updatedAt: string;
}

export interface HealthResponseDto {
  ok: true;
  service: "mine-soundroom-web-api";
  uptimeSec: number;
  guildCount: number;
  timestamp: string;
}

export interface ApiErrorResponseDto {
  ok: false;
  code: string;
  message: string;
}

export interface DiscordOAuthUserDto {
  id: string;
  username: string;
  globalName: string | null;
  avatar: string | null;
  avatarUrl: string | null;
}

export interface DiscordOAuthGuildDto {
  id: string;
  name: string;
  icon: string | null;
  iconUrl: string | null;
  owner: boolean;
  permissions: string;
}

export interface WebSessionDto {
  id: string;
  user: DiscordOAuthUserDto;
  guilds: DiscordOAuthGuildDto[];
  createdAt: number;
  expiresAt: number;
}

export interface WebDashboardGuildDto {
  id: string;
  name: string;
  icon: string | null;
  iconUrl: string | null;
  owner: boolean;
  permissions: string;
  botInGuild: boolean;
  soundroomConfigured: boolean;
  soundroomChannelId: string | null;
  hasManageGuild: boolean;
  hasAdministrator: boolean;
}

export interface AuthMeResponseDto {
  ok: true;
  user: DiscordOAuthUserDto;
  expiresAt: string;
}

export interface AuthGuildsResponseDto {
  ok: true;
  guilds: WebDashboardGuildDto[];
}

export interface AuthOkResponseDto {
  ok: true;
}

export interface AuthCsrfResponseDto {
  ok: true;
  csrfToken: string;
}

export interface AuthSoundroomStateResponseDto {
  ok: true;
  state: SoundroomGuildStateDto;
}

export type SoundroomControlAction =
  | "togglePause"
  | "skip"
  | "stop"
  | "setVolume"
  | "toggleAutoplay";

export interface SoundroomControlRequestDto {
  action: SoundroomControlAction;
  volume?: number;
}

export interface SoundroomControlResponseDto {
  ok: true;
  action: SoundroomControlAction;
  state: SoundroomGuildStateDto;
}

export type SoundroomControlStatusCode =
  | "READY"
  | "SOUNDROOM_NOT_CONFIGURED"
  | "USER_NOT_IN_VOICE_CHANNEL"
  | "PLAYER_NOT_CONNECTED"
  | "NOT_SAME_VOICE_CHANNEL";

export interface SoundroomControlStatusResponseDto {
  ok: true;
  canControl: boolean;
  code: SoundroomControlStatusCode;
  message: string;
  soundroomConfigured: boolean;
  playerConnected: boolean;
  userVoiceChannelId: string | null;
  userVoiceChannelName: string | null;
  botVoiceChannelId: string | null;
  botVoiceChannelName: string | null;
}

export interface SoundroomSearchRequestDto {
  query: string;
}

export interface SoundroomSearchResultDto {
  id: string;
  title: string;
  uri: string | null;
  author: string | null;
  durationMs: number | null;
  isStream: boolean;
  thumbnailUrl: string | null;
}

export interface SoundroomSearchResponseDto {
  ok: true;
  query: string;
  results: SoundroomSearchResultDto[];
}

export interface SoundroomAddRequestDto {
  query?: string;
  uri?: string;
}

export interface SoundroomAddedTrackDto {
  title: string;
  uri: string | null;
  author: string | null;
  durationMs: number | null;
  isStream: boolean;
  thumbnailUrl: string | null;
  requesterId: string | null;
  requesterName: string | null;
}

export interface SoundroomAddResponseDto {
  ok: true;
  added: SoundroomAddedTrackDto;
  state: SoundroomGuildStateDto;
}

export interface SoundroomPlaylistAddRequestDto {
  uri: string;
  limit?: number;
}

export interface SoundroomPlaylistAddResponseDto {
  ok: true;
  addedCount: number;
  skippedCount: number;
  requestedCount: number;
  limit: number;
  truncated: boolean;
  playlist: {
    title: string | null;
    uri: string | null;
  };
  state: SoundroomGuildStateDto;
}

export interface SoundroomQueueRemoveRequestDto {
  queueIndex: number;
  expectedUri?: string | null;
  expectedTitle?: string | null;
}

export interface SoundroomQueueRemoveResponseDto {
  ok: true;
  removed: SoundroomQueueItemDto;
  state: SoundroomGuildStateDto;
}

export interface SoundroomQueueSwapRequestDto {
  fromQueueIndex: number;
  toQueueIndex: number;
  expectedFromUri?: string | null;
  expectedFromTitle?: string | null;
  expectedToUri?: string | null;
  expectedToTitle?: string | null;
}

export interface SoundroomQueueSwapSummaryDto {
  from: SoundroomQueueItemDto;
  to: SoundroomQueueItemDto;
}

export interface SoundroomQueueSwapResponseDto {
  ok: true;
  swapped: SoundroomQueueSwapSummaryDto;
  state: SoundroomGuildStateDto;
}

export type WebPlaylistVisibility = "private" | "public";

export interface WebPlaylistSummaryDto {
  id: string;
  title: string;
  description: string;
  visibility: WebPlaylistVisibility;
  trackCount: number;
  queueAddCount: number;
  favoriteCount: number;
  lastQueuedAt: string | null;
  isHiddenByAdmin: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface WebPlaylistPublicSummaryDto {
  id: string;
  title: string;
  description: string;
  ownerNameSnapshot: string;
  trackCount: number;
  queueAddCount: number;
  favoriteCount: number;
  lastQueuedAt: string | null;
  isFavorited?: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface WebPlaylistFavoriteSummaryDto {
  id: string;
  title: string;
  description: string;
  ownerNameSnapshot: string;
  trackCount: number;
  queueAddCount: number;
  favoriteCount: number;
  lastQueuedAt: string | null;
  isFavorited: true;
  favoritedAt: string;
  createdAt: string;
  updatedAt: string;
}

export type WebPlaylistAdminListHiddenFilter = "all" | "visible" | "hidden";

export interface WebPlaylistAdminSummaryDto {
  id: string;
  title: string;
  description: string;
  ownerNameSnapshot: string;
  trackCount: number;
  queueAddCount: number;
  favoriteCount: number;
  lastQueuedAt: string | null;
  isHiddenByAdmin: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface WebPlaylistTrackDto {
  id: string;
  position: number;
  title: string;
  uri: string;
  author: string;
  durationMs: number;
  thumbnailUrl: string | null;
  source: string;
}

export interface WebPlaylistDetailDto {
  id: string;
  title: string;
  description: string;
  visibility: WebPlaylistVisibility;
  ownerNameSnapshot: string;
  isOwner: boolean;
  canManage: boolean;
  isHiddenByAdmin: boolean;
  isFavorited?: boolean;
  queueAddCount: number;
  favoriteCount: number;
  lastQueuedAt: string | null;
  createdAt: string;
  updatedAt: string;
  tracks: WebPlaylistTrackDto[];
}

export interface WebPlaylistCreateRequestDto {
  title: string;
  description?: string;
  visibility: WebPlaylistVisibility;
}

export interface WebPlaylistUpdateRequestDto {
  title?: string;
  description?: string;
  visibility?: WebPlaylistVisibility;
}

export interface WebPlaylistTrackAddRequestDto {
  query?: string;
  uri?: string;
}

export interface WebPlaylistTrackReorderRequestDto {
  trackIds: string[];
}

export interface WebPlaylistAddToQueueRequestDto {
  limit?: number;
}

export interface WebPlaylistAddToQueueResponseDto {
  ok: true;
  addedCount: number;
  requestedCount: number;
  limit: number;
  truncated: boolean;
  playlist: {
    id: string;
    title: string;
  };
  state: SoundroomGuildStateDto;
}

export interface WebPlaylistAdminHideRequestDto {
  hidden: boolean;
}

export interface WebPlaylistMineResponseDto {
  ok: true;
  playlists: WebPlaylistSummaryDto[];
}

export interface WebPlaylistPublicListResponseDto {
  ok: true;
  playlists: WebPlaylistPublicSummaryDto[];
  limit: number;
  offset: number;
}

export interface WebPlaylistFavoritesResponseDto {
  ok: true;
  playlists: WebPlaylistFavoriteSummaryDto[];
  limit: number;
  offset: number;
}

export interface WebPlaylistFavoriteResponseDto {
  ok: true;
  favorited: boolean;
}

export interface WebPlaylistDetailResponseDto {
  ok: true;
  playlist: WebPlaylistDetailDto;
}

export interface WebPlaylistCreateResponseDto {
  ok: true;
  playlist: WebPlaylistDetailDto;
}

export interface WebPlaylistTrackAddResponseDto {
  ok: true;
  track: WebPlaylistTrackDto;
}

export interface WebPlaylistTrackReorderResponseDto {
  ok: true;
  tracks: WebPlaylistTrackDto[];
}

export interface WebPlaylistDeleteResponseDto {
  ok: true;
  deleted: true;
}

export interface WebPlaylistAdminHideResponseDto {
  ok: true;
  hidden: boolean;
}

export interface WebPlaylistAdminListResponseDto {
  ok: true;
  playlists: WebPlaylistAdminSummaryDto[];
  hidden: WebPlaylistAdminListHiddenFilter;
  limit: number;
  offset: number;
}

export type WebPlaylistReportReason =
  | "inappropriate"
  | "spam"
  | "misleading"
  | "broken"
  | "other";

export type WebPlaylistReportStatus = "open" | "resolved";

export type WebPlaylistAdminReportStatusFilter = "open" | "resolved" | "all";

export interface WebPlaylistReportRequestDto {
  reason: WebPlaylistReportReason;
  detail?: string;
}

export interface WebPlaylistReportResponseDto {
  ok: true;
  reported: true;
}

export interface WebPlaylistAdminReportPlaylistDto {
  id: string;
  title: string;
  ownerNameSnapshot: string;
  isHiddenByAdmin: boolean;
}

export interface WebPlaylistAdminReportSummaryDto {
  id: string;
  playlist: WebPlaylistAdminReportPlaylistDto;
  reporterNameSnapshot: string;
  reason: WebPlaylistReportReason;
  detail: string;
  status: WebPlaylistReportStatus;
  createdAt: string;
  resolvedAt: string | null;
  resolutionNote: string;
}

export interface WebPlaylistAdminReportsResponseDto {
  ok: true;
  reports: WebPlaylistAdminReportSummaryDto[];
  status: WebPlaylistAdminReportStatusFilter;
  limit: number;
  offset: number;
}

export interface WebPlaylistReportResolveRequestDto {
  resolutionNote?: string;
}

export interface WebPlaylistReportResolveResponseDto {
  ok: true;
  resolved: true;
}
