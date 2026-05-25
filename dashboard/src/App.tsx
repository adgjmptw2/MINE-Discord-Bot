import { useCallback, useEffect, useState } from "react";
import { ApiClientError, getMe } from "./api";
import type { DiscordOAuthUserDto } from "./types";
import { DashboardView } from "./components/DashboardView";
import { ErrorState } from "./components/ErrorState";
import { LoadingState } from "./components/LoadingState";
import { LoginView } from "./components/LoginView";

type AppPhase = "loading" | "login" | "dashboard" | "error";

export function App() {
  const [phase, setPhase] = useState<AppPhase>("loading");
  const [user, setUser] = useState<DiscordOAuthUserDto | null>(null);
  const [errorMessage, setErrorMessage] = useState("");

  const checkSession = useCallback(async (signal?: AbortSignal) => {
    setPhase("loading");
    setErrorMessage("");
    try {
      const res = await getMe(signal);
      setUser(res.user);
      setPhase("dashboard");
    } catch (err) {
      if (signal?.aborted) {
        return;
      }
      if (err instanceof ApiClientError && err.status === 401) {
        setUser(null);
        setPhase("login");
        return;
      }
      const msg =
        err instanceof ApiClientError
          ? err.message
          : "API 서버에 연결할 수 없습니다.";
      setErrorMessage(msg);
      setPhase("error");
    }
  }, []);

  useEffect(() => {
    const ac = new AbortController();
    void checkSession(ac.signal);
    return () => ac.abort();
  }, [checkSession]);

  const handleLogout = () => {
    setUser(null);
    setPhase("login");
  };

  if (phase === "loading") {
    return <LoadingState />;
  }

  if (phase === "login") {
    return <LoginView />;
  }

  if (phase === "error") {
    return (
      <ErrorState message={errorMessage} onRetry={() => void checkSession()} />
    );
  }

  if (!user) {
    return <LoginView />;
  }

  return <DashboardView user={user} onLogout={handleLogout} />;
}
