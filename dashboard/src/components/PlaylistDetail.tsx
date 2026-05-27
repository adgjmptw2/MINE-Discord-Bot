import { useState } from "react";
import {
  addPlaylistToQueue,
  addTrackToPlaylist,
  deletePlaylist,
  getPlaylistDetail,
  removeTrackFromPlaylist,
  reorderPlaylistTracks,
  updatePlaylist,
} from "../api";
import { isControlUnauthorized, mapPlaylistError } from "../controlErrors";
import { useTransientNotice } from "../hooks/useTransientNotice";
import type {
  SoundroomGuildStateDto,
  WebPlaylistDetailDto,
} from "../types";
import { PlaylistEditor } from "./PlaylistEditor";
import { PlaylistTrackList } from "./PlaylistTrackList";

type PlaylistDetailProps = {
  guildId: string | null;
  playlist: WebPlaylistDetailDto;
  queueAddDisabled: boolean;
  queueAddDisabledReason: string | null;
  onPlaylistChange: (playlist: WebPlaylistDetailDto) => void;
  onDeleted: () => void;
  onStateChange: (state: SoundroomGuildStateDto) => void;
  onUnauthorized?: () => void;
  onAfterQueueChanged?: () => void;
  onUserActionStart?: () => void;
  onUserActionEnd?: () => void;
};

function buildTrackAddRequest(input: string): { query?: string; uri?: string } {
  const trimmed = input.trim();
  if (/^https?:\/\//i.test(trimmed)) {
    return { uri: trimmed };
  }
  return { query: trimmed };
}

function looksLikeStoredPlaylistUrl(input: string): boolean {
  const t = input.trim().toLowerCase();
  return (
    /youtube\.com\/playlist/i.test(t) ||
    /[?&]list=[^&]+/i.test(t) ||
    /soundcloud\.com\/[^/]+\/sets\//i.test(t) ||
    /open\.spotify\.com\/(playlist|album)/i.test(t)
  );
}

