const AVATAR_BACKGROUNDS = [
  "#67e8f9",
  "#a7f3d0",
  "#fbcfe8",
  "#fde68a",
  "#c4b5fd",
  "#fdba74",
  "#93c5fd",
  "#f9a8d4",
] as const;

const AVATAR_EAR_INNERS = [
  "#f472b6",
  "#fb7185",
  "#f9a8d4",
  "#fda4af",
] as const;

const AVATAR_FUR = [
  "#ffffff",
  "#f8fafc",
  "#fef2f2",
  "#fdf4ff",
] as const;

const AVATAR_EYE_COLORS = ["#1f2937", "#0f172a", "#3f3f46"] as const;

const AVATAR_NOSE_COLORS = ["#f43f5e", "#ec4899", "#fb7185"] as const;

const hashSeed = (seed: string) => {
  let hash = 2166136261;
  for (let i = 0; i < seed.length; i += 1) {
    hash ^= seed.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
};

const pick = <T,>(values: readonly T[], index: number) => values[index % values.length];

const buildAvatarLabel = (seed: string) => {
  const compact = seed
    .trim()
    .split(/[^a-z0-9]+/i)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
  return compact || seed.trim().slice(0, 2).toUpperCase() || "?";
};

export const buildAvatarSvg = (seed: string): string => {
  const trimmed = seed.trim();
  if (!trimmed) {
    throw new Error("Avatar seed is required.");
  }

  const hash = hashSeed(trimmed);
  const background = pick(AVATAR_BACKGROUNDS, hash);
  const earInner = pick(AVATAR_EAR_INNERS, hash >>> 2);
  const fur = pick(AVATAR_FUR, hash >>> 4);
  const eye = pick(AVATAR_EYE_COLORS, hash >>> 7);
  const nose = pick(AVATAR_NOSE_COLORS, hash >>> 9);
  const label = buildAvatarLabel(trimmed);
  const leftEarTilt = 10 + ((hash >>> 11) % 13);
  const rightEarTilt = 10 + ((hash >>> 14) % 13);
  const blinkHeight = 4 + ((hash >>> 17) % 3);
  const cheekOffset = 13 + ((hash >>> 19) % 4);
  const whiskerLift = (hash >>> 21) % 3;

  return [
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 80 80" role="img" aria-label="${label} bunny avatar" data-bunny="true">`,
    `<rect width="80" height="80" rx="18" fill="${background}"/>`,
    `<circle cx="16" cy="14" r="7" fill="#ffffff" opacity="0.22"/>`,
    `<circle cx="66" cy="64" r="9" fill="#ffffff" opacity="0.18"/>`,
    `<path d="M28 38 C${26 - leftEarTilt * 0.18} 22, ${26 - leftEarTilt * 0.08} 10, 32 6 C36 10, 35 23, 34 38 Z" fill="${fur}"/>`,
    `<path d="M28 34 C${27 - leftEarTilt * 0.12} 23, 28 15, 31.5 11 C34 14, 33 23, 32 34 Z" fill="${earInner}" opacity="0.95"/>`,
    `<path d="M52 38 C${54 + rightEarTilt * 0.18} 22, ${54 + rightEarTilt * 0.08} 10, 48 6 C44 10, 45 23, 46 38 Z" fill="${fur}"/>`,
    `<path d="M52 34 C${53 + rightEarTilt * 0.12} 23, 52 15, 48.5 11 C46 14, 47 23, 48 34 Z" fill="${earInner}" opacity="0.95"/>`,
    `<ellipse cx="40" cy="45" rx="21" ry="20" fill="${fur}"/>`,
    `<ellipse cx="40" cy="57" rx="15" ry="11" fill="#ffffff" opacity="0.56"/>`,
    `<ellipse cx="33" cy="44" rx="3" ry="${blinkHeight}" fill="${eye}"/>`,
    `<ellipse cx="47" cy="44" rx="3" ry="${blinkHeight}" fill="${eye}"/>`,
    `<circle cx="${40 - cheekOffset}" cy="52" r="3.2" fill="${earInner}" opacity="0.4"/>`,
    `<circle cx="${40 + cheekOffset}" cy="52" r="3.2" fill="${earInner}" opacity="0.4"/>`,
    `<path d="M40 49 l4 4 l-4 3.2 l-4 -3.2 Z" fill="${nose}"/>`,
    `<path d="M40 55 v4" stroke="#7f1d1d" stroke-width="1.6" stroke-linecap="round"/>`,
    `<path d="M40 59 c-3.4 0 -5.6 1.4 -6.7 3.6" stroke="#7f1d1d" stroke-width="1.6" fill="none" stroke-linecap="round"/>`,
    `<path d="M40 59 c3.4 0 5.6 1.4 6.7 3.6" stroke="#7f1d1d" stroke-width="1.6" fill="none" stroke-linecap="round"/>`,
    `<path d="M27 ${54 - whiskerLift} H20 M27 ${58 - whiskerLift} H19 M53 ${54 - whiskerLift} H60 M53 ${58 - whiskerLift} H61" stroke="#9f1239" stroke-width="1.2" stroke-linecap="round" opacity="0.8"/>`,
    `<text x="40" y="76" text-anchor="middle" font-family="system-ui, sans-serif" font-size="8.5" font-weight="700" fill="${eye}" opacity="0.9">${label}</text>`,
    `</svg>`,
  ].join("");
};

export const buildAvatarDataUrl = (seed: string): string => {
  const svg = buildAvatarSvg(seed);
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
};
