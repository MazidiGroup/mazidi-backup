import { timingSafeEqual } from "node:crypto";
export function authorised(request, variable = "CRON_SECRET") {
  const secret = (process.env[variable] || "").trim();
  const header = request.headers.get("authorization") || "";
  if (!secret || !/^Bearer\s+/i.test(header)) return false;
  const a = Buffer.from(secret),
    b = Buffer.from(header.replace(/^Bearer\s+/i, "").trim());
  return a.length === b.length && timingSafeEqual(a, b);
}
