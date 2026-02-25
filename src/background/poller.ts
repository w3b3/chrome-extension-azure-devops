import type { GitPullRequest } from "../types/azure-devops.js";
import type { ProjectConfig } from "../types/settings.js";
import type { ChangeEvent, PRSnapshot, SeenPRRecord } from "../types/state.js";
import type { ReviewerVote } from "../types/azure-devops.js";
import { fetchActivePRs, fetchPRById } from "../api/pull-requests.js";
import { fetchPRStatuses, latestStatusByContext } from "../api/statuses.js";
import { getSettings } from "../utils/storage.js";
import {
  saveSnapshots,
  getSnapshots,
  saveLastPollTimestamp,
  getSeenPRs,
  saveSeenPRs,
  getMergedCelebrationAckAt,
} from "../utils/storage.js";
import { diffSnapshots } from "./state-diff.js";
import { notifyChanges } from "./notifier.js";
import { updateBadge } from "../utils/badge.js";
import { ApiError } from "../api/client.js";

const SEEN_PR_RETENTION_MS = 7 * 24 * 60 * 60 * 1000;

/** Run a full poll cycle across all configured projects */
export async function pollAll(): Promise<void> {
  const settings = await getSettings();
  if (settings.projects.length === 0) return;

  const previousSnapshots = await getSnapshots();
  const previousSeenPRs = await getSeenPRs();
  const mergedCelebrationAckAt = await getMergedCelebrationAckAt();
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
  const mergedEvents = await detectMergedPRs(previousSnapshots, allSnapshots, settings.projects);
  events.push(...mergedEvents);
  if (events.length > 0 && settings.notificationsEnabled) {
    notifyChanges(events);
  }

  const seenPRs = updateSeenPRHistory(previousSeenPRs, allSnapshots, mergedEvents, Date.now());
  const hasUnseenMerged = seenPRs.some(
    (record) => record.lastKnownState === "merged" && record.lastSeenAt > mergedCelebrationAckAt,
  );
  await saveSnapshots(allSnapshots);
  await saveSeenPRs(seenPRs);
  await saveLastPollTimestamp(Date.now());
  await updateBadge(allSnapshots, { showCelebration: hasUnseenMerged });
}

async function detectMergedPRs(
  previous: PRSnapshot[],
  current: PRSnapshot[],
  projects: ProjectConfig[],
): Promise<ChangeEvent[]> {
  const events: ChangeEvent[] = [];
  const currentKeys = new Set(current.map((s) => s.key));
  const projectByKey = new Map(projects.map((p) => [`${p.organization}/${p.project}`, p]));

  for (const prev of previous) {
    if (currentKeys.has(prev.key)) continue; // Still active
    if (!prev.isAuthor) continue; // Celebrate merges only for your own PRs

    const projectKey = `${prev.organization}/${prev.project}`;
    const project = projectByKey.get(projectKey);
    if (!project) continue;

    try {
      const pr = await fetchPRById({
        organization: project.organization,
        pat: project.pat,
        project: project.project,
        repositoryName: prev.repositoryName,
        pullRequestId: prev.pullRequestId,
      });

      if (pr.status === "completed") {
        events.push({
          type: "pr_merged",
          severity: "low",
          prSnapshot: prev,
          description: `🎉 PR #${prev.pullRequestId} merged!`,
          details: prev.title,
        });
      }
    } catch (err) {
      if (!(err instanceof ApiError && err.status === 404)) {
        // eslint-disable-next-line no-console
        console.warn(
          `Could not verify merge status for PR #${prev.pullRequestId} in ${projectKey}:`,
          err,
        );
      }
    }
  }

  return events;
}

function updateSeenPRHistory(
  previousSeenPRs: SeenPRRecord[],
  currentSnapshots: PRSnapshot[],
  events: ChangeEvent[],
  now: number,
): SeenPRRecord[] {
  const seenMap = new Map(previousSeenPRs.map((record) => [record.key, record]));

  for (const snapshot of currentSnapshots) {
    seenMap.set(snapshot.key, {
      key: snapshot.key,
      organization: snapshot.organization,
      project: snapshot.project,
      repositoryName: snapshot.repositoryName,
      pullRequestId: snapshot.pullRequestId,
      title: snapshot.title,
      lastKnownState: "active",
      lastSeenAt: now,
    });
  }

  for (const event of events) {
    if (event.type !== "pr_merged") continue;
    const snapshot = event.prSnapshot;
    seenMap.set(snapshot.key, {
      key: snapshot.key,
      organization: snapshot.organization,
      project: snapshot.project,
      repositoryName: snapshot.repositoryName,
      pullRequestId: snapshot.pullRequestId,
      title: snapshot.title,
      lastKnownState: "merged",
      lastSeenAt: now,
    });
  }

  const cutoff = now - SEEN_PR_RETENTION_MS;
  return [...seenMap.values()].filter((record) => record.lastSeenAt >= cutoff);
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
