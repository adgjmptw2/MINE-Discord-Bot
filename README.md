# 마인 Discord 봇

개인 서버에서 쓰기 좋게 다듬은 Discord 음악 봇입니다. **전용 노래 채널(Soundroom)** 중심으로 재생하고, 플레이리스트·인기차트·슬래시 명령 일부만 남긴 가벼운 구성입니다.

## 스크린샷

노래 채널 패널:

![노래 채널 패널](docs/readme-soundroom-panel.png)

지금 재생 중 · 대기열:

![지금 재생 중 · 대기열](docs/readme-player-and-queue.png)

## 기능

- **노래 채널(Soundroom)**: `/세팅`으로 전용 텍스트 채널과 패널을 만든 뒤, **채팅 검색어·패널 버튼·대기열 패널·(일반 채널의) 플레이어 버튼**으로 재생·대기열·일시정지 등을 조작합니다. 레포에는 `/play`·24/7·가사·Top.gg 투표 같은 **일반 음악봇용 슬래시 루트는 넣지 않았습니다.**
- 플레이리스트: **`/playlist`**(한국어 표기: **`/플레이리스트`**) 한 개만 등록합니다. 서브커맨드는 `create` / `add` / `load` / `view` / `remove` / `delete`입니다.
- 인기차트: **전역** 유튜브 재생목록 하나입니다. `.env`의 `DISCORD_OWNER_IDS`에 넣은 **제작자만** `/melon_chart`(또는 `/인기차트-관리`)로 등록·해제할 수 있습니다. 등록해 두면 **모든 서버**의 노래 채널 **[인기차트]** 버튼이 같은 목록을 재생합니다.
- SQLite 저장소: 서버 설정, 최근 재생, 플레이리스트를 저장합니다. 런타임 DB는 레포 루트 **`/storage/`**에 두고, `*.sqlite`는 `.gitignore`에 포함했습니다. 저장소 파일을 커밋했다면 `git rm --cached -r --ignore-unmatch storage/*.sqlite`로 한 번 정리한 뒤 다시 커밋하면 됩니다.
- **주식(Twelve Data Api 모의투자)** 테스트 중
env/config/종목 상수
Mock 가격 Provider

## 준비

1. Node.js 20 이상을 설치합니다.
2. Lavalink 서버를 준비합니다.
3. `.env.example`을 복사해서 `.env`를 만들고 값을 채웁니다.

```bash
npm install
npm run start:bot
```

`start:bot`과 `start`는 실행 전에 자동으로 `build`를 돌립니다. `dist`만 갱신하려면 `npm run build`만 실행하면 됩니다.

**패키지 매니저:** 기본은 **npm**(`package-lock.json`)입니다. Bun으로도 실행할 수 있어 **`bun.lock`**도 함께 두었습니다. 둘 중 하나만 사용해도 되고, 둘 다 맞추려면 `npm install`과 `bun install`을 각각 실행하면 됩니다.

Bun 예시:

```bash
bun install
bun run start:bot:bun
```
