import type { ConnectionData } from "../types/azure-devops.js";
import { apiGet, type ApiClientOptions } from "./client.js";

export interface UserIdentity {
  id: string;
  displayName: string;
}

/** Discover the authenticated user's identity for a given org */
export async function getCurrentUser(options: ApiClientOptions): Promise<UserIdentity> {
  const data = await apiGet<ConnectionData>(options, "_apis/connectionData");
  return {
    id: data.authenticatedUser.id,
    displayName: data.authenticatedUser.providerDisplayName,
  };
}
