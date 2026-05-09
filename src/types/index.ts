import type {
  ChatInputApplicationCommandData,
  ChatInputCommandInteraction,
  Collection,
  GuildMember,
  Message,
  PermissionResolvable,
} from "discord.js";
import { Client } from "discord.js";
import type {
  LoopOption,
  Riffy,
  RiffyNodeConfig,
  RiffyPlayer,
  RiffyTrack,
} from "riffy";
import type { StockMarketService } from "@/services/stock/StockMarketService";

export interface SoundroomConfig {
  /** 임베드·패널에 쓰는 표시 이름 (기본: 마인). */
  brandName?: string;
  /** 만들 채널 이름 */
  channelName?: string;
}

/**
 * mock = 개발용 더미 시세
 * twelvedata = Twelve Data API
 * yahoo = 국내주식 demo/delayed quote provider
 */
export type StockPriceProvider = "mock" | "twelvedata" | "yahoo";

/** 시세 메모리 캐시 갱신 정책 */
export type StockPriceRefreshMode = "interval" | "scheduled-close";

export interface StockConfig {
  stockPriceProvider: StockPriceProvider;
  stockPriceRefreshIntervalMs: number;
  stockPriceRefreshMode: StockPriceRefreshMode;
  /** KST 평일 장 마감 후 예약 갱신 시각(분 단위, 0–1439). scheduled-close 모드에서만 사용 */
  stockScheduledCloseRefreshTimesKst: number[];
  /** 비어 있으면 없는 거. twelvedata 쓸 때 키 있는지는 그때 검사 */
  twelveDataApiKey: string;
}

export interface BotConfig {
  clientid: string;
  engine: string;
  color: number;
  developers: string[];
  nodes: RiffyNodeConfig[];
  soundroom?: SoundroomConfig;
  stock: StockConfig;
}

export interface ExtendedTrackInfo {
  title: string;
  author: string;
  length: number;
  uri: string;
  thumbnail?: string;
  isStream?: boolean;
  identifier?: string;
  sourceName?: string;
  requester?: GuildMember;
}

export interface ExtendedTrack extends Omit<RiffyTrack, "info"> {
  info: ExtendedTrackInfo;
}

export interface ExtendedPlayer extends Omit<
  RiffyPlayer,
  "current" | "previous" | "queue" | "autoplay" | "message" | "loop"
> {
  current?: ExtendedTrack;
  previous?: ExtendedTrack;
  loop: LoopOption;
  queue: Array<ExtendedTrack> & {
    add(track: ExtendedTrack): void;
    remove(index: number): ExtendedTrack;
    clear(): void;
    shuffle(): void;
    size: number;
  };
  message?: Message;
}

export interface BaseCommandOptions {
  developerOnly?: boolean;
  userPermissions?: PermissionResolvable[];
  clientPermissions?: PermissionResolvable[];
  guildOnly?: boolean;
  inVoice?: boolean;
  sameVoice?: boolean;
  player?: boolean;
  current?: boolean;
  category?: string;
  aliases?: string[];
  usage?: string;
}

export interface SlashCommand
  extends ChatInputApplicationCommandData, BaseCommandOptions {
  run: (
    client: MineClient,
    interaction: ChatInputCommandInteraction,
  ) => Promise<unknown>;
}

export type BotEventHandler = (client: MineClient) => void | Promise<void>;

export class MineClient extends Client {
  public config!: BotConfig;
  public slashCommands!: Collection<string, SlashCommand>;
  public riffy!: Riffy;
  public stockMarket?: StockMarketService;
}
