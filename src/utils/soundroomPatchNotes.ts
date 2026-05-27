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
    icon: "🔁",
    timestamp: "5월 26일 18:00",
    title: "자동재생 반복 추천 완화",
    detail:
      "YouTube Mix 계열 URL과 유사 제목 후보에서 같은 노래가 반복되는 문제를 줄이도록 개선",
  },
  {
    icon: "🎵",
    timestamp: "5월 26일 17:00",
    title: "웹 리모컨 재생목록 추가와 조작 안내 강화",
    detail:
      "URL 재생목록을 대기열에 추가하고 웹 리모컨 조작 내역을 노래채널에 잠시 표시",
  },
  {
    icon: "📊",
    timestamp: "5월 26일 16:00",
    title: "랜딩 페이지 운영 현황 추가",
    detail:
      "홈 화면에 공개용 운영 현황 카드와 더 풍성한 소개 섹션을 추가",
  },
  {
    icon: "✨",
    timestamp: "5월 26일 15:00",
    title: "공개 랜딩 페이지 디자인 개선",
    detail:
      "홈 화면을 히어로, 기능 카드, 명령어, 보안 안내가 있는 소개 페이지로 개선",
  },
  {
    icon: "🌐",
    timestamp: "5월 26일 14:00",
    title: "공개 랜딩 페이지와 웹 리모컨 버튼 추가",
    detail:
      "기본 웹 페이지를 소개형 랜딩 페이지로 개선하고 Soundroom 패널에서 웹 리모컨을 바로 열 수 있게 추가",
  },
  {
    icon: "📋",
    timestamp: "5월 26일 13:00",
    title: "운영 전 최종 점검 문서 추가",
    detail:
      "CSRF, preflight, HTTPS, Discord Portal, 백업·롤백 절차를 확인할 수 있는 운영 체크리스트 추가",
  },
  {
    icon: "🛡️",
    timestamp: "5월 26일 12:00",
    title: "웹 대시보드 CSRF 보호 추가",
    detail:
      "로그인 세션 기반 POST 요청에 X-CSRF-Token 검증을 추가해 조작 API 보호를 강화",
  },
  {
    icon: "✅",
    timestamp: "5월 26일 11:00",
    title: "운영 전 대시보드 설정 점검 추가",
    detail:
      "웹 대시보드 운영 전 env, 정적 빌드, 보안 설정을 확인하는 preflight 스크립트 추가",
  },
  {
    icon: "📜",
    timestamp: "5월 26일 10:00",
    title: "개인정보처리방침·이용약관 페이지 추가",
    detail:
      "공개 /privacy·/terms, 대시보드 하단 링크, rate limit·세션 시크릿 검사와 분리",
  },
  {
    icon: "🔒",
    timestamp: "5월 25일 09:00",
    title: "웹 대시보드 보안 하드닝",
    detail:
      "비인증 상태 조회 제한, Secure 쿠키 옵션, 세션 시크릿 검사, 요청 제한을 추가",
  },
  {
    icon: "📋",
    timestamp: "5월 26일 07:00",
    title: "웹 대시보드 운영 배포 가이드",
    detail:
      "개발·정적 서빙·HTTPS reverse proxy 설정 방법과 운영 빌드 스크립트 문서 추가",
  },
  {
    icon: "🌐",
    timestamp: "5월 26일 06:30",
    title: "대시보드 정적 서빙 추가",
    detail:
      "빌드된 대시보드를 봇 웹 API 서버의 /dashboard 경로에서 열 수 있도록 개선",
  },
  {
    icon: "💾",
    timestamp: "5월 26일 06:00",
    title: "대시보드 섹션 접기 상태 저장",
    detail:
      "노래 추가와 대기열 섹션의 접기·펼치기 상태가 새로고침 후에도 유지되도록 개선",
  },
  {
    icon: "📱",
    timestamp: "5월 26일 05:30",
    title: "대시보드 모바일 UX 정리",
    detail:
      "섹션 구조, 대기열 조작 버튼, 갱신 상태 표시를 더 읽기 쉽게 개선",
  },
  {
    icon: "🔄",
    timestamp: "5월 26일 05:00",
    title: "대시보드 대기열 조작 UX 개선",
    detail:
      "대기열 변경 충돌 안내, 갱신 상태 표시, 조작 중 중복 클릭 방지를 개선",
  },
  {
    icon: "↕️",
    timestamp: "5월 26일 04:30",
    title: "대시보드 대기열 순서 변경 UI",
    detail: "웹에서 대기열 곡을 위·아래로 이동하고 노래채널에 변경 안내가 표시되도록 개선",
  },
  {
    icon: "↔️",
    timestamp: "5월 26일 04:00",
    title: "웹 대기열 순서 변경 API",
    detail:
      "같은 노래채널에서 대기열 두 곡 순서를 바꾸고, 변경 내역을 노래채널에 잠시 안내",
  },
  {
    icon: "🗑️",
    timestamp: "5월 26일 03:30",
    title: "대시보드 대기열 삭제 UI",
    detail: "웹에서 본인이 추가한 대기열 곡을 삭제할 수 있게 개선",
  },
  {
    icon: "🗑️",
    timestamp: "5월 26일 03:00",
    title: "웹 대기열 삭제 API",
    detail: "본인이 추가한 대기열 곡을 웹에서 삭제할 수 있도록 백엔드 기반 추가",
  },
  {
    icon: "🎧",
    timestamp: "5월 26일 02:30",
    title: "대시보드 노래 검색·추가 UI",
    detail: "웹 대시보드에서 검색어 또는 URL로 노래를 찾아 대기열에 추가",
  },
  {
    icon: "🔎",
    timestamp: "5월 25일 15:00",
    title: "웹 노래 검색·추가 API",
    detail: "대시보드용 검색·대기열 추가 백엔드",
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
