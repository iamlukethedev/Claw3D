export const CRYPTO_ROOM_PAIR_ADDRESS = "6rpwhgzzdvsbn1lty58h9krjfqsezkpnbeitngmyvsvc";
export const CRYPTO_ROOM_DEXSCREENER_URL =
  `https://dexscreener.com/solana/${CRYPTO_ROOM_PAIR_ADDRESS}`;

export const SOL_MINT = "So11111111111111111111111111111111111111112";
export const SOL_DECIMALS = 9;
export const TOKEN_PROGRAM_ID = "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA";
export const TOKEN_2022_PROGRAM_ID = "TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb";
// eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
export const SOLANA_MAINNET_RPC: string = process.env.NEXT_PUBLIC_SOLANA_RPC_URL ?? "";

export const SOLANA_RPC_ENDPOINTS: readonly string[] = [
  ...(SOLANA_MAINNET_RPC ? [SOLANA_MAINNET_RPC] : []),
  "https://rpc.ankr.com/solana",
  "https://solana-rpc.publicnode.com",
  "https://api.mainnet-beta.solana.com",
];

export const CRYPTO_ROOM_STORAGE_KEY = "openclaw-crypto-room-v1";
export const CRYPTO_ROOM_APPROVAL_TTL_MS = 15 * 60 * 1000;
export const CRYPTO_ROOM_AGENT_LOOP_MS = 45 * 1000;
