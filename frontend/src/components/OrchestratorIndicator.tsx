import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { ProcessedEvent } from "@/components/ActivityTimeline";
import { Loader2, Activity, TextSearch, Search, Brain, Pen } from "lucide-react";
import React, { useMemo } from "react";

interface OrchestratorIndicatorProps {
  processedEvents: ProcessedEvent[];
  isLoading: boolean;
}

// Utility to determine current flow based on processed events
function computeFlow(processedEvents: ProcessedEvent[]) {
  const hasGenerate = processedEvents.some((e) => e.title.toLowerCase().includes("generating"));
  const hasResearch = processedEvents.some((e) => e.title.toLowerCase().includes("web research"));
  const hasReflection = processedEvents.some((e) => e.title.toLowerCase().includes("reflection"));
  const hasFinalize = processedEvents.some((e) => e.title.toLowerCase().includes("finalizing"));

  const steps = [
    { key: "received", label: "Received User Question", icon: <Activity className="h-3.5 w-3.5" /> },
    { key: "generate", label: "Generating Search Queries", icon: <TextSearch className="h-3.5 w-3.5" /> },
    // These two will be omitted if direct-answer path
    { key: "research", label: "Web Research", icon: <Search className="h-3.5 w-3.5" /> },
    { key: "reflection", label: "Reflection", icon: <Brain className="h-3.5 w-3.5" /> },
    { key: "finalize", label: "Finalizing Answer", icon: <Pen className="h-3.5 w-3.5" /> },
  ];

  const directPath = hasGenerate && !hasResearch && !hasReflection; // queries generated but no research

  // Determine completed steps
  const completed: string[] = ["received"]; // we always have a human message
  if (hasGenerate) completed.push("generate");
  if (!directPath) {
    if (hasResearch) completed.push("research");
    if (hasReflection) completed.push("reflection");
  }
  if (hasFinalize) completed.push("finalize");

  const activeKey = (() => {
    if (hasFinalize) return "finalize";
    if (!directPath) {
      if (hasReflection) return "reflection";
      if (hasResearch) return "research";
    }
    if (hasGenerate) return "generate";
    return "received";
  })();

  const visibleSteps = directPath
    ? steps.filter((s) => ["received", "generate", "finalize"].includes(s.key))
    : steps;

  const progress = Math.round((completed.length / visibleSteps.length) * 100);

  return { steps: visibleSteps, completed, activeKey, progress, directPath };
}

const ShimmerText: React.FC<{ children: React.ReactNode; active?: boolean }> = ({ children, active }) => (
  <span className={active ? "animate-pulse" : ""}>{children}</span>
);

export const OrchestratorIndicator: React.FC<OrchestratorIndicatorProps> = ({
  processedEvents,
  isLoading,
}) => {
  const flow = useMemo(() => computeFlow(processedEvents), [processedEvents]);

  return (
    <Card className="bg-neutral-800 border-neutral-700">
      <CardHeader>
        <CardTitle className="text-neutral-100 text-sm">Orchestrator</CardTitle>
      </CardHeader>
      <CardContent>
        {/* Progress bar */}
        <div className="w-full h-2 bg-neutral-700 rounded overflow-hidden mb-3">
          <div
            className="h-full bg-gradient-to-r from-blue-500 to-cyan-400"
            style={{ width: `${flow.progress}%` }}
          />
        </div>
        {/* Flow steps */}
        <div className="space-y-2">
          {flow.steps.map((step) => {
            const isCompleted = flow.completed.includes(step.key);
            const isActive = flow.activeKey === step.key && isLoading;
            return (
              <div key={step.key} className="flex items-center gap-2 text-xs">
                <div
                  className={`h-5 w-5 rounded-full flex items-center justify-center border ${
                    isCompleted ? "bg-neutral-700 border-neutral-600" : "bg-neutral-900 border-neutral-700"
                  }`}
                >
                  {step.icon}
                </div>
                <div className="flex-1">
                  <ShimmerText active={isActive}>
                    <span className={`text-neutral-200 ${isCompleted ? "" : "text-neutral-300"}`}>
                      {step.label}
                    </span>
                  </ShimmerText>
                </div>
                <div className="text-[10px] text-neutral-400">
                  {isCompleted ? "Done" : isActive ? "Running" : "Pending"}
                </div>
              </div>
            );
          })}
        </div>
        {/* Direct answer indicator */}
        {flow.directPath ? (
          <p className="text-[11px] text-neutral-400 mt-3">
            Direct Answer Path: Skipped web research for this query.
          </p>
        ) : null}
      </CardContent>
    </Card>
  );
};