# 마인 Discord 봇

개인 서버에서 쓰기 좋게 다듬은 Discord 음악 봇입니다.

전용 노래 채널(Soundroom) 중심으로 재생합니다.

플레이리스트·인기차트·슬래시 명령 일부만 남긴 가벼운 구성입니다.

## 스크린샷

노래 채널 패널 이미지

![노래 채널 패널](docs/readme-soundroom-panel.png)

지금 재생 중 · 대기열 이미지

![지금 재생 중 · 대기열](docs/readme-player-and-queue.png)

## 기능

- 노래 채널
- 플레이리스트
- 인기차트
- SQLite 저장소
- 주식 모의투자 게임

문서: [배포 가이드](docs/deployment.md) · [베타 운영 체크리스트](docs/beta-ops-checklist.md)

## 주식 모의투자 게임

서버별 가상 화폐로 국내 인기 주식 5개를 사고파는 모의투자 게임입니다.

실제 돈·환전·현물 보상은 없습니다.

실제 투자 판단에 사용할 수 없습니다.

시세·평가는 지연되거나 부정확할 수 있습니다.

가격 소스는 StockQuoteProvider 구현을 바꿉니다.

mock / yahoo / twelvedata 등으로 교체할 수 있습니다.

### 지원 종목

| 종목 | 종목코드 |
| --- | --- |
| 삼성전자 | 005930 |
| SK하이닉스 | 000660 |
| NAVER | 035420 |
| 카카오 | 035720 |
| 현대차 | 005380 |

### 슬래시 명령어

| 명령어 | 설명 |
| --- | --- |
| /도움말 | 봇의 주요 명령어와 사용법을 확인합니다 |
| /상태 | 봇의 주요 운영 상태를 확인합니다 |
| /출석 | 하루 1회 가상 화폐를 받습니다 |
| /알바 | 일정 시간마다 알바를 해서 코인을 법니다 |
| /낚시 | 일정 시간마다 낚시를 해서 코인을 법니다 |
| /미션 | 오늘의 코인 미션 진행도를 확인합니다 |
| /상점 | 코인으로 구매할 수 있는 아이템을 확인합니다 |
| /구매 | 상점 아이템을 구매합니다 |
| /내아이템 | 보유 아이템과 장착 상태를 확인합니다 |
| /칭호장착 | 구매한 칭호를 장착합니다 |
| /칭호해제 | 장착 중인 칭호를 해제합니다 |
| /프로필 | 유저의 코인 프로필을 확인합니다 |
| /자산 | 내 총 잔액을 공개 메시지로 확인합니다 |
| /주식자산 | 내 주식 보유 현황을 본인만 자세히 확인합니다 |
| /주식목록 | 지원 종목·시세를 ANSI 블록으로 확인합니다 (공개 메시지) |
| /시세 | 특정 종목의 모의투자 시세를 확인합니다 |
| /매수 | 가상 화폐로 주식을 매수합니다 |
| /매도 | 보유 주식을 매도합니다 |
| /랭킹 | 서버 코인 랭킹을 확인합니다 (표시는 `<@userId>` 형태이나 응답에 `allowedMentions`로 알림 없음) |
| /코인지급 | 관리자가 유저에게 코인을 지급합니다 |
| /코인차감 | 관리자가 유저의 코인을 차감합니다 |
| /유저초기화 | 관리자가 특정 유저의 코인/주식 데이터를 초기화합니다 |
| /서버초기화 | 관리자가 이 서버의 코인/주식 데이터를 전체 초기화합니다 |
| /시즌시작 | 관리자가 서버 코인 랭킹 시즌을 시작합니다 |
| /시즌종료 | 현재 시즌을 종료하고 랭킹 결과를 저장합니다 |
| /시즌정보 | 현재 시즌과 최근 종료 시즌 정보를 확인합니다 |
| /가위바위보 | 코인을 걸고 봇과 가위바위보를 합니다 |
| /게임기록 | 최근 코인 미니게임 기록을 확인합니다 |
| /코인설정 | 서버 코인 경제 설정을 확인하거나 변경합니다 |

