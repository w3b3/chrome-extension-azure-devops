import type { ProjectConfig } from "../types/settings.js";
import { getSettings, saveSettings } from "../utils/storage.js";
import { getCurrentUser } from "../api/identity.js";

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;

async function render(): Promise<void> {
  const settings = await getSettings();
  renderProjectList(settings.projects, settings.jiraDomainDefault);

  const jiraDomainDefaultInput = $<HTMLInputElement>("jira-domain-default");
  jiraDomainDefaultInput.value = settings.jiraDomainDefault ?? "";

  const pollInput = $<HTMLInputElement>("poll-interval");
  pollInput.value = String(settings.pollIntervalMinutes);

  const notifCheckbox = $<HTMLInputElement>("notif-enabled");
  notifCheckbox.checked = settings.notificationsEnabled;
}

function renderProjectList(projects: ProjectConfig[], jiraDomainDefault?: string): void {
  const container = $<HTMLDivElement>("project-list");

  if (projects.length === 0) {
    container.innerHTML = `<p class="no-projects">No projects configured yet.</p>`;
    return;
  }

  const grouped = new Map<string, Array<{ project: ProjectConfig; index: number }>>();
  projects.forEach((project, index) => {
    const bucket = grouped.get(project.organization) ?? [];
    bucket.push({ project, index });
    grouped.set(project.organization, bucket);
  });

  const organizations = [...grouped.entries()].sort(([a], [b]) => a.localeCompare(b));

  container.innerHTML = organizations
    .map(([organization, entries]) => {
      const orgEntries = [...entries].sort((a, b) => a.project.project.localeCompare(b.project.project));
      const userNames = [
        ...new Set(orgEntries.map((e) => e.project.userDisplayName).filter((name): name is string => Boolean(name))),
      ];
      const effectiveDomains = [
        ...new Set(orgEntries.map((e) => e.project.jiraDomain ?? jiraDomainDefault).filter(Boolean)),
      ];
      const usesGlobalFallbackForAll =
        Boolean(jiraDomainDefault) && orgEntries.every((entry) => !entry.project.jiraDomain);

      const userSummary = userNames.length === 1
        ? `Connected as ${esc(userNames[0])}`
        : userNames.length > 1
          ? "Connected as multiple accounts"
          : "Not connected";

      const jiraSummary = effectiveDomains.length === 0
        ? `<div class="org-jira muted">Jira domain not configured</div>`
        : `<div class="org-jira">Jira: ${esc(`${effectiveDomains[0]}.atlassian.net`)}${usesGlobalFallbackForAll ? " (global fallback)" : ""}</div>`;

      return `
        <div class="org-group">
          <div class="org-header">
            <div class="org-title-row">
              <div class="org-title">${esc(organization)}</div>
              <div class="org-count">${orgEntries.length} project${orgEntries.length === 1 ? "" : "s"}</div>
            </div>
            <div class="org-user">${userSummary}</div>
            ${
              effectiveDomains.length > 1
                ? `<div class="org-jira">Jira: multiple domains configured</div>`
                : jiraSummary
            }
          </div>
          <div class="project-rows">
            ${orgEntries
              .map(({ project, index }) => {
                const overrideDomain = project.jiraDomain;
                const hasOverride = Boolean(overrideDomain) && overrideDomain !== jiraDomainDefault;
                const hasProjectDomainWithoutFallback = Boolean(overrideDomain) && !jiraDomainDefault;
                return `
                  <div class="project-row">
                    <div class="project-main">
                      <div class="project-name">${esc(project.project)}</div>
                      ${
                        hasOverride
                          ? `<div class="project-badge">Jira override: ${esc(`${overrideDomain}.atlassian.net`)}</div>`
                          : hasProjectDomainWithoutFallback
                            ? `<div class="project-badge">Jira: ${esc(`${overrideDomain}.atlassian.net`)}</div>`
                            : ""
                      }
                    </div>
                    <button class="btn btn-danger remove-btn" data-index="${index}">Remove</button>
                  </div>
                `;
              })
              .join("")}
          </div>
        </div>
      `;
    })
    .join("");

  container.querySelectorAll(".remove-btn").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      const idx = parseInt((e.target as HTMLElement).dataset["index"] ?? "0", 10);
      void removeProject(idx);
    });
  });
}

async function removeProject(index: number): Promise<void> {
  const settings = await getSettings();
  settings.projects.splice(index, 1);
  await saveSettings(settings);
  renderProjectList(settings.projects, settings.jiraDomainDefault);
}

async function addProject(): Promise<void> {
  const orgInput = $<HTMLInputElement>("org");
  const projectInput = $<HTMLInputElement>("project");
  const patInput = $<HTMLInputElement>("pat");
  const jiraDomainInput = $<HTMLInputElement>("jira-domain");
  const statusEl = $<HTMLDivElement>("add-status");

  const organization = orgInput.value.trim();
  const project = projectInput.value.trim();
  const pat = patInput.value.trim();
  const jiraDomain = normalizeJiraDomain(jiraDomainInput.value);

  if (!organization || !project || !pat) {
    showStatus(statusEl, "All fields are required.", "error");
    return;
  }

  showStatus(statusEl, "Verifying connection...", "");

  try {
    const user = await getCurrentUser({ organization, pat });

    const settings = await getSettings();

    // Check for duplicate
    const exists = settings.projects.some(
      (p) => p.organization === organization && p.project === project,
    );
    if (exists) {
      showStatus(statusEl, "This project is already configured.", "error");
      return;
    }

    settings.projects.push({
      organization,
      project,
      pat,
      ...(jiraDomain ? { jiraDomain } : {}),
      userId: user.id,
      userDisplayName: user.displayName,
    });

    await saveSettings(settings);

    orgInput.value = "";
    projectInput.value = "";
    patInput.value = "";
    jiraDomainInput.value = "";
    showStatus(statusEl, `Connected as ${user.displayName}`, "success");
    renderProjectList(settings.projects, settings.jiraDomainDefault);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Connection failed";
    showStatus(statusEl, msg, "error");
  }
}

async function saveGeneral(): Promise<void> {
  const statusEl = $<HTMLDivElement>("general-status");
  const settings = await getSettings();
  const jiraDomainDefault = normalizeJiraDomain($<HTMLInputElement>("jira-domain-default").value);

  settings.pollIntervalMinutes = Math.max(
    1,
    parseInt($<HTMLInputElement>("poll-interval").value, 10) || 2,
  );
  settings.notificationsEnabled = $<HTMLInputElement>("notif-enabled").checked;
  settings.jiraDomainDefault = jiraDomainDefault || undefined;

  await saveSettings(settings);
  showStatus(statusEl, "Settings saved.", "success");
  renderProjectList(settings.projects, settings.jiraDomainDefault);
}

function showStatus(el: HTMLElement, msg: string, type: string): void {
  el.textContent = msg;
  el.className = `status-msg ${type}`;
}

function esc(str: string): string {
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}

function normalizeJiraDomain(raw: string): string {
  const trimmed = raw.trim().toLowerCase();
  if (!trimmed) return "";

  const withoutProtocol = trimmed.replace(/^https?:\/\//, "");
  const withoutPath = withoutProtocol.split("/")[0] ?? "";
  const withoutSuffix = withoutPath.replace(/\.atlassian\.net$/, "");
  return withoutSuffix;
}

// Event listeners
$<HTMLButtonElement>("add-btn").addEventListener("click", () => void addProject());
$<HTMLButtonElement>("save-general-btn").addEventListener("click", () => void saveGeneral());

// Initial render
void render();