export function PlaylistDetail({
  guildId,
  playlist,
  queueAddDisabled,
  queueAddDisabledReason,
  onPlaylistChange,
  onDeleted,
  onStateChange,
  onUnauthorized,
  onAfterQueueChanged,
  onUserActionStart,
  onUserActionEnd,
}: PlaylistDetailProps) {
  const [editing, setEditing] = useState(false);
  const [trackInput, setTrackInput] = useState("");
  const [queueLimit, setQueueLimit] = useState(50);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { message: success, show: showSuccess } = useTransientNotice();

  const runBusy = async (fn: () => Promise<void>) => {
    setBusy(true);
    setError(null);
    onUserActionStart?.();
    try {
      await fn();
    } finally {
      setBusy(false);
      onUserActionEnd?.();
    }
  };

  const handleUpdate = async (values: {
    title: string;
    description: string;
    visibility: "private" | "public";
  }) => {
    await runBusy(async () => {
      try {
        const res = await updatePlaylist(playlist.id, values);
        onPlaylistChange(res.playlist);
        setEditing(false);
        showSuccess("플레이리스트를 저장했습니다.");
      } catch (err) {
        if (isControlUnauthorized(err)) {
          onUnauthorized?.();
          return;
        }
        setError(mapPlaylistError(err));
      }
    });
  };

  const handleDelete = () => {
    if (
      !window.confirm(
        "이 플레이리스트를 삭제할까요? 삭제된 플레이리스트는 목록에서 사라집니다.",
      )
    ) {
      return;
    }
    void runBusy(async () => {
      try {
        await deletePlaylist(playlist.id);
        onDeleted();
      } catch (err) {
        if (isControlUnauthorized(err)) {
          onUnauthorized?.();
          return;
        }
        setError(mapPlaylistError(err));
      }
    });
  };

  const handleAddTrack = async () => {
    const value = trackInput.trim();
    if (!value) {
      setError("곡 URL 또는 검색어를 입력해 주세요.");
      return;
    }
    if (looksLikeStoredPlaylistUrl(value)) {
      setError(
        "재생목록 URL은 저장할 수 없습니다. 단일 곡 URL 또는 검색어를 사용해 주세요.",
      );
      return;
    }
    await runBusy(async () => {
      try {
        await addTrackToPlaylist(playlist.id, buildTrackAddRequest(value));
        const detail = await getPlaylistDetail(playlist.id);
        onPlaylistChange(detail.playlist);
        setTrackInput("");
        showSuccess("곡을 플레이리스트에 추가했습니다.");
      } catch (err) {
        if (isControlUnauthorized(err)) {
          onUnauthorized?.();
          return;
        }
        setError(mapPlaylistError(err));
      }
    });
  };

  const reorderTracks = async (nextIds: string[]) => {
    await runBusy(async () => {
      try {
        const res = await reorderPlaylistTracks(playlist.id, {
          trackIds: nextIds,
        });
        onPlaylistChange({ ...playlist, tracks: res.tracks });
      } catch (err) {
        if (isControlUnauthorized(err)) {
          onUnauthorized?.();
          return;
        }
        setError(mapPlaylistError(err));
      }
    });
  };

  const handleMove = (index: number, delta: number) => {
    const tracks = [...playlist.tracks];
    const target = index + delta;
    if (target < 0 || target >= tracks.length) {
      return;
    }
    const a = tracks[index]!;
    tracks[index] = tracks[target]!;
    tracks[target] = a;
    void reorderTracks(tracks.map((t) => t.id));
  };

  const handleRemoveTrack = (trackId: string) => {
    void runBusy(async () => {
      try {
        await removeTrackFromPlaylist(playlist.id, trackId);
        const detail = await getPlaylistDetail(playlist.id);
        onPlaylistChange(detail.playlist);
        showSuccess("곡을 삭제했습니다.");
      } catch (err) {
        if (isControlUnauthorized(err)) {
          onUnauthorized?.();
          return;
        }
        setError(mapPlaylistError(err));
      }
    });
  };

  const handleAddToQueue = () => {
    if (!guildId) {
      return;
    }
    void runBusy(async () => {
      try {
        const res = await addPlaylistToQueue(guildId, playlist.id, {
          limit: queueLimit,
        });
        onStateChange(res.state);
        const base = `플레이리스트에서 ${res.addedCount}곡을 대기열에 추가했습니다.`;
        showSuccess(
          res.truncated ? `${base} 최대 ${res.limit}곡까지만 추가했습니다.` : base,
        );
        onAfterQueueChanged?.();
      } catch (err) {
        if (isControlUnauthorized(err)) {
          onUnauthorized?.();
          return;
        }
        setError(mapPlaylistError(err));
      }
    });
  };

  return (
    <div className="playlist-detail">
      {editing && playlist.canManage ? (
        <PlaylistEditor
          mode="edit"
          initialTitle={playlist.title}
          initialDescription={playlist.description}
          initialVisibility={playlist.visibility}
          busy={busy}
          onSubmit={(values) => void handleUpdate(values)}
          onCancel={() => setEditing(false)}
        />
      ) : (
        <>
          <header className="playlist-detail-header">
            <div>
              <h4 className="playlist-detail-title">{playlist.title}</h4>
              {playlist.description ? (
                <p className="playlist-detail-desc muted">{playlist.description}</p>
              ) : null}
              <p className="playlist-detail-meta muted">
                {playlist.visibility === "public" ? "공개" : "비공개"}
                {" · "}
                {playlist.ownerNameSnapshot}
                {" · "}
                {playlist.tracks.length}곡
                {playlist.isHiddenByAdmin ? " · 운영자 숨김" : ""}
              </p>
            </div>
            {playlist.canManage ? (
              <div className="playlist-actions playlist-actions--header">
                <button
                  type="button"
                  className="btn btn-secondary"
                  disabled={busy}
                  onClick={() => setEditing(true)}
                >
                  수정
                </button>
                <button
                  type="button"
                  className="btn btn-danger"
                  disabled={busy}
                  onClick={handleDelete}
                >
                  삭제
                </button>
              </div>
            ) : null}
          </header>

          <div className="playlist-queue-add">
            <h5>현재 대기열에 추가</h5>
            {queueAddDisabledReason && queueAddDisabled ? (
              <p className="playlist-disabled-hint muted">{queueAddDisabledReason}</p>
            ) : null}
            <div className="playlist-queue-add-row">
              <label className="playlist-limit-label muted">
                최대
                <select
                  value={queueLimit}
                  onChange={(e) =>
                    setQueueLimit(Number.parseInt(e.target.value, 10))
                  }
                  disabled={busy || queueAddDisabled || !guildId}
                >
                  <option value={10}>10곡</option>
                  <option value={25}>25곡</option>
                  <option value={50}>50곡</option>
                </select>
              </label>
              <button
                type="button"
                className="btn btn-primary"
                disabled={busy || queueAddDisabled || !guildId}
                onClick={handleAddToQueue}
              >
                {busy ? "추가 중…" : "현재 대기열에 추가"}
              </button>
            </div>
          </div>

          {playlist.canManage ? (
            <div className="playlist-track-add">
              <h5>곡 추가</h5>
              <p className="muted playlist-track-add-hint">
                단일 곡 URL 또는 검색어. 재생목록 URL은 지원하지 않습니다.
              </p>
              <div className="playlist-track-add-row">
                <input
                  type="text"
                  className="search-input"
                  value={trackInput}
                  onChange={(e) => setTrackInput(e.target.value)}
                  placeholder="YouTube/Spotify URL 또는 곡 제목"
                  maxLength={300}
                  disabled={busy}
                />
                <button
                  type="button"
                  className="btn btn-secondary"
                  disabled={busy}
                  onClick={() => void handleAddTrack()}
                >
                  곡 추가
                </button>
              </div>
            </div>
          ) : null}

          <PlaylistTrackList
            tracks={playlist.tracks}
            canManage={playlist.canManage}
            busy={busy}
            onMoveUp={(i) => handleMove(i, -1)}
            onMoveDown={(i) => handleMove(i, 1)}
            onRemove={handleRemoveTrack}
          />
        </>
      )}

      {error ? (
        <p className="playlist-error" role="alert">
          {error}
        </p>
      ) : null}
      {success ? (
        <p className="playlist-notice" role="status">
          {success}
        </p>
      ) : null}
    </div>
  );
}
