import type { GuildMember } from "discord.js";
import { getSoundroom } from "@/storage/soundroom";
import type { ExtendedPlayer, ExtendedTrack, MineClient } from "@/types";

type GuildAutoplayState = {
  enabled: boolean;
  seedUri: string | null;
  seedTitle: string | null;
  lastEndedUri: string | null;
  /** 패널에 미리 보여 줄 다음 자동재생 곡 제목 */
  autoplayNextHintTitle: string | null;
  idleLeaveTimer: NodeJS.Timeout | null;
};

const states = new Map<string, GuildAutoplayState>();

function getOrCreate(guildId: string): GuildAutoplayState {
  let s = states.get(guildId);
  if (!s) {
    s = {
      enabled: true,
      seedUri: null,
      seedTitle: null,
      lastEndedUri: null,
      autoplayNextHintTitle: null,
      idleLeaveTimer: null,
    };
    states.set(guildId, s);
  }
  return s;
}

export function getAutoplayState(guildId: string): GuildAutoplayState {
  return getOrCreate(guildId);
}

export function toggleAutoplay(guildId: string): boolean {
  const s = getOrCreate(guildId);
  s.enabled = !s.enabled;
  if (!s.enabled) {
    s.autoplayNextHintTitle = null;
  }
  return s.enabled;
}

export function resetAutoplaySession(guildId: string): void {
  cancelIdleLeaveTimer(guildId);
  const s = states.get(guildId);
  if (!s) {
    return;
  }
  s.seedUri = null;
  s.seedTitle = null;
  s.lastEndedUri = null;
  s.autoplayNextHintTitle = null;
}

export function cancelIdleLeaveTimer(guildId: string): void {
  const s = states.get(guildId);
  if (!s?.idleLeaveTimer) {
    return;
  }
  clearTimeout(s.idleLeaveTimer);
  s.idleLeaveTimer = null;
}

export function armIdleLeaveTimer(guildId: string, ms: number, fn: () => void): void {
  cancelIdleLeaveTimer(guildId);
  const s = getOrCreate(guildId);
  s.idleLeaveTimer = setTimeout(() => {
    s.idleLeaveTimer = null;
    fn();
  }, ms);
}

export function onQueueMayHaveItems(guildId: string): void {
  cancelIdleLeaveTimer(guildId);
}

export function isSoundroomAutoplayTrack(track: ExtendedTrack): boolean {
  return Boolean((track as unknown as { __mineAutoplay?: boolean }).__mineAutoplay);
}

export function markAutoplayTrack(track: ExtendedTrack): void {
  (track as unknown as { __mineAutoplay?: boolean }).__mineAutoplay = true;
}

export function setLastEndedTrack(guildId: string, track: ExtendedTrack | undefined): void {
  if (!track?.info.uri) {
    return;
  }
  const s = getOrCreate(guildId);
  s.lastEndedUri = track.info.uri;
}

export function ensureSeedTrack(guildId: string, track: ExtendedTrack): void {
  if (isSoundroomAutoplayTrack(track)) {
    return;
  }
  const s = getOrCreate(guildId);
  if (s.seedUri) {
    return;
  }
  if (!track.info.uri) {
    return;
  }
  s.seedUri = track.info.uri;
  s.seedTitle = track.info.title ?? null;
}

export function splitSoundroomQueue(player: ExtendedPlayer): {
  user: ExtendedTrack[];
  autoplay: ExtendedTrack[];
} {
  const user: ExtendedTrack[] = [];
  const autoplay: ExtendedTrack[] = [];
  for (const t of player.queue) {
    if (isSoundroomAutoplayTrack(t)) {
      autoplay.push(t);
    } else {
      user.push(t);
    }
  }
  return { user, autoplay };
}

export function setSoundroomQueueUserThenAutoplay(
  player: ExtendedPlayer,
  user: ExtendedTrack[],
  autoplay: ExtendedTrack[],
): void {
  player.queue.clear();
  for (const t of user) {
    player.queue.add(t);
  }
  for (const t of autoplay) {
    player.queue.add(t);
  }
}

