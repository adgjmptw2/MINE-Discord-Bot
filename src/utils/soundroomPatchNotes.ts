export const SR_PATCH_NOTES_CUSTOM_ID = "sr_patch_notes";

const PATCH_NOTES_DELETE_MS = 30_000;
const DISCORD_CONTENT_MAX = 2000;

export interface SoundroomPatchNote {
  icon: string;
  timestamp: string;
  title: string;
  detail?: string;
}

/** 최신 항목이 위에 오도록 관리합니다. */
export const SOUNDROOM_PATCH_NOTES: SoundroomPatchNote[] = [
  {
    icon: "🔎",
    timestamp: "5월 25일 15:00",
    title: "웹 노래 검색·추가 API",
    detail: "대시보드용 검색·대기열 추가 백엔드 (UI는 다음 단계)",
  },
  {
    icon: "🔁",
    timestamp: "5월 25일 14:00",
    title: "웹 대시보드 자동재생 토글",
    detail: "같은 음성 채널에서 자동재생 켜기·끄기 지원",
  },
  {
    icon: "🎛️",
    timestamp: "5월 25일 13:30",
    title: "웹 대시보드 음악 조작",
    detail: "일시정지·스킵·정지·볼륨·조작 가능 여부 안내",
  },
  {
    icon: "🟢",
    timestamp: "5월 25일 12:00",
    title: "패치노트 버튼 추가",
    detail:
      "Soundroom 패널에서 최근 변경 내역을 본인에게만 확인할 수 있게 추가",
  },
  {
    icon: "🔧",
    timestamp: "5월 25일 09:30",
    title: "스킵 후 패널 동기화 수정",
    detail: "빠른 스킵 시 제목·게이지가 이전 곡으로 남던 문제 수정",
  },
  {
    icon: "🌐",
    timestamp: "5월 25일 09:10",
    title: "웹 대시보드 OAuth 로그인 API 추가",
    detail: "Discord 로그인, 세션, 서버 목록 조회 API 추가",
  },
  {
    icon: "📡",
    timestamp: "5월 25일 08:40",
    title: "Soundroom 상태 조회 API 추가",
    detail: "/health, 재생 상태, 대기열 읽기 전용 API 추가",
  },
  {
    icon: "🎵",
    timestamp: "5월 25일 08:00",
    title: "Riffy fallback 오류 해결",
    detail: "Spotify URL과 ytsearch가 섞이던 Lavalink 오류 수정",
  },
  {
    icon: "↩️",
    timestamp: "5월 24일 18:00",
    title: "패널 UI 롤백",
  },
  {
    icon: "🎨",
    timestamp: "5월 24일 15:00",
    title: "노래 패널 UI 변경",
  },
  {
    icon: "🛠️",
    timestamp: "5월 24일 12:00",
    title: "음악 채널 UI 수정",
  },
  {
    icon: "♻️",
    timestamp: "5월 24일 10:00",
    title: "패널 자동 갱신",
    detail: "봇 재시작 또는 패널 유실 시 Soundroom 패널 복구",
  },
];

function formatNoteBlock(note: SoundroomPatchNote): string {
  const head = `${note.icon} ${note.timestamp}\n${note.title}`;
  return note.detail ? `${head}\n└ ${note.detail}` : head;
}

export function formatSoundroomPatchNotes(limit = 10): string {
  const notes = SOUNDROOM_PATCH_NOTES.slice(0, limit);

  if (notes.length === 0) {
    return "📝 Soundroom 패치노트\n\n아직 표시할 패치노트가 없습니다.";
  }

  const footer = "30초 뒤 이 메시지는 자동 삭제됩니다.";
  const header = "📝 Soundroom 패치노트";
  const allBlocks = notes.map(formatNoteBlock);

  const buildBody = (blocks: string[], truncated: boolean): string => {
    const parts: string[] = [header, ""];
    if (blocks.length > 0) {
      parts.push(blocks.join("\n\n"));
    }
    if (truncated) {
      parts.push("", "…", "최근 일부만 표시됩니다.");
    }
    parts.push("", footer);
    return parts.join("\n");
  };

  let included = allBlocks;
  let body = buildBody(included, false);

  if (body.length > DISCORD_CONTENT_MAX) {
    included = [];
    for (const block of allBlocks) {
      const trial = buildBody([...included, block], true);
      if (trial.length > DISCORD_CONTENT_MAX) {
        break;
      }
      included.push(block);
    }
    if (included.length === 0) {
      included = [allBlocks[0]!.slice(0, 400)];
    }
    body = buildBody(included, included.length < allBlocks.length);
  }

  if (body.length > DISCORD_CONTENT_MAX) {
    return `${body.slice(0, DISCORD_CONTENT_MAX - 1)}…`;
  }

  return body;
}

export { PATCH_NOTES_DELETE_MS };
