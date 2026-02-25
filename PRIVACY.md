Privacy Policy — Azure DevOps PR Monitor
=======================================

Effective date: 2026-02-25

1. Introduction
---------------
Azure DevOps PR Monitor ("the extension") helps you monitor pull requests in Azure DevOps and receive desktop notifications for events such as pipeline failures, new pushes, and reviewer actions. This Privacy Policy explains what information the extension collects, how it is used, where it is stored, and how you can remove it.

2. Data the extension collects
------------------------------
- Account & project settings: organization name, project name, and the display name / user id returned by Azure DevOps for the configured account(s).
- Personal Access Token (PAT): a PAT that you provide to authorize API requests to Azure DevOps. The extension uses the PAT to call Azure DevOps APIs on your behalf.
- Pull request metadata: when polling Azure DevOps the extension fetches PR information (IDs, titles, statuses, reviewers, pipelines, timestamps, etc.) needed to detect changes and show notifications.
- Local runtime state: cached snapshots of PRs and a last-poll timestamp are stored to detect changes between polls.

3. How data is used
--------------------
- The PAT and organization/project settings are used only to call the Azure DevOps REST API to read PRs and related status information.
- PR metadata is used to determine when to show desktop notifications and to render the extension UI.
- All stored data is used solely to provide and improve the extension's core functionality (monitoring PRs, showing notifications, and preserving user settings).

4. Where data is stored and retained
-----------------------------------
- All data is stored locally in your browser using Chrome's extension local storage (chrome.storage.local). The extension does not upload your PAT, settings, or cached PR data to any external servers owned by the extension author.
- Data is retained until you remove the project from the extension settings or uninstall the extension. You can remove stored project entries via the extension's Options page.
- If you are concerned about continued access, revoke the PAT in Azure DevOps and/or remove the project from the extension settings.

5. Sharing and third parties
---------------------------
- The extension only contacts Azure DevOps endpoints (host permissions for: https://dev.azure.com/* and https://*.visualstudio.com/*) to fetch PR and status data. The extension does not send your data to analytics services, external servers, or other third parties.
- If you manually export or share settings or screenshots, that is outside the scope of this extension and is your responsibility.

6. Security
-----------
- The PAT is stored in Chrome's extension storage; treat PATs as sensitive credentials. If a PAT is compromised, revoke it in Azure DevOps immediately.
- The extension follows the principle of least privilege: it only requests the permissions required to perform monitoring and notifications.
- There is no server-side processing or telemetry by the extension author; network requests are made directly to Azure DevOps.

7. Your choices
---------------
- Remove stored data: use the extension Options page to remove configured projects (which deletes the stored PAT and associated settings for that project).
- Uninstall: uninstalling the extension removes its local storage.
- Revoke PAT: revoke the Personal Access Token in your Azure DevOps account if you no longer want the extension to access that account.

8. Contact & updates
--------------------
If you have questions, concerns, or discover a security issue, please open an issue in the extension's repository or contact the extension author via the support channel listed on the extension's store listing.

We may update this Privacy Policy from time to time. When we do, we will update the "Effective date" at the top of this document. Continued use of the extension after a change indicates acceptance of the updated policy.

