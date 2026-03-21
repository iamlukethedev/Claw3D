/**
 * Messaging provider abstraction — Phone Booth & SMS Booth.
 *
 * Claw3D supports pluggable messaging backends so users can connect whichever
 * service their OpenClaw workspace uses.
 *
 * ┌─────────────────┬────────────┬──────────────────────────────────────────┐
 * │ Provider        │ SMS  Call  │ Status                                   │
 * ├─────────────────┼────────────┼──────────────────────────────────────────┤
 * │ twilio          │  ✅   ✅   │ Implemented — Twilio REST API            │
 * │ whatsapp        │  🔜   🔜   │ Planned — Twilio WhatsApp / Meta Cloud   │
 * │ telegram        │  🔜   —    │ Planned — Telegram Bot API               │
 * │ imessage        │  🔜   —    │ Planned — Apple Messages for Business    │
 * └─────────────────┴────────────┴──────────────────────────────────────────┘
 *
 * Adding a new provider
 * ─────────────────────
 * 1. Add its key to `MessagingProvider` below.
 * 2. Create `src/lib/office/providers/<name>.ts` that exports
 *    `sendSms()` and/or `makeCall()` matching the shapes here.
 * 3. Wire it into `dispatchSendSms` / `dispatchMakeCall`.
 * 4. Document required env vars in `.env.example` under the new provider block.
 *
 * Active provider selection
 * ─────────────────────────
 * Set `MESSAGING_PROVIDER` in your `.env.local` (defaults to "twilio").
 * Individual API calls may also pass an explicit `provider` field to override.
 */

// ── Provider types ────────────────────────────────────────────────────────────

/** All known messaging backends. */
export type MessagingProvider = "twilio" | "whatsapp" | "telegram" | "imessage";

/** Providers that support sending SMS / chat messages. */
export type SmsCapableProvider = Extract<MessagingProvider, "twilio" | "whatsapp" | "telegram">;

/** Providers that support voice calls. */
export type CallCapableProvider = Extract<MessagingProvider, "twilio" | "whatsapp">;

// ── Active provider resolution ────────────────────────────────────────────────

export const getDefaultSmsProvider = (): SmsCapableProvider => {
  const raw = (process.env.MESSAGING_PROVIDER ?? "twilio").trim().toLowerCase();
  if (raw === "whatsapp") return "whatsapp";
  if (raw === "telegram") return "telegram";
  return "twilio";
};

export const getDefaultCallProvider = (): CallCapableProvider => {
  const raw = (process.env.MESSAGING_PROVIDER ?? "twilio").trim().toLowerCase();
  if (raw === "whatsapp") return "whatsapp";
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

// ── SMS dispatch ──────────────────────────────────────────────────────────────

export async function dispatchSendSms(params: SendSmsParams): Promise<MessagingResult> {
  const provider = params.provider ?? getDefaultSmsProvider();

  switch (provider) {
    case "twilio": {
      const { sendSms } = await import("./twilio");
      return sendSms({ to: params.to, body: params.body });
    }

    case "whatsapp":
      /**
       * WhatsApp via Twilio:  https://www.twilio.com/en-us/whatsapp
       * WhatsApp via Meta:    https://developers.facebook.com/docs/whatsapp/cloud-api
       *
       * Required env vars (example):
       *   WHATSAPP_PROVIDER=twilio          # "twilio" or "meta"
       *   TWILIO_WHATSAPP_NUMBER=whatsapp:+14155238886
       *   META_WHATSAPP_TOKEN=...
       *   META_WHATSAPP_PHONE_NUMBER_ID=...
       */
      throw new Error(
        "WhatsApp provider is not yet implemented. " +
          "Contributions welcome: https://github.com/iamlukethedev/Claw3D",
      );

    case "telegram":
      /**
       * Telegram Bot API:  https://core.telegram.org/bots/api#sendmessage
       *
       * Required env vars (example):
       *   TELEGRAM_BOT_TOKEN=...
       *   TELEGRAM_CHAT_ID=...   # or resolve dynamically from recipient username
       */
      throw new Error(
        "Telegram provider is not yet implemented. " +
          "Contributions welcome: https://github.com/iamlukethedev/Claw3D",
      );
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

    case "whatsapp":
      /**
       * WhatsApp voice calls via Meta Cloud API (beta):
       *   https://developers.facebook.com/docs/whatsapp/cloud-api/calling
       *
       * Note: iMessage does not expose a public calling API.
       * Apple Messages for Business supports chat only.
       */
      throw new Error(
        "WhatsApp call provider is not yet implemented. " +
          "Contributions welcome: https://github.com/iamlukethedev/Claw3D",
      );
  }
}

// ── Configuration helpers ─────────────────────────────────────────────────────

export type ProviderConfigStatus = "configured" | "not_configured" | "not_implemented";

export function getSmsProviderStatus(provider: SmsCapableProvider): ProviderConfigStatus {
  switch (provider) {
    case "twilio": {
      const configured =
        Boolean(process.env.TWILIO_ACCOUNT_SID?.trim()) &&
        Boolean(process.env.TWILIO_AUTH_TOKEN?.trim()) &&
        Boolean(process.env.TWILIO_PHONE_NUMBER?.trim());
      return configured ? "configured" : "not_configured";
    }
    case "whatsapp":
    case "telegram":
      return "not_implemented";
  }
}

export function getCallProviderStatus(provider: CallCapableProvider): ProviderConfigStatus {
  switch (provider) {
    case "twilio":
      return getSmsProviderStatus("twilio");
    case "whatsapp":
      return "not_implemented";
  }
}

/** Returns true when at least one SMS provider is ready. */
export const isAnyMessagingConfigured = (): boolean =>
  getSmsProviderStatus(getDefaultSmsProvider()) === "configured";
