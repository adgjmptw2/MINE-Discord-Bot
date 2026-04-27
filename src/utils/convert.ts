export function convertTime(duration: number): string {
  const totalSeconds = Math.floor(duration / 1000);
  const seconds = totalSeconds % 60;
  const minutes = Math.floor((totalSeconds / 60) % 60);
  const hours = Math.floor(totalSeconds / 3600);

  if (duration < 3_600_000) {
    return `${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`;
  }

  return `${hours.toString().padStart(2, "0")}:${minutes
    .toString()
    .padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`;
}

export function convertNumber(value: number, decimalPlaces: number): string | number {
  const precision = 10 ** decimalPlaces;
  const abbreviations = ["K", "M", "B", "T"];
  let output: string | number = value;

  for (let index = abbreviations.length - 1; index >= 0; index -= 1) {
    const size = 10 ** ((index + 1) * 3);

    if (size <= value) {
      let rounded = Math.round((value * precision) / size) / precision;

      if (rounded === 1000 && index < abbreviations.length - 1) {
        rounded = 1;
        index += 1;
      }

      output = `${rounded}${abbreviations[index]}`;
      break;
    }
  }

  return output;
}

export function chunk<T>(items: T[], size: number): T[][] {
  const output: T[][] = [];

  for (let index = 0; index < items.length; index += size) {
    output.push(items.slice(index, index + size));
  }

  return output;
}

export function convertHmsToMs(hms: string): number {
  const parts = hms.trim().replace(/[. -]/g, ":").split(":");
  let seconds = 0;
  let multiplier = 1;

  while (parts.length > 0) {
    const part = parts.pop();

    if (!part) {
      continue;
    }

    seconds += multiplier * Number.parseInt(part, 10);
    multiplier *= 60;
  }

  return seconds * 1000;
}
