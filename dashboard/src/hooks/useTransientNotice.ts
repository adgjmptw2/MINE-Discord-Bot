import { useCallback, useEffect, useRef, useState } from "react";

const DEFAULT_MS = 4000;

/** 몇 초 뒤 사라지는 안내 문구 */
export function useTransientNotice(ms = DEFAULT_MS) {
  const [message, setMessage] = useState<string | null>(null);
  const timerRef = useRef<number | null>(null);

  const clear = useCallback(() => {
    if (timerRef.current != null) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    setMessage(null);
  }, []);

  const show = useCallback(
    (text: string) => {
      setMessage(text);
      if (timerRef.current != null) {
        window.clearTimeout(timerRef.current);
      }
      timerRef.current = window.setTimeout(() => {
        setMessage(null);
        timerRef.current = null;
      }, ms);
    },
    [ms],
  );

  useEffect(() => clear, [clear]);

  return { message, show, clear };
}
