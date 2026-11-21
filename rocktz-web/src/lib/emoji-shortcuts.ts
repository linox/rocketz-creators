const EMOJI_SHORTCUTS: ReadonlyArray<readonly [string, string]> = [
  [":')", "😂"],
  [":'(", "😢"],
  [":-)", "😊"],
  [":-(", "😞"],
  [":-D", "😄"],
  [":-P", "😛"],
  [":-p", "😛"],
  [":-O", "😮"],
  [":-o", "😮"],
  [":-/", "😕"],
  [";-)", "😉"],
  [":)", "😊"],
  [":(", "😞"],
  [":D", "😄"],
  [":d", "😄"],
  ["xD", "😆"],
  ["XD", "😆"],
  [";)", "😉"],
  [":P", "😛"],
  [":p", "😛"],
  [":O", "😮"],
  [":o", "😮"],
  [":/", "😕"],
  [":*", "😘"],
  [":|", "😐"],
  ["<3", "❤️"],
  ["B)", "😎"],
  ["^^", "😄"],
  ["o/", "👋"],
];

const SORTED_EMOJI_SHORTCUTS = [...EMOJI_SHORTCUTS].sort((a, b) => b[0].length - a[0].length);

function isBoundary(value: string, index: number) {
  return index === 0 || /\s/.test(value[index - 1] ?? "");
}

function needsBoundary(symbol: string) {
  return /[A-Za-z]/.test(symbol);
}

function isClosed(value: string, end: number) {
  return end === value.length || /\s/.test(value[end] ?? "");
}

export function applyEmojiShortcuts(value: string, cursor: number): { value: string; cursor: number } {
  let result = "";
  let nextCursor = cursor;
  let index = 0;

  while (index < value.length) {
    let matched: readonly [string, string] | null = null;
    for (const pair of SORTED_EMOJI_SHORTCUTS) {
      const symbol = pair[0];
      if (!value.startsWith(symbol, index)) continue;
      if (needsBoundary(symbol) && !isBoundary(value, index)) continue;
      if (!isClosed(value, index + symbol.length)) continue;
      matched = pair;
      break;
    }

    if (!matched) {
      result += value[index];
      index += 1;
      continue;
    }

    const [symbol, emoji] = matched;
    const end = index + symbol.length;
    result += emoji;
    if (cursor >= end) nextCursor += emoji.length - symbol.length;
    else if (cursor > index) nextCursor = result.length;
    index = end;
  }

  return { value: result, cursor: nextCursor };
}

export const MESSAGE_EMOJIS = [
  "😊", "😄", "😁", "😂", "🤣", "😉", "😍", "😘", "🥰", "😋",
  "😎", "😢", "😭", "😡", "🤔", "😴", "🙄", "😅", "😇", "😜",
  "👍", "👎", "👏", "🙏", "👋", "🤝", "✌️", "🤞", "💪", "🙌",
  "❤️", "🧡", "💛", "💚", "💙", "💜", "🖤", "💔", "💕", "🔥",
  "✅", "❌", "⭐", "🎉", "✨", "💯", "📌", "📎", "📷", "🎬",
] as const;
