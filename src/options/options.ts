import type { ProjectConfig } from "../types/settings.js";
import { getSettings, saveSettings } from "../utils/storage.js";
import { getCurrentUser } from "../api/identity.js";

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;

async function render(): Promise<void> {
  const settings = await getSettings();
  renderProjectList(settings.projects);

  const pollInput = $<HTMLInputElement>("poll-interval");
  pollInput.value = String(settings.pollIntervalMinutes);

  const notifCheckbox = $<HTMLInputElement>("notif-enabled");
  notifCheckbox.checked = settings.notificationsEnabled;
}

function renderProjectList(projects: ProjectConfig[]): void {
  const container = $<HTMLDivElement>("project-list");

  if (projects.length === 0) {
    container.innerHTML = `<p class="no-projects">No projects configured yet.</p>`;
    return;
  }

  container.innerHTML = projects
    .map(
      (p, i) => `
    <div class="project-card">
      <div class="project-info">
        <div class="org-project">${esc(p.organization)} / ${esc(p.project)}</div>
        <div class="user-name">${p.userDisplayName ? `Connected as ${esc(p.userDisplayName)}` : "Not connected"}</div>
      </div>
      <button class="btn btn-danger remove-btn" data-index="${i}">Remove</button>
    </div>
  `,
    )
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
  renderProjectList(settings.projects);
}

async function addProject(): Promise<void> {
  const orgInput = $<HTMLInputElement>("org");
  const projectInput = $<HTMLInputElement>("project");
  const patInput = $<HTMLInputElement>("pat");
  const statusEl = $<HTMLDivElement>("add-status");

  const organization = orgInput.value.trim();
  const project = projectInput.value.trim();
  const pat = patInput.value.trim();

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
      userId: user.id,
      userDisplayName: user.displayName,
    });

    await saveSettings(settings);

    orgInput.value = "";
    projectInput.value = "";
    patInput.value = "";
    showStatus(statusEl, `Connected as ${user.displayName}`, "success");
    renderProjectList(settings.projects);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Connection failed";
    showStatus(statusEl, msg, "error");
  }
}

async function saveGeneral(): Promise<void> {
  const statusEl = $<HTMLDivElement>("general-status");
  const settings = await getSettings();

  settings.pollIntervalMinutes = Math.max(
    1,
    parseInt($<HTMLInputElement>("poll-interval").value, 10) || 2,
  );
  settings.notificationsEnabled = $<HTMLInputElement>("notif-enabled").checked;

  await saveSettings(settings);
  showStatus(statusEl, "Settings saved.", "success");
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

// Event listeners
$<HTMLButtonElement>("add-btn").addEventListener("click", () => void addProject());
$<HTMLButtonElement>("save-general-btn").addEventListener("click", () => void saveGeneral());

// Initial render
void render();
