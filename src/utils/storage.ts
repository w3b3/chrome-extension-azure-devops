import type { ExtensionSettings } from "../types/settings.js";
import type { PRSnapshot, SeenPRRecord } from "../types/state.js";

/** Settings are stored in sync storage so they persist across reinstalls. */
interface SyncStorageSchema {
  settings: ExtensionSettings;
}

/** Ephemeral/large data stays in local storage. */
interface LocalStorageSchema {
  snapshots: PRSnapshot[];
  lastPollTimestamp: number;
  seenPRs: SeenPRRecord[];
  mergedCelebrationAckAt: number;
}

type SyncStorageKey = keyof SyncStorageSchema;
type LocalStorageKey = keyof LocalStorageSchema;

async function getFromSyncStorage<K extends SyncStorageKey>(
  key: K,
  defaultValue: SyncStorageSchema[K],
): Promise<SyncStorageSchema[K]> {
  const result = await chrome.storage.sync.get(key);
  return (result[key] as SyncStorageSchema[K] | undefined) ?? defaultValue;
}

async function setInSyncStorage<K extends SyncStorageKey>(
  key: K,
  value: SyncStorageSchema[K],
): Promise<void> {
  await chrome.storage.sync.set({ [key]: value });
}

async function getFromLocalStorage<K extends LocalStorageKey>(
  key: K,
  defaultValue: LocalStorageSchema[K],
): Promise<LocalStorageSchema[K]> {
  const result = await chrome.storage.local.get(key);
  return (result[key] as LocalStorageSchema[K] | undefined) ?? defaultValue;
}

async function setInLocalStorage<K extends LocalStorageKey>(
  key: K,
  value: LocalStorageSchema[K],
): Promise<void> {
  await chrome.storage.local.set({ [key]: value });
}

export async function getSettings(): Promise<ExtensionSettings> {
  const { DEFAULT_SETTINGS: defaults } = await import("../types/settings.js");
  return getFromSyncStorage("settings", defaults);
}

export async function saveSettings(settings: ExtensionSettings): Promise<void> {
  await setInSyncStorage("settings", settings);
}

export async function getSnapshots(): Promise<PRSnapshot[]> {
  return getFromLocalStorage("snapshots", []);
}

export async function saveSnapshots(snapshots: PRSnapshot[]): Promise<void> {
  await setInLocalStorage("snapshots", snapshots);
}

export async function getLastPollTimestamp(): Promise<number> {
  return getFromLocalStorage("lastPollTimestamp", 0);
}

export async function saveLastPollTimestamp(timestamp: number): Promise<void> {
  await setInLocalStorage("lastPollTimestamp", timestamp);
}

export async function getSeenPRs(): Promise<SeenPRRecord[]> {
  return getFromLocalStorage("seenPRs", []);
}

export async function saveSeenPRs(seenPRs: SeenPRRecord[]): Promise<void> {
  await setInLocalStorage("seenPRs", seenPRs);
}

export async function getMergedCelebrationAckAt(): Promise<number> {
  return getFromLocalStorage("mergedCelebrationAckAt", 0);
}

export async function saveMergedCelebrationAckAt(timestamp: number): Promise<void> {
  await setInLocalStorage("mergedCelebrationAckAt", timestamp);
}
