import { useEffect, useRef, useState } from "react";
import { removeSoundroomQueueItem, swapSoundroomQueueItems } from "../api";
import {
  isControlUnauthorized,
  mapQueueRemoveError,
  mapQueueSwapError,
} from "../controlErrors";
import { formatDurationMs } from "../format";
import type {
  SoundroomGuildStateDto,
  SoundroomQueueItemDto,
} from "../types";

const NOTICE_MS = 4000;

type QueueListProps = {
  queue: SoundroomQueueItemDto[];
  guildId: string;
  currentUserId: string;
  canModifyQueue: boolean;
  disabledReason?: string | null;
  onStateChange: (state: SoundroomGuildStateDto) => void;
  onQueueChanged?: () => void;
  onUnauthorized?: () => void;
};

function itemKey(item: SoundroomQueueItemDto): string {
  return `${item.index}-${item.uri ?? item.title}`;
}

export function QueueList({
  queue,
  guildId,
  currentUserId,
  canModifyQueue,
  disabledReason = null,
  onStateChange,
  onQueueChanged,
  onUnauthorized,
}: QueueListProps) {
  const [removingIndex, setRemovingIndex] = useState<number | null>(null);
  const [swapping, setSwapping] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const guildIdRef = useRef(guildId);
  const noticeTimer = useRef<number | null>(null);

  useEffect(() => {
    guildIdRef.current = guildId;
    setRemovingIndex(null);
    setSwapping(false);
    setError(null);
    setSuccess(null);
  }, [guildId]);

  useEffect(() => {
    return () => {
      if (noticeTimer.current != null) {
        window.clearTimeout(noticeTimer.current);
      }
    };
  }, []);

  const showNotice = (message: string) => {
    setSuccess(message);
    if (noticeTimer.current != null) {
      window.clearTimeout(noticeTimer.current);
    }
    noticeTimer.current = window.setTimeout(() => {
      setSuccess(null);
      noticeTimer.current = null;
    }, NOTICE_MS);
  };

  const busy = removingIndex != null || swapping;
  const showMoveControls = canModifyQueue && queue.length >= 2;

  const handleRemove = async (item: SoundroomQueueItemDto) => {
    if (!canModifyQueue || busy) {
      return;
    }
    if (!item.requesterId || item.requesterId !== currentUserId) {
      return;
    }

    const gid = guildIdRef.current;
    setRemovingIndex(item.index);
    setError(null);
    try {
      const res = await removeSoundroomQueueItem(gid, {
        queueIndex: item.index,
        expectedUri: item.uri,
        expectedTitle: item.title,
      });
      if (guildIdRef.current !== gid) {
        return;
      }
      onStateChange(res.state);
      showNotice(`「${item.title}」을(를) 대기열에서 삭제했습니다.`);
      onQueueChanged?.();
    } catch (err) {
      if (guildIdRef.current !== gid) {
        return;
      }
      if (isControlUnauthorized(err)) {
        onUnauthorized?.();
        return;
      }
      setError(mapQueueRemoveError(err));
    } finally {
      setRemovingIndex(null);
    }
  };

  const handleSwap = async (
    fromItem: SoundroomQueueItemDto,
    toItem: SoundroomQueueItemDto,
  ) => {
    if (!canModifyQueue || busy) {
      return;
    }

    const gid = guildIdRef.current;
    setSwapping(true);
    setError(null);
    try {
      const res = await swapSoundroomQueueItems(gid, {
        fromQueueIndex: fromItem.index,
        toQueueIndex: toItem.index,
        expectedFromUri: fromItem.uri,
        expectedFromTitle: fromItem.title,
        expectedToUri: toItem.uri,
        expectedToTitle: toItem.title,
      });
      if (guildIdRef.current !== gid) {
        return;
      }
      onStateChange(res.state);
      showNotice(
        "대기열 순서를 변경했습니다. 노래채널에 변경 안내가 잠시 표시됩니다.",
      );
      onQueueChanged?.();
    } catch (err) {
      if (guildIdRef.current !== gid) {
        return;
      }
      if (isControlUnauthorized(err)) {
        onUnauthorized?.();
        return;
      }
      setError(mapQueueSwapError(err));
    } finally {
      setSwapping(false);
    }
  };

  if (queue.length === 0) {
    return (
      <div className="queue-panel">
        {disabledReason && !canModifyQueue ? (
          <p className="queue-disabled-hint muted" role="status">
            {disabledReason}
          </p>
        ) : null}
        <p className="queue-empty">대기열이 비어 있습니다.</p>
      </div>
    );
  }

  return (
    <div className="queue-panel">
      {disabledReason && !canModifyQueue ? (
        <p className="queue-disabled-hint muted" role="status">
          {disabledReason}
        </p>
      ) : null}

      {error ? (
        <p className="queue-action-error" role="alert">
          {error}
        </p>
      ) : null}

      {success ? (
        <p className="queue-action-success" role="status">
          {success}
        </p>
      ) : null}

      <ol className="queue-list">
        {queue.map((item, arrayPos) => {
          const owned =
            Boolean(item.requesterId) && item.requesterId === currentUserId;
          const showRemove = owned;
          const prevItem = arrayPos > 0 ? queue[arrayPos - 1] : null;
          const nextItem =
            arrayPos < queue.length - 1 ? queue[arrayPos + 1] : null;

          const removeDisabled =
            !canModifyQueue || busy || !owned || removingIndex === item.index;

          const canMoveUp = showMoveControls && prevItem != null;
          const canMoveDown = showMoveControls && nextItem != null;
          const moveDisabled = !canModifyQueue || busy || swapping;

          let removeTitle = "대기열에서 삭제";
          if (!canModifyQueue && disabledReason) {
            removeTitle = disabledReason;
          } else if (!owned) {
            removeTitle = "본인이 추가한 곡만 삭제할 수 있습니다";
          } else if (busy && removingIndex !== item.index) {
            removeTitle = "다른 항목 처리 중";
          }

          const moveHint =
            !canModifyQueue && disabledReason
              ? disabledReason
              : swapping
                ? "순서 변경 중"
                : "위·아래로 순서 변경";

          return (
            <li key={itemKey(item)} className="queue-item">
              <span className="queue-index">{item.index + 1}</span>
              <span className="queue-body">
                <span className="queue-title">{item.title}</span>
                <span className="queue-sub">
                  {item.requesterName ? item.requesterName : "신청자 없음"}
                  {" · "}
                  {formatDurationMs(item.durationMs)}
                </span>
              </span>
              <span className="queue-actions">
                {showMoveControls ? (
                  <span className="queue-move-group">
                    <button
                      type="button"
                      className="btn btn-queue-move"
                      disabled={!canMoveUp || moveDisabled}
                      title={moveHint}
                      aria-label={`${item.title} 위로 이동`}
                      onClick={() => {
                        if (prevItem) {
                          void handleSwap(item, prevItem);
                        }
                      }}
                    >
                      ↑
                    </button>
                    <button
                      type="button"
                      className="btn btn-queue-move"
                      disabled={!canMoveDown || moveDisabled}
                      title={moveHint}
                      aria-label={`${item.title} 아래로 이동`}
                      onClick={() => {
                        if (nextItem) {
                          void handleSwap(item, nextItem);
                        }
                      }}
                    >
                      ↓
                    </button>
                  </span>
                ) : null}
                {showRemove ? (
                  <button
                    type="button"
                    className="btn btn-queue-remove"
                    disabled={removeDisabled}
                    title={removeTitle}
                    aria-label={`${item.title} 삭제`}
                    onClick={() => void handleRemove(item)}
                  >
                    {removingIndex === item.index ? "삭제 중…" : "삭제"}
                  </button>
                ) : null}
              </span>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
