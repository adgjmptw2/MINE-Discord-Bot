import { useEffect, useRef, useState } from "react";
import { controlSoundroom } from "../api";
import { isControlUnauthorized, mapControlError } from "../controlErrors";
import { ControlStatusNotice } from "./ControlStatusNotice";
import type {
  SoundroomControlAction,
  SoundroomControlStatusResponseDto,
  SoundroomGuildStateDto,
} from "../types";

const MIN_VOLUME = 0;
const MAX_VOLUME = 150;
const NOTICE_MS = 3500;

type SoundroomControlsProps = {
  guildId: string;
  state: SoundroomGuildStateDto;
  controlStatus: SoundroomControlStatusResponseDto | null;
  controlStatusLoading?: boolean;
  controlStatusError?: string | null;
  disabled?: boolean;
  onStateChange: (state: SoundroomGuildStateDto) => void;
  onControlSuccess?: () => void;
  onUnauthorized?: () => void;
  onSkipDone?: () => void;
};

function hasPlayableCurrent(state: SoundroomGuildStateDto): boolean {
  return Boolean(
    state.current && (state.playing || state.paused),
  );
}

function parseVolumeDraft(raw: string): number | null {
  const t = raw.trim();
  if (!/^\d+$/.test(t)) {
    return null;
  }
  const n = Number.parseInt(t, 10);
  if (!Number.isInteger(n) || n < MIN_VOLUME || n > MAX_VOLUME) {
    return null;
  }
  return n;
}

