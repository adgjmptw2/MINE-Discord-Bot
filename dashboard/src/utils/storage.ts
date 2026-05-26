export function readBooleanPreference(key: string): boolean | null {
  if (typeof window === "undefined") {
    return null;
  }
  try {
    const raw = window.localStorage.getItem(key);
    if (raw === "true") {
      return true;
    }
    if (raw === "false") {
      return false;
    }
    return null;
  } catch {
    return null;
  }
}

export function writeBooleanPreference(key: string, value: boolean): void {
  if (typeof window === "undefined") {
    return;
  }
  try {
    window.localStorage.setItem(key, value ? "true" : "false");
  } catch {
    /* private 모드·용량 초과 등 */
  }
}
