import { describe, it, expect } from "vitest";
import { prUrl, repoUrl, projectUrl } from "../src/utils/url-builder.js";

describe("url-builder", () => {
  describe("prUrl", () => {
    it("given org, project, repo, and PR id, when building URL, then returns correct Azure DevOps PR link", () => {
      // Given
      const org = "myorg";
      const project = "MyProject";
      const repo = "my-repo";
      const prId = 42;

      // When
      const url = prUrl(org, project, repo, prId);

      // Then
      expect(url).toBe("https://dev.azure.com/myorg/MyProject/_git/my-repo/pullrequest/42");
    });
  });

  describe("repoUrl", () => {
    it("given org, project, and repo, when building URL, then returns correct repo link", () => {
      // Given / When
      const url = repoUrl("myorg", "MyProject", "my-repo");

      // Then
      expect(url).toBe("https://dev.azure.com/myorg/MyProject/_git/my-repo");
    });
  });

  describe("projectUrl", () => {
    it("given org and project, when building URL, then returns correct project link", () => {
      // Given / When
      const url = projectUrl("myorg", "MyProject");

      // Then
      expect(url).toBe("https://dev.azure.com/myorg/MyProject");
    });
  });
});
