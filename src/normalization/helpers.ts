import { log } from "../utils/logger.js";

type Nullable<T> = T | null;

export function asString(value: unknown): Nullable<string> {
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed.length ? trimmed : null;
  }
  if (typeof value === "number" && Number.isFinite(value)) {
    return String(value);
  }
  return null;
}

export function cleanEmail(value: unknown): Nullable<string> {
  const str = asString(value);
  return str ? str.toLowerCase() : null;
}

export function emailDomain(email: Nullable<string>): Nullable<string> {
  if (!email) return null;
  const [, domain] = email.split("@");
  if (!domain) return null;
  const trimmed = domain.trim().toLowerCase();
  return trimmed.length ? trimmed : null;
}

export function parseTimestamp(value: unknown): Nullable<Date> {
  if (value == null) return null;
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value;
  }
  if (typeof value === "number" && Number.isFinite(value)) {
    return new Date(value > 1e12 ? value : value * 1000);
  }
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) return null;
    if (/^\d+$/.test(trimmed)) {
      const asNumber = Number(trimmed);
      if (!Number.isFinite(asNumber)) return null;
      return new Date(trimmed.length <= 10 ? asNumber * 1000 : asNumber);
    }
    const ms = Date.parse(trimmed);
    return Number.isNaN(ms) ? null : new Date(ms);
  }
  return null;
}

export function normalizePhone(value: unknown): { raw: Nullable<string>; e164: Nullable<string> } {
  const raw = asString(value);
  if (!raw) return { raw: null, e164: null };

  const digits = raw.replace(/\D+/g, "");
  if (!digits.length) return { raw, e164: null };

  if (raw.startsWith("+")) {
    const plusDigits = raw.replace(/[^+\d]/g, "");
    const candidate = plusDigits.startsWith("+") ? plusDigits : `+${digits}`;
    return { raw, e164: candidate.length > 1 ? candidate : null };
  }

  if (digits.length === 10) {
    return { raw, e164: `+1${digits}` };
  }
  if (digits.length === 11 && digits.startsWith("1")) {
    return { raw, e164: `+${digits}` };
  }
  if (digits.length > 11) {
    return { raw, e164: `+${digits}` };
  }

  return { raw, e164: null };
}

export function buildFullName(first: Nullable<string>, last: Nullable<string>): Nullable<string> {
  const parts = [first, last].filter((p): p is string => Boolean(p && p.trim().length));
  if (!parts.length) return null;
  return parts.join(" ");
}

export function pickFirstString(props: Record<string, any>, keys: string[]): Nullable<string> {
  for (const key of keys) {
    if (key in props) {
      const val = asString(props[key]);
      if (val) return val;
    }
  }
  return null;
}

export function pickFirstTimestamp(props: Record<string, any>, keys: string[]): Nullable<Date> {
  for (const key of keys) {
    if (key in props) {
      const ts = parseTimestamp(props[key]);
      if (ts) return ts;
    }
  }
  return null;
}

export function safeJson(value: any): any {
  if (value == null) return {};
  if (typeof value === "object") return value;
  log.warn({ value }, "Expected object payload for normalization");
  return {};
}
