export function LoadingState({ label = "불러오는 중…" }: { label?: string }) {
  return (
    <div className="loading-state" role="status">
      <div className="spinner" aria-hidden="true" />
      <p>{label}</p>
    </div>
  );
}
