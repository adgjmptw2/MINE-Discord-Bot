# 주식 모의투자 기능 설계

개발자용 문서입니다.

사용자 안내는 [README.md](../README.md)의 주식 섹션을 참고하세요.

## 개요

길드(서버)마다 가상 화폐와 지갑·보유·거래 기록을 둡니다.

가상 코인은 주식 모의투자뿐 아니라 `/가위바위보` 같은 서버 미니게임에서도 사용할 수 있습니다.

코인 **획득**은 성격이 다릅니다. **`/출석`**·**`/알바`**·**`/낚시`**(보상이 있을 때만)·**`/미션`** 일일 보상 수령은 서버가 지급하는 기본 활동(누적 입금 `total_deposit`에 반영)이고, **`/가위바위보`**는 베팅 승패로 현금만 바뀌며 입금 누적에는 잡히지 않습니다.

**`/낚시`**는 20분 쿨다운·랜덤 보상이며 코인을 잃지 않습니다. 기록은 `coin_fishing_logs`에만 남고 `coin_game_logs`와는 별도입니다.

**`/미션`**은 KST 기준 당일 5가지 활동(출석·알바·낚시·가위바위보·주식목록)을 완료하면 **3,000 코인**을 한 번 받을 수 있는 일일 과제입니다. 진행도는 `coin_daily_missions`·관련 로그로 판별하고, 보상 수령은 `coin_daily_mission_rewards`에 기록됩니다. 보상은 `cash_balance`·`total_deposit`에 반영됩니다.

**`/상점`**·**`/구매`**는 가상 코인으로 **칭호(TITLE)** 아이템을 사고, **`/내아이템`**으로 보유·장착 상태를 확인합니다. **`/칭호장착`**·**`/칭호해제`**로 길드당 칭호 하나를 장착하거나 뺄 수 있으며, 장착 정보는 `coin_equipped_items`(PK: 길드·유저·`item_type`)에 저장됩니다. **`/프로필`**은 (옵션으로 다른 유저 지정 가능) 장착 칭호·총자산·현금·주식 평가·보유 아이템 수·최근 미니게임 1건·현재 시즌 이름을 한 패널에 모아 보여 줍니다. 상품 목록은 코드 상수(`src/settings/coinShopItems.ts`)이며, 구매 시 `cash_balance`만 차감하고 **`total_deposit`은 바꾸지 않습니다.** 칭호는 **스탯·효과 없이 표시용**이며, **`/자산`**·**`/랭킹`**에 장착 칭호가 붙어 보입니다. 보유는 `coin_inventory_items`에 저장됩니다.

`coin_game_logs`에 기록되며, `/게임기록`으로 본인의 최근 미니게임 기록을 확인할 수 있습니다. 다른 유저 기록은 서버 관리자 또는 봇 운영자만 조회할 수 있습니다.

`coin_guild_settings`에 길드별 출석 보상, 가위바위보 베팅 한도·쿨다운이 저장되며, `/코인설정`으로 조회·변경(변경은 관리자)할 수 있습니다. 기본값은 출석 10,000코인, 가위바위보 베팅 100~100,000코인, 쿨다운 5초입니다.

국내 대형주 5종을 사고팔 수 있는 모의투자 미니 게임입니다.

실제 돈·환전·현물 보상은 없습니다.

실제 투자 판단에 사용할 수 없습니다.

시세는 지연되거나 부정확할 수 있습니다.

## 명령어

슬래시 명령은 `src/commands/interaction/stock/` 아래에 모듈별로 분리되어 있습니다.

전체·카테고리별 안내는 **`/도움말`** (`src/commands/interaction/utility/help.ts`)에서 확인합니다.

