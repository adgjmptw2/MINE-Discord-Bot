import type { WebPlaylistReportReason } from "./types";

export const PLAYLIST_REPORT_REASON_OPTIONS: {
  value: WebPlaylistReportReason;
  label: string;
}[] = [
  { value: "inappropriate", label: "부적절한 내용" },
  { value: "spam", label: "광고/도배" },
  { value: "misleading", label: "오해를 부르는 제목/설명" },
  { value: "broken", label: "재생 불가/잘못된 곡" },
  { value: "other", label: "기타" },
];

export function playlistReportReasonLabel(
  reason: WebPlaylistReportReason,
): string {
  return (
    PLAYLIST_REPORT_REASON_OPTIONS.find((o) => o.value === reason)?.label ??
    reason
  );
}
