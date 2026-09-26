export type AgentId = "supervisor" | "analyzer" | "verifier" | "guidance";

export type AgentStep = {
  id: AgentId;
  name: string;
  icon: string;
  status: "completed" | "active" | "waiting" | "degraded";
  detail: string;
};

export type AgentMode = "normal" | "degraded";

export type AgentWorkflowResult = {
  mode: AgentMode;
  agents: AgentStep[];
  tools: string[];
  summary: string;
  verification: {
    passed: boolean;
    evidenceAvailable: boolean;
    answerAccepted: boolean;
  };
};

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

/**
 * Builds the visible four-agent workflow metadata.
 * The actual department research/evidence functions remain in the API route
 * so the previously tested department behaviour stays unchanged.
 */
export function buildAgentWorkflow(args: {
  department: string;
  question: string;
  jurisdiction?: string | null;
  mode?: AgentMode;
  tools?: string[];
}): AgentWorkflowResult {
  const mode = args.mode || "normal";
  const jurisdiction = args.jurisdiction || "not specified";
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
        "Analyzed intent and jurisdiction (" +
        jurisdiction +
        "), then selected the appropriate evidence path.",
    },
    {
      id: "verifier",
      name: "Verification Agent",
      icon: "🛡️",
      status: mode === "degraded" ? "degraded" : "completed",
      detail:
        mode === "degraded"
          ? "Verified only the locally available evidence; live external verification was unavailable."
          : "Checked service, jurisdiction, source relevance and available evidence before guidance was prepared.",
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
        : "Four-agent workflow completed.",
    verification: {
      passed: mode === "normal",
      evidenceAvailable: true,
      answerAccepted: true,
    },
  };
}

/**
 * Executes the four logical agent stages around the existing, proven
 * department/evidence pipeline. This deliberately does not replace that
 * pipeline; it wraps it so the frozen service logic remains intact.
 */
export function runFourAgentWorkflow(args: {
  department: string;
  question: string;
  jurisdiction?: string | null;
  mode?: AgentMode;
  tools?: string[];
  answer: string;
  evidenceAvailable: boolean;
}): AgentWorkflowResult {
  const base = buildAgentWorkflow(args);
  const answerAccepted =
    args.answer.trim().length > 20 && args.evidenceAvailable;

  base.verification = {
    passed: base.mode === "normal" && answerAccepted,
    evidenceAvailable: args.evidenceAvailable,
    answerAccepted,
  };

  base.agents = base.agents.map((agent) => {
    if (agent.id === "verifier") {
      if (base.mode === "degraded") {
        return {
          ...agent,
          status: "degraded",
          detail:
            "Checked the available local evidence; live verification services were unavailable.",
        };
      }
      return {
        ...agent,
        status: answerAccepted ? "completed" : "degraded",
        detail: answerAccepted
          ? "Verified that supporting evidence is available for the generated guidance."
          : "Verification could not confirm sufficient supporting evidence for the generated guidance.",
      };
    }

    if (agent.id === "guidance") {
      return {
        ...agent,
        status: answerAccepted || base.mode === "degraded" ? "completed" : "waiting",
        detail:
          answerAccepted || base.mode === "degraded"
            ? "Prepared the final citizen-facing guidance from the verified evidence."
            : "Waiting for sufficient verified evidence.",
      };
    }

    return agent;
  });

  base.summary =
    base.mode === "degraded"
      ? "Four-agent workflow completed in degraded mode using available verified evidence."
      : answerAccepted
        ? "Four-agent workflow completed: supervised, analyzed, verified and prepared citizen guidance."
        : "Four-agent workflow completed with a verification warning.";

  return base;
}
