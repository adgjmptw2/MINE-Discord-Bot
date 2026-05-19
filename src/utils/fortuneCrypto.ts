import {
  createCipheriv,
  createDecipheriv,
  randomBytes,
} from "node:crypto";
import type { FortuneProfilePlain } from "@/utils/fortuneInput";

const ALGO = "aes-256-gcm" as const;
const IV_LEN = 12;
const TAG_LEN = 16;
const AAD_PREFIX = "fortune_profile:v1:";

export interface FortuneEncryptedPayload {
  profileCiphertext: string;
  profileIv: string;
  profileTag: string;
}

export function getFortuneEncryptionKey(): Buffer | null {
  const b64 = process.env.FORTUNE_PROFILE_ENCRYPTION_KEY_BASE64?.trim();
  if (!b64) {
    return null;
  }
  try {
    const buf = Buffer.from(b64, "base64");
    if (buf.length !== 32) {
      return null;
    }
    return buf;
  } catch {
    return null;
  }
}

function aadForUser(userId: string): Buffer {
  return Buffer.from(`${AAD_PREFIX}${userId}`, "utf8");
}

export function encryptFortuneProfile(
  profile: FortuneProfilePlain,
  userId: string,
): FortuneEncryptedPayload {
  const key = getFortuneEncryptionKey();
  if (!key) {
    throw new Error("FORTUNE_CRYPTO_NO_KEY");
  }

  const iv = randomBytes(IV_LEN);
  const cipher = createCipheriv(ALGO, key, iv, { authTagLength: TAG_LEN });
  cipher.setAAD(aadForUser(userId));

  const plain = JSON.stringify(profile);
  const ciphertext = Buffer.concat([
    cipher.update(plain, "utf8"),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();

  return {
    profileCiphertext: ciphertext.toString("base64"),
    profileIv: iv.toString("base64"),
    profileTag: tag.toString("base64"),
  };
}

export function decryptFortuneProfile(
  row: FortuneEncryptedPayload,
  userId: string,
): FortuneProfilePlain | null {
  const key = getFortuneEncryptionKey();
  if (!key) {
    return null;
  }

  try {
    const iv = Buffer.from(row.profileIv, "base64");
    const tag = Buffer.from(row.profileTag, "base64");
    const ciphertext = Buffer.from(row.profileCiphertext, "base64");
    if (iv.length !== IV_LEN || tag.length !== TAG_LEN) {
      return null;
    }

    const decipher = createDecipheriv(ALGO, key, iv, {
      authTagLength: TAG_LEN,
    });
    decipher.setAAD(aadForUser(userId));
    decipher.setAuthTag(tag);

    const plain = Buffer.concat([
      decipher.update(ciphertext),
      decipher.final(),
    ]).toString("utf8");

    const parsed: unknown = JSON.parse(plain);
    if (!parsed || typeof parsed !== "object") {
      return null;
    }
    const o = parsed as Record<string, unknown>;
    const birthDate = o.birthDate;
    const gender = o.gender;
    if (typeof birthDate !== "string" || typeof gender !== "string") {
      return null;
    }
    if (!/^(\d{4})-(\d{2})-(\d{2})$/.test(birthDate)) {
      return null;
    }
    if (!["male", "female", "other", "private"].includes(gender)) {
      return null;
    }
    return {
      birthDate,
      gender: gender as FortuneProfilePlain["gender"],
    };
  } catch {
    return null;
  }
}
