import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
} from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Loader2,
  Activity,
  Info,
  Search,
  TextSearch,
  Brain,
  Pen,
  ChevronDown,
  ChevronUp,
  ListChecks,
  PackagePlus,
  CheckCircle2,
} from "lucide-react";
import { useEffect, useState } from "react";

export interface ProcessedEvent {
  title: string;
  data: any;
  sources?: any[];
  queries?: string[];
  details?: any;
}

interface ActivityTimelineProps {
  processedEvents: ProcessedEvent[];
  isLoading: boolean;
}

export function ActivityTimeline({
  processedEvents,
  isLoading,
}: ActivityTimelineProps) {
  const [isTimelineCollapsed, setIsTimelineCollapsed] =
    useState<boolean>(false);
  
  const getEventIcon = (title: string, index: number) => {
    if (index === 0 && isLoading && processedEvents.length === 0) {
      return <Loader2 className="h-4 w-4 text-white animate-spin" />;
    }
    if (title.toLowerCase().includes("generating")) {
      return <TextSearch className="h-4 w-4 text-white" />;
    } else if (title.toLowerCase().includes("thinking")) {
      return <Loader2 className="h-4 w-4 text-white animate-spin" />;
    } else if (title.toLowerCase().includes("reflection")) {
      return <Brain className="h-4 w-4 text-white" />;
    } else if (title.toLowerCase().includes("research")) {
      return <Search className="h-4 w-4 text-white" />;
    } else if (title.toLowerCase().includes("planner")) {
      return <ListChecks className="h-4 w-4 text-white" />;
    } else if (title.toLowerCase().includes("actor")) {
      return <PackagePlus className="h-4 w-4 text-white" />;
    } else if (title.toLowerCase().includes("self-check")) {
      return <CheckCircle2 className="h-4 w-4 text-white" />;
    } else if (title.toLowerCase().includes("finalizing")) {
      return <Pen className="h-4 w-4 text-white" />;
    }
    return <Activity className="h-4 w-4 text-white" />;
  };

  const formatEventData = (eventItem: ProcessedEvent) => {
    // Hiển thị nội dung chi tiết thay vì tóm tắt
    if (eventItem.title.toLowerCase().includes("generating")) {
      if (eventItem.queries && Array.isArray(eventItem.queries)) {
        return (
          <div className="space-y-1">
            <p className="text-xs text-neutral-400 mb-2">Generated search queries:</p>
            {eventItem.queries.map((query, idx) => (
              <div key={idx} className="flex items-start gap-2">
                <span className="text-xs text-white mt-0.5">•</span>
                <span className="text-xs text-neutral-200 leading-relaxed">"{query}"</span>
              </div>
            ))}
          </div>
        );
      }
    } else if (eventItem.title.toLowerCase().includes("research")) {
      if (eventItem.sources && Array.isArray(eventItem.sources)) {
        const numSources = eventItem.sources.length;
        return (
          <div className="space-y-2">
            <p className="text-xs text-neutral-400">Found {numSources} sources:</p>
            {eventItem.sources.slice(0, 5).map((source, idx) => (
              <div key={idx} className="flex items-start gap-2">
                <span className="text-xs text-white mt-0.5">•</span>
                <div className="flex-1">
                  <p className="text-xs text-neutral-200 font-medium">{source.title || source.label || `Source ${idx + 1}`}</p>
                  {source.url && (
                    <p className="text-xs text-neutral-400 truncate">{source.url}</p>
                  )}
                  {source.snippet && (
                    <p className="text-xs text-neutral-300 mt-1 leading-relaxed">{source.snippet.substring(0, 100)}...</p>
                  )}
                </div>
              </div>
            ))}
            {numSources > 5 && (
              <p className="text-xs text-neutral-400 italic">... and {numSources - 5} more sources</p>
            )}
          </div>
        );
      }
    } else if (eventItem.title.toLowerCase().includes("reflection")) {
      return (
        <div className="space-y-1">
          <p className="text-xs text-neutral-200">Analyzing gathered information for knowledge gaps...</p>
          <p className="text-xs text-neutral-400">Determining if additional research is needed</p>
        </div>
      );
    } else if (eventItem.title.toLowerCase().includes("planner") && eventItem.details?.plan) {
      const plan = eventItem.details.plan;
      return (
        <div className="space-y-1">
          {plan.objective && (
            <p className="text-xs text-neutral-300">Objective: <span className="text-neutral-200">{plan.objective}</span></p>
          )}
          {Array.isArray(plan.steps) && plan.steps.length > 0 && (
            <div>
              <p className="text-xs text-neutral-400 mb-1">Steps:</p>
              <ul className="list-disc pl-5 space-y-1">
                {plan.steps.slice(0, 3).map((s: any, idx: number) => (
                  <li key={idx} className="text-xs text-neutral-200">{typeof s === "string" ? s : s.description}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      );
    } else if (eventItem.title.toLowerCase().includes("actor") && Array.isArray(eventItem.details?.artifacts)) {
      const a = eventItem.details.artifacts[0];
      if (a?.content) {
        return <pre className="text-xs text-neutral-300 whitespace-pre-wrap">{String(a.content).substring(0, 200)}...</pre>;
      }
    } else if (eventItem.title.toLowerCase().includes("self-check")) {
      return <div className="text-xs text-neutral-300 whitespace-pre-wrap">{String(eventItem.data || "").substring(0, 240)}</div>;
    }

    // Fallback cho các loại event khác
    if (typeof eventItem.data === "string") {
      return <p className="text-xs text-neutral-300 leading-relaxed">{eventItem.data}</p>;
    } else if (Array.isArray(eventItem.data)) {
      return (
        <div className="space-y-1">
          {eventItem.data.map((item, idx) => (
            <div key={idx} className="flex items-start gap-2">
              <span className="text-xs text-white mt-0.5">•</span>
              <span className="text-xs text-neutral-200 leading-relaxed">{item}</span>
            </div>
          ))}
        </div>
      );
    } else {
      return <p className="text-xs text-neutral-300 leading-relaxed">{JSON.stringify(eventItem.data)}</p>;
    }
  };

  useEffect(() => {
    if (!isLoading && processedEvents.length !== 0) {
      setIsTimelineCollapsed(true);
    }
  }, [isLoading, processedEvents]);

  return (
    <Card className="border-none rounded-lg bg-transparent backdrop-blur-sm max-h-96">
      <CardHeader>
        <CardDescription className="flex items-center justify-between">
          <div
            className="flex items-center justify-start text-sm w-full cursor-pointer gap-2 text-neutral-100"
            onClick={() => setIsTimelineCollapsed(!isTimelineCollapsed)}
          >
            Research
            {isTimelineCollapsed ? (
              <ChevronDown className="h-4 w-4 mr-2" />
            ) : (
              <ChevronUp className="h-4 w-4 mr-2" />
            )}
          </div>
        </CardDescription>
      </CardHeader>
      {!isTimelineCollapsed && (
        <ScrollArea className="max-h-96 overflow-y-auto pr-4">
          <CardContent className="pr-2">
            {isLoading && processedEvents.length === 0 && (
              <div className="relative pl-8 pb-4">
                <div className="absolute left-3 top-3.5 h-full w-0.5 bg-neutral-600/50" />
                <div className="absolute left-0.5 top-2 h-5 w-5 rounded-full bg-neutral-700/50 backdrop-blur-sm flex items-center justify-center ring-4 ring-neutral-800/30">
                  <Loader2 className="h-3 w-3 text-white animate-spin" />
                </div>
                <div>
                  <p className="text-sm text-neutral-200 font-medium">
                    Đang tìm kiếm...
                  </p>
                </div>
              </div>
            )}
            {processedEvents.length > 0 ? (
              <div className="space-y-0">
                {processedEvents.map((eventItem, index) => (
                  <div key={index} className="relative pl-8 pb-6">
                    {index < processedEvents.length - 1 ||
                    (isLoading && index === processedEvents.length - 1) ? (
                      <div className="absolute left-3 top-3.5 h-full w-0.5 bg-gradient-to-b from-blue-400/50 to-neutral-600/30" />
                    ) : null}
                    <div className="absolute left-0.5 top-2 h-6 w-6 rounded-full bg-neutral-700/50 backdrop-blur-sm flex items-center justify-center ring-4 ring-neutral-800/30 border border-neutral-600/30">
                      {getEventIcon(eventItem.title, index)}
                    </div>
                    <div>
                      <p className="text-sm text-neutral-100 font-medium mb-2">
                        {eventItem.title}
                      </p>
                      <div className="ml-2">
                        {formatEventData(eventItem)}
                      </div>
                    </div>
                  </div>
                ))}
                {isLoading && processedEvents.length > 0 && (
                  <div className="relative pl-8 pb-4">
                    <div className="absolute left-0.5 top-2 h-5 w-5 rounded-full bg-neutral-700/50 backdrop-blur-sm flex items-center justify-center ring-4 ring-neutral-800/30">
                      <Loader2 className="h-3 w-3 text-white animate-spin" />
                    </div>
                    <div>
                      <p className="text-sm text-neutral-200 font-medium">
                        Đang tìm kiếm thêm...
                      </p>
                    </div>
                  </div>
                )}
              </div>
            ) : !isLoading ? (
              <div className="flex flex-col items-center justify-center h-full text-neutral-500 pt-10">
                <Info className="h-6 w-6 mb-3 text-neutral-400" />
                <p className="text-sm text-neutral-300">Chưa có hoạt động nào.</p>
                <p className="text-xs text-neutral-500 mt-1">
                  Timeline sẽ cập nhật trong quá trình xử lý.
                </p>
              </div>
            ) : null}
          </CardContent>
        </ScrollArea>
      )}
    </Card>
  );
}
