import type { ExtendedPlayer, MineClient } from "@/types";

export function getPlayer(
  client: MineClient,
  guildId: string | null,
): ExtendedPlayer | undefined {
  if (!guildId) {
    return undefined;
  }

  return client.riffy.players.get(guildId) as ExtendedPlayer | undefined;
}

export function hasActivePlayerSession(
  client: MineClient,
  guildId: string | null,
): boolean {
  if (!guildId) {
    return false;
  }

  const player = getPlayer(client, guildId);
  if (!player?.voiceChannel) {
    return false;
  }

  const guild = client.guilds.cache.get(guildId);
  const botChannelId = guild?.members.me?.voice.channelId ?? null;
  return Boolean(
    player.connected && botChannelId && botChannelId === player.voiceChannel,
  );
}

export function getActivePlayer(
  client: MineClient,
  guildId: string | null,
): ExtendedPlayer | undefined {
  if (!hasActivePlayerSession(client, guildId)) {
    return undefined;
  }

  return getPlayer(client, guildId);
}

export function hasCurrentTrack(
  player: ExtendedPlayer | undefined,
): player is ExtendedPlayer & {
  current: NonNullable<ExtendedPlayer["current"]>;
} {
  return Boolean(player?.current && (player.playing || player.paused));
}

/** 웹·전환 구간: current만 있어도 조작 허용 (playing/paused 플래그 지연 시 NOTHING_PLAYING 방지) */
export function hasControllableTrack(
  player: ExtendedPlayer | undefined,
): player is ExtendedPlayer & {
  current: NonNullable<ExtendedPlayer["current"]>;
} {
  return Boolean(player?.current);
}

export async function ensurePlayerConnection(
  client: MineClient,
  guildId: string,
  voiceChannelId: string,
  textChannelId: string,
): Promise<ExtendedPlayer> {
  const guild = client.guilds.cache.get(guildId);
  const botChannelId = guild?.members.me?.voice.channelId ?? null;
  let player = getPlayer(client, guildId);

  if (!player) {
    return (await client.riffy.createConnection({
      guildId,
      voiceChannel: voiceChannelId,
      textChannel: textChannelId,
      deaf: true,
    })) as ExtendedPlayer;
  }

  player.textChannel = textChannelId;

  const needsReconnect =
    !player.connected || !botChannelId || botChannelId !== voiceChannelId;
  if (needsReconnect) {
    player.connect({
      guildId,
      voiceChannel: voiceChannelId,
      textChannel: textChannelId,
      deaf: true,
    });
  }

  return player;
}
