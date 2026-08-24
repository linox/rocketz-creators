export function safeHttpUrl(value?: string | null): string | undefined {
  if (!value?.trim()) {
    return undefined;
  }

  try {
    const url = new URL(value.trim());
    if (url.protocol !== "http:" && url.protocol !== "https:") {
      return undefined;
    }
    return url.href;
  } catch {
    return undefined;
  }
}
