import type { ExtensionSettings } from "../types/settings.js";
import type { PRSnapshot } from "../types/state.js";

/** Keys used in chrome.storage.local */
interface StorageSchema {
  settings: ExtensionSettings;
  snapshots: PRSnapshot[];
  lastPollTimestamp: number;
}

type StorageKey = keyof StorageSchema;

async function getFromStorage<K extends StorageKey>(
  key: K,
  defaultValue: StorageSchema[K],
): Promise<StorageSchema[K]> {
  const result = await chrome.storage.local.get(key);
  return (result[key] as StorageSchema[K] | undefined) ?? defaultValue;
}

async function setInStorage<K extends StorageKey>(
  key: K,
  value: StorageSchema[K],
): Promise<void> {
  await chrome.storage.local.set({ [key]: value });
}

export async function getSettings(): Promise<ExtensionSettings> {
  const { DEFAULT_SETTINGS: defaults } = await import("../types/settings.js");
  return getFromStorage("settings", defaults);
}

export async function saveSettings(settings: ExtensionSettings): Promise<void> {
  await setInStorage("settings", settings);
}

export async function getSnapshots(): Promise<PRSnapshot[]> {
  return getFromStorage("snapshots", []);
}

export async function saveSnapshots(snapshots: PRSnapshot[]): Promise<void> {
  await setInStorage("snapshots", snapshots);
}

export async function getLastPollTimestamp(): Promise<number> {
  return getFromStorage("lastPollTimestamp", 0);
}

export async function saveLastPollTimestamp(timestamp: number): Promise<void> {
  await setInStorage("lastPollTimestamp", timestamp);
}
