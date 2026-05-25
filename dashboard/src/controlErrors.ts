import { ApiClientError } from "./api";

export function mapControlError(err: unknown): string {
  if (err instanceof ApiClientError) {
    return err.message;
  }
  return "API 서버에 연결할 수 없습니다.";
}

export function isControlUnauthorized(err: unknown): boolean {
  return err instanceof ApiClientError && err.status === 401;
}
