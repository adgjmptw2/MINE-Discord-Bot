import { useState } from "react";
import type { WebPlaylistVisibility } from "../types";

type PlaylistEditorProps = {
  mode: "create" | "edit";
  initialTitle?: string;
  initialDescription?: string;
  initialVisibility?: WebPlaylistVisibility;
  busy?: boolean;
  onSubmit: (values: {
    title: string;
    description: string;
    visibility: WebPlaylistVisibility;
  }) => void;
  onCancel?: () => void;
};

export function PlaylistEditor({
  mode,
  initialTitle = "",
  initialDescription = "",
  initialVisibility = "private",
  busy = false,
  onSubmit,
  onCancel,
}: PlaylistEditorProps) {
  const [title, setTitle] = useState(initialTitle);
  const [description, setDescription] = useState(initialDescription);
  const [visibility, setVisibility] =
    useState<WebPlaylistVisibility>(initialVisibility);

  return (
    <form
      className="playlist-form"
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit({
          title: title.trim(),
          description: description.trim(),
          visibility,
        });
      }}
    >
      <label className="playlist-form-field">
        <span>제목</span>
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          maxLength={40}
          disabled={busy}
          required
        />
      </label>
      <label className="playlist-form-field">
        <span>설명</span>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          maxLength={200}
          rows={3}
          disabled={busy}
        />
      </label>
      <label className="playlist-form-field">
        <span>공개 범위</span>
        <select
          value={visibility}
          onChange={(e) =>
            setVisibility(e.target.value as WebPlaylistVisibility)
          }
          disabled={busy}
        >
          <option value="private">비공개 — 나만 사용</option>
          <option value="public">공개 — 로그인 사용자가 대기열에 추가 가능</option>
        </select>
      </label>
      <div className="playlist-actions">
        <button type="submit" className="btn btn-primary" disabled={busy}>
          {busy ? "저장 중…" : mode === "create" ? "만들기" : "저장"}
        </button>
        {onCancel ? (
          <button
            type="button"
            className="btn btn-secondary"
            disabled={busy}
            onClick={onCancel}
          >
            취소
          </button>
        ) : null}
      </div>
    </form>
  );
}
