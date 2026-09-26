export type AgentId = "supervisor" | "analyzer" | "verifier" | "guidance";

export type AgentStep = {
  id: AgentId;
  name: string;
  icon: string;
  status: "completed" | "active" | "waiting" | "degraded";
  detail: string;
};

export type AgentMode = "normal" | "degraded";

export const AGENT_TOOL_REGISTRY = [
  "NADRA RAG",
  "Supabase verified knowledge",
  "Official web research",
  "Official source reader",
  "Jurisdiction detection",
  "Source verification",
  "Short-term conversation memory",
  "User-controlled long-term memory",
  "English / Urdu guidance",
] as const;

export function buildAgentWorkflow(args: {
  department: string;
  question: string;
  jurisdiction?: string | null;
  mode?: AgentMode;
  tools?: string[];
}): {
  mode: AgentMode;
  agents: AgentStep[];
  tools: string[];
  summary: string;
} {
  const mode = args.mode || "normal";
  const jurisdiction = args.jurisdiction || "not specified";

  // Research is a capability of the Analyzing Agent, not a fifth agent.
  // The API supplies request-specific tools; the core tool layer remains visible.
  const requestedTools = args.tools || [];
  const tools = Array.from(
    new Set([
      ...requestedTools,
      "NADRA RAG (when applicable)",
      "Supabase verified knowledge (when applicable)",
      "Official web research (when applicable)",
      "Official source reader (when applicable)",
      "Jurisdiction detection",
      "Source verification",
      "Short-term conversation memory",
      "User-controlled long-term memory",
      "English / Urdu guidance",
    ])
  );

  const agents: AgentStep[] = [
    {
      id: "supervisor",
      name: "Supervisor Agent",
      icon: "🧠",
      status: "completed",
      detail:
        "Coordinated the request and selected " +
        (args.department || "the appropriate service") +
        ".",
    },
    {
      id: "analyzer",
      name: "Analyzing Agent",
      icon: "🔍",
      status: "completed",
      detail:
        "Analyzed the intent and jurisdiction (" +
        jurisdiction +
        "), then selected the appropriate research tools and evidence path.",
    },
    {
      id: "verifier",
      name: "Verification Agent",
      icon: "🛡️",
      status: mode === "degraded" ? "degraded" : "completed",
      detail:
        mode === "degraded"
          ? "Verified only the locally available evidence; live external verification was unavailable."
          : "Checked service, jurisdiction, source relevance and available evidence before the answer was prepared.",
    },
    {
      id: "guidance",
      name: "Citizen Guidance Agent",
      icon: "✍️",
      status: "completed",
      detail:
        mode === "degraded"
          ? "Prepared bounded guidance from locally available verified evidence."
          : "Prepared clear citizen-friendly guidance from the verified evidence.",
    },
  ];

  return {
    mode,
    agents,
    tools,
    summary:
      mode === "degraded"
        ? "Degraded Mode is active. Live external services are unavailable; only available verified local evidence is used."
        : "Four-agent verification workflow completed.",
  };
}
