export function sanitizeText(value: string) {
  return value
    .replace(/[<>]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

export function sanitizeArray(values: string[]) {
  return values.map((item) => sanitizeText(item)).filter(Boolean);
}
