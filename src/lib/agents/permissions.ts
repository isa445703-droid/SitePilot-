/**
 * Explicit tool permissions for agents.
 *
 * The LLM never receives tools directly and never has database access. Agents
 * call named operations, and every operation asserts that the calling agent is
 * allowed to perform it. Anything not listed is denied (deny-by-default).
 */

export const AGENT_NAMES = [
  "orchestrator",
  "research",
  "writer",
  "editor",
  "seo",
  "analytics",
  "publisher",
  "pages",
] as const;
export type AgentName = (typeof AGENT_NAMES)[number];

export const TOOLS = [
  "read_site",
  "read_content",
  "read_analytics",
  "research",
  "create_draft",
  "update_content",
  "set_metadata",
  "publish",
  "create_tasks",
  "log_activity",
  // Sensitive operations — denied to every agent (documented on purpose).
  "manage_billing",
  "delete_site",
  "modify_auth",
  "run_shell",
  "modify_source_code",
] as const;
export type ToolName = (typeof TOOLS)[number];

export const AGENT_PERMISSIONS: Record<AgentName, readonly ToolName[]> = {
  research: ["read_site", "read_content", "research", "log_activity"],
  writer: ["read_site", "read_content", "research", "create_draft", "log_activity"],
  editor: ["read_site", "read_content", "update_content", "log_activity"],
  seo: ["read_site", "read_content", "set_metadata", "update_content", "log_activity"],
  analytics: ["read_site", "read_content", "read_analytics", "create_tasks", "log_activity"],
  publisher: ["read_site", "read_content", "publish", "log_activity"],
  pages: ["read_site", "read_content", "update_content", "log_activity"],
  orchestrator: [
    "read_site",
    "read_content",
    "read_analytics",
    "create_tasks",
    "log_activity",
  ],
};

/** Tools that must never be granted to any agent, no matter what. */
export const ALWAYS_DENIED: readonly ToolName[] = [
  "manage_billing",
  "delete_site",
  "modify_auth",
  "run_shell",
  "modify_source_code",
];

export class PermissionError extends Error {
  readonly userMessage = "The agent is not allowed to perform this action.";
  readonly code = "AGENT_PERMISSION_DENIED";
  constructor(
    public readonly agent: AgentName,
    public readonly tool: ToolName,
  ) {
    super(`Agent "${agent}" is not allowed to use tool "${tool}"`);
    this.name = "PermissionError";
  }
}

export function isToolAllowed(agent: AgentName, tool: ToolName): boolean {
  if (ALWAYS_DENIED.includes(tool)) return false;
  return AGENT_PERMISSIONS[agent]?.includes(tool) ?? false;
}

export function assertPermission(agent: AgentName, tool: ToolName): void {
  if (!isToolAllowed(agent, tool)) throw new PermissionError(agent, tool);
}

/** The exact tool list an agent may use — useful for logging and tests. */
export function allowedTools(agent: AgentName): readonly ToolName[] {
  return AGENT_PERMISSIONS[agent].filter((t) => !ALWAYS_DENIED.includes(t));
}
