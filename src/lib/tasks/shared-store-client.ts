import type { SharedTaskRecord } from "@/lib/tasks/shared-store";

const TASK_STORE_ROUTE = "/api/task-store";
const REQUEST_TIMEOUT_MS = 8_000;
const MAX_RETRIES = 2;
const RETRY_BASE_DELAY_MS = 500;

export class TaskStoreRequestError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "TaskStoreRequestError";
    this.status = status;
  }
}

const isRetryable = (error: unknown): boolean => {
  if (error instanceof TaskStoreRequestError) {
    return error.status >= 500 || error.status === 429;
  }
  if (error instanceof DOMException && error.name === "AbortError") return false;
  return error instanceof TypeError;
};

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

const fetchWithTimeout = (
  input: RequestInfo,
  init?: RequestInit
): Promise<Response> => {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  return fetch(input, { ...init, signal: controller.signal }).finally(() =>
    clearTimeout(timer)
  );
};

const parseResponse = async <T>(response: Response): Promise<T> => {
  const body = (await response.json().catch(() => null)) as { error?: string } & T;
  if (!response.ok) {
    throw new TaskStoreRequestError(
      body?.error || "Task store request failed.",
      response.status,
    );
  }
  return body;
};

const withRetry = async <T>(fn: () => Promise<T>): Promise<T> => {
  let lastError: unknown;
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      if (!isRetryable(error) || attempt === MAX_RETRIES) break;
      await sleep(RETRY_BASE_DELAY_MS * 2 ** attempt);
    }
  }
  throw lastError;
};

export const listSharedTaskRecords = async (): Promise<SharedTaskRecord[]> =>
  withRetry(async () => {
    const response = await fetchWithTimeout(TASK_STORE_ROUTE, {
      method: "GET",
      cache: "no-store",
    });
    const body = await parseResponse<{ tasks: SharedTaskRecord[] }>(response);
    return Array.isArray(body.tasks) ? body.tasks : [];
  });

export const upsertSharedTaskRecord = async (
  task: Partial<SharedTaskRecord> & Pick<SharedTaskRecord, "id" | "title">
): Promise<SharedTaskRecord> =>
  withRetry(async () => {
    const response = await fetchWithTimeout(TASK_STORE_ROUTE, {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ task }),
    });
    const body = await parseResponse<{ task: SharedTaskRecord }>(response);
    return body.task;
  });

export const archiveSharedTaskRecord = async (
  taskId: string
): Promise<SharedTaskRecord> =>
  withRetry(async () => {
    const response = await fetchWithTimeout(TASK_STORE_ROUTE, {
      method: "DELETE",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ id: taskId }),
    });
    const body = await parseResponse<{ task: SharedTaskRecord }>(response);
    return body.task;
  });
