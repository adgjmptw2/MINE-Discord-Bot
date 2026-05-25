type RefreshStatusProps = {
  loading: boolean;
  lastFetchedAt: Date | null;
  pollPaused?: boolean;
  stateUpdatedAt?: string | null;
};

function formatLastFetched(at: Date | null): string {
  if (!at) {
    return "아직 갱신되지 않음";
  }
  const diff = Date.now() - at.getTime();
  if (diff < 15_000) {
    return "방금 갱신됨";
  }
  return `마지막 갱신: ${at.toLocaleTimeString("ko-KR")}`;
}

export function RefreshStatus({
  loading,
  lastFetchedAt,
  pollPaused = false,
  stateUpdatedAt = null,
}: RefreshStatusProps) {
  let label = formatLastFetched(lastFetchedAt);
  if (loading) {
    label = "갱신 중…";
  } else if (pollPaused) {
    label = "자동 갱신 일시 대기 중";
  }

  return (
    <div className="refresh-status" role="status">
      <span className="refresh-status-label">{label}</span>
      {stateUpdatedAt && !loading ? (
        <span className="refresh-status-meta muted">
          서버 상태 {new Date(stateUpdatedAt).toLocaleTimeString("ko-KR")}
        </span>
      ) : null}
    </div>
  );
}
