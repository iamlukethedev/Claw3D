/**
 * Messaging provider abstraction — Phone Booth & SMS Booth.
 *
 * Claw3D supports pluggable messaging backends so users can connect whichever
 * service their OpenClaw workspace uses.
 *
 * ┌─────────────────┬────────────┬──────────────────────────────────────────┐
 * │ Provider        │ MSG  Call  │ Status                                   │
 * ├─────────────────┼────────────┼──────────────────────────────────────────┤
 * │ twilio          │  ✅   ✅   │ Implemented — Twilio REST API            │
 * │ whatsapp        │  ✅   ❌   │ Implemented — Twilio WhatsApp API        │
 * │ telegram        │  ✅   ❌   │ Implemented — Telegram Bot API           │
 * │ imessage        │  ✅   ❌   │ Implemented — BlueBubbles server (Mac)   │
 * └─────────────────┴────────────┴──────────────────────────────────────────┘
 *
 * Active provider selection
 * ─────────────────────────
 * Set `MESSAGING_PROVIDER` in your `.env.local` (defaults to "twilio").
 * Individual API calls may also pass an explicit `provider` field to override.
 *
 * Adding a new provider
 * ─────────────────────
 * 1. Add its key to `MessagingProvider` below.
 * 2. Create `src/lib/office/providers/<name>.ts` that exports the
 *    implementation matching the shapes used in this file.
 * 3. Wire it into `dispatchSendSms` / `dispatchMakeCall`.
 * 4. Add `getSmsProviderStatus` / `getCallProviderStatus` cases.
 * 5. Document required env vars in `.env.example`.
 */

// ── Provider types ────────────────────────────────────────────────────────────

/** All known messaging backends. */
export type MessagingProvider = "twilio" | "whatsapp" | "telegram" | "imessage";

/** Providers that support sending SMS / chat messages. */
export type SmsCapableProvider = Extract<MessagingProvider, "twilio" | "whatsapp" | "telegram" | "imessage">;

/** Providers that support voice calls. */
export type CallCapableProvider = Extract<MessagingProvider, "twilio">;

// ── Active provider resolution ────────────────────────────────────────────────

export const getDefaultSmsProvider = (): SmsCapableProvider => {
  const raw = (process.env.MESSAGING_PROVIDER ?? "twilio").trim().toLowerCase();
  if (raw === "whatsapp") return "whatsapp";
  if (raw === "telegram") return "telegram";
  if (raw === "imessage") return "imessage";
  return "twilio";
};

export const getDefaultCallProvider = (): CallCapableProvider => {
  // Only Twilio supports outbound calls via a public API.
  // WhatsApp and Telegram do not expose programmatic outbound calling.
  return "twilio";
};

// ── Shared param / result types ───────────────────────────────────────────────

export type SendSmsParams = {
  to: string;
  body: string;
  /** Override the active provider for this request. */
  provider?: SmsCapableProvider;
};

export type MakeCallParams = {
  to: string;
  message: string;
  /** Override the active provider for this request. */
  provider?: CallCapableProvider;
};

export type MessagingResult = { sid: string };

// ── SMS / message dispatch ────────────────────────────────────────────────────

export async function dispatchSendSms(params: SendSmsParams): Promise<MessagingResult> {
  const provider = params.provider ?? getDefaultSmsProvider();

  switch (provider) {
    case "twilio": {
      const { sendSms } = await import("./twilio");
      return sendSms({ to: params.to, body: params.body });
    }

    case "whatsapp": {
      /**
       * Sends a WhatsApp message via the Twilio WhatsApp API.
       * Requires: TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_WHATSAPP_NUMBER
       * Setup:    console.twilio.com/develop/sms/whatsapp/senders
       */
      const { sendWhatsAppMessage } = await import("./providers/whatsapp");
      return sendWhatsAppMessage({ to: params.to, body: params.body });
    }

    case "telegram": {
      /**
       * Sends a message via the Telegram Bot API.
       * Requires: TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID
       * Setup:    message @BotFather on Telegram to create a bot.
       */
      const { sendTelegramMessage } = await import("./providers/telegram");
      return sendTelegramMessage({ text: params.body });
    }

    case "imessage": {
      /**
       * Sends an iMessage via a BlueBubbles server running on a Mac.
       * Requires: IMESSAGE_BLUEBUBBLES_URL, IMESSAGE_BLUEBUBBLES_PASSWORD
       * Setup:    https://bluebubbles.app — install on a Mac signed into iMessage.
       */
      const { sendIMessage } = await import("./providers/imessage");
      return sendIMessage({ to: params.to, body: params.body });
    }
  }
}

// ── Call dispatch ─────────────────────────────────────────────────────────────

export async function dispatchMakeCall(params: MakeCallParams): Promise<MessagingResult> {
  const provider = params.provider ?? getDefaultCallProvider();

  switch (provider) {
    case "twilio": {
      const { makeCall } = await import("./twilio");
      return makeCall({ to: params.to, message: params.message });
    }
  }
}

// ── Configuration helpers ─────────────────────────────────────────────────────

export type ProviderConfigStatus = "configured" | "not_configured" | "not_supported";

export function getSmsProviderStatus(provider: SmsCapableProvider): ProviderConfigStatus {
  switch (provider) {
    case "twilio": {
      const ok =
        Boolean(process.env.TWILIO_ACCOUNT_SID?.trim()) &&
        Boolean(process.env.TWILIO_AUTH_TOKEN?.trim()) &&
        Boolean(process.env.TWILIO_PHONE_NUMBER?.trim());
      return ok ? "configured" : "not_configured";
    }
    case "whatsapp": {
      const ok =
        Boolean(process.env.TWILIO_ACCOUNT_SID?.trim()) &&
        Boolean(process.env.TWILIO_AUTH_TOKEN?.trim()) &&
        Boolean(process.env.TWILIO_WHATSAPP_NUMBER?.trim());
      return ok ? "configured" : "not_configured";
    }
    case "telegram": {
      const ok =
        Boolean(process.env.TELEGRAM_BOT_TOKEN?.trim()) &&
        Boolean(process.env.TELEGRAM_CHAT_ID?.trim());
      return ok ? "configured" : "not_configured";
    }
    case "imessage": {
      const ok =
        Boolean(process.env.IMESSAGE_BLUEBUBBLES_URL?.trim()) &&
        Boolean(process.env.IMESSAGE_BLUEBUBBLES_PASSWORD?.trim());
      return ok ? "configured" : "not_configured";
    }
  }
}

export function getCallProviderStatus(provider: CallCapableProvider): ProviderConfigStatus {
  switch (provider) {
    case "twilio":
      return getSmsProviderStatus("twilio");
  }
}

/** Returns true when at least one messaging provider is ready. */
export const isAnyMessagingConfigured = (): boolean =>
  getSmsProviderStatus(getDefaultSmsProvider()) === "configured";
