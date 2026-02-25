import type { ChangeEvent } from "../types/state.js";

/** Send desktop notifications for detected changes */
export function notifyChanges(events: ChangeEvent[]): void {
  for (const event of events) {
    const notifId = `${event.type}-${event.prSnapshot.key}-${Date.now()}`;
    const isHigh = event.severity === "high";

    chrome.notifications.create(notifId, {
      type: "basic",
      iconUrl: chrome.runtime.getURL("icons/icon-128.png"),
      title: event.description,
      message: event.details ?? "",
      priority: isHigh ? 2 : 1,
      requireInteraction: isHigh,
    });
  }
}

/** Handle notification click → open the PR in a new tab */
export function setupNotificationClickHandler(): void {
  chrome.notifications.onClicked.addListener((notifId) => {
    // Parse the PR key from the notification ID: "type-org/project/prId-timestamp"
    const keyMatch = notifId.match(/^[^-]+-(.+)-\d+$/);
    if (keyMatch?.[1]) {
      const key = keyMatch[1];
      const keyParts = key.split("/");
      if (keyParts.length === 3 && keyParts[0] && keyParts[1] && keyParts[2]) {
        const [org, project, prIdStr] = keyParts;
        const prId = parseInt(prIdStr, 10);
        if (!isNaN(prId)) {
          // We don't have the repo name in the key, so open the project PR list
          // The popup provides direct links. For notifications, open the project.
          void chrome.tabs.create({
            url: `https://dev.azure.com/${org}/${project}/_git/pullrequest/${prId}`,
          });
        }
      }
    }

    void chrome.notifications.clear(notifId);
  });
}
