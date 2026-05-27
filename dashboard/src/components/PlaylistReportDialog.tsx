import { useState } from "react";
import { reportPlaylist } from "../api";
import { isControlUnauthorized, mapPlaylistError } from "../controlErrors";
import { PLAYLIST_REPORT_REASON_OPTIONS } from "../playlistReportLabels";
import type { WebPlaylistReportReason } from "../types";

type PlaylistReportDialogProps = {
  playlistId: string;
  disabled?: boolean;
  onSuccess: () => void;
  onCancel: () => void;
  onUnauthorized?: () => void;
};

export function PlaylistReportDialog({
  playlistId,
  disabled = false,
  onSuccess,
  onCancel,
  onUnauthorized,
}: PlaylistReportDialogProps) {
  const [reason, setReason] = useState<WebPlaylistReportReason | "">("");
  const [detail, setDetail] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async () => {
    if (!reason) {
      setError("신고 사유를 선택해 주세요.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await reportPlaylist(playlistId, {
        reason,
        detail: detail.trim() || undefined,
      });
      onSuccess();
    } catch (err) {
      if (isControlUnauthorized(err)) {
        onUnauthorized?.();
        return;
      }
      setError(mapPlaylistError(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="playlist-report-panel">
      <h5>플레이리스트 신고</h5>
      <p className="muted playlist-report-hint">
        신고는 운영자 확인용이며 자동으로 숨겨지지 않습니다.
      </p>
      <label className="playlist-form-field">
        <span>신고 사유</span>
        <select
          value={reason}
          onChange={(e) =>
            setReason(e.target.value as WebPlaylistReportReason | "")
          }
          disabled={busy || disabled}
        >
          <option value="">선택…</option>
          {PLAYLIST_REPORT_REASON_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </label>
      <label className="playlist-form-field">
        <span>상세 내용 (선택)</span>
        <textarea
          value={detail}
          onChange={(e) => setDetail(e.target.value)}
          maxLength={300}
          rows={3}
          disabled={busy || disabled}
          placeholder="추가 설명이 있으면 입력해 주세요."
        />
      </label>
      <div className="playlist-actions">
        <button
          type="button"
          className="btn btn-danger"
          disabled={busy || disabled}
          onClick={() => void handleSubmit()}
        >
          {busy ? "제출 중…" : "신고 제출"}
        </button>
        <button
          type="button"
          className="btn btn-secondary"
          disabled={busy}
          onClick={onCancel}
        >
          취소
        </button>
      </div>
      {error ? (
        <p className="playlist-error" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
