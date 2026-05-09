import { PermissionFlagsBits } from "discord.js";
import type { ChatInputCommandInteraction } from "discord.js";
import type { MineClient } from "@/types";

/** Administrator 또는 ManageGuild */
export function canManageGuild(
  interaction: ChatInputCommandInteraction,
): boolean {
  if (!interaction.inGuild()) {
    return false;
  }
  const perms = interaction.memberPermissions;
  if (!perms) {
    return false;
  }
  return (
    perms.has(PermissionFlagsBits.Administrator) ||
    perms.has(PermissionFlagsBits.ManageGuild)
  );
}

/** 관리자 권한 또는 .env DISCORD_OWNER_IDS 봇 오너 */
export function canUseStockAdminCommand(
  client: MineClient,
  interaction: ChatInputCommandInteraction,
): boolean {
  if (canManageGuild(interaction)) {
    return true;
  }
  return client.config.developers.includes(interaction.user.id);
}
