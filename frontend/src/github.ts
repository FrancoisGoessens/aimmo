// Petit client pour l'API GitHub, utilisé pour rendre le site "autonome" sans repasser
// par un push manuel : commit direct de criteria-<market>.json et déclenchement de
// l'Action à la demande. Le token ne quitte jamais ce navigateur (localStorage) sauf
// pour parler directement à api.github.com.

const TOKEN_KEY = "aimmo_github_token";
const REPO_KEY = "aimmo_github_repo"; // format "utilisateur/repo"

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}
export function setToken(token: string) {
  localStorage.setItem(TOKEN_KEY, token);
}
export function clearToken() {
  localStorage.removeItem(TOKEN_KEY);
}

export function getRepo(): string | null {
  return localStorage.getItem(REPO_KEY);
}
export function setRepo(repo: string) {
  localStorage.setItem(REPO_KEY, repo);
}

export function isConfigured(): boolean {
  return !!getToken() && !!getRepo();
}

interface GhError {
  message: string;
}

async function ghFetch(url: string, init: RequestInit = {}) {
  const token = getToken();
  if (!token) throw new Error("Aucun token GitHub configuré.");
  const res = await fetch(url, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
      ...(init.headers || {}),
    },
  });
  if (!res.ok) {
    let detail = "";
    try {
      const body = (await res.json()) as GhError;
      detail = body.message || "";
    } catch {
      // pas de corps JSON exploitable
    }
    throw new Error(`GitHub API ${res.status}${detail ? " — " + detail : ""}`);
  }
  return res;
}

// Committe un fichier texte (ex: criteria-achat.json) sur la branche main.
export async function commitFile(filePath: string, content: string, message: string): Promise<void> {
  const repo = getRepo();
  if (!repo) throw new Error("Aucun repo configuré.");
  const apiUrl = `https://api.github.com/repos/${repo}/contents/${filePath}`;

  // Il faut le sha du fichier existant pour le mettre à jour (sinon GitHub refuse).
  let sha: string | undefined;
  try {
    const res = await ghFetch(apiUrl);
    const data = await res.json();
    sha = data.sha;
  } catch {
    // fichier inexistant : on le crée, pas de sha nécessaire
  }

  const body = {
    message,
    content: btoa(unescape(encodeURIComponent(content))), // base64, UTF-8 safe
    ...(sha ? { sha } : {}),
  };

  await ghFetch(apiUrl, { method: "PUT", body: JSON.stringify(body) });
}

// Déclenche un workflow à la demande (scrape-and-deploy.yml ou scrape-leboncoin.yml),
// avec des inputs optionnels pour générer un bulletin ponctuel.
export async function triggerWorkflow(workflowFile: string, inputs: Record<string, string>): Promise<void> {
  const repo = getRepo();
  if (!repo) throw new Error("Aucun repo configuré.");
  const url = `https://api.github.com/repos/${repo}/actions/workflows/${workflowFile}/dispatches`;
  await ghFetch(url, {
    method: "POST",
    body: JSON.stringify({ ref: "main", inputs }),
  });
}
