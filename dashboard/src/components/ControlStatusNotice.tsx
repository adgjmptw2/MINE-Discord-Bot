import { controlStatusHeadline } from "../controlErrors";
import type { SoundroomControlStatusResponseDto } from "../types";

type ControlStatusNoticeProps = {
  status: SoundroomControlStatusResponseDto | null;
  loading?: boolean;
  error?: string | null;
};

export function ControlStatusNotice({
  status,
  loading = false,
  error = null,
}: ControlStatusNoticeProps) {
  if (loading) {
    return (
      <div className="control-status control-status--loading" role="status">
        <p>조작 가능 여부 확인 중…</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="control-status control-status--error" role="alert">
        <p>{error}</p>
      </div>
    );
  }

  if (!status) {
    return (
      <div className="control-status control-status--blocked" role="status">
        <p>조작 가능 여부를 확인할 수 없습니다.</p>
      </div>
    );
  }

  const headline = controlStatusHeadline(status.code, status.message);
  const variant = status.canControl
    ? "control-status--ready"
    : "control-status--blocked";

  return (
    <div className={`control-status ${variant}`} role="status">
      <p className="control-status-headline">{headline}</p>
      {status.userVoiceChannelName ? (
        <p className="control-status-voice muted">
          현재 내 채널:{" "}
          <span className="control-status-channel-name">
            {status.userVoiceChannelName}
          </span>
        </p>
      ) : null}
      {status.botVoiceChannelName ? (
        <p className="control-status-voice muted">
          봇 채널:{" "}
          <span className="control-status-channel-name">
            {status.botVoiceChannelName}
          </span>
        </p>
      ) : null}
      {status.code === "NOT_SAME_VOICE_CHANNEL" &&
      status.userVoiceChannelName &&
      status.botVoiceChannelName ? (
        <p className="control-status-voice muted">
          서로 다른 음성 채널에 있습니다.
        </p>
      ) : null}
    </div>
  );
}
