# Lavalink (MINE 봇)

이 폴더에는 **`application.yml`**만 포함되어 있습니다. **`Lavalink.jar`는 여기 넣지 않고**, 아래에서 받아 같은 폴더에 저장합니다.

## 1. JAR 받기

1. [Lavalink releases](https://github.com/lavalink-devs/Lavalink/releases) 에서 최신 **Lavalink.jar** 를 내려받습니다.
2. 파일 이름을 **`Lavalink.jar`** 로 두고, 이 디렉터리(`lavalink/`)에 넣습니다.  
   → 최종 경로 예: `…/MINE-Discord-main/lavalink/Lavalink.jar`

## 2. application.yml

`lavalink/application.yml.example` 을 **`application.yml`** 로 복사합니다. (Git에는 `application.yml` 이 없습니다.)

## 3. 비밀번호 맞추기

- **`lavalink/application.yml`** 안의 `lavalink.server.password`  
- 봇 **`.env`** 의 `LAVALINK_PASSWORD`  

기본 예시는 **`youshallnotpass`** 입니다. 바꿀 경우 **반드시 동일한 문자열**로 맞추세요.

## 4. 봇 `.env`

`LAVALINK_JAR_DIR` 에 **이 폴더의 절대 경로**를 넣습니다.

Windows 예:

```text
LAVALINK_JAR_DIR=C:\Users\MINE\Desktop\Study\MINE-Discord-main\lavalink
```

`LAVALINK_HOST=localhost`, `LAVALINK_PORT=2333` 은 기본과 같으면 그대로 두면 됩니다.

## 5. YouTube 플러그인 (수동 설치)

`application.yml`에 Maven **자동 다운로드**를 넣으면, Lavalink 4.2.x가 시작할 때 **Java**로 `maven.lavalink.dev`에 접속합니다.  
Windows에서 브라우저·PowerShell은 되는데 **Java만 `SSLHandshakeException`** 이 나는 경우가 있습니다(보안 프로그램·TLS 스택 차이).

이 프로젝트는 **자동 다운로드를 쓰지 않고** `plugins/` 폴더에 JAR을 둡니다.

프로젝트 루트에서:

```powershell
npm run lavalink:download-plugin
```

또는 `scripts/download-lavalink-youtube-plugin.ps1` 실행 → `lavalink/plugins/youtube-plugin-1.18.1.jar` 생성.

## 6. 실행

이 폴더에서:

```bash
java -Xms512m -Xmx1536m -jar Lavalink.jar
```

또는 프로젝트 루트에서 `npm run start:lavalink` / `npm run start:all` (`.env`에 `LAVALINK_JAR_DIR` 설정 후).

## 7. 요구 사항

- **Java 17+** (배포하는 Lavalink 버전 README 기준)
- YouTube 재생이 막히면 [youtube-source](https://github.com/lavalink-devs/youtube-source) 문서를 보고 `application.yml`의 `plugins.youtube` 설정을 조정하세요.

## YouTube 재생 오류 (`Must find sig function`)

로그에 `LocalSignatureCipherManager` / `Must find sig function from script` 가 보이면 YouTube가 플레이어 스크립트(cipher)를 바꿔 **youtube-plugin 1.18.1 로컬 추출이 실패**한 경우가 많습니다.

1. **`application.yml`의 `plugins.youtube.remoteCipher`** 가 켜져 있는지 확인합니다. (기본: 공개 [yt-cipher](https://github.com/kikkia/yt-cipher) 인스턴스 `https://cipher.kikkia.dev`)
2. **Lavalink를 완전히 재시작**합니다. (`plugins/` 아래 JAR는 재시작 시 갱신)
3. 여전히 `Sign in to confirm you're not a bot` 이면 [OAuth 설정](https://github.com/lavalink-devs/youtube-source#using-oauth-tokens)을 burner 계정으로 검토합니다 (`oauth.enabled: true`).
4. 운영 환경에서는 [yt-cipher를 직접 호스팅](https://github.com/kikkia/yt-cipher)하고 `remoteCipher.url`을 자체 URL로 바꾸는 것을 권장합니다.
5. 플러그인은 [youtube-source Releases](https://github.com/lavalink-devs/youtube-source/releases) 최신 `youtube-plugin` 버전으로 올립니다. (현재 `1.18.1`)
