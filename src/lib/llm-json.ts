function unwrapCodeFence(raw: string) {
  const match = raw.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (!match) return raw;
  return match[1]?.trim() || raw;
}

export function extractFirstJsonObject(raw: string) {
  const source = unwrapCodeFence(raw).trim();
  const start = source.indexOf("{");
  if (start === -1) return null;

  let depth = 0;
  let inString = false;
  let escaped = false;

  for (let i = start; i < source.length; i += 1) {
    const ch = source[i];

    if (inString) {
      if (escaped) {
        escaped = false;
      } else if (ch === "\\") {
        escaped = true;
      } else if (ch === "\"") {
        inString = false;
      }
      continue;
    }

    if (ch === "\"") {
      inString = true;
      continue;
    }

    if (ch === "{") depth += 1;
    if (ch === "}") {
      depth -= 1;
      if (depth === 0) {
        return source.slice(start, i + 1);
      }
      if (depth < 0) return null;
    }
  }

  return null;
}

export function parseFirstJsonObject(raw: string) {
  const jsonCandidate = extractFirstJsonObject(raw);
  if (!jsonCandidate) return null;

  try {
    return JSON.parse(jsonCandidate) as unknown;
  } catch {
    return null;
  }
}
