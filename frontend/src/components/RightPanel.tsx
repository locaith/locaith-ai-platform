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

// Shimmer effect component for thinking state
const ShimmerEffect: React.FC = () => (
  <div className="animate-pulse">
    <div className="space-y-2">
      <div className="h-3 bg-neutral-700 rounded w-3/4"></div>
      <div className="h-3 bg-neutral-700 rounded w-1/2"></div>
      <div className="h-3 bg-neutral-700 rounded w-5/6"></div>
    </div>
  </div>
);

// Extract sources from processed events
function extractSources(processedEvents: ProcessedEvent[]): Array<{url: string, title: string}> {
  const sources: Array<{url: string, title: string}> = [];
  
  processedEvents.forEach(event => {
    if (event.sources && Array.isArray(event.sources)) {
      event.sources.forEach((source: any) => {
        if (source.url && source.title) {
          sources.push({
            url: source.url,
            title: source.title
          });
        }
      });
    }
  });
  
  // Remove duplicates based on URL
  const uniqueSources = sources.filter((source, index, self) => 
    index === self.findIndex(s => s.url === source.url)
  );
  
  return uniqueSources;
}

// Get current thinking status
function getThinkingStatus(processedEvents: ProcessedEvent[], isLoading: boolean): string {
  if (!isLoading) {
    return "Hoàn thành";
  }
  
  if (processedEvents.length === 0) {
    return "Đang khởi tạo...";
  }
  
  const lastEvent = processedEvents[processedEvents.length - 1];
  
  switch (lastEvent.title) {
    case "Generating Search Queries":
      return "Đang tạo câu hỏi tìm kiếm...";
    case "Web Research":
      return "Đang nghiên cứu trên web...";
    case "Reflection":
      return "Đang phân tích kết quả...";
    case "Finalizing Answer":
      return "Đang hoàn thiện câu trả lời...";
    default:
      return "Đang xử lý...";
  }
}

export const RightPanel: React.FC<RightPanelProps> = ({ 
  processedEvents, 
  isLoading, 
  wordPreviewActive, 
  wordDocument, 
  wordError, 
  wordIsGenerating 
}) => {
  const sources = extractSources(processedEvents);
  const thinkingStatus = getThinkingStatus(processedEvents, isLoading);
  
  return (
    <div className="bg-neutral-800/50 backdrop-blur-sm border border-neutral-700/50 rounded-lg p-4 space-y-6">
      {/* Word preview appears at the top when active */}
      {wordPreviewActive && (
        <div className="mb-4">
          <h3 className="text-sm font-medium text-neutral-200 mb-3">Word Preview</h3>
          <div className="text-xs text-neutral-400">
            {wordError ? (
              <div className="text-red-400">{wordError}</div>
            ) : wordIsGenerating ? (
              <div className="text-neutral-300">Đang tạo tài liệu...</div>
            ) : wordDocument ? (
              <div className="text-neutral-300">Tài liệu đã sẵn sàng</div>
            ) : (
              <div className="text-neutral-500">Chưa có tài liệu</div>
            )}
          </div>
        </div>
      )}

      {/* Thinking Section */}
      <div>
        <h3 className="text-sm font-medium text-neutral-200 mb-3">Thinking</h3>
        <div className="text-xs text-neutral-400">
          {isLoading ? (
            <div className="space-y-3">
              <div className="text-neutral-300">{thinkingStatus}</div>
              <ShimmerEffect />
            </div>
          ) : (
            <div className="text-neutral-300">
              {processedEvents.length > 0 ? "Đã hoàn thành phân tích" : "Chưa có hoạt động"}
            </div>
          )}
        </div>
      </div>

      {/* Sources Section */}
      <div>
        <h3 className="text-sm font-medium text-neutral-200 mb-3">Sources</h3>
        <div className="space-y-2">
          {sources.length > 0 ? (
            sources.map((source, index) => (
              <a
                key={index}
                href={source.url}
                target="_blank"
                rel="noopener noreferrer"
                className="block text-xs text-blue-400 hover:text-blue-300 hover:underline transition-colors duration-200 truncate"
                title={source.title}
              >
                {source.title}
              </a>
            ))
          ) : (
            <div className="text-xs text-neutral-500">
              {isLoading ? "Đang tìm kiếm nguồn..." : "Không có nguồn nào"}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};