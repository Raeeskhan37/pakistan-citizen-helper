export type AgentId =
  | "supervisor"
  | "analyzer"
  | "researcher"
  | "verifier"
  | "guidance";

export type AgentStep = {
  id: AgentId;
  name: string;
  icon: string;
  status: "completed" | "active" | "waiting" | "degraded";
  detail: string;
};

export type AgentMode = "normal" | "degraded";

const AGENT_NAMES: Record<AgentId, string> = {
  supervisor: "Supervisor Agent",
  analyzer: "Analyzing Agent",
  researcher: "Research Agent",
  verifier: "Verification Agent",
  guidance: "Citizen Guidance Agent",
};

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
  const tools = args.tools || [
    "Department knowledge",
    "Jurisdiction detection",
    "Official-source research",
    "Source verification",
  ];

  const degradedSuffix =
    mode === "degraded"
      ? " Live external verification is unavailable; only locally available verified knowledge can be used."
      : "";

  const agents: AgentStep[] = [
    {
      id: "supervisor",
      name: AGENT_NAMES.supervisor,
      icon: "🧠",
      status: "completed",
      detail: `Received the request and selected ${args.department || "the appropriate service"}.`,
    },
    {
      id: "analyzer",
      name: AGENT_NAMES.analyzer,
      icon: "🔍",
      status: "completed",
      detail: `Analyzed the request and jurisdiction: ${jurisdiction}.`,
    },
    {
      id: "researcher",
      name: AGENT_NAMES.researcher,
      icon: "🌐",
      status: mode === "degraded" ? "degraded" : "completed",
      detail:
        mode === "degraded"
          ? "Live official-source research unavailable."
          : "Collected evidence from the approved government knowledge/source layer.",
    },
    {
      id: "verifier",
      name: AGENT_NAMES.verifier,
      icon: "🛡️",
      status: "completed",
      detail:
        mode === "degraded"
          ? "Checked the locally available evidence only."
          : "Checked service, jurisdiction and evidence relevance before answering.",
    },
    {
      id: "guidance",
      name: AGENT_NAMES.guidance,
      icon: "✍️",
      status: "completed",
      detail: "Converted the verified evidence into citizen-friendly guidance.",
    },
  ];

  return {
    mode,
    agents,
    tools,
    summary:
      mode === "degraded"
        ? "Degraded Mode is active." + degradedSuffix
        : "Four-agent verification workflow completed.",
  };
}
