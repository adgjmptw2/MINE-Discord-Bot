import { useEffect, useRef, useState } from "react";
import { removeSoundroomQueueItem, swapSoundroomQueueItems } from "../api";
import {
  isControlUnauthorized,
  isQueueItemChangedError,
  mapQueueRemoveError,
  mapQueueSwapError,
  QUEUE_ITEM_CHANGED_UI,
} from "../controlErrors";
import { useTransientNotice } from "../hooks/useTransientNotice";
import { formatDurationMs } from "../format";
import { isStaleGuild } from "../utils/requestGuards";
import type {
  SoundroomGuildStateDto,
  SoundroomQueueItemDto,
} from "../types";

type QueueListProps = {
  queue: SoundroomQueueItemDto[];
  guildId: string;
  currentUserId: string;
  canModifyQueue: boolean;
  disabledReason?: string | null;
  onStateChange: (state: SoundroomGuildStateDto) => void;
  onQueueChanged?: () => void;
  onRefreshPanel?: () => void;
  onUnauthorized?: () => void;
  onUserActionStart?: () => void;
  onUserActionEnd?: () => void;
};

type SwapPair = { from: number; to: number };

function itemKey(item: SoundroomQueueItemDto): string {
  return `${item.index}-${item.uri ?? item.title}`;
}

function isInSwapPair(index: number, pair: SwapPair | null): boolean {
  return pair != null && (index === pair.from || index === pair.to);
}

