import { ApplicationCommandOptionType } from "discord.js";
import { panelReply } from "@/utils/discord";
import type { SlashCommand } from "@/types";

const CAT_ALL = "전체";
const CAT_MUSIC = "음악";
const CAT_COIN = "코인";
const CAT_STOCK = "주식";
const CAT_GAME = "게임";
const CAT_SEASON = "시즌";
const CAT_ADMIN = "관리자";

const DISCLAIMER = [
  "—",
  "코인·주식·게임은 서버 내 가상 기능입니다. 실제 돈·현물·환전과 무관합니다.",
  "주식 시세는 모의투자용 캐시이며 실제 투자 판단에 쓰이지 않습니다.",
];

function linesCoinSummary(): string[] {
  return [
    "### 🪙 코인",
    "`/출석` — 하루 1회 코인을 받습니다.",
    "`/알바` — 30분마다 기본 활동 보상(500~2,000 코인).",
    "`/낚시` — 쿨다운마다 낚시로 코인을 법니다.",
    "`/미션` — 오늘의 코인 미션 진행도를 확인합니다.",
    "`/상점` — 코인으로 구매할 수 있는 아이템을 확인합니다.",
    "`/구매` — 상점 아이템을 구매합니다.",
    "`/내아이템` — 보유 아이템과 장착 상태를 확인합니다.",
    "`/칭호장착` — 보유한 칭호를 장착합니다.",
    "`/칭호해제` — 현재 칭호를 해제합니다.",
    "`/자산` — 내 총 잔액을 확인합니다.",
    "`/프로필` — 유저의 코인 프로필을 확인합니다.",
    "`/랭킹` — 서버 코인 랭킹을 확인합니다.",
  ];
}

function linesStockSummary(): string[] {
  return [
    "### 📈 주식",
    "`/주식목록` — 지원 종목과 시세를 확인합니다.",
    "`/시세` — 특정 종목 시세를 확인합니다.",
    "`/매수` · `/매도` — 코인으로 매수·매도합니다.",
    "`/주식자산` — 내 보유·평가를 자세히 확인합니다.",
  ];
}

function linesGameSummary(): string[] {
  return [
    "### 🎮 게임",
    "`/가위바위보` — 코인을 걸고 봇과 가위바위보합니다.",
    "`/게임기록` — 최근 미니게임 기록을 확인합니다.",
  ];
}

function linesSeasonSummary(): string[] {
  return [
    "### 🏁 시즌",
    "`/시즌정보` — 현재·최근 종료 시즌을 확인합니다.",
  ];
}

function buildOverview(): string[] {
  return [
    ...linesCoinSummary(),
    "",
    ...linesStockSummary(),
    "",
    ...linesGameSummary(),
    "",
    ...linesSeasonSummary(),
    "",
    "관리자·음악 상세는 `/도움말`에 **카테고리** 옵션을 주세요.",
    "",
    ...DISCLAIMER,
  ];
}

function buildCoinDetail(): string[] {
  return [
    "### 🪙 코인",
    "`/출석` — 하루 1회 코인을 받습니다.",
    "`/알바` — 30분마다 기본 활동 보상(500~2,000 코인).",
    "`/낚시` — 쿨다운마다 낚시로 코인을 법니다.",
    "`/미션` — 오늘의 코인 미션 진행도를 확인합니다.",
    "`/상점` — 코인으로 구매할 수 있는 아이템을 확인합니다.",
    "`/구매` — 상점 아이템을 구매합니다.",
    "`/내아이템` — 보유 아이템과 장착 상태를 확인합니다.",
    "`/칭호장착` — 보유한 칭호를 장착합니다.",
    "`/칭호해제` — 현재 칭호를 해제합니다.",
    "`/자산` — 내 총 잔액을 공개 메시지로 확인합니다.",
    "`/프로필` — 유저의 코인 프로필을 확인합니다.",
    "`/랭킹` — 서버 코인 랭킹을 확인합니다.",
    "",
    "서버별 출석 보상·가위바위보 베팅 한도·쿨다운은 **`/코인설정`**(관리자)에서 바꿉니다.",
    "",
    ...DISCLAIMER,
  ];
}

function buildStockDetail(): string[] {
  return [
    "### 📈 주식",
    "`/주식목록` — 지원 종목·ANSI 시세 블록을 봅니다.",
    "`/시세` — 종목별 캐시 시세를 봅니다.",
    "`/매수` — 코인으로 매수합니다.",
    "`/매도` — 금액·비율·전부 등으로 매도합니다.",
    "`/주식자산` — 현금·보유·평가·수익률을 본인만(ephemeral) 확인합니다.",
    "",
    "시세는 봇이 주기적으로 갱신하는 **메모리 캐시** 기준이며, 실제 투자용 데이터가 아닙니다.",
    "",
    ...DISCLAIMER,
  ];
}

