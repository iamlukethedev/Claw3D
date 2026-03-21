/**
 * Telegram provider — sends messages via the Telegram Bot API.
 *
 * Required env vars:
 *   TELEGRAM_BOT_TOKEN  — your bot token from @BotFather
 *                         format: 123456789:ABCdefGhIJKlmNoPQRsTUVwxyZ
 *   TELEGRAM_CHAT_ID    — the chat_id to send messages to
 *                         Can be a personal chat, group, or channel.
 *                         To find your chat_id: message your bot and call
 *                         https://api.telegram.org/bot<TOKEN>/getUpdates
 *
 * Important: the bot must have been started by the recipient first
 * (i.e. they must have sent at least one message to the bot).
 * For group chats, the bot must be a member of the group.
 *
 * Note: outbound calls are not supported via the Telegram Bot API.
 *
 * Docs: https://core.telegram.org/bots/api#sendmessage
 */

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN?.trim() ?? "";
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID?.trim() ?? "";

const telegramApiUrl = (method: string) =>
  `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/${method}`;

export const isTelegramConfigured = (): boolean =>
  Boolean(TELEGRAM_BOT_TOKEN && TELEGRAM_CHAT_ID);

export const sendTelegramMessage = async (params: {
  /** Target chat. Defaults to TELEGRAM_CHAT_ID env var. */
  chatId?: string;
  text: string;
}): Promise<{ sid: string }> => {
  const chatId = params.chatId?.trim() || TELEGRAM_CHAT_ID;
  if (!chatId) throw new Error("Telegram chat_id is required.");

  const response = await fetch(telegramApiUrl("sendMessage"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: chatId,
      text: params.text,
      parse_mode: "HTML",
    }),
  });

  if (!response.ok) {
    const error = (await response.json()) as { description?: string };
    throw new Error(error.description ?? `Telegram error ${response.status}`);
  }

  const result = (await response.json()) as { result?: { message_id?: number } };
  // Telegram returns a message_id — we normalise it to a sid string for consistency
  return { sid: String(result.result?.message_id ?? "ok") };
};
