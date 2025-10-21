import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { OrchestratorIndicator } from "@/components/OrchestratorIndicator";
import { SearchResultsPanel } from "@/components/SearchResultsPanel";
import { ProcessedEvent } from "@/components/ActivityTimeline";
import { Clipboard, ClipboardCheck, ListChecks, PackagePlus } from "lucide-react";
import React, { useState, useEffect } from "react";
import { useDevMode } from "@/lib/devMode";
import { WordPreviewPanel } from "@/components/WordPreviewPanel";

interface RightPanelProps {
  processedEvents: ProcessedEvent[];
  isLoading: boolean;
  // Word preview (optional)
  wordPreviewActive?: boolean;
  wordDocument?: any;
  wordError?: string | null;
  wordIsGenerating?: boolean;
}

function usePlannerData(processedEvents: ProcessedEvent[]) {
  const plannerEvent = processedEvents.find((e) => e.title.toLowerCase().includes("planner"));
  const plan = plannerEvent?.details?.plan || plannerEvent?.data || null;
  return plan || null;
}

function useArtifacts(processedEvents: ProcessedEvent[]) {
  const actorEvents = processedEvents.filter((e) => e.title.toLowerCase().includes("actor"));
  const artifacts = actorEvents.flatMap((e) => (e.details?.artifacts || e.data?.artifacts || e.sources || [])).filter(Boolean);
  return artifacts || [];
}

const PolicyBadge: React.FC = () => {
  const [label, setLabel] = useState<string>("Policy: loading...");
  useEffect(() => {
    async function fetchPolicy() {
      try {
        const url = import.meta.env.DEV ? "/api/policy/current" : "http://localhost:8123/api/policy/current";
        
        // Validate URL before fetch
        if (!url || typeof url !== "string" || url.trim() === "") {
          throw new Error("Invalid URL for policy fetch");
        }
        
        const res = await fetch(url);
        const data = await res.json();
        const preamble: string = data?.preamble || "";
        const checksum = preamble
          ? (preamble.split("").reduce((acc, ch) => acc + ch.charCodeAt(0), 0) % 100000).toString(16)
          : "0";
        setLabel(`Policy v${checksum}`);
      } catch (e) {
        console.warn('Policy fetch error:', e);
        setLabel("Policy: unavailable");
      }
    }
    fetchPolicy();
  }, []);
  return <Badge className="text-[10px]" variant="outline">{label}</Badge>;
};

const PlanPanel: React.FC<{ plan: any | null }>= ({ plan }) => {
  const [copied, setCopied] = useState(false);
  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(JSON.stringify(plan, null, 2));
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch (err) {
      console.error("Failed to copy plan:", err);
    }
  };
  if (!plan) {
    return (
      <Card className="bg-neutral-800 border-neutral-700">
        <CardHeader>
          <CardTitle className="text-neutral-100 text-sm flex items-center gap-2">
            <ListChecks className="h-4 w-4" /> Plan
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-xs text-neutral-400">Chưa có kế hoạch.</p>
        </CardContent>
      </Card>
    );
  }
  return (
    <Card className="bg-neutral-800 border-neutral-700">
      <CardHeader className="flex items-center justify-between">
        <CardTitle className="text-neutral-100 text-sm flex items-center gap-2">
          <ListChecks className="h-4 w-4" /> Plan
        </CardTitle>
        <Button size="sm" variant="outline" className="text-xs" onClick={handleCopy}>
          {copied ? <ClipboardCheck className="h-3 w-3" /> : <Clipboard className="h-3 w-3" />}
          {copied ? "Copied" : "Copy JSON"}
        </Button>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          {plan.objective && (
            <div>
              <p className="text-xs text-neutral-400">Objective</p>
              <p className="text-sm text-neutral-200">{plan.objective}</p>
            </div>
          )}
          {plan.kind && (
            <div className="flex items-center gap-2">
              <p className="text-xs text-neutral-400">Kind</p>
              <Badge className="text-[10px]">{plan.kind}</Badge>
            </div>
          )}
          {Array.isArray(plan.steps) && plan.steps.length > 0 && (
            <div>
              <p className="text-xs text-neutral-400">Steps</p>
              <ul className="list-disc pl-5 text-sm text-neutral-200">
                {plan.steps.map((s: any, i: number) => (
                  <li key={i}>{typeof s === "string" ? s : s?.description || JSON.stringify(s)}</li>
                ))}
              </ul>
            </div>
          )}
          {Array.isArray(plan.acceptance_criteria) && plan.acceptance_criteria.length > 0 && (
            <div>
              <p className="text-xs text-neutral-400">Acceptance Criteria</p>
              <ul className="list-disc pl-5 text-sm text-neutral-200">
                {plan.acceptance_criteria.map((c: any, i: number) => (
                  <li key={i}>{typeof c === "string" ? c : c?.description || JSON.stringify(c)}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
};

const ArtifactsPanel: React.FC<{ artifacts: any[] }>= ({ artifacts }) => {
  if (!artifacts || artifacts.length === 0) {
    return (
      <Card className="bg-neutral-800 border-neutral-700">
        <CardHeader>
          <CardTitle className="text-neutral-100 text-sm flex items-center gap-2">
            <PackagePlus className="h-4 w-4" /> Artifacts
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-xs text-neutral-400">Chưa có artifacts.</p>
        </CardContent>
      </Card>
    );
  }
  return (
    <Card className="bg-neutral-800 border-neutral-700">
      <CardHeader>
        <CardTitle className="text-neutral-100 text-sm flex items-center gap-2">
          <PackagePlus className="h-4 w-4" /> Artifacts
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {artifacts.map((a: any, idx: number) => (
            <div key={idx} className="rounded-md bg-neutral-900 border border-neutral-700 p-3">
              <div className="text-sm font-medium text-neutral-100">{a.title || a.id || `Artifact ${idx+1}`}</div>
              {a.mime && (
                <div className="text-xs text-neutral-400">{a.mime}</div>
              )}
              {a.content && (
                <pre className="mt-2 text-xs whitespace-pre-wrap text-neutral-200">{a.content}</pre>
              )}
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
};

export const RightPanel: React.FC<RightPanelProps> = ({ processedEvents, isLoading, wordPreviewActive, wordDocument, wordError, wordIsGenerating }) => {
  const plan = usePlannerData(processedEvents);
  const artifacts = useArtifacts(processedEvents);
  const dev = useDevMode();

  return (
    <div className="space-y-4">
      {/* Word preview appears at the top when active */}
      {wordPreviewActive && (
        <WordPreviewPanel documentJson={wordDocument} error={wordError || undefined} isGenerating={!!wordIsGenerating} />
      )}

      {/* Orchestrator flow indicator remains minimal */}
      <OrchestratorIndicator processedEvents={processedEvents} isLoading={isLoading} />
      {/* Sources section is always shown when right panel is visible */}
      <SearchResultsPanel processedEvents={processedEvents} isLoading={isLoading} />

      {/* Plan + Artifacts ONLY visible in dev mode */}
      {dev && <PlanPanel plan={plan} />}
      {dev && <ArtifactsPanel artifacts={artifacts} />}

      {/* Footer badges */}
      <div className="flex items-center gap-2">
        <PolicyBadge />
      </div>
    </div>
  );
};