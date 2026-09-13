const PROHIBITED_KEYWORDS = [
  "tigrinho",
  "tigrinhos",
  "fortune tiger",
  "fortunetiger",
  "jogo do tigre",
  "jogodotigre",
  "fortune ox",
  "fortuneox",
  "touro da fortuna",
  "fortune rabbit",
  "fortunerabbit",
  "coelho da fortuna",
  "fortune dragon",
  "fortunedragon",
  "fortune mouse",
  "fortunemouse",
  "fortune snake",
  "fortunesnake",
  "pgsoft",
  "pg soft",
  "jogo do bicho",
  "jogodobicho",
  "bichao",
  "sweet bonanza",
  "gates of olympus",
  "aviator crash",
  "jogo de azar",
  "jogos de azar",
  "caca niquel",
  "cacaniquel",
  "slot machine",
  "slots casino",
  "cassino online",
  "casino online",
  "cassinoonline",
  "casinoonline",
  "roleta online",
  "blaze.com",
  "blaze.bet",
];

function normalize(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/[^a-z0-9]+/g, "");
}

export function isProhibitedStorefrontLink(...parts: Array<string | null | undefined>): boolean {
  const haystack = normalize(parts.filter(Boolean).join(" "));
  if (!haystack) return false;
  return PROHIBITED_KEYWORDS.some((keyword) => {
    const needle = normalize(keyword);
    return needle.length > 0 && haystack.includes(needle);
  });
}
