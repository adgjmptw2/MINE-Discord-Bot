import { readdirSync } from "node:fs";
import path from "node:path";
import { REST, Routes } from "discord.js";
import type { RESTGetAPIApplicationCommandsResult } from "discord.js";
import type { MineClient, SlashCommand } from "@/types";
import { log } from "@/utils/logger";

function walkFiles(directoryPath: string): string[] {
  const entries = readdirSync(directoryPath, { withFileTypes: true });
  const files: string[] = [];

  for (const entry of entries) {
    const fullPath = path.join(directoryPath, entry.name);
    if (entry.isDirectory()) {
      files.push(...walkFiles(fullPath));
      continue;
    }

    if (entry.isFile() && entry.name.endsWith(".js")) {
      files.push(fullPath);
    }
  }

  return files;
}

function commandsListRoute(clientId: string, guildId?: string) {
  return guildId
    ? Routes.applicationGuildCommands(clientId, guildId)
    : Routes.applicationCommands(clientId);
}

function applicationCommandDeleteRoute(
  clientId: string,
  commandId: string,
  guildId?: string,
) {
  return guildId
    ? Routes.applicationGuildCommand(clientId, guildId, commandId)
    : Routes.applicationCommand(clientId, commandId);
}

/** REST body is JSON.stringify'd; PermissionFlagsBits etc. are bigint in d.js v14. */
function applicationCommandsJsonBody(commands: SlashCommand[]): SlashCommand[] {
  return JSON.parse(
    JSON.stringify(commands, (_key, value: unknown) =>
      typeof value === "bigint" ? value.toString() : value,
    ),
  ) as SlashCommand[];
}

async function cleanupOldCommands(
  rest: REST,
  clientId: string,
  guildId: string | undefined,
  validNames: Set<string>,
): Promise<void> {
  const existing = (await rest.get(
    commandsListRoute(clientId, guildId),
  )) as RESTGetAPIApplicationCommandsResult;

  for (const command of existing) {
    if (!validNames.has(command.name)) {
      await rest.delete(
        applicationCommandDeleteRoute(clientId, command.id, guildId),
      );
      log("info", "commands", `Removed stale command ${command.name}`);
    }
  }
}

async function resetCommandsIfRequested(
  rest: REST,
  clientId: string,
  guildId: string | undefined,
): Promise<void> {
  if (process.env.RESET_SLASH_COMMANDS_ON_START !== "true") {
    return;
  }

  await rest.put(commandsListRoute(clientId, guildId), { body: [] });
  log(
    "warn",
    "commands",
    guildId
      ? `Reset guild application commands for ${guildId} before registration`
      : "Reset all global application commands before registration",
  );

  /** 길드 명령만 비우면 글로벌 명령이 남아 `/` 메뉴에 중복으로 표시될 수 있음 */
  if (guildId) {
    await rest.put(Routes.applicationCommands(clientId), { body: [] });
    log(
      "warn",
      "commands",
      "RESET: cleared GLOBAL application commands too (DEV_GUILD_ID was set).",
    );
  }
}

/** Discord returns 403 / code 20012 if CLIENT_ID does not match the application that issued TOKEN. */
async function assertTokenMatchesClientId(
  rest: REST,
  clientId: string,
): Promise<void> {
  const app = (await rest.get(Routes.oauth2CurrentApplication())) as {
    id: string;
  };
  if (app.id !== clientId) {
    throw new Error(
      `TOKEN과 CLIENT_ID가 서로 다른 앱입니다 (토큰 앱 id: ${app.id}, .env의 CLIENT_ID: ${clientId}). ` +
        "https://discord.com/developers/applications 에서 **같은 봇 앱**을 연 뒤, OAuth2의 Client ID를 CLIENT_ID에, Bot 탭의 Token을 TOKEN에 넣으세요.",
    );
  }
}

