import type { CryptoLaunchDraft, CryptoLaunchPrepared, CryptoLaunchResult } from "@/features/crypto/types";
import { getPhantomProvider } from "@/features/crypto/lib/solana";

function deserializeTransaction(base64Transaction: string) {
  return Uint8Array.from(atob(base64Transaction), (char) => char.charCodeAt(0));
}

function serializeSignedTransaction(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary);
}

async function readJson(response: Response) {
  const payload = (await response.json().catch(() => null)) as
    | {
        error?: string;
        prepared?: CryptoLaunchPrepared;
        result?: CryptoLaunchResult;
        authenticated?: boolean;
      }
    | null;
  if (!response.ok) {
    throw new Error(payload?.error?.trim() || `Request failed with status ${response.status}.`);
  }
  return payload;
}

function isPhantomUnauthorizedError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return /not been authorized|not authorized by the user|unauthorized/i.test(message);
}

function isPhantomUserRejection(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return /user rejected|user denied|cancelled|canceled/i.test(message);
}

async function connectAuthorizedPhantom(provider: NonNullable<ReturnType<typeof getPhantomProvider>>) {
  try {
    return await provider.connect();
  } catch (error) {
    if (!isPhantomUnauthorizedError(error)) {
      throw error;
    }
    await provider.disconnect().catch(() => {});
    return provider.connect();
  }
}

export async function prepareCryptoLaunch(
  draft: CryptoLaunchDraft,
  creatorPublicKey?: string,
): Promise<CryptoLaunchPrepared> {
  const response = await fetch("/api/crypto/launch/prepare", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      draft,
      creatorPublicKey,
    }),
  });
  const payload = await readJson(response);
  if (!payload?.prepared) {
    throw new Error("The launch preparation response was incomplete.");
  }
  return payload.prepared;
}

export async function submitCryptoLaunch(params: {
  launchId: string;
  executionMode: CryptoLaunchDraft["executionMode"];
  submitToken: string;
  signedTransaction?: string;
}): Promise<CryptoLaunchResult> {
  const response = await fetch("/api/crypto/launch/submit", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(params),
  });
  const payload = await readJson(response);
  if (!payload?.result) {
    throw new Error("The launch submission response was incomplete.");
  }
  return payload.result;
}

export async function executeWalletApprovedLaunch(
  draft: CryptoLaunchDraft,
): Promise<{ prepared: CryptoLaunchPrepared; result: CryptoLaunchResult; creatorPublicKey: string }> {
  const provider = getPhantomProvider();
  if (!provider) {
    throw new Error("Phantom was not detected in this browser.");
  }
  const connected = provider.publicKey
    ? { publicKey: provider.publicKey }
    : await connectAuthorizedPhantom(provider);
  const creatorPublicKey = connected.publicKey.toBase58();
  const prepared = await prepareCryptoLaunch(draft, creatorPublicKey);
  if (!prepared.serializedTransaction) {
    throw new Error("The launch is missing a transaction to sign.");
  }
  const mod = await import("@solana/web3.js");
  const transaction = mod.VersionedTransaction.deserialize(
    deserializeTransaction(prepared.serializedTransaction),
  );
  let signed: InstanceType<typeof mod.VersionedTransaction>;
  try {
    signed = await provider.signTransaction(transaction);
  } catch (error) {
    if (isPhantomUnauthorizedError(error)) {
      await provider.disconnect().catch(() => {});
      throw new Error(
        "Phantom is no longer authorized for this site. Reconnect your wallet and try launching again.",
      );
    }
    if (isPhantomUserRejection(error)) {
      await provider.disconnect().catch(() => {});
      throw new Error(
        "Phantom approval was cancelled. Reconnect your wallet and try launching again.",
      );
    }
    throw error;
  }
  const result = await submitCryptoLaunch({
    launchId: prepared.launchId,
    executionMode: "user_approved",
    submitToken: prepared.submitToken,
    signedTransaction: serializeSignedTransaction(signed.serialize()),
  });
  return { prepared, result, creatorPublicKey };
}

export async function executeServerSideLaunch(
  draft: CryptoLaunchDraft,
): Promise<{ prepared: CryptoLaunchPrepared; result: CryptoLaunchResult }> {
  const prepared = await prepareCryptoLaunch(draft);
  const result = await submitCryptoLaunch({
    launchId: prepared.launchId,
    executionMode: "server_side",
    submitToken: prepared.submitToken,
  });
  return { prepared, result };
}

export async function getServerLaunchSessionStatus(): Promise<boolean> {
  const response = await fetch("/api/crypto/launch/session", {
    method: "GET",
    cache: "no-store",
  });
  const payload = await readJson(response);
  return Boolean(payload?.authenticated);
}

export async function loginServerLaunchSession(password: string): Promise<boolean> {
  const response = await fetch("/api/crypto/launch/session", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ password }),
  });
  const payload = await readJson(response);
  return Boolean(payload?.authenticated);
}

export async function logoutServerLaunchSession(): Promise<void> {
  const response = await fetch("/api/crypto/launch/session", {
    method: "DELETE",
  });
  await readJson(response);
}
