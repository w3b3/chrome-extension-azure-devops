/** Azure DevOps API fetch wrapper with PAT authentication and error handling */

export class ApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly retryAfterMs?: number,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export interface ApiClientOptions {
  organization: string;
  pat: string;
}

export function createAuthHeader(pat: string): string {
  return `Basic ${btoa(`:${pat}`)}`;
}

export async function apiGet<T>(
  options: ApiClientOptions,
  path: string,
  apiVersion = "7.0-preview",
): Promise<T> {
  const url = new URL(`https://dev.azure.com/${options.organization}/${path}`);
  url.searchParams.set("api-version", apiVersion);

  const response = await fetch(url.toString(), {
    method: "GET",
    headers: {
      Authorization: createAuthHeader(options.pat),
      Accept: "application/json",
    },
  });

  if (!response.ok) {
    const retryAfter = response.headers.get("Retry-After");
    const retryAfterMs = retryAfter ? parseInt(retryAfter, 10) * 1000 : undefined;
    const body = await response.text().catch(() => "");
    throw new ApiError(
      `API ${response.status}: ${response.statusText} — ${body}`,
      response.status,
      retryAfterMs,
    );
  }

  return (await response.json()) as T;
}
