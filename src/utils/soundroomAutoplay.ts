import type { GuildMember } from "discord.js";
import { getSoundroom } from "@/storage/soundroom";
import type { ExtendedPlayer, ExtendedTrack, MineClient } from "@/types";
import { buildAutoplaySearchQueries } from "@/utils/soundroomAutoplayCandidateSearch";
import {
  clearSoundroomAutoplayHistory,
  pickBestAutoplayCandidate,
} from "@/utils/soundroomAutoplayHistory";
import {
  extractYouTubePlaylistId,
  isYouTubeMixPlaylistId,
  isYouTubeRadioLikeUrl,
} from "@/utils/soundroomAutoplaySimilarity";

export { recordSoundroomPlaybackHistory } from "@/utils/soundroomAutoplayHistory";

type GuildAutoplayState = {
  enabled: boolean;
  seedUri: string | null;
  seedTitle: string | null;
  lastEndedUri: string | null;
  mixPlaylistId: string | null;
  mixSourceUri: string | null;
  autoplayNextHintTitle: string | null;
  idleLeaveTimer: NodeJS.Timeout | null;
};

const states = new Map<string, GuildAutoplayState>();

const MAX_RESOLVE_ATTEMPTS = 5;
const MAX_TRACKS_PER_RESOLVE = 10;
const MAX_TOTAL_POOL = 20;