/** 자동재생을 끌 때 큐에 남은 예약 곡만 치웁니다. 지금 재생 중인 곡은 그대로 둡니다. */
export function removeAutoplayTracksFromQueue(player: ExtendedPlayer): void {
  const { user } = splitSoundroomQueue(player);
  setSoundroomQueueUserThenAutoplay(player, user, []);
}

/** 사용자가 넣은 곡은 자동재생 예약보다 앞에 둡니다. */
export function addSoundroomUserTracks(player: ExtendedPlayer, tracks: ExtendedTrack[]): void {
  const { user, autoplay } = splitSoundroomQueue(player);
  setSoundroomQueueUserThenAutoplay(player, [...user, ...tracks], autoplay);
}

export function countUserSoundroomQueue(player: ExtendedPlayer): number {
  let n = 0;
  for (const t of player.queue) {
    if (!isSoundroomAutoplayTrack(t)) {
      n += 1;
    }
  }
  return n;
}

export function userSoundroomQueueEntries(player: ExtendedPlayer): { track: ExtendedTrack; queueIndex: number }[] {
  const out: { track: ExtendedTrack; queueIndex: number }[] = [];
  player.queue.forEach((t, i) => {
    if (!isSoundroomAutoplayTrack(t)) {
      out.push({ track: t, queueIndex: i });
    }
  });
  return out;
}

export function addTracksRespectingSoundroomAutoplay(
  player: ExtendedPlayer,
  guildId: string,
  tracks: ExtendedTrack[],
): void {
  const room = getSoundroom(guildId);
  if (room && player.textChannel === room.channelId) {
    addSoundroomUserTracks(player, tracks);
    syncAutoplayHintFromQueue(guildId, player);
    return;
  }
  for (const t of tracks) {
    player.queue.add(t);
  }
}

/** 큐에 자동재생 예약 곡이 있으면 패널 힌트를 맞춥니다. */
export function syncAutoplayHintFromQueue(guildId: string, player: ExtendedPlayer): void {
  const s = states.get(guildId);
  if (!s?.enabled) {
    return;
  }
  const first = player.queue.find(isSoundroomAutoplayTrack);
  s.autoplayNextHintTitle = first?.info.title?.trim() ?? null;
}

/** 지금 곡 기준으로 다음 자동재생 후보 제목만 미리 가져옵니다. */
export async function prefetchAutoplayNextHint(client: MineClient, player: ExtendedPlayer): Promise<void> {
  const guildId = player.guildId;
  const s = states.get(guildId);
  if (!s?.enabled) {
    return;
  }
  if (countUserSoundroomQueue(player) > 0) {
    return;
  }
  if (player.queue.length > 0) {
    syncAutoplayHintFromQueue(guildId, player);
    return;
  }
  const uri = player.current?.info.uri;
  if (!uri) {
    return;
  }
  const requester = await pickVoiceRequester(client, player);
  if (!requester) {
    return;
  }
  const tracks = await resolveAutoplayTracks(
    client,
    requester,
    uri,
    uri,
    player.current?.info.title?.trim() ?? s.seedTitle ?? null,
  );
  const title = tracks[0]?.info.title?.trim();
  if (title) {
    s.autoplayNextHintTitle = title;
  }
}

async function pickVoiceRequester(client: MineClient, player: ExtendedPlayer): Promise<GuildMember | null> {
  const guild = client.guilds.cache.get(player.guildId);
  if (!guild) {
    return null;
  }
  const chan = guild.channels.cache.get(player.voiceChannel);
  if (chan && chan.isVoiceBased()) {
    const human = chan.members.find((m) => !m.user.bot);
    if (human) {
      return human;
    }
  }
  return guild.members.me;
}