export function QueueList({
  queue,
  guildId,
  currentUserId,
  canModifyQueue,
  disabledReason = null,
  onStateChange,
  onQueueChanged,
  onRefreshPanel,
  onUnauthorized,
  onUserActionStart,
  onUserActionEnd,
}: QueueListProps) {
  const [removingIndex, setRemovingIndex] = useState<number | null>(null);
  const [swapPair, setSwapPair] = useState<SwapPair | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [queueConflict, setQueueConflict] = useState(false);
  const [refreshingConflict, setRefreshingConflict] = useState(false);
  const { message: success, show: showSuccess, clear: clearSuccess } =
    useTransientNotice();
  const guildIdRef = useRef(guildId);

  useEffect(() => {
    guildIdRef.current = guildId;
    setRemovingIndex(null);
    setSwapPair(null);
    setError(null);
    setQueueConflict(false);
    clearSuccess();
  }, [guildId, clearSuccess]);

  const queueBusy = removingIndex != null || swapPair != null;
  const showMoveControls = canModifyQueue && queue.length >= 2;

  const withUserAction = async (fn: () => Promise<void>) => {
    onUserActionStart?.();
    try {
      await fn();
    } finally {
      onUserActionEnd?.();
    }
  };

  const handleRemove = async (item: SoundroomQueueItemDto) => {
    if (!canModifyQueue || queueBusy) {
      return;
    }
    if (!item.requesterId || item.requesterId !== currentUserId) {
      return;
    }

    const gid = guildIdRef.current;
    setRemovingIndex(item.index);
    setError(null);
    setQueueConflict(false);

    await withUserAction(async () => {
      try {
        const res = await removeSoundroomQueueItem(gid, {
          queueIndex: item.index,
          expectedUri: item.uri,
          expectedTitle: item.title,
        });
        if (isStaleGuild(gid, guildIdRef.current)) {
          return;
        }
        onStateChange(res.state);
        showSuccess(`「${item.title}」을(를) 대기열에서 삭제했습니다.`);
        onQueueChanged?.();
      } catch (err) {
        if (isStaleGuild(gid, guildIdRef.current)) {
          return;
        }
        if (isControlUnauthorized(err)) {
          onUnauthorized?.();
          return;
        }
        const conflict = isQueueItemChangedError(err);
        setQueueConflict(conflict);
        setError(
          conflict ? QUEUE_ITEM_CHANGED_UI : mapQueueRemoveError(err),
        );
      } finally {
        setRemovingIndex(null);
      }
    });
  };

  const handleSwap = async (
    fromItem: SoundroomQueueItemDto,
    toItem: SoundroomQueueItemDto,
  ) => {
    if (!canModifyQueue || queueBusy) {
      return;
    }

    const gid = guildIdRef.current;
    const pair: SwapPair = { from: fromItem.index, to: toItem.index };
    setSwapPair(pair);
    setError(null);
    setQueueConflict(false);

    await withUserAction(async () => {
      try {
        const res = await swapSoundroomQueueItems(gid, {
          fromQueueIndex: fromItem.index,
          toQueueIndex: toItem.index,
          expectedFromUri: fromItem.uri,
          expectedFromTitle: fromItem.title,
          expectedToUri: toItem.uri,
          expectedToTitle: toItem.title,
        });
        if (isStaleGuild(gid, guildIdRef.current)) {
          return;
        }
        onStateChange(res.state);
        showSuccess(
          "대기열 순서를 변경했습니다. 노래채널에 변경 안내가 잠시 표시됩니다.",
        );
        onQueueChanged?.();
      } catch (err) {
        if (isStaleGuild(gid, guildIdRef.current)) {
          return;
        }
        if (isControlUnauthorized(err)) {
          onUnauthorized?.();
          return;
        }
        const conflict = isQueueItemChangedError(err);
        setQueueConflict(conflict);
        setError(
          conflict ? QUEUE_ITEM_CHANGED_UI : mapQueueSwapError(err),
        );
      } finally {
        setSwapPair(null);
      }
    });
  };

  const handleConflictRefresh = () => {
    if (!onRefreshPanel || refreshingConflict) {
      return;
    }
    setRefreshingConflict(true);
    onRefreshPanel();
    window.setTimeout(() => {
      setRefreshingConflict(false);
      setError(null);
      setQueueConflict(false);
    }, 600);
  };

  if (queue.length === 0) {
    return (
      <div className="queue-panel">
        <div className="queue-summary-bar">
          <span className="queue-summary-title">대기열 0곡</span>
        </div>
        {disabledReason && !canModifyQueue ? (
          <p className="queue-disabled-hint muted" role="status">
            {disabledReason}
          </p>
        ) : null}
        <p className="queue-empty">대기열에 곡이 없습니다. 노래 추가에서 신청해 보세요.</p>
      </div>
    );
  }

  return (
    <div className="queue-panel">
      <div className="queue-summary-bar">
        <span className="queue-summary-title">대기열 {queue.length}곡</span>
        <span className="queue-summary-hint muted">
          내가 추가한 곡은 삭제 가능 · 같은 노래채널이면 순서 변경 가능
        </span>
      </div>

      {disabledReason && !canModifyQueue ? (
        <p className="queue-disabled-hint muted" role="status">
          {disabledReason}
        </p>
      ) : null}

      {error ? (
        <div
          className={`queue-notice${queueConflict ? " queue-notice--conflict" : " queue-notice--error"}`}
          role="alert"
        >
          <p className="queue-notice-text">{error}</p>
          {queueConflict && onRefreshPanel ? (
            <button
              type="button"
              className="btn btn-secondary btn-queue-refresh"
              disabled={refreshingConflict || queueBusy}
              onClick={handleConflictRefresh}
            >
              {refreshingConflict ? "새로고침 중…" : "새로고침"}
            </button>
          ) : null}
        </div>
      ) : null}

      {success ? (
        <p className="queue-notice queue-notice--success" role="status">
          {success}
        </p>
      ) : null}

      <div className="queue-scroll-panel">
      <ol className="queue-list queue-list--scroll">
        {queue.map((item, arrayPos) => {
          const owned =
            Boolean(item.requesterId) && item.requesterId === currentUserId;
          const showRemove = owned;
          const prevItem = arrayPos > 0 ? queue[arrayPos - 1] : null;
          const nextItem =
            arrayPos < queue.length - 1 ? queue[arrayPos + 1] : null;

          const itemPending =
            removingIndex === item.index || isInSwapPair(item.index, swapPair);
          const otherBusy = queueBusy && !itemPending;

          const removeDisabled =
            !canModifyQueue ||
            itemPending ||
            otherBusy ||
            !owned ||
            removingIndex === item.index;

          const canMoveUp = showMoveControls && prevItem != null;
          const canMoveDown = showMoveControls && nextItem != null;
          const moveDisabled =
            !canModifyQueue || itemPending || otherBusy || queueBusy;

          let removeTitle = "대기열에서 삭제";
          if (!canModifyQueue && disabledReason) {
            removeTitle = disabledReason;
          } else if (!owned) {
            removeTitle = "본인이 추가한 곡만 삭제할 수 있습니다";
          } else if (removingIndex === item.index) {
            removeTitle = "삭제 중";
          } else if (isInSwapPair(item.index, swapPair)) {
            removeTitle = "순서 변경 중";
          } else if (otherBusy) {
            removeTitle = "다른 항목 처리 중";
          }

          const moveHint =
            !canModifyQueue && disabledReason
              ? disabledReason
              : isInSwapPair(item.index, swapPair)
                ? "순서 변경 중"
                : removingIndex === item.index
                  ? "삭제 중"
                  : otherBusy
                    ? "다른 항목 처리 중"
                    : "위·아래로 순서 변경";

          return (
            <li
              key={itemKey(item)}
              className={`queue-item${itemPending ? " queue-item--pending" : ""}`}
            >
              <div className="queue-item-main">
                <span className="queue-index">{item.index + 1}</span>
                <span className="queue-body">
                  <span className="queue-title">{item.title}</span>
                  <span className="queue-sub">
                    {item.requesterName ? item.requesterName : "신청자 없음"}
                    {" · "}
                    {formatDurationMs(item.durationMs)}
                  </span>
                </span>
              </div>
              <div className="queue-item-actions">
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
              </div>
            </li>
          );
        })}
      </ol>
      </div>
    </div>
  );
}
