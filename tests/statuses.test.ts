import { describe, it, expect } from "vitest";
import { latestStatusByContext } from "../src/api/statuses.js";
import type { GitPullRequestStatus } from "../src/types/azure-devops.js";

describe("latestStatusByContext", () => {
  it("given multiple statuses for the same context, when reducing, then keeps the latest one", () => {
    // Given
    const statuses: GitPullRequestStatus[] = [
      {
        id: 1,
        state: "failed",
        context: { name: "Build", genre: "CI" },
        creationDate: "2024-01-01T10:00:00Z",
      },
      {
        id: 2,
        state: "succeeded",
        context: { name: "Build", genre: "CI" },
        creationDate: "2024-01-01T12:00:00Z",
      },
    ];

    // When
    const result = latestStatusByContext(statuses);

    // Then
    expect(result["CI/Build"]).toBe("succeeded");
  });

  it("given statuses for different contexts, when reducing, then keeps each separately", () => {
    // Given
    const statuses: GitPullRequestStatus[] = [
      {
        id: 1,
        state: "succeeded",
        context: { name: "Build" },
        creationDate: "2024-01-01T10:00:00Z",
      },
      {
        id: 2,
        state: "failed",
        context: { name: "Tests" },
        creationDate: "2024-01-01T10:00:00Z",
      },
    ];

    // When
    const result = latestStatusByContext(statuses);

    // Then
    expect(result["Build"]).toBe("succeeded");
    expect(result["Tests"]).toBe("failed");
  });

  it("given a status with updatedDate, when reducing, then uses updatedDate for comparison", () => {
    // Given
    const statuses: GitPullRequestStatus[] = [
      {
        id: 1,
        state: "pending",
        context: { name: "Build" },
        creationDate: "2024-01-01T08:00:00Z",
        updatedDate: "2024-01-01T14:00:00Z",
      },
      {
        id: 2,
        state: "failed",
        context: { name: "Build" },
        creationDate: "2024-01-01T12:00:00Z",
      },
    ];

    // When
    const result = latestStatusByContext(statuses);

    // Then
    expect(result["Build"]).toBe("pending");
  });
});
