import type { GitPullRequest } from "../types/azure-devops.js";
import type { ProjectConfig } from "../types/settings.js";
import type { PRSnapshot } from "../types/state.js";
import type { ReviewerVote } from "../types/azure-devops.js";
import { fetchActivePRs } from "../api/pull-requests.js";
import { fetchPRStatuses, latestStatusByContext } from "../api/statuses.js";
import { getSettings } from "../utils/storage.js";
import { saveSnapshots, getSnapshots, saveLastPollTimestamp } from "../utils/storage.js";
import { diffSnapshots } from "./state-diff.js";
import { notifyChanges } from "./notifier.js";
import { updateBadge } from "../utils/badge.js";
import { ApiError } from "../api/client.js";

/** Run a full poll cycle across all configured projects */
export async function pollAll(): Promise<void> {
  const settings = await getSettings();
  if (settings.projects.length === 0) return;

  const previousSnapshots = await getSnapshots();
  const allSnapshots: PRSnapshot[] = [];

  for (const project of settings.projects) {
    if (!project.userId) continue; // Not yet connected

    try {
      const snapshots = await pollProject(project);
      allSnapshots.push(...snapshots);
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        // eslint-disable-next-line no-console
        console.warn(`Auth failed for ${project.organization}/${project.project} — PAT may be expired`);
      } else {
        // eslint-disable-next-line no-console
        console.error(`Poll failed for ${project.organization}/${project.project}:`, err);
      }
    }
  }

  // Diff and notify
  const events = diffSnapshots(previousSnapshots, allSnapshots);
  if (events.length > 0 && settings.notificationsEnabled) {
    notifyChanges(events);
  }

  await saveSnapshots(allSnapshots);
  await saveLastPollTimestamp(Date.now());
  await updateBadge(allSnapshots);
}

/** Poll a single project, return PR snapshots */
async function pollProject(config: ProjectConfig): Promise<PRSnapshot[]> {
  const { organization, project, pat, userId } = config;
  if (!userId) return [];

  const prs = await fetchActivePRs({ organization, pat, project, userId });

  const snapshots: PRSnapshot[] = [];

  for (const pr of prs) {
    const statuses = await fetchPRStatuses({
      organization,
      pat,
      project,
      repositoryId: pr.repository.id,
      pullRequestId: pr.pullRequestId,
    });

    snapshots.push(prToSnapshot(pr, organization, project, userId, latestStatusByContext(statuses)));
  }

  return snapshots;
}

function prToSnapshot(
  pr: GitPullRequest,
  organization: string,
  project: string,
  userId: string,
  statusChecks: Record<string, string>,
): PRSnapshot {
  const reviewerVotes: Record<string, ReviewerVote> = {};
  const reviewerNames: Record<string, string> = {};

  for (const r of pr.reviewers) {
    reviewerVotes[r.id] = r.vote;
    reviewerNames[r.id] = r.displayName;
  }

  return {
    key: `${organization}/${project}/${pr.pullRequestId}`,
    organization,
    project,
    repositoryName: pr.repository.name,
    pullRequestId: pr.pullRequestId,
    title: pr.title,
    createdByName: pr.createdBy.displayName,
    createdByImageUrl: pr.createdBy.imageUrl,
    creationDate: pr.creationDate,
    sourceRefName: pr.sourceRefName,
    targetRefName: pr.targetRefName,
    isDraft: pr.isDraft,
    mergeStatus: pr.mergeStatus,
    lastMergeSourceCommitId: pr.lastMergeSourceCommit?.commitId,
    reviewerVotes,
    reviewerNames,
    statusChecks,
    isAuthor: pr.createdBy.id === userId,
    isReviewer: pr.reviewers.some((r) => r.id === userId),
    lastSeenAt: Date.now(),
  };
}
