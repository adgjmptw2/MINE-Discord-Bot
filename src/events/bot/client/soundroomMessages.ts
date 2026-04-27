import type { Message } from "discord.js";
import { getSoundroom } from "@/storage/soundroom";
import { ensurePlayerConnection } from "@/utils/commands";
import { sendSoundroomAddNotification } from "@/utils/soundroomPanel";
import type { ExtendedTrack, MineClient } from "@/types";

/**
 * Plain text is passed through so Riffy can apply `defaultSearchPlatform` (same resolution as legacy play search).
 * Avoid prefixing `ytsearch:` here — double-prefix breaks Lavalink search.
 */
export function buildSoundroomResolveQuery(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) {
    return trimmed;
  }
  if (/^https?:\/\//i.test(trimmed)) {
    return trimmed;
  }
  if (/^[a-z][a-z0-9]*:/i.test(trimmed)) {
    return trimmed;
  }
  return trimmed;
}

export async function tryHandleSoundroomMessage(client: MineClient, message: Message): Promise<boolean> {
  if (!message.guild || message.author.bot) {
    return false;
  }

  const lounge = getSoundroom(message.guild.id);
  if (!lounge || message.channelId !== lounge.channelId) {
    return false;
  }

  const ch = message.channel;
  if (!ch.isTextBased() || ch.isDMBased()) {
    return true;
  }

  const raw = message.content.trim();
  if (!raw) {
    return true;
  }

  try {
    await message.delete();
  } catch {
    /* ignore */
  }

  const member = message.member;
  const guildId = message.guildId;
  if (!guildId || !member?.voice.channel) {
    const warn = await ch.send({ content: `<@${message.author.id}> 음성 채널에 먼저 입장해 주십시오.` });
    setTimeout(() => void warn.delete().catch(() => undefined), 5000);
    return true;
  }

  const query = buildSoundroomResolveQuery(raw);
  const player = await ensurePlayerConnection(client, guildId, member.voice.channel.id, lounge.channelId);

  const resolve = await client.riffy.resolve({ query, requester: member });
  const tracks = resolve.tracks as ExtendedTrack[];

  if (tracks.length === 0) {
    const fail = await ch.send({ content: "검색 결과가 없습니다. 다른 키워드를 입력해 주십시오." });
    setTimeout(() => void fail.delete().catch(() => undefined), 8000);
    return true;
  }

  let notifyTrack: ExtendedTrack;
  if (resolve.loadType === "playlist") {
    for (const t of tracks) {
      t.info.requester = member;
      player.queue.add(t);
    }
    notifyTrack = tracks[0]!;
  } else {
    const track = tracks.shift()!;
    track.info.requester = member;
    player.queue.add(track);
    notifyTrack = track;
  }

  const volPct = Math.round(player.volume ?? 100);
  const playlistCount = resolve.loadType === "playlist" ? tracks.length : undefined;
  const playlistName = resolve.loadType === "playlist" ? resolve.playlistInfo?.name : undefined;
  await sendSoundroomAddNotification(ch, notifyTrack, volPct, playlistCount, playlistName);

  if (player.queue.length > 0 && !player.playing && !player.paused) {
    try {
      await Promise.resolve(player.play());
    } catch {
      const err = await ch.send({ content: "재생하지 못했습니다. Lavalink 연결을 확인해 주십시오." });
      setTimeout(() => void err.delete().catch(() => undefined), 8000);
    }
  }

  return true;
}
