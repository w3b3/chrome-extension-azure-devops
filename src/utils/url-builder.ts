const BASE = "https://dev.azure.com";

export function prUrl(org: string, project: string, repoName: string, prId: number): string {
  return `${BASE}/${org}/${project}/_git/${repoName}/pullrequest/${prId}`;
}

export function repoUrl(org: string, project: string, repoName: string): string {
  return `${BASE}/${org}/${project}/_git/${repoName}`;
}

export function buildUrl(targetUrl: string | undefined): string | undefined {
  return targetUrl;
}

export function projectUrl(org: string, project: string): string {
  return `${BASE}/${org}/${project}`;
}
