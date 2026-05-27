import { getDiscordLoginUrl } from "../api";
import { LegalLinks } from "./LegalLinks";

export function LoginView() {
  const goLogin = () => {
    window.location.href = getDiscordLoginUrl();
  };

  return (
    <div className="login-view">
      <div className="login-card">
        <h1>MINE 노래채널</h1>
        <p className="login-desc">
          Discord로 로그인해서 참여 중인 서버의 노래채널 상태를 확인하세요.
        </p>
        <button type="button" className="btn btn-primary" onClick={goLogin}>
          Discord로 로그인
        </button>
        <ul className="login-hints">
          <li>조작은 봇과 같은 음성 채널에 있을 때만 가능합니다.</li>
        </ul>
      </div>
      <LegalLinks />
    </div>
  );
}