| 명령어 | 역할 요약 |
| --- | --- |
| /도움말 | 주요 슬래시·가상 경제 안내(공개 메시지) |
| /상태 | 봇·음악·시세·DB·코인 설정 요약(공개 메시지) |
| /출석 | 일 1회 코인 지급, 지갑 생성·갱신 |
| /알바 | 30분마다 알바 보상(500~2,000 코인, `coin_work_logs`) |
| /낚시 | 20분마다 낚시 보상(랜덤, 꽝 시 0코인, `coin_fishing_logs`) |
| /미션 | KST 당일 일일 미션 진행도·보상 수령(`coin_daily_missions` 등) |
| /상점 | 고정 칭호 아이템 목록·가격·설명(공개) |
| /구매 | 상점 아이템 구매(`coin_inventory_items`, `cash_balance` 차감) |
| /내아이템 | 보유 상점 아이템·장착 상태(ephemeral) |
| /칭호장착 | 보유 칭호 장착(`coin_equipped_items`) |
| /칭호해제 | 장착 칭호 해제 |
| /프로필 | 코인 프로필(칭호·자산·아이템 수·최근 게임·시즌, 공개) |
| /자산 | 총자산(현금+주식 평가), 장착 칭호가 있으면 제목에 `[칭호]` 표시 |
| /주식자산 | 현금·보유·평가·총자산·수익률(본인만, ephemeral) |
| /주식목록 | 지원 5종 + 캐시 시세 (ANSI 색상·공개 메시지) |
| /시세 | 종목별 캐시 시세 |
| /매수 | 캐시 가격 기준 매수 + 거래 기록 |
| /매도 | 금액·퍼센트·전부 매도 |
| /랭킹 | 길드 내 총자산 랭킹, 장착 칭호가 있으면 `[칭호]` 접두 (`<@userId>` + 알림 방지) |
| /코인지급 | 관리자 코인 지급 (cash·total_deposit 증가) |
| /코인차감 | 관리자 코인 차감 (cash만 감소) |
| /유저초기화 | 특정 유저 지갑·보유·거래·출석 기록 삭제 (확인: 초기화) |
| /서버초기화 | 길드 전체 모의투자 데이터 삭제 (확인: 서버초기화) |
| /시즌시작 | ACTIVE 시즌 생성 (관리자·확인: 시즌시작) |
| /시즌종료 | 랭킹 상위 10명 저장 후 시즌 종료 (확인: 시즌종료) |
| /시즌정보 | 진행 시즌·최근 종료 시즌 요약 |
| /가위바위보 | 코인 베팅 가위바위보 (로그 `coin_game_logs`) |
| /게임기록 | 최근 미니게임 기록 조회 (본인·관리자 타 유저) |
| /코인설정 | 서버별 출석·가위바위보 한도·쿨다운 조회 / 관리자 변경 |

## 데이터 모델

SQLite 테이블은 `src/storage/db.ts` 등에서 정의됩니다.

| 테이블 | 역할 |
| --- | --- |
| stock_wallets | 길드·유저별 현금, 누적 입금(수익률 분모) |
| stock_holdings | 심볼별 수량(마이크로), 평균 매수가 |
| stock_trades | BUY/SELL, 수수료, 실현손익 등 |
| stock_daily_attendance | 출석 일자·보상 기록 |
| stock_seasons | 길드별 시즌 (ACTIVE는 길드당 하나, partial unique index) |
| stock_season_results | 시즌 종료 시점 랭킹 스냅샷 (상위 10명 등) |
| coin_game_logs | 코인 미니게임 로그 (예: RPS, `/게임기록`으로 조회) |
| coin_work_logs | `/알바` 지급·쿨다운 판별용 로그 (`work_type` 예: PART_TIME) |
| coin_fishing_logs | `/낚시` 결과·쿨다운 판별용 로그 (`fish_name`, `rarity`, `reward_amount` 등) |
| coin_daily_missions | 일일 미션 완료 스냅샷 (`mission_key`, KST `date`, `INSERT OR IGNORE`) |
| coin_daily_mission_rewards | 일일 미션 보상 일 1회 수령 기록 |
| coin_inventory_items | `/구매`로 산 상점 아이템 보유(PK: 길드·유저·`item_key`, `price_paid` 스냅샷) |
| coin_equipped_items | 길드·유저·`item_type`당 장착 슬롯 1개(현재 `TITLE`만, `INSERT OR REPLACE`) |
| coin_guild_settings | 길드별 출석 보상·가위바위보 베팅 한도·쿨다운 (`/코인설정`) |

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
