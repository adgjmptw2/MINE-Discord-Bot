# Lavalink (MINE 봇)

이 폴더에는 **`application.yml`**만 포함되어 있습니다. **`Lavalink.jar`는 여기 넣지 않고**, 아래에서 받아 같은 폴더에 저장합니다.

## 1. JAR 받기

1. [Lavalink releases](https://github.com/lavalink-devs/Lavalink/releases) 에서 최신 **Lavalink.jar** 를 내려받습니다.
2. 파일 이름을 **`Lavalink.jar`** 로 두고, 이 디렉터리(`lavalink/`)에 넣습니다.  
   → 최종 경로 예: `…/MINE-Discord-main/lavalink/Lavalink.jar`

## 2. 비밀번호 맞추기

- **`lavalink/application.yml`** 안의 `lavalink.server.password`  
- 봇 **`.env`** 의 `LAVALINK_PASSWORD`  

기본값은 둘 다 **`youshallnotpass`** 로 맞춰 두었습니다. 바꿀 경우 **반드시 동일한 문자열**로 맞추세요.

## 3. 봇 `.env`

`LAVALINK_JAR_DIR` 에 **이 폴더의 절대 경로**를 넣습니다.

Windows 예:

```text
LAVALINK_JAR_DIR=C:\Users\MINE\Desktop\Study\MINE-Discord-main\lavalink
```

`LAVALINK_HOST=localhost`, `LAVALINK_PORT=2333` 은 기본과 같으면 그대로 두면 됩니다.

## 4. 실행

이 폴더에서:

```bash
java -Xms512m -Xmx1536m -jar Lavalink.jar
```

또는 프로젝트 루트에서 `npm run start:lavalink` / `npm run start:all` (`.env`에 `LAVALINK_JAR_DIR` 설정 후).

## 요구 사항

- **Java 17+** (배포하는 Lavalink 버전 README 기준)
- YouTube 재생이 막히면 [youtube-source](https://github.com/lavalink-devs/youtube-source) 문서를 보고 `application.yml`의 `plugins.youtube` 설정을 조정하세요.
