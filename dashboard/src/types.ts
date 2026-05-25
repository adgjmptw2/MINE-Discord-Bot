export interface DiscordOAuthUserDto {
  id: string;
  username: string;
  globalName: string | null;
  avatar: string | null;
  avatarUrl: string | null;
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

export interface AuthMeResponse {
  ok: true;
  user: DiscordOAuthUserDto;
  expiresAt: string;
}

export interface AuthGuildsResponse {
  ok: true;
  guilds: WebDashboardGuildDto[];
}

export interface AuthSoundroomStateResponse {
  ok: true;
  state: SoundroomGuildStateDto;
}

export interface ApiErrorResponse {
  ok: false;
  code: string;
  message: string;
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