/** 유튜브 주소에서 영상 ID를 뽑습니다. */
function extractYoutubeVideoId(uri: string): string | null {
  const trimmed = uri.trim();
  if (!trimmed) {
    return null;
  }
  try {
    const u = new URL(trimmed);
    const host = u.hostname.replace(/^www\./i, "").toLowerCase();
    if (host === "youtu.be") {
      const id = u.pathname.replace(/^\//, "").split("/")[0] ?? "";
      return /^[\w-]{6,}$/.test(id) ? id : null;
    }
    if (host === "youtube.com" || host === "m.youtube.com" || host === "music.youtube.com") {
      const v = u.searchParams.get("v");
      return v && /^[\w-]{6,}$/.test(v) ? v : null;
    }
  } catch {
    return null;
  }
  return null;
}

/** 유튜브 라디오 주소를 만들어 연관곡 후보를 받습니다. */
function buildYoutubeRadioQuery(uri: string): string | null {
  const id = extractYoutubeVideoId(uri);
  if (!id) {
    return null;
  }
  return `https://www.youtube.com/watch?v=${encodeURIComponent(id)}&list=RD${encodeURIComponent(id)}`;
}

/** 단일 영상으로 안 잡히는 경우가 있어 라디오 주소와 제목 검색을 차례로 시도합니다. */
async function resolveAutoplayTracks(
  client: MineClient,
  requester: GuildMember,
  sourceUri: string,
  excludeUri: string | null,
  searchFallbackTitle: string | null,
): Promise<ExtendedTrack[]> {
  const attempts: string[] = [];
  const primary = sourceUri.trim();
  if (primary) {
    attempts.push(primary);
  }
  const radio = buildYoutubeRadioQuery(primary);
  if (radio && !attempts.includes(radio)) {
    attempts.push(radio);
  }
  const title = searchFallbackTitle?.trim();
  if (title) {
    const engine = client.config.engine?.trim() || "ytsearch";
    const prefix = engine.endsWith(":") ? engine : `${engine}:`;
    attempts.push(`${prefix}${title}`);
  }

  for (const query of attempts) {
    let raw: ExtendedTrack[];
    try {
      const r = (await client.riffy.resolve({
        query,
        requester,
      })) as { tracks: ExtendedTrack[] };
      raw = r.tracks as ExtendedTrack[];
    } catch {
      continue;
    }
    if (raw.length === 0) {
      continue;
    }
    const seen = new Set<string>();
    const filtered = raw.filter((t) => {
      const u = t.info.uri;
      if (!u) {
        return false;
      }
      if (excludeUri && u === excludeUri) {
        return false;
      }
      if (seen.has(u)) {
        return false;
      }
      seen.add(u);
      return true;
    });
    if (filtered.length > 0) {
      return filtered;
    }
  }
  return [];
}

/** 대기열이 비었을 때 연관곡을 자동재생 큐에 넣고 바로 재생합니다. */
export async function tryEnqueueAutoplayPlaylist(client: MineClient, player: ExtendedPlayer): Promise<boolean> {
  const guildId = player.guildId;
  const s = getOrCreate(guildId);
  if (!s.enabled) {
    return false;
  }

  if (player.queue.length > 0) {
    return false;
  }

  const sourceUri = s.lastEndedUri ?? s.seedUri;
  if (!sourceUri) {
    return false;
  }

  const requester = await pickVoiceRequester(client, player);
  if (!requester) {
    return false;
  }

  const lastUri = s.lastEndedUri;
  const tracks = await resolveAutoplayTracks(
    client,
    requester,
    sourceUri,
    lastUri,
    s.seedTitle ?? null,
  );
  if (tracks.length === 0) {
    return false;
  }

  for (const t of tracks) {
    markAutoplayTrack(t);
    t.info.requester = requester;
    player.queue.add(t);
  }

  try {
    await Promise.resolve(player.play());
  } catch {
    player.queue.clear();
    s.autoplayNextHintTitle = null;
    return false;
  }
  syncAutoplayHintFromQueue(guildId, player);
  return true;
}