`<@id>`는 클라이언트에서 멘션처럼 보이지만, 응답 옵션으로 자동 멘션·알림을 끕니다.

### 환경 변수

| 변수 | 설명 |
| --- | --- |
| STOCK_PRICE_PROVIDER | mock, yahoo, twelvedata 중 하나 |
| STOCK_PRICE_REFRESH_INTERVAL_MS | 기본 300000ms, 5분 (`interval` 모드에서 사용) |
| STOCK_PRICE_REFRESH_MODE | `interval`(기본) 또는 `scheduled-close` |
| STOCK_SCHEDULED_CLOSE_REFRESH_TIMES_KST | `scheduled-close`일 때만 사용. 쉼표로 구분한 KST `HH:mm` 목록 |
| TWELVE_DATA_API_KEY | twelvedata 사용 시 필요 |

### 개발·테스트 순서

1. .env에서 STOCK_PRICE_PROVIDER=mock 설정
2. npm run check
3. npm run build
4. npm run start:bot
5. Discord 일반 채널에서 /출석
6. /주식목록
7. /시세 종목:삼성전자
8. /매수 종목:삼성전자 금액:5000
9. /자산
10. /주식자산
11. /매도 종목:삼성전자 매도:50%
12. /랭킹

### 시세 갱신 모드

- 기본은 **interval**: `STOCK_PRICE_REFRESH_INTERVAL_MS`마다 메모리 캐시를 갱신한다.

- **scheduled-close**: KST 평일에만, 지정 시각(기본 15:31, 15:35, 15:40, 16:00)마다 갱신을 시도한다.

- 정규장 마감 직후 반영 지연을 고려한 선택 모드이며, 공휴일·임시 휴장은 아직 반영하지 않는다.

- 시세는 demo/delayed 등으로 지연·누락될 수 있으며 실제 투자용이 아니다.

### Provider·시세 구조

- 명령어는 외부 API를 직접 호출하지 않는다.
- StockMarketService가 주기적으로 가격을 캐시한다.
- `/자산`은 총자산(현금+주식 평가)만 공개 메시지로 표시한다.
- `/주식자산`은 상세 보유·수익률을 본인만(ephemeral) 확인한다.
- /시세, /매수, /매도, /랭킹은 캐시 가격만 사용한다.
- Yahoo provider는 공식 투자용 데이터가 아닌 demo/delayed quote provider다.

### 알려진 한계

- 장 운영 시간 제한 없음
- 시즌제 없음
- 예약/지정가 주문 없음
- Yahoo provider는 공식 투자용 데이터가 아님
- 가격 데이터는 지연되거나 누락될 수 있음
- 대규모 서버에서는 랭킹 집계 최적화 필요
- 실제 투자용 아님

### 포트폴리오 관점

- Discord slash command 기반 인터랙션
- SQLite 기반 서버별 지갑, 보유, 거래 기록
- Provider 인터페이스로 가격 데이터 소스 분리
- 캐시 기반 시세 조회
- 트랜잭션 기반 매수/매도 처리
- 서버별 랭킹 계산

상세 설계는 [docs/stock-investing.md](docs/stock-investing.md)를 참고합니다.

수동 테스트는 [docs/stock-manual-test.md](docs/stock-manual-test.md)를 참고합니다.

배포·VM 구성은 [docs/deployment.md](docs/deployment.md)를, 베타 운영 점검은 [docs/beta-ops-checklist.md](docs/beta-ops-checklist.md)를 참고합니다.

## 준비

1. Node.js 20 이상을 설치합니다.

2. Lavalink 서버를 준비합니다.

3. `.env.example`을 복사해서 `.env`를 만들고 값을 채웁니다.

```bash
npm install
npm run start:bot
```

`start:bot`과 `start`는 실행 전에 자동으로 build를 돌립니다.

`dist`만 갱신하려면 `npm run build`만 실행하면 됩니다.

기본 패키지 매니저는 npm(`package-lock.json`)입니다.

Bun으로도 실행할 수 있어 `bun.lock`도 함께 두었습니다.

```bash
bun install
bun run start:bot:bun
```
