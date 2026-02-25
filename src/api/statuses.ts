import type { ApiListResponse, GitPullRequestStatus } from "../types/azure-devops.js";
import { apiGet, type ApiClientOptions } from "./client.js";

interface FetchStatusesOptions extends ApiClientOptions {
  project: string;
  repositoryId: string;
  pullRequestId: number;
}

/** Fetch the latest status checks for a pull request */
export async function fetchPRStatuses(
  options: FetchStatusesOptions,
): Promise<GitPullRequestStatus[]> {
  const path =
    `${options.project}/_apis/git/repositories/${options.repositoryId}` +
    `/pullRequests/${options.pullRequestId}/statuses`;
  const response = await apiGet<ApiListResponse<GitPullRequestStatus>>(options, path);
  return response.value;
}

/**
 * Reduce status list to latest status per context name.
 * Azure DevOps may return multiple statuses for the same context (pipeline re-runs).
 */
export function latestStatusByContext(
  statuses: GitPullRequestStatus[],
): Record<string, string> {
  const result: Record<string, string> = {};
  const latestDate: Record<string, string> = {};

  for (const s of statuses) {
    const key = s.context.genre ? `${s.context.genre}/${s.context.name}` : s.context.name;
    const date = s.updatedDate ?? s.creationDate;
    const existing = latestDate[key];

    if (!existing || date > existing) {
      latestDate[key] = date;
      result[key] = s.state;
    }
  }

  return result;
}
