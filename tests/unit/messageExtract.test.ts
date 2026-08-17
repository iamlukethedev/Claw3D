import { describe, expect, it } from "vitest";

import { normalizeAssistantDisplayText } from "@/lib/text/assistantText";
import {
  buildAgentInstruction,
  EXEC_APPROVAL_AUTO_RESUME_MARKER,
  extractText,
  extractTextCached,
  extractThinking,
  extractThinkingCached,
  extractToolLines,
  isUiMetadataPrefix,
  stripUiMetadata,
} from "@/lib/text/message-extract";

describe("message-extract", () => {
  it("strips envelope headers from user messages", () => {
    const message = {
      role: "user",
      content:
        "[Discord Guild #hermes3d channel id:123 +0s 2026-02-01 00:00 UTC] hello there",
    };

    expect(extractText(message)).toBe("hello there");
  });

  it("removes <thinking>/<analysis> blocks from assistant-visible text", () => {
    const message = {
      role: "assistant",
      content: "<thinking>Plan A</thinking>\n<analysis>Details</analysis>\nOk.",
    };

    expect(extractText(message)).toBe("Ok.");
  });

  it("strips assistant control prefixes in single- and double-bracket forms", () => {
    expect(extractText({ role: "assistant", content: "[reply_to_current] hello" })).toBe("hello");
    expect(extractText({ role: "assistant", content: "[[reply_to_current]] hello" })).toBe("hello");
  });

  it("extractTextCached matches extractText and is consistent", () => {
    const message = { role: "user", content: "plain text" };

    expect(extractTextCached(message)).toBe(extractText(message));
    expect(extractTextCached(message)).toBe("plain text");
    expect(extractTextCached(message)).toBe("plain text");
  });

  it("extractThinkingCached matches extractThinking and is consistent", () => {
    const message = {
      role: "assistant",
      content: [{ type: "thinking", thinking: "Plan A" }],
    };

    expect(extractThinkingCached(message)).toBe(extractThinking(message));
    expect(extractThinkingCached(message)).toBe("Plan A");
    expect(extractThinkingCached(message)).toBe("Plan A");
  });

  it("formats tool call + tool result lines", () => {
    const callMessage = {
      role: "assistant",
      content: [
        {
          type: "toolCall",
          id: "call-1",
          name: "functions.exec",
          arguments: { command: "echo hi" },
        },
      ],
    };

    const resultMessage = {
      role: "toolResult",
      toolCallId: "call-1",
      toolName: "functions.exec",
      details: { status: "ok", exitCode: 0 },
      content: "hi\n",
    };

    const callLines = extractToolLines(callMessage).join("\n");
    expect(callLines).toContain("[[tool]] functions.exec (call-1)");
    expect(callLines).toContain("\"command\": \"echo hi\"");

    const resultLines = extractToolLines(resultMessage).join("\n");
    expect(resultLines).toContain("[[tool-result]] functions.exec (call-1)");
    expect(resultLines).toContain("ok");
    expect(resultLines).toContain("hi");
  });

  it("does not treat normal messages as UI metadata", () => {
    const built = buildAgentInstruction({
      message: "hello",
    });

    expect(isUiMetadataPrefix(built)).toBe(false);
    expect(stripUiMetadata(built)).toContain("hello");
    expect(stripUiMetadata(built)).not.toContain("Execution approval policy:");
  });

  it("strips leading system event blocks from queued session updates", () => {
    const raw = `System: [2026-02-12 01:09:16 UTC] Exec failed (mild-she, signal SIGKILL)

[Thu 2026-02-12 01:14 UTC] nope none of those are it. keep looking
[message_id: e050a641-aa32-4950-8083-c3bb7efdfc6d]`;

    expect(stripUiMetadata(raw)).toBe("nope none of those are it. keep looking");
  });

  it("hides internal exec approval auto-resume messages from transcript text", () => {
    const raw = `[Tue 2026-02-17 12:52 PST] ${EXEC_APPROVAL_AUTO_RESUME_MARKER}
Continue where you left off and finish the task.`;
    expect(stripUiMetadata(raw)).toBe("");
  });

  it("hides legacy auto-resume messages without internal marker", () => {
    const raw = `printf "\\n== Root (/) ==\\n" ls -la /
[Tue 2026-02-17 12:52 PST] The exec approval was granted. Continue where you left off and finish the task.`;
    expect(stripUiMetadata(raw)).toBe("");
  });

  it("normalizes assistant helper text shape", () => {
    expect(normalizeAssistantDisplayText("first\r\n\r\n\r\nsecond")).toBe("first\n\nsecond");
    expect(normalizeAssistantDisplayText("line one  \nline two\t \n")).toBe("line one\nline two");
    expect(normalizeAssistantDisplayText("\n\nalpha\n\n\nbeta\n\n")).toBe("alpha\n\nbeta");
  });
});
