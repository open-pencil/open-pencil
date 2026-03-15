export type TaskType =
  | "landing-hero"
  | "dashboard"
  | "form-auth"
  | "pricing"
  | "settings"
  | "empty-state"
  | "data-table"
  | "navigation"
  | "modal-dialog"
  | "card-component"
  | "profile-page"
  | "onboarding";

const KEYWORD_MAP: ReadonlyArray<{ type: TaskType; keywords: readonly string[] }> = [
  { type: "landing-hero", keywords: ["hero", "landing", "homepage", "above the fold", "value proposition", "headline"] },
  { type: "dashboard", keywords: ["dashboard", "analytics", "metrics", "kpi", "overview", "stats", "charts"] },
  { type: "form-auth", keywords: ["login", "signup", "sign up", "sign in", "register", "authentication", "auth", "password"] },
  { type: "pricing", keywords: ["pricing", "plans", "subscription", "billing", "tiers", "free trial"] },
  { type: "settings", keywords: ["settings", "preferences", "configuration", "options", "account settings"] },
  { type: "empty-state", keywords: ["empty state", "no data", "no results", "zero state", "blank slate", "first use"] },
  { type: "data-table", keywords: ["table", "data table", "grid", "spreadsheet", "list view", "rows", "columns"] },
  { type: "navigation", keywords: ["navigation", "navbar", "nav bar", "menu", "header", "sidebar navigation", "top bar"] },
  { type: "modal-dialog", keywords: ["modal", "dialog", "popup", "confirm", "alert dialog", "overlay"] },
  { type: "card-component", keywords: ["card", "cards", "card grid", "card list", "tile", "tiles"] },
  { type: "profile-page", keywords: ["profile", "user profile", "account page", "my account", "user page"] },
  { type: "onboarding", keywords: ["onboarding", "welcome", "getting started", "wizard", "setup flow", "first run"] },
];

/**
 * Classify a task description into a TaskType by matching keywords.
 * Returns the best-matching type, or "landing-hero" as the default fallback.
 */
export function classifyTask(description: string): TaskType {
  const lower = description.toLowerCase();

  let bestType: TaskType = "landing-hero";
  let bestScore = 0;

  for (const entry of KEYWORD_MAP) {
    let score = 0;
    for (const keyword of entry.keywords) {
      if (lower.includes(keyword)) {
        // Longer keyword matches are worth more
        score += keyword.length;
      }
    }
    if (score > bestScore) {
      bestScore = score;
      bestType = entry.type;
    }
  }

  return bestType;
}
