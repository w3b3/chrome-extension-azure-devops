# Azure DevOps PR Monitor

A Chrome extension that monitors your Azure DevOps pull requests and delivers desktop notifications for important events—pipeline failures, new pushes, reviewer votes, and merge conflicts.

## Features

- **Pipeline status tracking** — get notified when a pipeline fails or recovers
- **New push detection** — know when someone pushes new commits to a PR
- **Reviewer vote changes** — see approvals, rejections, and "waiting for author" votes
- **Merge conflict alerts** — catch conflicts as soon as they appear
- **Multi-project support** — monitor PRs across multiple Azure DevOps organizations and projects
- **Popup dashboard** — quick overview of all active PRs with status badges
- **Click-to-open** — click a notification or popup item to jump straight to the PR

## Installation

### From source

1. Clone the repository:
   ```bash
   git clone https://github.com/YOUR_USERNAME/chrome-extension-azure-devops.git
   cd chrome-extension-azure-devops
   ```

2. Install dependencies and build:
   ```bash
   npm install
   npm run build
   ```

3. Load the extension in Chrome:
   - Navigate to `chrome://extensions`
   - Enable **Developer mode** (toggle in top-right)
   - Click **Load unpacked** and select the `dist` folder

## Configuration

1. Click the extension icon and open **Settings** (or right-click → Options)
2. Add a project:
   - **Organization** — your Azure DevOps organization name (e.g. `contoso`)
   - **Project** — the project name
   - **Personal Access Token** — a PAT with **Code (Read)** scope ([create one here](https://dev.azure.com/_usersSettings/tokens))
3. Adjust the poll interval and notification preferences as needed

The extension polls Azure DevOps at the configured interval (default: 2 minutes) and shows desktop notifications when it detects changes.

## Development

```bash
# Watch mode (rebuilds on file changes)
npm run watch

# Type-check
npm run typecheck

# Lint
npm run lint

# Run tests
npm run test

# Full check (typecheck + lint + build + test)
npm run check
```

### Project structure

```
src/
├── api/           # Azure DevOps API client and endpoints
├── background/    # Service worker, poller, notifier, state diff
├── options/       # Options page UI
├── popup/         # Popup UI
├── types/         # TypeScript type definitions
└── utils/         # Storage helpers, badge, URL builder
static/
├── manifest.json  # Extension manifest (MV3)
├── icons/         # Extension icons
├── popup/         # Popup HTML/CSS
└── options/       # Options HTML/CSS
```

## Permissions

| Permission | Purpose |
|------------|---------|
| `alarms` | Schedule periodic polling |
| `notifications` | Show desktop notifications |
| `storage` | Store settings and cached PR state locally |
| `host_permissions` (dev.azure.com, *.visualstudio.com) | Fetch PR data from Azure DevOps APIs |

## Privacy

All data (PAT, settings, cached PRs) is stored locally in your browser. The extension only communicates with Azure DevOps—no data is sent to third-party servers. See [PRIVACY.md](PRIVACY.md) for details.

## License

MIT
