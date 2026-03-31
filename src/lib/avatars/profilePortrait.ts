import type { AgentAvatarProfile } from "./profile";

const AVATAR_BG = "#070b16";
const EYE_COLOR = "#111827";
const HEADSET_BAND = "#94a3b8";
const HEADSET_PAD = "#475569";
const MOUTH_COLOR = "#9c4a4a";

const escapeXml = (value: string) =>
  value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");

const normalizeHex = (value: string): string | null => {
  const trimmed = value.trim();
  if (/^#[0-9a-f]{6}$/i.test(trimmed)) return trimmed.toLowerCase();
  if (/^#[0-9a-f]{3}$/i.test(trimmed)) {
    const [, r, g, b] = trimmed;
    return `#${r}${r}${g}${g}${b}${b}`.toLowerCase();
  }
  return null;
};

const blendHex = (source: string, target: string, weight: number): string => {
  const sourceHex = normalizeHex(source);
  const targetHex = normalizeHex(target);
  if (!sourceHex || !targetHex) return source;
  const ratio = Math.max(0, Math.min(1, weight));
  const sourceChannels = [
    Number.parseInt(sourceHex.slice(1, 3), 16),
    Number.parseInt(sourceHex.slice(3, 5), 16),
    Number.parseInt(sourceHex.slice(5, 7), 16),
  ];
  const targetChannels = [
    Number.parseInt(targetHex.slice(1, 3), 16),
    Number.parseInt(targetHex.slice(3, 5), 16),
    Number.parseInt(targetHex.slice(5, 7), 16),
  ];
  const mixed = sourceChannels.map((channel, index) =>
    Math.round(channel * (1 - ratio) + targetChannels[index] * ratio)
  );
  return `#${mixed.map((channel) => channel.toString(16).padStart(2, "0")).join("")}`;
};

const buildHairSvg = (profile: AgentAvatarProfile, hairColor: string) => {
  if (profile.accessories.hatStyle !== "none") return "";
  switch (profile.hair.style) {
    case "short":
      return `<rect x="22" y="19" width="36" height="12" rx="4" fill="${hairColor}"/>`;
    case "parted":
      return [
        `<rect x="22" y="19" width="36" height="11" rx="4" fill="${hairColor}"/>`,
        `<path d="M25 25 L46 18 L47 29 L25 30 Z" fill="${blendHex(hairColor, "#ffffff", 0.08)}"/>`,
      ].join("");
    case "spiky":
      return [
        `<rect x="23" y="21" width="34" height="9" rx="3" fill="${hairColor}"/>`,
        `<path d="M25 22 L30 14 L34 22 Z" fill="${hairColor}"/>`,
        `<path d="M38 21 L43 11 L47 21 Z" fill="${hairColor}"/>`,
        `<path d="M49 22 L54 14 L57 22 Z" fill="${hairColor}"/>`,
      ].join("");
    case "bun":
      return [
        `<rect x="22" y="20" width="36" height="10" rx="4" fill="${hairColor}"/>`,
        `<circle cx="40" cy="15" r="6" fill="${hairColor}"/>`,
      ].join("");
    default:
      return "";
  }
};

const buildHatSvg = (profile: AgentAvatarProfile, accessoryColor: string) => {
  switch (profile.accessories.hatStyle) {
    case "cap":
      return [
        `<rect x="21" y="17" width="38" height="10" rx="4" fill="${accessoryColor}"/>`,
        `<rect x="29" y="25" width="22" height="5" rx="2.5" fill="${blendHex(accessoryColor, "#000000", 0.08)}"/>`,
      ].join("");
    case "beanie":
      return `<path d="M22 27 C22 16, 58 16, 58 27 L58 31 L22 31 Z" fill="${accessoryColor}"/>`;
    default:
      return "";
  }
};

const buildHeadsetSvg = (enabled: boolean) => {
  if (!enabled) return "";
  return [
    `<path d="M24 33 C24 21, 56 21, 56 33" fill="none" stroke="${HEADSET_BAND}" stroke-width="3" stroke-linecap="round"/>`,
    `<rect x="20" y="33" width="6" height="14" rx="3" fill="${HEADSET_PAD}"/>`,
    `<rect x="54" y="33" width="6" height="14" rx="3" fill="${HEADSET_PAD}"/>`,
  ].join("");
};

const buildGlassesSvg = (enabled: boolean) => {
  if (!enabled) return "";
  return [
    `<rect x="26" y="34" width="12" height="10" rx="2" fill="none" stroke="${EYE_COLOR}" stroke-width="2"/>`,
    `<rect x="42" y="34" width="12" height="10" rx="2" fill="none" stroke="${EYE_COLOR}" stroke-width="2"/>`,
    `<rect x="38" y="38" width="4" height="2" rx="1" fill="${EYE_COLOR}"/>`,
  ].join("");
};

export const buildAgentAvatarPortraitSvg = (profile: AgentAvatarProfile): string => {
  const skinTone = profile.body.skinTone;
  const hairColor = profile.hair.color;
  const topColor = profile.clothing.topColor;
  const accessoryColor = blendHex(topColor, "#ffffff", 0.08);
  const shirtShadow = blendHex(topColor, "#000000", 0.18);
  const faceShadow = blendHex(skinTone, "#000000", 0.12);
  const faceHighlight = blendHex(skinTone, "#ffffff", 0.16);

  return [
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 80 80" role="img" aria-label="${escapeXml(profile.seed)} avatar portrait">`,
    `<rect width="80" height="80" rx="18" fill="${AVATAR_BG}"/>`,
    `<circle cx="60" cy="18" r="14" fill="${topColor}" opacity="0.16"/>`,
    `<circle cx="18" cy="66" r="16" fill="${faceHighlight}" opacity="0.1"/>`,
    `<ellipse cx="40" cy="72" rx="18" ry="5" fill="#000000" opacity="0.22"/>`,
    `<rect x="20" y="55" width="40" height="17" rx="8" fill="${topColor}"/>`,
    `<rect x="24" y="55" width="32" height="5" rx="2.5" fill="${shirtShadow}" opacity="0.22"/>`,
    `<rect x="36" y="48" width="8" height="9" rx="2" fill="${faceShadow}"/>`,
    `<rect x="24" y="21" width="32" height="29" rx="6" fill="${skinTone}"/>`,
    `<rect x="27" y="24" width="26" height="8" rx="3" fill="${faceHighlight}" opacity="0.26"/>`,
    buildHairSvg(profile, hairColor),
    buildHatSvg(profile, accessoryColor),
    buildHeadsetSvg(profile.accessories.headset),
    `<rect x="29" y="35" width="7" height="7" rx="1.5" fill="${EYE_COLOR}"/>`,
    `<rect x="44" y="35" width="7" height="7" rx="1.5" fill="${EYE_COLOR}"/>`,
    buildGlassesSvg(profile.accessories.glasses),
    `<rect x="34" y="45" width="12" height="3" rx="1.5" fill="${MOUTH_COLOR}"/>`,
    `</svg>`,
  ].join("");
};

export const buildAgentAvatarPortraitDataUrl = (profile: AgentAvatarProfile): string =>
  `data:image/svg+xml;utf8,${encodeURIComponent(buildAgentAvatarPortraitSvg(profile))}`;
