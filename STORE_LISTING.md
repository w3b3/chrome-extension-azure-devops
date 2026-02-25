# Chrome Web Store Listing — Azure DevOps PR Monitor

## 1. Short Description (132 chars max)

> Monitor Azure DevOps pull requests — get desktop notifications for pipeline failures, new pushes, and reviewer actions.

Character count: 113

---

## 2. Long Description

Azure DevOps PR Monitor keeps your engineering team informed about pull request activity across Azure DevOps organizations and projects — without leaving your browser.

The extension polls Azure DevOps at a configurable interval and delivers desktop notifications the moment something changes: a pipeline fails, a colleague pushes new commits, a reviewer approves or rejects, or a merge conflict appears. A compact popup dashboard gives you a real-time overview of every active pull request, complete with color-coded status bars and badges for pipeline results, reviewer votes, and merge conflicts.

### Key capabilities

- **Pipeline status tracking** — Receive immediate desktop notifications when a CI/CD pipeline fails or recovers, so your team can respond before delays compound.
- **Reviewer vote monitoring** — See approvals, rejections, and "waiting for author" votes at a glance. Know when a PR is ready to merge or needs attention.
- **Merge conflict and push alerts** — Detect new commits and merge conflicts as soon as they appear, keeping code review cycles short.
- **Multi-project support** — Monitor pull requests across multiple Azure DevOps organizations and projects from a single extension instance.
- **Privacy-first architecture** — All data, including your Personal Access Token, is stored locally in your browser. The extension communicates only with Azure DevOps endpoints — no telemetry, no third-party servers.

### Built for teams that ship

Click any notification or popup item to jump directly to the PR in Azure DevOps. Configure the poll interval (1–60 minutes), toggle notifications on or off, and add or remove projects at any time through the dedicated Settings page.

Azure DevOps PR Monitor uses Manifest V3, requests only the minimum permissions required (alarms, notifications, local storage), and follows the principle of least privilege. It is suitable for individual developers and enterprise teams alike.

---

## 3. Screenshots

Chrome Web Store allows up to 5 screenshots. Recommended size: **1280 x 800 px** (or 640 x 400 px minimum). Use PNG format for crisp text.

| # | Screen to Capture | Caption (max 132 chars) | Guidance |
|---|---|---|---|
| 1 | **Popup dashboard** showing 3–5 PRs with mixed statuses (green/amber/red status bars, badges for Approved, Failed, Conflicts) | Real-time PR dashboard — see pipeline status, reviewer votes, and merge conflicts at a glance. | Load the extension with realistic PR data. Ensure a mix of status badges is visible. Blur or redact repo names and author names if they contain internal information. |
| 2 | **Desktop notification** appearing alongside the browser, showing a pipeline failure or reviewer approval message | Desktop notifications — know instantly when a pipeline fails, a reviewer acts, or someone pushes new commits. | Trigger a notification (or mock one) and take a system screenshot. Include part of the browser chrome so the context is clear. |
| 3 | **Settings / Options page** with one or two projects configured and the "Add Project" form visible | Multi-project setup — connect multiple Azure DevOps organizations with a Personal Access Token. | Show at least one configured project with its organization and project name (blur the PAT field). The "Add & Verify Connection" button should be visible. |
| 4 | **Popup dashboard — empty state vs. populated state** (side by side, or just the populated state with attention-needed PRs sorted to top) | Attention-needed PRs bubble to the top — never miss a failing pipeline or rejected review. | Capture the popup with at least one PR that has a red status bar and a "Rejected" or "Failed" badge, showing the priority sort order. |

### Image preparation tips

- Export at **1280 x 800 px**, PNG, no transparency.
- Use a clean browser profile (no personal bookmarks or tabs visible).
- If using real Azure DevOps data, blur or redact organization names, project names, author names, and branch names that reveal proprietary information.
- Chrome Web Store will display screenshots in a carousel; the first screenshot carries the most weight. Lead with the popup dashboard.

---

## 4. Category Selection

| Field | Value | Rationale |
|---|---|---|
| **Primary category** | Developer Tools | The extension's core audience is developers and engineering managers who work with Azure DevOps pull requests daily. "Developer Tools" is the most relevant category for extensions that integrate with CI/CD platforms and code review workflows. |
| **Language** | English | The listing and UI are in English. |

> Chrome Web Store currently supports a single category per extension. If multiple categories become available, "Productivity" would be a strong secondary choice.

---

## 5. Keywords / Tags (SEO)

Chrome Web Store does not have a dedicated "tags" field, but these keywords should appear naturally in the short description, long description, and extension name to improve search discoverability:

| # | Keyword / Phrase |
|---|---|
| 1 | Azure DevOps |
| 2 | pull request monitor |
| 3 | PR notifications |
| 4 | pipeline status |
| 5 | code review |
| 6 | CI/CD notifications |
| 7 | merge conflict alert |
| 8 | reviewer votes |
| 9 | DevOps productivity |
| 10 | Azure DevOps extension |

All ten keywords are organically present in the long description above. No keyword stuffing is needed.

---

## 6. Additional Store Fields

| Field | Recommended Value |
|---|---|
| **Privacy Policy URL** | Link to the hosted `PRIVACY.md` (e.g., GitHub raw URL or a dedicated page) |
| **Support URL / Homepage** | GitHub repository URL |
| **Single purpose description** | "This extension monitors Azure DevOps pull requests and shows desktop notifications for status changes." |
| **Permissions justification** | Already documented in the manifest and `README.md`. Ensure the Chrome Web Store review form references: `alarms` for periodic polling, `notifications` for desktop alerts, `storage` for local settings, and host permissions for Azure DevOps API access. |
