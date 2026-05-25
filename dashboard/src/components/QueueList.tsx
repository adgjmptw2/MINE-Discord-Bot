import { formatDurationMs } from "../format";
import type { SoundroomQueueItemDto } from "../types";

type QueueListProps = {
  queue: SoundroomQueueItemDto[];
};

export function QueueList({ queue }: QueueListProps) {
  if (queue.length === 0) {
    return <p className="queue-empty">대기열이 비어 있습니다.</p>;
  }

  return (
    <ol className="queue-list">
      {queue.map((item) => (
        <li key={`${item.index}-${item.title}`} className="queue-item">
          <span className="queue-index">{item.index + 1}</span>
          <span className="queue-body">
            <span className="queue-title">{item.title}</span>
            <span className="queue-sub">
              {item.requesterName ? item.requesterName : "신청자 없음"}
              {" · "}
              {formatDurationMs(item.durationMs)}
            </span>
          </span>
        </li>
      ))}
    </ol>
  );
}
