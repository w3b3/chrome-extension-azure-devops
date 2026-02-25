import { describe, it, expect, vi, beforeEach } from "vitest";
import { apiGet, ApiError, createAuthHeader } from "../src/api/client.js";

describe("client", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe("createAuthHeader", () => {
    it("given a PAT, when creating auth header, then returns Basic auth with :PAT base64 encoded", () => {
      // Given
      const pat = "my-secret-token";

      // When
      const header = createAuthHeader(pat);

      // Then
      expect(header).toBe(`Basic ${btoa(`:${pat}`)}`);
      expect(header.startsWith("Basic ")).toBe(true);
    });
  });

  describe("apiGet", () => {
    it("given a valid response, when fetching, then returns parsed JSON", async () => {
      // Given
      const mockData = { count: 1, value: [{ id: 1 }] };
      vi.stubGlobal(
        "fetch",
        vi.fn().mockResolvedValue({
          ok: true,
          json: () => Promise.resolve(mockData),
        }),
      );

      // When
      const result = await apiGet({ organization: "org", pat: "pat" }, "some/path");

      // Then
      expect(result).toEqual(mockData);
    });

    it("given a 401 response, when fetching, then throws ApiError with status 401", async () => {
      // Given
      vi.stubGlobal(
        "fetch",
        vi.fn().mockResolvedValue({
          ok: false,
          status: 401,
          statusText: "Unauthorized",
          headers: new Headers(),
          text: () => Promise.resolve("Access denied"),
        }),
      );

      // When / Then
      await expect(
        apiGet({ organization: "org", pat: "bad-pat" }, "some/path"),
      ).rejects.toThrow(ApiError);

      try {
        await apiGet({ organization: "org", pat: "bad-pat" }, "some/path");
      } catch (err) {
        expect(err).toBeInstanceOf(ApiError);
        expect((err as ApiError).status).toBe(401);
      }
    });

    it("given a 429 response with Retry-After, when fetching, then throws ApiError with retryAfterMs", async () => {
      // Given
      const headers = new Headers();
      headers.set("Retry-After", "30");
      vi.stubGlobal(
        "fetch",
        vi.fn().mockResolvedValue({
          ok: false,
          status: 429,
          statusText: "Too Many Requests",
          headers,
          text: () => Promise.resolve("Rate limited"),
        }),
      );

      // When / Then
      try {
        await apiGet({ organization: "org", pat: "pat" }, "some/path");
      } catch (err) {
        expect(err).toBeInstanceOf(ApiError);
        expect((err as ApiError).status).toBe(429);
        expect((err as ApiError).retryAfterMs).toBe(30000);
      }
    });

    it("given org and path, when fetching, then constructs correct URL with api-version", async () => {
      // Given
      const fetchMock = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({}),
      });
      vi.stubGlobal("fetch", fetchMock);

      // When
      await apiGet({ organization: "myorg", pat: "pat" }, "_apis/connectionData");

      // Then
      const calledUrl = fetchMock.mock.calls[0]![0] as string;
      expect(calledUrl).toContain("https://dev.azure.com/myorg/_apis/connectionData");
      expect(calledUrl).toContain("api-version=7.0-preview");
    });
  });
});
