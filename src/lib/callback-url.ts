export function buildCallbackPath(pathname: string, search?: string) {
  const normalizedPath = pathname.startsWith("/") ? pathname : `/${pathname}`;
  const normalizedSearch = search ?? "";
  return `${normalizedPath}${normalizedSearch}`;
}

export function sanitizeCallbackUrl(rawValue: string | null | undefined, fallback = "/home") {
  const safeFallback = fallback.startsWith("/") ? fallback : `/${fallback}`;
  const value = rawValue?.trim();
  if (!value) return safeFallback;

  try {
    const parsed = new URL(value, "http://localhost");
    if (parsed.origin !== "http://localhost") {
      return safeFallback;
    }
    const candidate = `${parsed.pathname}${parsed.search}${parsed.hash}`;
    if (!candidate.startsWith("/") || candidate.startsWith("//")) {
      return safeFallback;
    }
    return candidate;
  } catch {
    return safeFallback;
  }
}
