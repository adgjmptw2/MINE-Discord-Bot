import { db } from "@/storage/db";
import {
  decryptFortuneProfile,
  encryptFortuneProfile,
  type FortuneEncryptedPayload,
} from "@/utils/fortuneCrypto";
import type { FortuneProfilePlain } from "@/utils/fortuneInput";

export type { FortuneProfilePlain } from "@/utils/fortuneInput";

export interface FortuneProfileRow extends FortuneEncryptedPayload {
  userId: string;
  keyVersion: number;
  privacyNoticeVersion: string;
  consentedAt: string;
  createdAt: string;
  updatedAt: string;
}

const PRIVACY_NOTICE_VERSION = "fortune-v1";

function nowIso(): string {
  return new Date().toISOString();
}

export function hasFortuneProfile(userId: string): boolean {
  const row = db.get<{ ok: number }>(
    "SELECT 1 AS ok FROM fortune_profiles WHERE user_id = ?",
    [userId],
  );
  return row !== undefined;
}

export function getFortuneProfile(userId: string): FortuneProfilePlain | null {
  const r = db.get<{
    user_id: string;
    profile_ciphertext: string;
    profile_iv: string;
    profile_tag: string;
  }>(
    "SELECT user_id, profile_ciphertext, profile_iv, profile_tag FROM fortune_profiles WHERE user_id = ?",
    [userId],
  );
  if (!r) {
    return null;
  }
  return decryptFortuneProfile(
    {
      profileCiphertext: r.profile_ciphertext,
      profileIv: r.profile_iv,
      profileTag: r.profile_tag,
    },
    userId,
  );
}

export function upsertFortuneProfile(
  userId: string,
  profile: FortuneProfilePlain,
): void {
  const enc = encryptFortuneProfile(profile, userId);
  const now = nowIso();

  const existing = db.get<{ user_id: string }>(
    "SELECT user_id FROM fortune_profiles WHERE user_id = ?",
    [userId],
  );

  if (existing) {
    db.run(
      `UPDATE fortune_profiles SET
        profile_ciphertext = ?,
        profile_iv = ?,
        profile_tag = ?,
        key_version = 1,
        privacy_notice_version = ?,
        updated_at = ?
      WHERE user_id = ?`,
      [
        enc.profileCiphertext,
        enc.profileIv,
        enc.profileTag,
        PRIVACY_NOTICE_VERSION,
        now,
        userId,
      ],
    );
    return;
  }

  db.run(
    `INSERT INTO fortune_profiles (
      user_id, profile_ciphertext, profile_iv, profile_tag,
      key_version, privacy_notice_version, consented_at, created_at, updated_at
    ) VALUES (?, ?, ?, ?, 1, ?, ?, ?, ?)`,
    [
      userId,
      enc.profileCiphertext,
      enc.profileIv,
      enc.profileTag,
      PRIVACY_NOTICE_VERSION,
      now,
      now,
      now,
    ],
  );
}

export function deleteFortuneProfile(userId: string): boolean {
  db.run("DELETE FROM fortune_profiles WHERE user_id = ?", [userId]);
  return true;
}
