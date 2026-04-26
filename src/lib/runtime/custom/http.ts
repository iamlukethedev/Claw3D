export const normalizeCustomBaseUrl = (value: string): string => {
  const trimmed = value.trim();
  if (!trimmed) return "";
  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol === "ws:") {
      parsed.protocol = "http:";
    } else if (parsed.protocol === "wss:") {
      parsed.protocol = "https:";
    }
    return parsed.toString().replace(/\/$/, "");
  } catch {
    return trimmed.replace(/\/$/, "");
  }
};

type CustomRuntimeProxyInput = {
  runtimeUrl: string;
  pathname: string;
  method?: "GET" | "POST";
  body?: unknown;
  signal?: AbortSignal;
};

export async function requestCustomRuntime<T = unknown>({
  runtimeUrl,
  pathname,
  method = "GET",
  body,
  signal,
}: CustomRuntimeProxyInput): Promise<T> {
  const normalizedRuntimeUrl = normalizeCustomBaseUrl(runtimeUrl);
  if (!normalizedRuntimeUrl) {
    throw new Error("Custom runtime URL is not configured.");
  }
  const response = await fetch("/api/runtime/custom", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    cache: "no-store",
    signal,
    body: JSON.stringify({
      runtimeUrl: normalizedRuntimeUrl,
      pathname,
      method,
      body,
    }),
  });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(
      text.trim() || `Custom runtime request failed (${response.status}) for ${pathname}.`
    );
  }
  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) {
    // Non-JSON success response (e.g. plain-text /health "OK") — return as-is.
    return (await response.text()) as unknown as T;
  }
  return (await response.json()) as T;
}

export async function fetchCustomRuntimeJson<T = unknown>(
  runtimeUrl: string,
  pathname: string
): Promise<T> {
  return requestCustomRuntime<T>({ runtimeUrl, pathname, method: "GET" });
}

export async function probeCustomRuntime(runtimeUrl: string): Promise<void> {
  await fetchCustomRuntimeJson(runtimeUrl, "/health");
}
