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
  const [rightPanelKey, setRightPanelKey] = useState(0); // Key để force reset RightPanel
  // NEW: global input mode to keep Image Mode persistent across views
  const [globalInputMode, setGlobalInputMode] = useState<"chat" | "image">("chat");
  const [hasEverHadMessages, setHasEverHadMessages] = useState(false);
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

  // Retry/backoff state for stream stability
  const lastPayloadRef = useRef<any>(null);
  const retryAttemptRef = useRef(0);
  const retryTimerRef = useRef<number | undefined>(undefined);
  const MAX_RETRIES = 3;

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
          sources: Array.isArray(event.sources_gathered) ? event.sources_gathered : [],
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
        msg.includes("Failed to fetch") ||
        msg.includes("net::ERR_ABORTED") ||
        msg.includes("The operation was aborted");
      
      const isNetworkError = 
        msg.includes("NetworkError") ||
        msg.includes("fetch") ||
        msg.includes("ECONNREFUSED") ||
        msg.includes("ENOTFOUND") ||
        msg.includes("timeout") ||
        msg.includes("502") ||
        msg.includes("503") ||
        msg.includes("504");
        
      if (isAbort) {
        console.info("Stream aborted/restarted (ignored):", msg);
        return; // don't surface aborts
      }
      
      if (isNetworkError) {
        console.warn("Network error, will retry with backoff:", msg);
        // schedule exponential backoff retry
        if (retryTimerRef.current) {
          clearTimeout(retryTimerRef.current);
          retryTimerRef.current = undefined;
        }
        const attempt = retryAttemptRef.current;
        if (attempt < MAX_RETRIES) {
          const delay = Math.min(8000, 500 * Math.pow(2, attempt));
          console.info(`[stream] retrying in ${delay}ms (attempt ${attempt + 1}/${MAX_RETRIES})`);
          retryTimerRef.current = window.setTimeout(() => {
            try { thread.stop(); } catch {}
            if (lastPayloadRef.current) {
              try { thread.submit(lastPayloadRef.current); } catch (e) {
                console.warn("Immediate resubmit failed", e);
              }
            }
            retryAttemptRef.current = attempt + 1;
          }, delay);
        }
        return;
      }
      
      // Only show critical errors
      console.error("Stream error:", error);
      setError(msg);
    },
  });

  // Clear any pending retry timer on unmount
  useEffect(() => {
    return () => {
      if (retryTimerRef.current) {
        clearTimeout(retryTimerRef.current);
        retryTimerRef.current = undefined;
      }
    };
  }, []);

  useEffect(() => {
    if (scrollAreaRef.current) {
      const scrollViewport = (
        scrollAreaRef.current.querySelector('[data-slot="scroll-area-viewport"]') ||
        scrollAreaRef.current.querySelector('[data-radix-scroll-area-viewport]')
      ) as HTMLElement | null;
      if (scrollViewport) {
        requestAnimationFrame(() => {
          scrollViewport.scrollTop = scrollViewport.scrollHeight;
        });
      }
    }
  }, [thread.messages, imageMessages]);

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
      
      // Reset tất cả state liên quan để tránh nhấp nháy và trùng lặp
      setProcessedEventsTimeline([]);
      setError(null);
      setRightPanelKey(prev => prev + 1); // Force reset RightPanel
      hasFinalizeEventOccurredRef.current = false;
      setHasEverHadMessages(true);
      
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

      // Reset hoàn toàn chat history để tránh trộn lẫn với tin nhắn cũ
      const newMessages: Message[] = [
        {
          type: "human",
          content: submittedInputValue,
          id: Date.now().toString(),
        },
      ];
      
      // Dừng stream hiện tại và submit ngay lập tức (không cần delay)
      try {
        thread.stop();
      } catch (e) {
        console.info("No active stream to stop");
      }
      
      // Build payload and reset retry state
      const payload = {
        messages: newMessages,
        initial_search_query_count: initial_search_query_count,
        max_research_loops: max_research_loops,
        reasoning_model: "gemini-2.5-pro", // Sử dụng model chính xác cho reasoning
      };
      lastPayloadRef.current = payload;
      retryAttemptRef.current = 0;
      if (retryTimerRef.current) {
        clearTimeout(retryTimerRef.current);
        retryTimerRef.current = undefined;
      }
      
      // Submit ngay lập tức để tránh race condition
      thread.submit(payload);
    },
    [thread]
  );

  const handleCancel = useCallback(() => {
    try { thread.stop(); } catch {}
    // Không reload trang để tránh flicker; chỉ hủy stream hiện tại
    setError(null);
    if (retryTimerRef.current) {
      clearTimeout(retryTimerRef.current);
      retryTimerRef.current = undefined;
    }
  }, [thread]);

  const handleNewChat = useCallback(() => {
    // Reset hoàn toàn tất cả state
    thread.stop();
    setProcessedEventsTimeline([]);
    setError(null);
    setRightPanelKey(prev => prev + 1); // Force reset RightPanel
    setImageMessages([]);
    setHasEverHadMessages(false);
    hasFinalizeEventOccurredRef.current = false;
    
    // Reset word preview
    setWordPreviewActive(false);
    setWordDocument(null);
    setWordError(null);
    setWordIsGenerating(false);
    
    // Clear retry state
    lastPayloadRef.current = null;
    retryAttemptRef.current = 0;
    if (retryTimerRef.current) {
      clearTimeout(retryTimerRef.current);
      retryTimerRef.current = undefined;
    }
    
    // Clear thread messages
    thread.clear();
    
    console.log('Chat reset completely');
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
    
    // Merge chat messages with image messages, maintaining chronological order
    const allMessages = [...compressMessages(processedMsgs), ...imageMessages];
    
    // Sort by creation order - maintain the natural order from the thread
    // Only sort image messages relative to their position, don't reorder chat messages
    allMessages.sort((a, b) => {
      // If both are from the main thread, maintain their original order
      const aIsFromThread = !a.id?.startsWith('ai-img-');
      const bIsFromThread = !b.id?.startsWith('ai-img-');
      
      if (aIsFromThread && bIsFromThread) {
        // Maintain original order for thread messages
        const aIndex = processedMsgs.findIndex(m => m.id === a.id);
        const bIndex = processedMsgs.findIndex(m => m.id === b.id);
        return aIndex - bIndex;
      }
      
      // For image messages, sort by timestamp
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

  // Track if we've ever had messages to prevent flashing back to welcome screen
  useEffect(() => {
    if (stableMessages.length > 0) {
      setHasEverHadMessages(true);
    }
  }, [stableMessages.length]);

  // Get the most recent image URL from imageMessages for editing
  const getRecentImageUrl = useCallback(() => {
    // Find the most recent AI image message
    const aiImageMessages = imageMessages
      .filter(msg => msg.type === "ai" && msg.id?.startsWith("ai-img-") && msg.content)
      .sort((a, b) => {
        // Sort by timestamp (extracted from ID)
        const getTs = (id?: string) => {
          if (!id) return 0;
          const parts = id.split('-');
          const last = parts[parts.length - 1];
          const num = parseInt(last);
          return isNaN(num) ? 0 : num;
        };
        return getTs(b.id) - getTs(a.id); // Most recent first
      });

    if (aiImageMessages.length === 0) return null;

    const mostRecentMessage = aiImageMessages[0];
    const content = typeof mostRecentMessage.content === "string" 
      ? mostRecentMessage.content 
      : JSON.stringify(mostRecentMessage.content);

    // Extract image URL from markdown content
    const imageUrlMatch = content.match(/!\[.*?\]\((.*?)\)/);
    if (imageUrlMatch && imageUrlMatch[1]) {
      return imageUrlMatch[1];
    }

    return null;
  }, [imageMessages]);

  return (
    <Layout
      onNewChat={handleNewChat}
      right={
        (usedSearch || wordPreviewActive) ? (
          <RightPanel
            key={rightPanelKey}
            processedEvents={processedEventsTimeline}
            isLoading={thread.isLoading}
            wordPreviewActive={wordPreviewActive}
            wordDocument={wordDocument}
            wordIsGenerating={wordIsGenerating}
            wordError={wordError}
          />
        ) : null
     }
    >
      {stableMessages.length === 0 && !hasEverHadMessages ? (
        <div className="app-shell__welcome">
          <WelcomeScreen
            handleSubmit={handleSubmit}
            isLoading={thread.isLoading}
            onCancel={handleCancel}
            onImageStart={handleImageStart}
            onImageGenerated={handleImageGenerated}
            // pass global input mode to InputForm in Welcome view
            mode={globalInputMode}
            onModeChange={setGlobalInputMode}
            // pass recent image for editing
            recentPreview={getRecentImageUrl()}
          />
        </div>
      ) : error ? (
        <div className="app-shell__error">
          <div className="app-shell__error-card">
            <h1 className="text-2xl text-red-400 font-bold">Error</h1>
            <p className="text-red-400 text-sm md:text-base">
              {JSON.stringify(error)}
            </p>

            <Button
              variant="destructive"
              onClick={() => window.location.reload()}
            >
              Retry
            </Button>
          </div>
        </div>
      ) : (
        <div className="app-shell__conversation">
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
            // pass recent image for editing
            recentPreview={getRecentImageUrl()}
          />
        </div>
      )}
    </Layout>
  );
}
