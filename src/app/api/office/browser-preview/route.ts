import { NextResponse } from "next/server";

import {
  normalizeBrowserPreviewUrl,
  resolveBrowserControlBaseUrl,
} from "@/lib/office/browserPreview";
import { validateBrowserPreviewTarget, isPrivateOrLoopbackHostname } from "@/lib/security/urlSafety";
import { loadStudioSettings } from "@/lib/studio/settings-store";

export const runtime = "nodejs";

type BrowserTab = {
  targetId: string;
  url: string;
};

type BrowserTabsResponse = {
  running?: boolean;
  tabs?: BrowserTab[];
};

type BrowserOpenResponse = {
  targetId?: string;
  url?: string;
};

type BrowserScreenshotResponse = {
  ok?: boolean;
  path?: string;
  targetId?: string;
  url?: string;
};

const DEFAULT_CAPTURE_WAIT_MS = 1_500;

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const buildBrowserHeaders = (token: string | null): HeadersInit => {
  if (!token) return { "Content-Type": "application/json" };
  return {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
  };
};

const parseBrowserError = async (response: Response): Promise<string> => {
  try {
    const payload = (await response.json()) as { error?: string; message?: string };
    return payload.error?.trim() || payload.message?.trim() || response.statusText || "Browser request failed";
  } catch {
    return response.statusText || "Browser request failed";
  }
};

const browserRequest = async <T>(
  baseUrl: string,
  pathname: string,
  init: RequestInit,
  token: string | null,
): Promise<T> => {
  const response = await fetch(`${baseUrl}${pathname}`, {
    ...init,
    headers: {
      ...buildBrowserHeaders(token),
      ...(init.headers ?? {}),
    },
    cache: "no-store",
  });
  if (!response.ok) {
    throw new Error(await parseBrowserError(response));
  }
  return (await response.json()) as T;
};

const samePreviewTarget = (left: string, right: string): boolean => {
  return normalizeBrowserPreviewUrl(left) === normalizeBrowserPreviewUrl(right);
};

const ensurePreviewTab = async (
  baseUrl: string,
  token: string | null,
  browserUrl: string,
): Promise<{ targetId: string; resolvedUrl: string }> => {
  const tabsPayload = await browserRequest<BrowserTabsResponse>(baseUrl, "/tabs", { method: "GET" }, token);

  if (tabsPayload.running === false) {
    await browserRequest(baseUrl, "/start", { method: "POST" }, token);
    await sleep(400);
  }

  const tabs = Array.isArray(tabsPayload.tabs) ? tabsPayload.tabs : [];
  const exactMatch = tabs.find((tab) => samePreviewTarget(tab.url, browserUrl));
  if (exactMatch?.targetId) {
    await browserRequest(baseUrl, "/tabs/focus", {
      method: "POST",
      body: JSON.stringify({ targetId: exactMatch.targetId }),
    }, token);
    return { targetId: exactMatch.targetId, resolvedUrl: exactMatch.url || browserUrl };
  }

  const reusableTab = tabs[0];
  if (reusableTab?.targetId) {
    await browserRequest(baseUrl, "/tabs/focus", {
      method: "POST",
      body: JSON.stringify({ targetId: reusableTab.targetId }),
    }, token);
    await browserRequest(baseUrl, "/navigate", {
      method: "POST",
      body: JSON.stringify({ targetId: reusableTab.targetId, url: browserUrl }),
    }, token);
    return { targetId: reusableTab.targetId, resolvedUrl: browserUrl };
  }

  const opened = await browserRequest<BrowserOpenResponse>(baseUrl, "/tabs/open", {
    method: "POST",
    body: JSON.stringify({ url: browserUrl }),
  }, token);
  if (!opened.targetId) {
    throw new Error("Browser preview did not return a target tab.");
  }
  return { targetId: opened.targetId, resolvedUrl: opened.url || browserUrl };
};

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const rawUrl = (searchParams.get("url") ?? "").trim();
    if (!rawUrl) {
      return NextResponse.json({ error: "url is required" }, { status: 400 });
    }

    let browserUrl: string;
    try {
      browserUrl = validateBrowserPreviewTarget(rawUrl).toString();
    } catch {
      return NextResponse.json(
        { error: "url must be an absolute public http(s) URL" },
        { status: 400 }
      );
    }

    const waitMsRaw = Number(searchParams.get("waitMs") ?? "");
    const waitMs =
      Number.isFinite(waitMsRaw) && waitMsRaw >= 0
        ? Math.min(Math.round(waitMsRaw), 8_000)
        : DEFAULT_CAPTURE_WAIT_MS;

    const settings = loadStudioSettings();
    const gatewayUrl = settings.gateway?.url?.trim() ?? "";
    const controlBaseUrl = resolveBrowserControlBaseUrl(gatewayUrl);
    if (!controlBaseUrl) {
      return NextResponse.json(
        { error: "Browser screenshot preview only works when Studio is connected to a local gateway." },
        { status: 501 },
      );
    }

    const token = settings.gateway?.token?.trim() || null;
    const { targetId, resolvedUrl } = await ensurePreviewTab(controlBaseUrl, token, browserUrl);

    if (waitMs > 0) {
      await sleep(waitMs);
    }

    const screenshot = await browserRequest<BrowserScreenshotResponse>(controlBaseUrl, "/screenshot", {
      method: "POST",
      body: JSON.stringify({ targetId, type: "png" }),
    }, token);

    // Re-validate final URL after navigation to prevent SSRF via redirects/DNS rebinding
    if (screenshot.url) {
      try {
        const finalParsed = new URL(screenshot.url);
        if (isPrivateOrLoopbackHostname(finalParsed.hostname)) {
          return NextResponse.json(
            { error: "Browser preview target redirected to a private network address." },
            { status: 400 }
          );
        }
      } catch {
        // Invalid URL in screenshot response - continue with caution
      }
    }

    if (!screenshot.path?.trim()) {
      throw new Error("Browser screenshot did not return a media path.");
    }

    const mediaUrl = `/api/gateway/media?path=${encodeURIComponent(screenshot.path)}`;
    return NextResponse.json(
      {
        ok: true,
        browserUrl: screenshot.url || resolvedUrl,
        imagePath: screenshot.path,
        mediaUrl,
        targetId: screenshot.targetId || targetId,
        capturedAt: Date.now(),
      },
      {
        headers: {
          "Cache-Control": "no-store",
        },
      },
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to build browser preview";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
