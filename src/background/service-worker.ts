import { getSettings } from "../utils/storage.js";
import { pollAll } from "./poller.js";
import { setupNotificationClickHandler } from "./notifier.js";

const ALARM_NAME = "pr-poll";

/** Set up the polling alarm based on current settings */
async function setupAlarm(): Promise<void> {
  const settings = await getSettings();
  await chrome.alarms.clearAll();

  if (settings.projects.length > 0) {
    void chrome.alarms.create(ALARM_NAME, {
      delayInMinutes: 0.1, // First poll almost immediately
      periodInMinutes: settings.pollIntervalMinutes,
    });
  }
}

// Alarm handler
chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === ALARM_NAME) {
    void pollAll();
  }
});

// Extension install / update
chrome.runtime.onInstalled.addListener(() => {
  void setupAlarm();
});

// Service worker startup (e.g. after being terminated)
chrome.runtime.onStartup.addListener(() => {
  void setupAlarm();
});

// Listen for settings changes to reset the alarm
chrome.storage.onChanged.addListener((changes, area) => {
  if (area === "sync" && changes["settings"]) {
    void setupAlarm();
  }
});

// Listen for messages from popup/options
chrome.runtime.onMessage.addListener(
  (message: Record<string, unknown>, _sender, sendResponse) => {
    if (message?.type === "poll-now") {
      void pollAll().then(() => sendResponse({ success: true }));
      return true; // Keep message channel open for async response
    }
    return false;
  },
);

// Set up notification click handler
setupNotificationClickHandler();

// Initial setup on script load
void setupAlarm();
