import { useStream } from "@langchain/langgraph-sdk/react";
import type { Message } from "@langchain/langgraph-sdk";
import { useState, useEffect, useRef, useCallback } from "react";
import { ProcessedEvent } from "@/components/ActivityTimeline";
import { WelcomeScreen } from "@/components/WelcomeScreen";
import { ChatMessagesView } from "@/components/ChatMessagesView";
import { Button } from "@/components/ui/button";
import { SearchResultsPanel } from "@/components/SearchResultsPanel";
import { OrchestratorIndicator } from "@/components/OrchestratorIndicator";
import { RightPanel } from "@/components/RightPanel";
import Layout from "@/components/Layout";

export default function App() {
  const [processedEventsTimeline, setProcessedEventsTimeline] = useState<
    ProcessedEvent[]
  >([]);
  const [historicalActivities, setHistoricalActivities] = useState<
    Record<string, ProcessedEvent[]>
  >({});
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const hasFinalizeEventOccurredRef = useRef(false);
  const [error, setError] = useState<string | null>(null);
  const thread = useStream<{
    messages: Message[];
    initial_search_query_count: number;
    max_research_loops: number;
    reasoning_model: string;
  }>({
    apiUrl: import.meta.env.DEV
      ? "/api"
      : "http://localhost:8123",
    assistantId: "agent",
    messagesKey: "messages",
    onUpdateEvent: (event: any) => {
      let processedEvent: ProcessedEvent | null = null;
      if (event.generate_query) {
        processedEvent = {
          title: "Generating Search Queries",
          data: event.generate_query?.search_query?.join(", ") || "",
          queries: event.generate_query?.search_query || [],
        };
      } else if (event.web_research) {
        const sources = event.web_research.sources_gathered || [];
        const numSources = sources.length;
        const uniqueLabels = [
          ...new Set(sources.map((s: any) => s.label).filter(Boolean)),
        ];
        const exampleLabels = uniqueLabels.slice(0, 3).join(", ");
        processedEvent = {
          title: "Web Research",
          data: `Gathered ${numSources} sources. Related to: ${
            exampleLabels || "N/A"
          }.`,
          sources: sources,
        };
      } else if (event.reflection) {
        processedEvent = {
          title: "Reflection",
          data: "Analysing Web Research Results",
        };
      } else if (event.planner) {
        processedEvent = {
          title: "Planner",
          data: event.planner?.plan || {},
          details: { plan: event.planner?.plan || {} },
        };
      } else if (event.actor) {
        processedEvent = {
          title: "Actor",
          data: event.actor?.artifacts || [],
          details: { artifacts: event.actor?.artifacts || [] },
        };
      } else if (event.self_check) {
        processedEvent = {
          title: "Self-Check",
          data: event.self_check?.feedback || "",
        };
      } else if (event.finalize_answer) {
        processedEvent = {
          title: "Finalizing Answer",
          data: "Composing and presenting the final answer.",
        };
        hasFinalizeEventOccurredRef.current = true;
      } else if (event.llm) {
        processedEvent = {
          title: "LLM",
          data: event.llm?.model || "gemini-2.5-flash",
        };
      }
      if (processedEvent) {
        setProcessedEventsTimeline((prevEvents) => [
          ...prevEvents,
          processedEvent!,
        ]);
      }
    },
    onError: (error: any) => {
      setError(error.message);
    },
  });

  useEffect(() => {
    if (scrollAreaRef.current) {
      const scrollViewport = scrollAreaRef.current.querySelector(
        "[data-radix-scroll-area-viewport]"
      );
      if (scrollViewport) {
        (scrollViewport as HTMLElement).scrollTop = (scrollViewport as HTMLElement).scrollHeight;
      }
    }
  }, [thread.messages]);

  useEffect(() => {
    if (
      hasFinalizeEventOccurredRef.current &&
      !thread.isLoading &&
      thread.messages.length > 0
    ) {
      const lastMessage = thread.messages[thread.messages.length - 1];
      if (lastMessage && lastMessage.type === "ai" && lastMessage.id) {
        setHistoricalActivities((prev) => ({
          ...prev,
          [lastMessage.id!]: [...processedEventsTimeline],
        }));
      }
      hasFinalizeEventOccurredRef.current = false;
    }
  }, [thread.messages, thread.isLoading, processedEventsTimeline]);

  const handleSubmit = useCallback(
    (submittedInputValue: string, effort: string) => {
      if (!submittedInputValue.trim()) return;
      setProcessedEventsTimeline([]);
      hasFinalizeEventOccurredRef.current = false;

      // convert effort to initial_search_query_count and max_research_loops
      // Optimized for performance:
      // Low: 1 initial query, 1 loop max
      // Medium: 2 initial queries, 1 loop max (faster response)
      // High: 3 initial queries, 3 loops max (detailed answers)
      let initial_search_query_count = 0;
      let max_research_loops = 0;
      switch (effort) {
        case "low":
          initial_search_query_count = 1;
          max_research_loops = 1;
          break;
        case "medium":
          initial_search_query_count = 2;
          max_research_loops = 1;
          break;
        case "high":
          initial_search_query_count = 3;
          max_research_loops = 3;
          break;
      }

      const newMessages: Message[] = [
        ...(thread.messages || []),
        {
          type: "human",
          content: submittedInputValue,
          id: Date.now().toString(),
        },
      ];
      thread.submit({
        messages: newMessages,
        initial_search_query_count: initial_search_query_count,
        max_research_loops: max_research_loops,
        reasoning_model: "gemini-2.0-flash-exp", // Auto-select optimal model
      });
    },
    [thread]
  );

  const handleCancel = useCallback(() => {
    thread.stop();
    window.location.reload();
  }, [thread]);

  const baseUrl = import.meta.env.BASE_URL || "/";

  // Chỉ mở panel phải khi thật sự có research.
  // Dựa trên stream đã xử lý: nếu xuất hiện "Generating Search Queries" hoặc "Web Research" thì usedSearch = true.
  const usedSearch = processedEventsTimeline.some((e) => {
    const t = e.title.toLowerCase();
    return t.includes("generating search queries") || t.includes("web research");
  });

  return (
    <Layout
      right={
        usedSearch ? (
          <RightPanel
            processedEvents={processedEventsTimeline}
            isLoading={thread.isLoading}
          />
        ) : null
      }
    >
      {thread.messages.length === 0 ? (
        <div className="h-full w-full pt-4 px-4">
          <WelcomeScreen
            handleSubmit={handleSubmit}
            isLoading={thread.isLoading}
            onCancel={handleCancel}
          />
        </div>
      ) : error ? (
        <div className="flex flex-col items-center justify-center h-full">
          <div className="flex flex-col items-center justify-center gap-4">
            <h1 className="text-2xl text-red-400 font-bold">Error</h1>
            <p className="text-red-400">{JSON.stringify(error)}</p>

            <Button
              variant="destructive"
              onClick={() => window.location.reload()}
            >
              Retry
            </Button>
          </div>
        </div>
      ) : (
        <div className="h-full w-full pt-4 px-4">
          <ChatMessagesView
            messages={thread.messages}
            isLoading={thread.isLoading}
            scrollAreaRef={scrollAreaRef}
            onSubmit={handleSubmit}
            onCancel={handleCancel}
            liveActivityEvents={processedEventsTimeline}
            historicalActivities={historicalActivities}
          />
        </div>
      )}
    </Layout>
  );
}