export default async function loadSlashCommands(
  client: MineClient,
): Promise<void> {
  const commandsRoot = path.join(__dirname, "../commands");
  const commandFiles = walkFiles(commandsRoot);
  const slashCommands: SlashCommand[] = [];
  let commandCount = 0;

  for (const filePath of commandFiles) {
    try {
      const moduleValue = require(filePath) as
        | SlashCommand
        | { default: SlashCommand };
      const command: SlashCommand =
        "default" in moduleValue ? moduleValue.default : moduleValue;

      if (!command.name || !command.description) {
        log(
          "warn",
          "commands",
          `Skipping ${path.basename(filePath)} because it is missing name or description`,
        );
        continue;
      }

      const relativeDirectory = path.dirname(
        path.relative(commandsRoot, filePath),
      );
      const category = command.category ?? path.basename(relativeDirectory);
      command.category = category;

      slashCommands.push(command);
      commandCount += 1;
    } catch (error) {
      log(
        "error",
        "commands",
        `Failed to load ${path.basename(filePath)}`,
        error,
      );
    }
  }

  /** 같은 `name`이 두 번 들어가면 Discord가 50035 DUPLICATE_NAME — 빌드 산출물(dist) 중복 등 */
  const byName = new Map<string, SlashCommand>();
  for (const command of slashCommands) {
    if (byName.has(command.name)) {
      log(
        "warn",
        "commands",
        `Duplicate slash name "${command.name}" — keeping last-loaded file, drop earlier`,
      );
    }
    byName.set(command.name, command);
  }
  const uniqueSlash = [...byName.values()];
  client.slashCommands.clear();
  for (const command of uniqueSlash) {
    client.slashCommands.set(command.name, command);
  }

  const dupSkipped = slashCommands.length - uniqueSlash.length;
  log(
    "success",
    "commands",
    dupSkipped > 0
      ? `Loaded ${commandCount} command files (${uniqueSlash.length} slash, ${dupSkipped} duplicate name dropped)`
      : `Loaded ${commandCount} command files (${uniqueSlash.length} slash commands)`,
  );

  if (!client.config.clientid) {
    throw new Error("Missing client ID in the bot configuration.");
  }

  const token = process.env.TOKEN;
  if (!token) {
    throw new Error("Missing TOKEN in environment variables.");
  }

  const rest = new REST({ version: "10" }).setToken(token);
  const devGuildRaw = process.env.DEV_GUILD_ID?.trim();
  const devGuildIds = devGuildRaw
    ? devGuildRaw
        .split(",")
        .map((id) => id.trim())
        .filter((id) => /^\d{17,22}$/.test(id))
    : [];

  await assertTokenMatchesClientId(rest, client.config.clientid);

  const primaryDevGuildId = devGuildIds[0];
  await resetCommandsIfRequested(
    rest,
    client.config.clientid,
    primaryDevGuildId,
  );

  const commandJson = applicationCommandsJsonBody(uniqueSlash);
  const validNames = new Set(uniqueSlash.map((command) => command.name));

  for (const gid of devGuildIds) {
    await cleanupOldCommands(rest, client.config.clientid, gid, validNames);
    await rest.put(
      Routes.applicationGuildCommands(client.config.clientid, gid),
      { body: commandJson },
    );
    log(
      "success",
      "commands",
      `Registered ${uniqueSlash.length} guild slash commands for guild ${gid} (즉시 반영)`,
    );
  }

  // 글로벌 명령 전체 덮어쓰기(등록 해제된 이름 제거). DEV_GUILD_ID가 있어도 글로벌은 비우지 않음.
  await cleanupOldCommands(rest, client.config.clientid, undefined, validNames);
  await rest.put(Routes.applicationCommands(client.config.clientid), {
    body: commandJson,
  });
  log(
    "success",
    "commands",
    `Registered ${uniqueSlash.length} global slash commands (전 서버, 반영 ~1h)`,
  );

  if (devGuildIds.length > 0) {
    log(
      "info",
      "commands",
      `DEV_GUILD_ID: ${devGuildIds.length}개 길드는 즉시, 나머지는 글로벌 대기.`,
    );
  }
}