function buildGameDetail(): string[] {
  return [
    "### 🎮 게임",
    "`/가위바위보` — 코인을 걸고 봇과 가위바위보합니다.",
    "`/게임기록` — 최근 미니게임 기록을 확인합니다(ephemeral).",
    "",
    "베팅 허용 범위·쿨다운은 **`/코인설정`**에 저장된 서버 설정을 따릅니다.",
    "",
    ...DISCLAIMER,
  ];
}

function buildSeasonDetail(): string[] {
  return [
    "### 🏁 시즌",
    "`/시즌정보` — 진행 중인 시즌과 최근 종료 시즌 요약을 봅니다.",
    "`/시즌시작` — 새 시즌을 시작합니다. **(관리자·봇 운영자)**",
    "`/시즌종료` — 랭킹을 저장하고 시즌을 종료합니다. **(관리자·봇 운영자)**",
    "",
    "시즌 종료 후 **지갑·주식 데이터가 자동으로 초기화되지는 않습니다.**",
    "",
    ...DISCLAIMER,
  ];
}

function buildAdminDetail(): string[] {
  return [
    "### 🛡️ 관리자",
    "아래 명령은 **서버 관리자(Administrator 또는 ManageGuild) 또는 봇 운영자**만 사용할 수 있습니다.",
    "",
    "`/코인설정` — 출석 보상·가위바위보 한도·쿨다운 조회·변경",
    "`/코인지급` · `/코인차감` — 유저 코인 조정",
    "`/유저초기화` · `/서버초기화` — 모의투자 데이터 초기화",
    "`/시즌시작` · `/시즌종료` — 시즌 운영",
    "",
    ...DISCLAIMER,
  ];
}

function buildMusicDetail(): string[] {
  return [
    "### 🎵 음악 · Soundroom",
    "`/세팅` — 전용 음악 채널(Soundroom)과 컨트롤 패널을 만듭니다.",
    "  · 슬래시 **등록 별칭**: `노래채널`, `music_lounge`, `music-lounge` → 동일 동작",
    "",
    "`/playlist` — 저장 플레이리스트(create, add, load, view, remove, delete).",
    "  · 디스코드에 한글 등록명이 있으면 **`/플레이리스트`**로 보일 수 있습니다.",
    "",
    "`/melon_chart` — 모든 서버 [인기차트]에 쓸 유튜브 재생목록 등록·해제.",
    "  · 한글 등록명 **`/인기차트-관리`** — **봇 제작자만** 사용 가능",
    "",
    "재생·대기열 조작은 **Soundroom 패널 버튼**을 주로 사용합니다.",
    "Soundroom으로 지정된 텍스트 채널에서는 **일부 슬래시(예: 주식)** 가 제한될 수 있습니다.",
    "",
    "—",
    "코인·주식·게임 안내는 `/도움말 카테고리:코인` 등에서 확인하세요.",
  ];
}

const command: SlashCommand = {
  name: "도움말",
  description: "봇의 주요 명령어와 사용법을 확인합니다.",
  category: "utility",
  guildOnly: false,
  options: [
    {
      type: ApplicationCommandOptionType.String,
      name: "카테고리",
      description: "보고 싶은 도움말 범위",
      required: false,
      choices: [
        { name: "전체", value: CAT_ALL },
        { name: "음악", value: CAT_MUSIC },
        { name: "코인", value: CAT_COIN },
        { name: "주식", value: CAT_STOCK },
        { name: "게임", value: CAT_GAME },
        { name: "시즌", value: CAT_SEASON },
        { name: "관리자", value: CAT_ADMIN },
      ],
    },
  ],

  async run(_client, interaction) {
    const raw = interaction.options.getString("카테고리");
    const cat = !raw || raw === CAT_ALL ? CAT_ALL : raw;

    let lines: string[];
    switch (cat) {
      case CAT_MUSIC:
        lines = buildMusicDetail();
        break;
      case CAT_COIN:
        lines = buildCoinDetail();
        break;
      case CAT_STOCK:
        lines = buildStockDetail();
        break;
      case CAT_GAME:
        lines = buildGameDetail();
        break;
      case CAT_SEASON:
        lines = buildSeasonDetail();
        break;
      case CAT_ADMIN:
        lines = buildAdminDetail();
        break;
      default:
        lines = buildOverview();
        break;
    }

    await interaction.reply(
      panelReply({
        ephemeral: false,
        panel: {
          title: "📘 MINE 봇 도움말",
          lines,
        },
      }),
    );
  },
};

export default command;
