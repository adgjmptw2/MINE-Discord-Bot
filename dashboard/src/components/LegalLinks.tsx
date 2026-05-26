import { getApiBaseUrl } from "../api";

export function LegalLinks() {
  const base = getApiBaseUrl();

  return (
    <footer className="legal-footer">
      <a href={`${base}/privacy`}>개인정보처리방침</a>
      <span className="legal-footer-sep" aria-hidden>
        ·
      </span>
      <a href={`${base}/terms`}>이용약관</a>
    </footer>
  );
}