function getOrCreate(guildId: string): GuildAutoplayState {
  let s = states.get(guildId);
  if (!s) {
    s = {
      enabled: true,
      seedUri: null,
      seedTitle: null,
      lastEndedUri: null,
      mixPlaylistId: null,
      mixSourceUri: null,
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
    clearSoundroomAutoplayHistory(guildId);
    return;
  }
  s.seedUri = null;
  s.seedTitle = null;
  s.lastEndedUri = null;
  s.mixPlaylistId = null;
  s.mixSourceUri = null;
  s.autoplayNextHintTitle = null;
  clearSoundroomAutoplayHistory(guildId);
}

export function cancelIdleLeaveTimer(guildId: string): void {
  const s = states.get(guildId);
  if (!s?.idleLeaveTimer) {
    return;
  }
  clearTimeout(s.idleLeaveTimer);
  s.idleLeaveTimer = null;
}

export function armIdleLeaveTimer(
  guildId: string,
  ms: number,
  fn: () => void,
): void {
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
  return Boolean(
    (track as unknown as { __mineAutoplay?: boolean }).__mineAutoplay,
  );
}

export function markAutoplayTrack(track: ExtendedTrack): void {
  (track as unknown as { __mineAutoplay?: boolean }).__mineAutoplay = true;
}

function syncAutoplayUriHints(
  guildId: string,
  uri: string | null | undefined,
): void {
  if (!uri?.trim()) {
    return;
  }
  const s = getOrCreate(guildId);
  const listId = extractYouTubePlaylistId(uri);
  if (listId && isYouTubeMixPlaylistId(listId)) {
    s.mixPlaylistId = listId;
    s.mixSourceUri = uri.trim();
    return;
  }
  if (isYouTubeRadioLikeUrl(uri) && listId && isYouTubeMixPlaylistId(listId)) {
    s.mixPlaylistId = listId;
    s.mixSourceUri = uri.trim();
    return;
  }
  s.mixPlaylistId = null;
  s.mixSourceUri = null;
}

export function setLastEndedTrack(
  guildId: string,
  track: ExtendedTrack | undefined,
): void {
  if (!track?.info.uri) {
    return;
  }
  const s = getOrCreate(guildId);
  s.lastEndedUri = track.info.uri;
  syncAutoplayUriHints(guildId, track.info.uri);
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
  syncAutoplayUriHints(guildId, track.info.uri);
}

// 사용자 대기열과 자동재생 예약 분리
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

export function removeAutoplayTracksFromQueue(player: ExtendedPlayer): void {
  const { user } = splitSoundroomQueue(player);
  setSoundroomQueueUserThenAutoplay(player, user, []);
}

export function addSoundroomUserTracks(
  player: ExtendedPlayer,
  tracks: ExtendedTrack[],
): void {
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

export function userSoundroomQueueEntries(
  player: ExtendedPlayer,
): { track: ExtendedTrack; queueIndex: number }[] {
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

export function syncAutoplayHintFromQueue(
  guildId: string,
  player: ExtendedPlayer,
): void {
  const s = states.get(guildId);
  if (!s?.enabled) {
    return;
  }
  const first = player.queue.find(isSoundroomAutoplayTrack);
  s.autoplayNextHintTitle = first?.info.title?.trim() ?? null;
}

export async function prefetchAutoplayNextHint(
  client: MineClient,
  player: ExtendedPlayer,
): Promise<void> {
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
  const picked = await pickAutoplayTrack(
    client,
    requester,
    guildId,
    uri,
    uri,
    player.current?.info.title?.trim() ?? s.seedTitle ?? null,
    player.current?.info.author?.trim() ?? null,
  );
  s.autoplayNextHintTitle = picked?.info.title?.trim() ?? null;
}

async function pickVoiceRequester(
  client: MineClient,
  player: ExtendedPlayer,
): Promise<GuildMember | null> {
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

async function resolveRawTracks(
  client: MineClient,
  requester: GuildMember,
  query: string,
): Promise<ExtendedTrack[]> {
  try {
    const r = (await client.riffy.resolve({
      query,
      requester,
    })) as { loadType?: string; tracks?: ExtendedTrack[] };
    const tracks = (r.tracks ?? []) as ExtendedTrack[];
    if (tracks.length === 0) {
      return [];
    }
    if (r.loadType === "playlist" || r.loadType === "album") {
      return tracks.slice(0, MAX_TRACKS_PER_RESOLVE);
    }
    return tracks.slice(0, MAX_TRACKS_PER_RESOLVE);
  } catch {
    return [];
  }
}

async function resolveAutoplayCandidates(
  client: MineClient,
  requester: GuildMember,
  guildId: string,
  sourceUri: string,
  excludeUri: string | null,
  searchFallbackTitle: string | null,
  searchFallbackAuthor: string | null,
): Promise<ExtendedTrack[]> {
  const s = getOrCreate(guildId);
  const queryBatches = buildAutoplaySearchQueries({
    sourceUri: sourceUri.trim(),
    mixPlaylistId: s.mixPlaylistId,
    title: searchFallbackTitle,
    author: searchFallbackAuthor,
  });

  const pool: ExtendedTrack[] = [];
  const seenUri = new Set<string>();
  let resolveAttempts = 0;

  for (const query of queryBatches) {
    if (resolveAttempts >= MAX_RESOLVE_ATTEMPTS) {
      break;
    }
    if (pool.length >= MAX_TOTAL_POOL) {
      break;
    }
    resolveAttempts += 1;
    const raw = await resolveRawTracks(client, requester, query);

    for (const t of raw) {
      if (pool.length >= MAX_TOTAL_POOL) {
        break;
      }
      const u = t.info.uri?.trim();
      if (!u) {
        continue;
      }
      if (excludeUri && u === excludeUri) {
        continue;
      }
      if (seenUri.has(u)) {
        continue;
      }
      seenUri.add(u);
      pool.push(t);
    }
  }

  const picked = pickBestAutoplayCandidate(guildId, pool, excludeUri);
  return picked ? [picked] : [];
}

async function pickAutoplayTrack(
  client: MineClient,
  requester: GuildMember,
  guildId: string,
  sourceUri: string,
  excludeUri: string | null,
  searchFallbackTitle: string | null,
  searchFallbackAuthor: string | null,
): Promise<ExtendedTrack | null> {
  const candidates = await resolveAutoplayCandidates(
    client,
    requester,
    guildId,
    sourceUri,
    excludeUri,
    searchFallbackTitle,
    searchFallbackAuthor,
  );
  return candidates[0] ?? null;
}

export async function tryEnqueueAutoplayPlaylist(
  client: MineClient,
  player: ExtendedPlayer,
): Promise<boolean> {
  const guildId = player.guildId;
  const s = getOrCreate(guildId);
  if (!s.enabled) {
    return false;
  }

  if (countUserSoundroomQueue(player) > 0) {
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
  const ended = player.previous ?? player.current;
  const track = await pickAutoplayTrack(
    client,
    requester,
    guildId,
    sourceUri,
    lastUri,
    ended?.info.title?.trim() ?? s.seedTitle ?? null,
    ended?.info.author?.trim() ?? null,
  );
  if (!track) {
    return false;
  }

  markAutoplayTrack(track);
  track.info.requester = requester;
  player.queue.add(track);

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
