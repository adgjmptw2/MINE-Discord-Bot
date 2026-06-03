import { useCallback, useEffect, useState } from "react";
import {
  readBooleanPreference,
  writeBooleanPreference,
} from "../utils/storage";

function resolveInitial(
  key: string | undefined,
  defaultValue: boolean,
): boolean {
  if (!key) {
    return defaultValue;
  }
  return readBooleanPreference(key) ?? defaultValue;
}

export function useLocalStorageBoolean(
  key: string | undefined,
  defaultValue: boolean,
): [boolean, (next: boolean | ((prev: boolean) => boolean)) => void] {
  const [value, setValue] = useState(() => resolveInitial(key, defaultValue));

  useEffect(() => {
    if (!key) {
      setValue(defaultValue);
      return;
    }
    setValue(readBooleanPreference(key) ?? defaultValue);
  }, [key]);

  useEffect(() => {
    if (!key) {
      return;
    }
    if (readBooleanPreference(key) != null) {
      return;
    }
    setValue(defaultValue);
  }, [key, defaultValue]);

  const setStored = useCallback(
    (next: boolean | ((prev: boolean) => boolean)) => {
      setValue((prev) => {
        const resolved = typeof next === "function" ? next(prev) : next;
        if (key) {
          writeBooleanPreference(key, resolved);
        }
        return resolved;
      });
    },
    [key],
  );

  return [value, setStored];
}
