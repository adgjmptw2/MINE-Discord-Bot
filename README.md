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
| /출석 | 하루 1회 가상 화폐를 받습니다 |
| /자산 | 내 현금, 보유 주식, 총자산을 확인합니다 |
| /주식목록 | 지원 종목과 시세 상태를 확인합니다 |
| /시세 | 특정 종목의 모의투자 시세를 확인합니다 |
| /매수 | 가상 화폐로 주식을 매수합니다 |
| /매도 | 보유 주식을 매도합니다 |
| /주식랭킹 | 서버별 총자산 랭킹을 확인합니다 |

### 환경 변수

| 변수 | 설명 |
| --- | --- |
| STOCK_PRICE_PROVIDER | mock, yahoo, twelvedata 중 하나 |
| STOCK_PRICE_REFRESH_INTERVAL_MS | 기본 300000ms, 5분 |
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
10. /매도 종목:삼성전자 매도:50%
11. /주식랭킹

### Provider·시세 구조

- 명령어는 외부 API를 직접 호출하지 않는다.
- StockMarketService가 주기적으로 가격을 캐시한다.
- /시세, /매수, /매도, /주식랭킹은 캐시 가격만 사용한다.
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
