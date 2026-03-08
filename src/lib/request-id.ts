import { headers } from "next/headers";

export const REQUEST_ID_HEADER = "x-request-id";

export function newRequestId() {
  try {
    return crypto.randomUUID();
  } catch {
    return `${Date.now()}-${Math.random().toString(16).slice(2, 10)}`;
  }
}

export function readRequestIdFromRequest(req: Request) {
  return req.headers.get(REQUEST_ID_HEADER) ?? null;
}

export function readRequestIdFromHeaders() {
  return headers().get(REQUEST_ID_HEADER) ?? null;
}

