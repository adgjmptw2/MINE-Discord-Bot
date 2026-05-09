# 주식 모의투자 기능 설계

개발자용 문서입니다.

사용자 안내는 [README.md](../README.md)의 주식 섹션을 참고하세요.

## 개요

길드(서버)마다 가상 화폐와 지갑·보유·거래 기록을 둡니다.

국내 대형주 5종을 사고팔 수 있는 모의투자 미니 게임입니다.

실제 돈·환전·현물 보상은 없습니다.

실제 투자 판단에 사용할 수 없습니다.

시세는 지연되거나 부정확할 수 있습니다.

## 명령어

슬래시 명령은 `src/commands/interaction/stock/` 아래에 모듈별로 분리되어 있습니다.

| 명령어 | 역할 요약 |
| --- | --- |
| /출석 | 일 1회 코인 지급, 지갑 생성·갱신 |
| /자산 | 총자산(현금+주식 평가)만 공개 메시지로 표시 |
| /주식자산 | 현금·보유·평가·총자산·수익률(본인만, ephemeral) |
| /주식목록 | 지원 5종 + 캐시 시세 (ANSI 색상·공개 메시지) |
| /시세 | 종목별 캐시 시세 |
| /매수 | 캐시 가격 기준 매수 + 거래 기록 |
| /매도 | 금액·퍼센트·전부 매도 |
| /랭킹 | 길드 내 총자산·코인 랭킹 (`<@userId>` 표시 + 알림 방지 옵션) |

## 데이터 모델

SQLite 테이블은 `src/storage/db.ts` 등에서 정의됩니다.

| 테이블 | 역할 |
| --- | --- |
| stock_wallets | 길드·유저별 현금, 누적 입금(수익률 분모) |
| stock_holdings | 심볼별 수량(마이크로), 평균 매수가 |
| stock_trades | BUY/SELL, 수수료, 실현손익 등 |
| stock_daily_attendance | 출석 일자·보상 기록 |

비즈니스 로직은 Drizzle 없이 raw SQL과 트랜잭션으로 처리합니다.

`BEGIN IMMEDIATE`, `COMMIT`, `ROLLBACK` 패턴을 사용합니다.

## 가격 Provider 구조

`StockQuoteProvider` 구현체(mock, yahoo, twelvedata)가 시세를 가져옵니다.

`StockMarketService`가 주기적으로 갱신하고 메모리 Map에 캐시합니다.

명령 핸들러는 외부 HTTP를 직접 호출하지 않고 캐시만 읽습니다.

환경 변수 `STOCK_PRICE_PROVIDER`:

| 값 | 설명 |
| --- | --- |
| mock | 개발용 가짜 시세 |
| yahoo | demo/delayed, 비공식 |
| twelvedata | Twelve Data API, TWELVE_DATA_API_KEY 필요 |

갱신 주기는 `STOCK_PRICE_REFRESH_INTERVAL_MS`입니다.

기본값은 5분입니다.

`STOCK_PRICE_REFRESH_MODE`가 `interval`(기본)일 때만 위 간격으로 폴링합니다.

`scheduled-close` 모드는 KST 평일에만, `STOCK_SCHEDULED_CLOSE_REFRESH_TIMES_KST`의 시각(기본 15:31, 15:35, 15:40, 16:00)마다 갱신을 시도합니다.

마감 직후 데이터 반영 지연을 가정한 선택 모드이며, 공휴일은 구분하지 않습니다.

명령 핸들러는 여전히 메모리 캐시만 읽으며, 실제 투자용 데이터가 아닙니다.

설정에서 최소 간격 보정이 있을 수 있습니다.

## 거래 처리 흐름

매수 시 금액·수수료·수량을 계산합니다.

트랜잭션 내에서 지갑 차감, 보유 upsert, stock_trades에 BUY를 기록합니다.

매도 시 매도 수량·대금·수수료·실현손익을 계산합니다.

보유 감소 후 0이면 행 삭제합니다.

지갑 증가, stock_trades에 SELL을 기록합니다.

동시 요청은 SQL 조건으로 잔고·보유 일관성을 맞춥니다.

## 테스트 시나리오

1. `.env`에서 `STOCK_PRICE_PROVIDER=mock` 또는 `yahoo`를 설정합니다.

2. `npm run check` 후 `npm run build`, `npm run start:bot`을 실행합니다.

3. Discord 일반 텍스트 채널에서 다음을 순서대로 확인합니다.

   - `/출석` → `/주식목록` → `/시세` 종목 삼성전자

   - `/매수` → `/자산` → `/주식자산` → `/매도` → `/랭킹`

Soundroom 전용 채널은 서버 정책에 따라 일부 슬래시가 제한될 수 있습니다.

## 알려진 한계

장 운영 시간 제한 없음.

시즌제 없음.

예약·지정가 없음.

시세는 demo/delayed 또는 mock이라 정확성을 보장하지 않습니다.

Yahoo 등 비공식 Provider는 시간대·네트워크·레이트 제한으로 일부 종목 시세가 비거나 갱신이 실패할 수 있다.

실패해도 `mock` Provider로 MVP 흐름 검증은 계속할 수 있다.

`/랭킹`은 길드 전량 조회 후 메모리 집계입니다.

표시 이름은 `<@userId>` 형태이며, 응답에 `allowedMentions`를 두어 실제 멘션 알림이 가지 않도록 한다.

대규모 서버에서는 랭킹 집계 최적화가 필요할 수 있다.

본 기능은 모의 게임이며 실제 투자 도구가 아닙니다.

## Known issues (문서화, 코드 미수정)

아래는 현재 설계·운영 상 알려진 한계이며, 이번 MVP 단계에서 코드로 제거하지 않는다.

- Yahoo Provider가 특정 시간대에 일부 가격을 가져오지 못할 수 있음
- 장 운영 시간 제한 없음
- 시즌제 없음
- 대규모 서버에서 `/랭킹` 집계 비용·지연 가능

## 수동 테스트 체크리스트 링크

체크리스트와 Known issues 기록은 [stock-manual-test.md](./stock-manual-test.md)를 참고하세요.
