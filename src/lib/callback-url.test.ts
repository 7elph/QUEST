import { describe, expect, it } from "vitest";
import { buildCallbackPath, sanitizeCallbackUrl } from "./callback-url";

describe("callback-url", () => {
  it("builds callback path preserving query", () => {
    expect(buildCallbackPath("/home", "?q=abc")).toBe("/home?q=abc");
  });

  it("sanitizes same-origin relative callback", () => {
    expect(sanitizeCallbackUrl("/profile?tab=missions", "/home")).toBe("/profile?tab=missions");
  });

  it("blocks external callback", () => {
    expect(sanitizeCallbackUrl("https://evil.example/phish", "/home")).toBe("/home");
  });

  it("blocks protocol-relative callback", () => {
    expect(sanitizeCallbackUrl("//evil.example/phish", "/home")).toBe("/home");
  });

  it("falls back on invalid callback value", () => {
    expect(sanitizeCallbackUrl("javascript:alert(1)", "/home")).toBe("/home");
  });
});
