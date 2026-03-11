# Chrome Web Store Listing — Azure DevOps PR Monitor

This document provides step-by-step guidance for filling out all required fields in the Chrome Web Store Developer Dashboard.

---

## Step 1: Build Section — Package

Upload your extension ZIP file (`extension-upload.zip`).

---

## Step 2: Build Section — Status

No action required — this shows the current review status.

---

## Step 3: Store Listing — App Details Page

### 3.1 Extension Name

> Azure DevOps PR Monitor

### 3.2 Short Description (132 chars max)

> Monitor Azure DevOps pull requests — get desktop notifications for pipeline failures, new pushes, and reviewer actions.

Character count: 113

### 3.3 Detailed Description

```
Azure DevOps PR Monitor keeps your engineering team informed about pull request activity across Azure DevOps organizations and projects — without leaving your browser.

The extension polls Azure DevOps at a configurable interval and delivers desktop notifications the moment something changes: a pipeline fails, a colleague pushes new commits, a reviewer approves or rejects, or a merge conflict appears. A compact popup dashboard gives you a real-time overview of every active pull request, complete with color-coded status bars and badges for pipeline results, reviewer votes, and merge conflicts.

Key capabilities:

• Pipeline status tracking — Receive immediate desktop notifications when a CI/CD pipeline fails or recovers, so your team can respond before delays compound.

• Reviewer vote monitoring — See approvals, rejections, and "waiting for author" votes at a glance. Know when a PR is ready to merge or needs attention.

• Merge conflict and push alerts — Detect new commits and merge conflicts as soon as they appear, keeping code review cycles short.

• Multi-project support — Monitor pull requests across multiple Azure DevOps organizations and projects from a single extension instance.

• Privacy-first architecture — All data, including your Personal Access Token, is stored locally in your browser. The extension communicates only with Azure DevOps endpoints — no telemetry, no third-party servers.

Built for teams that ship:

Click any notification or popup item to jump directly to the PR in Azure DevOps. Configure the poll interval (1–60 minutes), toggle notifications on or off, and add or remove projects at any time through the dedicated Settings page.

Azure DevOps PR Monitor uses Manifest V3, requests only the minimum permissions required (alarms, notifications, local storage), and follows the principle of least privilege. It is suitable for individual developers and enterprise teams alike.
```

### 3.4 Category

Select: **Developer Tools**

### 3.5 Language

Select: **English**

### 3.6 Store Icon

Upload: `icons/icon-128.png` (128x128 PNG)

### 3.7 Screenshots (1280x800 or 640x400 minimum, PNG)

| # | What to Capture | Suggested Caption |
|---|---|---|
| 1 | Popup dashboard with 3–5 PRs showing mixed statuses | Real-time PR dashboard — see pipeline status, reviewer votes, and merge conflicts at a glance. |
| 2 | Desktop notification showing pipeline failure or approval | Desktop notifications — know instantly when a pipeline fails or a reviewer acts. |
| 3 | Settings/Options page with configured projects | Multi-project setup — connect multiple Azure DevOps organizations. |
| 4 | Popup with attention-needed PRs sorted to top | Attention-needed PRs bubble to the top — never miss a failing pipeline. |

---

## Step 4: Store Listing — Distribution

### 4.1 Visibility

Select: **Public** (or Unlisted if you want to test first)

### 4.2 Geographic Distribution

Select: **All regions** (or specific countries if needed)

---

## Step 5: Store Listing — Access (if applicable)

If your extension requires login or special access to test, provide test credentials here. For this extension, you can note:

> No special access required. The extension uses a Personal Access Token (PAT) that users generate from their own Azure DevOps account.

---

## Step 6: Privacy Tab

### 6.1 Single Purpose Description

> This extension monitors Azure DevOps pull requests and shows desktop notifications for status changes.

### 6.2 Permission Justifications

Fill in each field as follows:

| Permission | Justification (copy-paste ready) |
|---|---|
| **alarms** | The extension uses the alarms API to periodically poll Azure DevOps for pull request updates at a user-configurable interval (1–60 minutes). This enables background monitoring without requiring the user to keep a tab open. |
| **notifications** | The extension uses the notifications API to display desktop alerts when pull request status changes occur, such as pipeline failures, new commits, reviewer votes, or merge conflicts. Users can enable or disable notifications in the extension settings. |
| **storage** | The extension uses the storage API to persist user settings locally, including configured Azure DevOps organizations, project names, Personal Access Tokens, poll interval preferences, and notification preferences. All data remains in the user's browser and is never transmitted to external servers. |
| **Host Permission (dev.azure.com, *.visualstudio.com)** | The extension requires access to Azure DevOps domains to fetch pull request data via the Azure DevOps REST API. It uses the user's Personal Access Token to authenticate API requests. The extension only communicates with Azure DevOps servers and does not send data to any third-party services. |

### 6.3 Data Usage Disclosures

When asked about data collection, select:

- **Does not collect user data** (if this option is available)

Or provide these answers:

| Question | Answer |
|---|---|
| Does your extension collect personal data? | No — all data is stored locally in the browser. |
| Does your extension use remote code? | No |
| Does your extension sell user data? | No |

### 6.4 Privacy Policy URL

Provide a link to your hosted privacy policy:

> `https://github.com/YOUR_USERNAME/chrome-extension-azure-devops/blob/main/PRIVACY.md`

(Replace with your actual repository URL)

---

## Step 7: Additional Fields

### 7.1 Homepage URL (optional)

> `https://github.com/YOUR_USERNAME/chrome-extension-azure-devops`

### 7.2 Support URL (optional)

> `https://github.com/YOUR_USERNAME/chrome-extension-azure-devops/issues`

---

## Step 8: Submit for Review

1. Click **Save Draft** to save your progress
2. Review all sections for completeness
3. Click **Submit for Review**

---

## Quick Reference: All Required Fields

| Section | Field | Status |
|---|---|---|
| Package | Extension ZIP | Required |
| App Details | Name | Required |
| App Details | Short Description | Required |
| App Details | Detailed Description | Required |
| App Details | Category | Required |
| App Details | Language | Required |
| App Details | Store Icon (128x128) | Required |
| App Details | Screenshots (at least 1) | Required |
| Privacy | Single Purpose | Required |
| Privacy | Permission Justifications | Required |
| Privacy | Privacy Policy URL | Required (for extensions with host permissions) |

---

## SEO Keywords (embedded in descriptions)

These keywords appear naturally in the descriptions above:

1. Azure DevOps
2. pull request monitor
3. PR notifications
4. pipeline status
5. code review
6. CI/CD notifications
7. merge conflict alert
8. reviewer votes
9. DevOps productivity
10. Azure DevOps extension
