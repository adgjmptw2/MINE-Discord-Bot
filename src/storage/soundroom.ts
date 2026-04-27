import { db } from "@/storage/db";

export interface SoundroomRecord {
  guildId: string;
  channelId: string;
  panelMessageId: string;
  updatedAt: string;
}

function nowIso(): string {
  return new Date().toISOString();
}

export function getSoundroom(guildId: string): SoundroomRecord | undefined {
  const row = db.get<{
    guild_id: string;
    channel_id: string;
    panel_message_id: string;
    updated_at: string;
  }>("SELECT guild_id, channel_id, panel_message_id, updated_at FROM soundroom WHERE guild_id = ?", [guildId]);

  if (!row) {
    return undefined;
  }

  return {
    guildId: row.guild_id,
    channelId: row.channel_id,
    panelMessageId: row.panel_message_id,
    updatedAt: row.updated_at,
  };
}

export function setSoundroom(guildId: string, channelId: string, panelMessageId: string): void {
  const t = nowIso();
  db.run(
    `INSERT INTO soundroom (guild_id, channel_id, panel_message_id, updated_at)
     VALUES (?, ?, ?, ?)
     ON CONFLICT(guild_id) DO UPDATE SET
       channel_id = excluded.channel_id,
       panel_message_id = excluded.panel_message_id,
       updated_at = excluded.updated_at`,
    [guildId, channelId, panelMessageId, t],
  );
}

export function clearSoundroom(guildId: string): void {
  db.run("DELETE FROM soundroom WHERE guild_id = ?", [guildId]);
}

export function isSoundroomTextChannel(guildId: string, channelId: string): boolean {
  const row = getSoundroom(guildId);
  return Boolean(row && row.channelId === channelId);
}
