# 주식 모의투자 기능 설계

개발자용 설명입니다. 사용자 안내는 [README.md](../README.md)의 주식 섹션을 참고하세요.

## 개요

서버(길드)마다 **가상 화폐 코인**과 **지갑·보유·거래 기록**을 두고, 국내 대형주 5종을 사고팔 수 있는 **모의투자용 미니 게임**입니다. 실제 돈·환전·현물 보상은 없으며 **실제 투자 판단에 사용할 수 없습니다.** 시세는 **지연되거나 부정확할 수 있습니다.**

## 명령어

슬래시 명령은 `src/commands/interaction/stock/` 아래에 모듈별로 분리되어 있습니다.

| 명령어      | 역할 요약                          |
| ----------- | ---------------------------------- |
| `/출석`     | 일 1회 코인 지급, 지갑 생성·갱신   |
| `/자산`     | 현금·보유·평가·총자산·수익률       |
| `/주식목록` | 지원 5종 + 캐시 시세 상태          |
| `/시세`     | 종목별 캐시 시세                  |
| `/매수`     | 캐시 가격 기준 매수 + 거래 기록    |
| `/매도`     | 금액·퍼센트·전부 매도              |
| `/주식랭킹` | 길드 내 총자산 순위               |

## 데이터 모델

SQLite 테이블 (스키마는 `src/storage/db.ts` 등에서 정의):

| 테이블                   | 역할                                                |
| ------------------------ | --------------------------------------------------- |
| `stock_wallets`          | 길드·유저별 현금, 누적 입금(수익률 분모)           |
| `stock_holdings`         | 심볼별 수량(마이크로, 1주 = 1_000_000), 평균 매수가 |
| `stock_trades`           | BUY/SELL, 수수료, 실현손익 등                       |
| `stock_daily_attendance` | 출석 일자·보상 기록                                 |

비즈니스 로직은 Drizzle 쿼리 빌더 없이 **raw SQL + 트랜잭션** (`BEGIN IMMEDIATE` / `COMMIT` / `ROLLBACK`)으로 처리합니다.

## 가격 Provider 구조

1. **`StockQuoteProvider`** (`mock` / `yahoo` / `twelvedata` 구현체)가 시세를 가져옵니다.
2. **`StockMarketService`**가 주기적으로 갱신하고 **메모리 Map**에 캐시합니다.
3. 명령 핸들러는 **`client.stockMarket`**의 캐시만 읽습니다 (외부 HTTP 호출 없음).

환경 변수 `STOCK_PRICE_PROVIDER`:

| 값           | 설명                                                       |
| ------------ | ---------------------------------------------------------- |
| `mock`       | 개발용 가짜 시세                                           |
| `yahoo`      | 국내주 MVP 검증용 **demo/delayed** (비공식, 투자용 아님)   |
| `twelvedata` | Twelve Data API (`TWELVE_DATA_API_KEY` 필요)               |

갱신 주기는 `STOCK_PRICE_REFRESH_INTERVAL_MS`(기본 5분, 최소 1분 보정 가능).

## 거래 처리 흐름

- **매수**: 금액·수수료·수량(micro) 계산 → 트랜잭션 내 지갑 차감, 보유 upsert, `stock_trades` BUY INSERT.
- **매도**: 매도 수량·매도대금·수수료·실현손익 계산 → 보유 감소(0이면 행 삭제), 지갑 증가, `stock_trades` SELL INSERT.
- 동시 요청 시 잔고·보유는 SQL 조건(`cash_balance >= …`, `quantity_micro >= …`)으로 맞춤.

## 테스트 시나리오

1. `.env`에서 `STOCK_PRICE_PROVIDER=mock` 또는 `yahoo`
2. `npm run check` → `npm run build` → `npm run start:bot`
3. Discord **일반 텍스트 채널**에서:
   - `/출석` → `/주식목록` → `/시세` 종목 삼성전자
   - `/매수` → `/자산` → `/매도` → `/주식랭킹`

Soundroom 전용 채널은 서버 정책상 일부 슬래시가 제한될 수 있습니다.

## 알려진 한계

- 장 운영 시간 제한 없음 · 시즌제 없음 · 예약·지정가 없음
- 시세는 demo/delayed 또는 mock → 정확성 보장 없음
- `/주식랭킹`은 길드 전량 조회 후 메모리 집계(MVP) → 대규모 서버에서는 최적화 여지
- 모의 게임일 뿐 실제 투자 도구 아님

## 수동 테스트 체크리스트 링크

체크리스트·Known issues 기록: **[stock-manual-test.md](./stock-manual-test.md)**
