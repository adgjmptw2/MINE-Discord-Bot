import { getDiscordLoginUrl } from "../api";

export function LoginView() {
  const goLogin = () => {
    window.location.href = getDiscordLoginUrl();
  };

  return (
    <div className="login-view">
      <div className="login-card">
        <p className="eyebrow">읽기 전용</p>
        <h1>MINE Soundroom</h1>
        <p className="login-desc">
          Discord로 로그인해서 참여 중인 서버의 Soundroom 상태를 확인하세요.
        </p>
        <button type="button" className="btn btn-primary" onClick={goLogin}>
          Discord로 로그인
        </button>
        <ul className="login-hints">
          <li>
            대시보드 주소:{" "}
            <strong>http://127.0.0.1:3000/dashboard/</strong> (localhost와
            섞지 마세요)
          </li>
          <li>로컬 개발 기준 API 서버(3077)와 대시보드가 모두 켜져 있어야 합니다.</li>
          <li>조작은 봇과 같은 음성 채널에 있을 때만 가능합니다.</li>
        </ul>
      </div>
    </div>
  );
}
