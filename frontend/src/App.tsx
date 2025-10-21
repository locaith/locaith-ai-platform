import { useStream } from "@langchain/langgraph-sdk/react";
import type { Message } from "@langchain/langgraph-sdk";
import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { ProcessedEvent } from "@/components/ActivityTimeline";
import { WelcomeScreen } from "@/components/WelcomeScreen";
import { ChatMessagesView } from "@/components/ChatMessagesView";
import { Button } from "@/components/ui/button";

import { RightPanel } from "@/components/RightPanel";
import Layout from "@/components/Layout";
import { safeInvokeEdgeFunction } from "@/lib/supabaseClient";

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
  const [imageMessages, setImageMessages] = useState<Message[]>([]);
  // NEW: global input mode to keep Image Mode persistent across views
  const [globalInputMode, setGlobalInputMode] = useState<"chat" | "image">("chat");
  // Word preview state
  const [wordPreviewActive, setWordPreviewActive] = useState(false);
  const [wordDocument, setWordDocument] = useState<any | null>(null);
  const [wordIsGenerating, setWordIsGenerating] = useState(false);
  const [wordError, setWordError] = useState<string | null>(null);
  // Validate and create API URL
  const getApiUrl = () => {
    try {
      const url = import.meta.env.DEV ? "http://127.0.0.1:2024" : "http://localhost:8123";
      if (!url || typeof url !== "string" || url.trim() === "") {
        throw new Error("Invalid API URL configuration");
      }
      return url.trim();
    } catch (error) {
      console.error("API URL validation error:", error);
      return "http://127.0.0.1:2024"; // Fallback to dev server URL
    }
  };

  const thread = useStream<{
    messages: Message[];
    initial_search_query_count: number;
    max_research_loops: number;
    reasoning_model: string;
  }>({
    apiUrl: getApiUrl(),
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
      const msg = String(error?.message || error || "");
      const isAbort =
        error?.name === "AbortError" ||
        msg.includes("ERR_ABORTED") ||
        msg.includes("The user aborted a request") ||
        msg.includes("NetworkError when attempting to fetch resource") ||
        msg.includes("Failed to fetch");
      if (isAbort) {
        console.info("Stream aborted/restarted (ignored):", msg);
        return; // Đừng hiển thị lỗi abort ra UI
      }
      setError(msg);
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

  // Listen to Word tool open event to show preview
  useEffect(() => {
    function onWordOpen(evt: any) {
      const prompt = evt?.detail?.prompt || "";
      setWordError(null);
      setWordIsGenerating(true);
      // Show a temporary draft immediately
      setWordDocument({
        loaiVanBan: "Bản thảo",
        meta: { ngayLap: new Date().toLocaleDateString("vi-VN") },
        noiDung: {
          tieuDe: prompt ? `Bản thảo: ${prompt.slice(0, 60)}` : "Bản thảo",
          muc: [
            { heading: "Mục tiêu", paragraphs: [prompt || ""] },
            { heading: "Nội dung", paragraphs: ["Đang tạo nội dung..."] }
          ]
        }
      });
      setWordPreviewActive(true);

      // Try invoking Supabase Edge Function for real Word JSON
      (async () => {
        const { data, error } = await safeInvokeEdgeFunction("compose-word-json", { prompt });
        if (error) {
          console.warn("compose-word-json failed", error);
          setWordError(String(error?.message || error));
          setWordIsGenerating(false);
          return;
        }
        setWordDocument(data || null);
        setWordIsGenerating(false);
      })();
    }
    window.addEventListener("wordToolOpen", onWordOpen as EventListener);
    return () => {
      window.removeEventListener("wordToolOpen", onWordOpen as EventListener);
    };
  }, []);

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



  // Chỉ mở panel phải khi thật sự có research.
  // Dựa trên stream đã xử lý: nếu xuất hiện "Generating Search Queries" hoặc "Web Research" thì usedSearch = true.
  const usedSearch = processedEventsTimeline.some((e) => {
    const t = e.title.toLowerCase();
    return t.includes("generating search queries") || t.includes("web research");
  });

  // Gom và ẩn bubble AI khi đang stream để tránh nhấp nháy
  const compressMessages = useCallback((messages: Message[]): Message[] => {
    const out: Message[] = [];
    for (const m of messages) {
      const last = out[out.length - 1];
      if (last && last.type === "ai" && m.type === "ai") {
        const lastContent =
          typeof last.content === "string"
            ? last.content
            : JSON.stringify(last.content);
        const curContent =
          typeof m.content === "string"
            ? m.content
            : JSON.stringify(m.content);
        last.content = [lastContent, curContent].filter(Boolean).join("\n\n");
        last.id = m.id || last.id;
      } else {
        out.push({ ...m });
      }
    }
    return out;
  }, []);

  // Immediately show user + AI placeholder when image request starts
  const handleImageStart = useCallback((start: {
    id: string;
    prompt: string;
    aspectRatio: string;
    isEdit: boolean;
    originalFile?: File;
  }) => {
    const userMessage: Message = {
      id: `user-img-${start.id}`,
      type: "human",
      content: start.isEdit
        ? `Chỉnh sửa ảnh: ${start.prompt}`
        : `Tạo ảnh: ${start.prompt}`,
    };

    const aiPlaceholder: Message = {
      id: `ai-img-pending-${start.id}`,
      type: "ai",
      content: `Tôi sẽ tạo ảnh giúp bạn...

• Prompt: ${start.prompt}
• Tỷ lệ khung: ${start.aspectRatio}

Đang tạo ảnh...`,
    };

    setImageMessages(prev => [...prev, userMessage, aiPlaceholder]);
    // Ensure the input stays in image mode after starting an image task
    setGlobalInputMode("image");
  }, []);

  // Replace placeholder with final image when ready
  const handleImageGenerated = useCallback((imageData: {
    id: string;
    dataUrl: string;
    prompt: string;
    aspectRatio: string;
    isEdit: boolean;
    originalFile?: File;
  }) => {
    setImageMessages(prev => prev.map(m => {
      if (m.id === `ai-img-pending-${imageData.id}`) {
        const raw = (imageData.dataUrl || "").trim();
        if (!raw) {
          console.warn('[App] imageData.dataUrl is empty, replacing with text message');
          return {
            ...m,
            id: `ai-img-${imageData.id}`,
            content: `Không nhận được ảnh từ server.\n\n**Prompt:** ${imageData.prompt}  \n**Aspect Ratio:** ${imageData.aspectRatio}  \n**Type:** ${imageData.isEdit ? 'Image Edit' : 'Image Generation'}`,
          };
        }
        const finalUrl = raw.startsWith("data:") || raw.startsWith("http")
          ? raw
          : `data:image/png;base64,${raw}`;
        return {
          ...m,
          id: `ai-img-${imageData.id}`,
          content: `![Generated Image](${finalUrl})\n\n**Prompt:** ${imageData.prompt}  \n**Aspect Ratio:** ${imageData.aspectRatio}  \n**Type:** ${imageData.isEdit ? 'Image Edit' : 'Image Generation'}`,
        };
      }
      return m;
    }));
  }, []);

  const stableMessages = useMemo(() => {
    const msgs = thread.messages || [];
    let processedMsgs = msgs;
    
    if (
      thread.isLoading &&
      msgs.length > 0 &&
      msgs[msgs.length - 1]?.type === "ai"
    ) {
      processedMsgs = msgs.slice(0, -1); // ẩn bubble AI đang stream
    }
    
    // Merge chat messages with image messages, sorted by timestamp
    const allMessages = [...compressMessages(processedMsgs), ...imageMessages];
     allMessages.sort((a, b) => {
       const getTs = (id?: string) => {
         if (!id) return 0;
         const parts = id.split('-');
         const last = parts[parts.length - 1];
         const num = parseInt(last);
         return isNaN(num) ? 0 : num;
       };
       return getTs(a.id) - getTs(b.id);
     });
     
     return allMessages;
   }, [thread.messages, thread.isLoading, compressMessages, imageMessages]);

  return (
    <Layout
      right={
-        usedSearch ? (
+        (usedSearch || wordPreviewActive) ? (
           <RightPanel
             processedEvents={processedEventsTimeline}
             isLoading={thread.isLoading}
+            wordPreviewActive={wordPreviewActive}
+            wordDocument={wordDocument}
+            wordIsGenerating={wordIsGenerating}
+            wordError={wordError}
           />
         ) : null
      }
    >
      {stableMessages.length === 0 ? (
         <div className="h-full w-full pt-4 px-4">
           <WelcomeScreen
             handleSubmit={handleSubmit}
             isLoading={thread.isLoading}
             onCancel={handleCancel}
             onImageStart={handleImageStart}
             onImageGenerated={handleImageGenerated}
             // pass global input mode to InputForm in Welcome view
             mode={globalInputMode}
             onModeChange={setGlobalInputMode}
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
            messages={stableMessages}
            isLoading={thread.isLoading}
            scrollAreaRef={scrollAreaRef}
            onSubmit={handleSubmit}
            onCancel={handleCancel}
            liveActivityEvents={processedEventsTimeline}
            historicalActivities={historicalActivities}
            onImageStart={handleImageStart}
            onImageGenerated={handleImageGenerated}
            // controlled input mode props
            inputMode={globalInputMode}
            onModeChange={setGlobalInputMode}
          />
        </div>
      )}
    </Layout>
  );
}
