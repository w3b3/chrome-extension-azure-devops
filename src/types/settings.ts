/** A single Azure DevOps project configuration */
export interface ProjectConfig {
  /** Organization name (e.g. "myorg") */
  organization: string;
  /** Project name (e.g. "MyProject") */
  project: string;
  /** Personal Access Token with Code (read) scope */
  pat: string;
  /** Jira domain prefix (e.g. "arancia" for arancia.atlassian.net) */
  jiraDomain?: string;
  /** Discovered user ID for this org — filled after first successful connection */
  userId?: string;
  /** Display name of the authenticated user */
  userDisplayName?: string;
}

export interface ExtensionSettings {
  /** Configured Azure DevOps projects to monitor */
  projects: ProjectConfig[];
  /** Global Jira domain prefix fallback (e.g. "arancia" for arancia.atlassian.net) */
  jiraDomainDefault?: string;
  /** Polling interval in minutes (default: 2) */
  pollIntervalMinutes: number;
  /** Whether desktop notifications are enabled (default: true) */
  notificationsEnabled: boolean;
}

export const DEFAULT_SETTINGS: ExtensionSettings = {
  projects: [],
  pollIntervalMinutes: 2,
  notificationsEnabled: true,
};
