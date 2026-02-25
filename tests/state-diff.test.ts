import { describe, it, expect } from "vitest";
import { diffSnapshots } from "../src/background/state-diff.js";
import type { PRSnapshot } from "../src/types/state.js";

function makeSnapshot(overrides: Partial<PRSnapshot> = {}): PRSnapshot {
  return {
    key: "org/proj/1",
    organization: "org",
    project: "proj",
    repositoryName: "repo",
    pullRequestId: 1,
    title: "Test PR",
    createdByName: "Alice",
    creationDate: "2024-01-01T00:00:00Z",
    sourceRefName: "refs/heads/feature",
    targetRefName: "refs/heads/main",
    isDraft: false,
    mergeStatus: "succeeded",
    lastMergeSourceCommitId: "abc123",
    reviewerVotes: {},
    reviewerNames: {},
    statusChecks: {},
    isAuthor: true,
    isReviewer: false,
    lastSeenAt: Date.now(),
    ...overrides,
  };
}

describe("diffSnapshots", () => {
  describe("pipeline failures", () => {
    it("given a pipeline that was pending, when it fails, then emits pipeline_failed event", () => {
      // Given
      const previous = [makeSnapshot({ statusChecks: { "Build/CI": "pending" } })];

      // When
      const current = [makeSnapshot({ statusChecks: { "Build/CI": "failed" } })];
      const events = diffSnapshots(previous, current);

      // Then
      expect(events).toHaveLength(1);
      expect(events[0]!.type).toBe("pipeline_failed");
      expect(events[0]!.severity).toBe("high");
      expect(events[0]!.details).toContain("Build/CI");
    });

    it("given a pipeline that was succeeded, when it fails, then emits pipeline_failed event", () => {
      // Given
      const previous = [makeSnapshot({ statusChecks: { "Build/CI": "succeeded" } })];

      // When
      const current = [makeSnapshot({ statusChecks: { "Build/CI": "error" } })];
      const events = diffSnapshots(previous, current);

      // Then
      expect(events).toHaveLength(1);
      expect(events[0]!.type).toBe("pipeline_failed");
    });
  });

  describe("pipeline recovery", () => {
    it("given a failed pipeline, when it succeeds, then emits pipeline_recovered event", () => {
      // Given
      const previous = [makeSnapshot({ statusChecks: { "Build/CI": "failed" } })];

      // When
      const current = [makeSnapshot({ statusChecks: { "Build/CI": "succeeded" } })];
      const events = diffSnapshots(previous, current);

      // Then
      expect(events).toHaveLength(1);
      expect(events[0]!.type).toBe("pipeline_recovered");
      expect(events[0]!.severity).toBe("medium");
    });
  });

  describe("new pushes", () => {
    it("given a PR with commit abc, when source commit changes to def, then emits new_push event", () => {
      // Given
      const previous = [makeSnapshot({ lastMergeSourceCommitId: "abc123" })];

      // When
      const current = [makeSnapshot({ lastMergeSourceCommitId: "def456" })];
      const events = diffSnapshots(previous, current);

      // Then
      expect(events).toHaveLength(1);
      expect(events[0]!.type).toBe("new_push");
      expect(events[0]!.severity).toBe("medium");
    });

    it("given a PR with same commit, when polled again, then no event", () => {
      // Given
      const previous = [makeSnapshot({ lastMergeSourceCommitId: "abc123" })];

      // When
      const current = [makeSnapshot({ lastMergeSourceCommitId: "abc123" })];
      const events = diffSnapshots(previous, current);

      // Then
      expect(events).toHaveLength(0);
    });
  });

  describe("reviewer vote changes", () => {
    it("given no votes, when a reviewer approves, then emits vote_changed event", () => {
      // Given
      const previous = [
        makeSnapshot({
          reviewerVotes: { "user-1": 0 },
          reviewerNames: { "user-1": "Bob" },
        }),
      ];

      // When
      const current = [
        makeSnapshot({
          reviewerVotes: { "user-1": 10 },
          reviewerNames: { "user-1": "Bob" },
        }),
      ];
      const events = diffSnapshots(previous, current);

      // Then
      expect(events).toHaveLength(1);
      expect(events[0]!.type).toBe("vote_changed");
      expect(events[0]!.details).toContain("Bob");
      expect(events[0]!.details).toContain("Approved");
    });

    it("given approval, when reviewer rejects, then emits high severity vote_changed", () => {
      // Given
      const previous = [
        makeSnapshot({
          reviewerVotes: { "user-1": 10 },
          reviewerNames: { "user-1": "Bob" },
        }),
      ];

      // When
      const current = [
        makeSnapshot({
          reviewerVotes: { "user-1": -10 },
          reviewerNames: { "user-1": "Bob" },
        }),
      ];
      const events = diffSnapshots(previous, current);

      // Then
      expect(events).toHaveLength(1);
      expect(events[0]!.type).toBe("vote_changed");
      expect(events[0]!.severity).toBe("high");
      expect(events[0]!.details).toContain("Rejected");
    });
  });

  describe("merge conflicts", () => {
    it("given no conflicts, when merge status becomes conflicts, then emits merge_conflict event", () => {
      // Given
      const previous = [makeSnapshot({ mergeStatus: "succeeded" })];

      // When
      const current = [makeSnapshot({ mergeStatus: "conflicts" })];
      const events = diffSnapshots(previous, current);

      // Then
      expect(events).toHaveLength(1);
      expect(events[0]!.type).toBe("merge_conflict");
      expect(events[0]!.severity).toBe("high");
    });

    it("given existing conflicts, when polled again still conflicts, then no event", () => {
      // Given
      const previous = [makeSnapshot({ mergeStatus: "conflicts" })];

      // When
      const current = [makeSnapshot({ mergeStatus: "conflicts" })];
      const events = diffSnapshots(previous, current);

      // Then
      expect(events).toHaveLength(0);
    });
  });

  describe("new PRs", () => {
    it("given no previous PRs, when a new PR appears, then no events (first seen)", () => {
      // Given
      const previous: PRSnapshot[] = [];

      // When
      const current = [makeSnapshot()];
      const events = diffSnapshots(previous, current);

      // Then
      expect(events).toHaveLength(0);
    });
  });

  describe("multiple changes", () => {
    it("given a PR, when pipeline fails AND merge conflicts appear, then emits both events", () => {
      // Given
      const previous = [
        makeSnapshot({
          statusChecks: { "Build/CI": "succeeded" },
          mergeStatus: "succeeded",
        }),
      ];

      // When
      const current = [
        makeSnapshot({
          statusChecks: { "Build/CI": "failed" },
          mergeStatus: "conflicts",
        }),
      ];
      const events = diffSnapshots(previous, current);

      // Then
      expect(events).toHaveLength(2);
      const types = events.map((e) => e.type);
      expect(types).toContain("pipeline_failed");
      expect(types).toContain("merge_conflict");
    });
  });
});