export function SoundroomControls({
  guildId,
  state,
  controlStatus,
  controlStatusLoading = false,
  controlStatusError = null,
  disabled: disabledExternal = false,
  onStateChange,
  onControlSuccess,
  onUnauthorized,
  onSkipDone,
}: SoundroomControlsProps) {
  const [busy, setBusy] = useState(false);
  const [controlError, setControlError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [volumeDraft, setVolumeDraft] = useState(String(Math.round(state.volume)));
  const volumeFocused = useRef(false);
  const noticeTimer = useRef<number | null>(null);

  const canControlByStatus =
    !controlStatusLoading &&
    controlStatus != null &&
    controlStatus.canControl;
  const disabled =
    disabledExternal || busy || controlStatusLoading || !canControlByStatus;
  const canPauseSkip = hasPlayableCurrent(state);
  const canStop = state.playerConnected || Boolean(state.current);
  const canVolume = state.playerConnected;

  useEffect(() => {
    if (!volumeFocused.current) {
      setVolumeDraft(String(Math.round(state.volume)));
    }
  }, [state.volume, state.guildId]);

  useEffect(() => {
    return () => {
      if (noticeTimer.current != null) {
        window.clearTimeout(noticeTimer.current);
      }
    };
  }, []);

  const showNotice = (message: string) => {
    setNotice(message);
    if (noticeTimer.current != null) {
      window.clearTimeout(noticeTimer.current);
    }
    noticeTimer.current = window.setTimeout(() => {
      setNotice(null);
      noticeTimer.current = null;
    }, NOTICE_MS);
  };

  const runControl = async (
    action: SoundroomControlAction,
    body: { action: SoundroomControlAction; volume?: number },
    successNotice: string,
  ) => {
    if (disabled) {
      return;
    }
    setBusy(true);
    setControlError(null);
    try {
      const res = await controlSoundroom(guildId, body);
      onStateChange(res.state);
      onControlSuccess?.();
      showNotice(successNotice);
      if (action === "skip") {
        onSkipDone?.();
      }
    } catch (err) {
      if (isControlUnauthorized(err)) {
        onUnauthorized?.();
        return;
      }
      setControlError(mapControlError(err));
    } finally {
      setBusy(false);
    }
  };

  const handleTogglePause = () => {
    void runControl("togglePause", { action: "togglePause" }, "요청을 보냈습니다.");
  };

  const handleSkip = () => {
    void runControl(
      "skip",
      { action: "skip" },
      "스킵 요청을 보냈습니다. 다음 곡 정보는 잠시 후 갱신됩니다.",
    );
  };

  const handleStop = () => {
    void runControl("stop", { action: "stop" }, "재생을 종료했습니다.");
  };

  const handleApplyVolume = () => {
    const volume = parseVolumeDraft(volumeDraft);
    if (volume === null) {
      setControlError("볼륨 값이 올바르지 않습니다. (0~150)");
      return;
    }
    void runControl(
      "setVolume",
      { action: "setVolume", volume },
      `볼륨을 ${volume}%로 변경했습니다.`,
    );
  };

  return (
    <section className="controls-section" aria-labelledby="controls-heading">
      <h3 id="controls-heading">조작</h3>

      <ControlStatusNotice
        status={controlStatus}
        loading={controlStatusLoading}
        error={controlStatusError}
      />

      <p
        className={`autoplay-badge${state.autoplay ? " autoplay-badge--on" : " autoplay-badge--off"}`}
      >
        자동재생 {state.autoplay ? "ON" : "OFF"}
      </p>

      {notice ? (
        <p className="controls-notice" role="status">
          {notice}
        </p>
      ) : null}
      {controlError ? (
        <p className="controls-error" role="alert">
          {controlError}
        </p>
      ) : null}
      {busy ? (
        <p className="controls-busy muted" role="status">
          조작 요청 중…
        </p>
      ) : null}

      <div className="controls-buttons">
        <button
          type="button"
          className={`btn btn-autoplay${state.autoplay ? " btn-autoplay--on" : ""}`}
          disabled={disabled}
          onClick={() => {
            void runControl(
              "toggleAutoplay",
              { action: "toggleAutoplay" },
              state.autoplay
                ? "자동재생을 껐습니다."
                : "자동재생을 켰습니다.",
            );
          }}
        >
          {state.autoplay ? "자동재생 끄기" : "자동재생 켜기"}
        </button>
        <button
          type="button"
          className="btn btn-secondary"
          disabled={disabled || !canPauseSkip}
          onClick={handleTogglePause}
        >
          {state.paused ? "재생" : "일시정지"}
        </button>
        <button
          type="button"
          className="btn btn-secondary"
          disabled={disabled || !canPauseSkip}
          onClick={handleSkip}
        >
          스킵
        </button>
        <button
          type="button"
          className="btn btn-danger"
          disabled={disabled || !canStop}
          onClick={handleStop}
        >
          정지·대기열 비우기
        </button>
      </div>

      <div className="volume-row">
        <label className="volume-label" htmlFor="volume-input">
          볼륨 ({MIN_VOLUME}~{MAX_VOLUME}%)
        </label>
        <div className="volume-inputs">
          <input
            id="volume-input"
            type="range"
            className="volume-slider"
            min={MIN_VOLUME}
            max={MAX_VOLUME}
            step={1}
            value={Math.min(
              MAX_VOLUME,
              Math.max(
                MIN_VOLUME,
                parseVolumeDraft(volumeDraft) ?? Math.round(state.volume),
              ),
            )}
            disabled={disabled || !canVolume}
            onChange={(e) => setVolumeDraft(e.target.value)}
            onFocus={() => {
              volumeFocused.current = true;
            }}
            onBlur={() => {
              volumeFocused.current = false;
            }}
          />
          <input
            type="number"
            className="volume-number"
            min={MIN_VOLUME}
            max={MAX_VOLUME}
            step={1}
            value={volumeDraft}
            disabled={disabled || !canVolume}
            onChange={(e) => setVolumeDraft(e.target.value)}
            onFocus={() => {
              volumeFocused.current = true;
            }}
            onBlur={() => {
              volumeFocused.current = false;
            }}
          />
          <button
            type="button"
            className="btn btn-secondary"
            disabled={disabled || !canVolume}
            onClick={handleApplyVolume}
          >
            볼륨 적용
          </button>
        </div>
      </div>
    </section>
  );
}
