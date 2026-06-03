import { PermissionFlagsBits } from "discord.js";
import type { ChatInputCommandInteraction } from "discord.js";
import type { MineClient } from "@/types";

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

export function canUseStockAdminCommand(
  client: MineClient,
  interaction: ChatInputCommandInteraction,
): boolean {
  if (canManageGuild(interaction)) {
    return true;
  }
  return client.config.developers.includes(interaction.user.id);
}
