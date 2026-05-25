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

export interface ApiErrorDto {
  ok: false;
  code: string;
  message: string;
}
