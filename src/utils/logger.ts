export type LogLevel = "info" | "success" | "warn" | "error" | "debug";

const reset = "\u001b[0m";
const dim = "\u001b[2m";
const bold = "\u001b[1m";

const levelStyle: Record<LogLevel, { glyph: string; color: string }> = {
  success: { glyph: "+", color: "\u001b[38;5;42m" },
  warn: { glyph: "!", color: "\u001b[38;5;214m" },
  error: { glyph: "x", color: "\u001b[38;5;196m" },
  info: { glyph: ">", color: "\u001b[38;5;117m" },
  debug: { glyph: ".", color: "\u001b[38;5;244m" },
};

function clock(): string {
  const d = new Date();
  const z = (n: number, w = 2) => String(n).padStart(w, "0");
  return `${z(d.getHours())}:${z(d.getMinutes())}:${z(d.getSeconds())}.${z(d.getMilliseconds(), 3)}`;
}

export function log(level: LogLevel, scope: string, message: string, extra?: unknown): void {
  const { glyph, color } = levelStyle[level];
  const t = `${dim}${clock()}${reset}`;
  const g = `${bold}${color}${glyph}${reset}`;
  const s = `${dim}${scope.padEnd(11)}${reset}`;
  const line = `${t}  ${g}  ${s} ${message}`;

  if (extra === undefined) {
    console.log(line);
    return;
  }

  console.log(line);
  console.log(`${dim}            ..${reset}`, extra);
}

export function printBanner(): void {
  const brand = "\u001b[38;5;203m";
  const tag = "\u001b[38;5;139m";
  const bar = `${dim}${"=".repeat(52)}${reset}`;

  console.log("");
  console.log(bar);
  console.log(`  ${brand}mine${reset}${tag}-soundroom${reset}   ${dim}music / queue / voice${reset}`);
  console.log(`  ${dim}ready.${reset}`);
  console.log(bar);
  console.log("");
}
