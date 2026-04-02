import { z } from "zod";
import type {
  CryptoLaunchDraft,
  CryptoLaunchExecutionMode,
  CryptoLaunchQuestionId,
} from "@/features/crypto/types";

const dataUrlSchema = z.string().regex(/^data:[^;]+;base64,/i, "Invalid data URL.");
const urlSchema = z.string().url();
const optionalUrlSchema = z.union([z.literal(""), urlSchema]);
const optionalHandleSchema = z.string().trim().max(240);
const optionalAssetSchema = z.union([z.literal(""), urlSchema, dataUrlSchema]);

export const CRYPTO_LAUNCH_REQUIRED_FIELDS: readonly CryptoLaunchQuestionId[] = [
  "network",
  "executionMode",
  "name",
  "symbol",
  "description",
  "logoUrl",
] as const;

export const cryptoLaunchDraftSchema = z.object({
  network: z.enum(["devnet", "mainnet"]),
  executionMode: z.enum(["user_approved", "server_side"]),
  name: z.string().trim().min(1).max(32),
  symbol: z
    .string()
    .trim()
    .min(1)
    .max(10)
    .regex(/^[A-Za-z0-9]+$/, "Token symbol must be letters and numbers only."),
  description: z.string().trim().min(1).max(280),
  logoUrl: optionalAssetSchema,
  website: optionalUrlSchema,
  twitter: optionalHandleSchema,
  telegram: optionalHandleSchema,
  discord: optionalHandleSchema,
  creatorWallet: z.string().trim().default(""),
  priorityFeeSol: z.number().min(0).max(0.1),
  computeUnitLimit: z.number().int().min(200_000).max(1_600_000),
});

export const cryptoLaunchPrepareSchema = z
  .object({
    draft: cryptoLaunchDraftSchema,
    creatorPublicKey: z.string().trim().optional(),
  })
  .superRefine((payload, ctx) => {
    if (payload.draft.executionMode === "user_approved" && !payload.creatorPublicKey?.trim()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "A connected wallet is required for user-approved launches.",
        path: ["creatorPublicKey"],
      });
    }
  });

export const cryptoLaunchSubmitSchema = z
  .object({
    launchId: z.string().trim().min(1),
    executionMode: z.enum(["user_approved", "server_side"]),
    submitToken: z.string().trim().min(1),
    signedTransaction: z.string().trim().optional(),
  })
  .superRefine((payload, ctx) => {
    if (payload.executionMode === "user_approved" && !payload.signedTransaction?.trim()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "A signed transaction is required for wallet-approved launches.",
        path: ["signedTransaction"],
      });
    }
  });

export const normalizeLaunchDraft = (draft: Partial<CryptoLaunchDraft> | null | undefined): CryptoLaunchDraft => ({
  network: draft?.network === "mainnet" ? "mainnet" : "devnet",
  executionMode: draft?.executionMode === "server_side" ? "server_side" : "user_approved",
  name: draft?.name?.trim() ?? "",
  symbol: draft?.symbol?.trim().toUpperCase() ?? "",
  description: draft?.description?.trim() ?? "",
  logoUrl: draft?.logoUrl?.trim() ?? "",
  website: draft?.website?.trim() ?? "",
  twitter: draft?.twitter?.trim() ?? "",
  telegram: draft?.telegram?.trim() ?? "",
  discord: draft?.discord?.trim() ?? "",
  creatorWallet: draft?.creatorWallet?.trim() ?? "",
  priorityFeeSol:
    typeof draft?.priorityFeeSol === "number" && Number.isFinite(draft.priorityFeeSol)
      ? draft.priorityFeeSol
      : 0.0005,
  computeUnitLimit:
    typeof draft?.computeUnitLimit === "number" && Number.isFinite(draft.computeUnitLimit)
      ? Math.trunc(draft.computeUnitLimit)
      : 500_000,
});

const FIELD_LABELS: Record<CryptoLaunchQuestionId, string> = {
  network: "network",
  executionMode: "execution mode",
  name: "token name",
  symbol: "token symbol",
  description: "token description",
  logoUrl: "logo URL",
  website: "website URL",
  twitter: "Twitter/X URL",
  telegram: "Telegram URL",
  discord: "Discord URL",
  confirm: "launch confirmation",
};

export const getLaunchFieldLabel = (field: CryptoLaunchQuestionId): string => FIELD_LABELS[field];

export const getMissingRequiredLaunchField = (
  draft: CryptoLaunchDraft,
): Exclude<CryptoLaunchQuestionId, "confirm"> | null => {
  for (const field of CRYPTO_LAUNCH_REQUIRED_FIELDS) {
    const value = draft[field as keyof CryptoLaunchDraft];
    if (typeof value !== "string" || value.trim().length === 0) {
      return field as Exclude<CryptoLaunchQuestionId, "confirm">;
    }
  }
  return null;
};

export const isSkipAnswer = (value: string): boolean => /^(skip|none|n\/a|na)$/i.test(value.trim());

export const parseNetworkAnswer = (value: string): CryptoLaunchDraft["network"] | null => {
  const normalized = value.trim().toLowerCase();
  if (normalized.includes("main")) return "mainnet";
  if (normalized.includes("dev")) return "devnet";
  return null;
};

export const parseExecutionModeAnswer = (
  value: string,
): CryptoLaunchExecutionMode | null => {
  const normalized = value.trim().toLowerCase();
  if (
    normalized.includes("server") ||
    normalized.includes("automatic") ||
    normalized.includes("automated")
  ) {
    return "server_side";
  }
  if (
    normalized.includes("wallet") ||
    normalized.includes("approve") ||
    normalized.includes("phantom") ||
    normalized.includes("manual")
  ) {
    return "user_approved";
  }
  return null;
};
