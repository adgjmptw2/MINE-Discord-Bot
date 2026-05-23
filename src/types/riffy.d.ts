declare module "riffy" {
  import type { Collection, GuildMember, Message, Snowflake } from "discord.js";

  export interface RiffyNodeConfig {
    name: string;
    host: string;
    password: string;
    port: number;
    secure?: boolean;
  }

  export interface RiffyNodeStats {
    players?: number;
    playingPlayers?: number;
    uptime?: number;
    memory?: {
      used?: number;
      free?: number;
      allocated?: number;
      reservable?: number;
    };
    cpu?: {
      cores?: number;
      systemLoad?: number;
      lavalinkLoad?: number;
    };
  }

  export interface RiffyNode {
    name?: string;
    ping?: number;
    isConnected?: boolean;
    info?: {
      identifier?: string;
    };
    options: {
      identifier?: string;
    };
    stats?: RiffyNodeStats;
  }

  export interface RiffyTrackInfo {
    title: string;
    author: string;
    length: number;
    uri: string;
    artworkUrl?: string;
    thumbnail?: string;
    isStream?: boolean;
    requester?: GuildMember;
    identifier?: string;
    sourceName?: string;
  }

  export interface RiffyTrack {
    info: RiffyTrackInfo;
    isAutoplay?: boolean;
  }

  export interface RiffyPlaylistInfo {
    name?: string;
  }

  export interface RiffyQueue extends Array<RiffyTrack> {
    add(track: RiffyTrack): void;
    remove(index: number): RiffyTrack;
    clear(): void;
    shuffle(): void;
    size: number;
  }

  export type LoopOption = "none" | "track" | "queue";

  export interface RiffyPlayer {
    guildId: Snowflake;
    voiceChannel: Snowflake;
    textChannel: Snowflake;
    current?: RiffyTrack;
    previous?: RiffyTrack;
    queue: RiffyQueue;
    paused: boolean;
    playing: boolean;
    connected: boolean;
    position: number;
    volume: number;
    loop: LoopOption;
    isAutoplay?: boolean;
    message?: Message;
    autoplay?(player: RiffyPlayer): Promise<void> | void;
    connect(options?: RiffyConnectionOptions & { mute?: boolean }): void;
    play(): Promise<void> | void;
    pause(paused: boolean): Promise<void> | void;
    stop(): Promise<void> | void;
    destroy(): Promise<void> | void;
    seek(position: number): void;
    setVolume(volume: number): Promise<void> | void;
    setLoop(mode: LoopOption): Promise<void> | void;
  }

  export interface RiffyResolveResponse {
    loadType: string;
    tracks: RiffyTrack[];
    playlistInfo: RiffyPlaylistInfo;
  }

  export interface RiffyConnectionOptions {
    guildId: Snowflake;
    voiceChannel: Snowflake;
    textChannel: Snowflake;
    deaf?: boolean;
    loop?: LoopOption;
  }

  export interface RiffyResolveOptions {
    query: string;
    requester?: GuildMember;
    source?: string;
  }

  export interface RiffyOptions {
    send(payload: unknown): void;
    defaultSearchPlatform?: string;
    restVersion?: string;
  }

  export class Riffy {
    public readonly players: Collection<Snowflake, RiffyPlayer>;
    public readonly nodes: Collection<string, RiffyNode>;

    public constructor(
      client: unknown,
      nodes: RiffyNodeConfig[],
      options: RiffyOptions,
    );

    public on(event: string, listener: (...args: unknown[]) => void): this;
    public init(userId: Snowflake): void;
    public updateVoiceState(payload: unknown): void;
    public createConnection(
      options: RiffyConnectionOptions,
    ): Promise<RiffyPlayer>;
    public resolve(options: RiffyResolveOptions): Promise<RiffyResolveResponse>;
  }
}
