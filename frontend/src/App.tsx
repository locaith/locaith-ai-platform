import { useStream } from "@langchain/langgraph-sdk/react";
import type { Message } from "@langchain/langgraph-sdk";
import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { ProcessedEvent } from "@/components/ActivityTimeline";
import { WelcomeScreen } from "@/components/WelcomeScreen";
import ChatMessagesView from "@/components/ChatMessagesView";
import { Button } from "@/components/ui/button";

import { RightPanel } from "@/components/RightPanel";
import Layout from "@/components/Layout";
import { safeInvokeEdgeFunction } from "@/lib/supabaseClient";
import { ResearchHistory } from "@/components/ResearchHistory";

export default function App() {
  const [processedEventsTimeline, setProcessedEventsTimeline] = useState<
    ProcessedEvent[]
  >([]);
  const [historicalActivities, setHistoricalActivities] = useState<
    Record<string, ProcessedEvent[]>
  >({});
  // NEW: Persistent research storage
  const [persistentResearch, setPersistentResearch] = useState<
    Record<string, ProcessedEvent[]>
  >({});
  const [currentSessionId, setCurrentSessionId] = useState<string>("");
  
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

  // Persistent research utilities
  const saveResearchToStorage = (sessionId: string, events: ProcessedEvent[]) => {
    try {
      const existingData = JSON.parse(localStorage.getItem('locaith-research') || '{}');
      existingData[sessionId] = events;
      localStorage.setItem('locaith-research', JSON.stringify(existingData));
      setPersistentResearch(existingData);
    } catch (error) {
      console.warn('Failed to save research to localStorage:', error);
    }
  };

  const loadResearchFromStorage = () => {
    try {
      const data = JSON.parse(localStorage.getItem('locaith-research') || '{}');
      setPersistentResearch(data);
      return data;
    } catch (error) {
      console.warn('Failed to load research from localStorage:', error);
      return {};
    }
  };

  const generateSessionId = () => {
    return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  };

  const restoreResearch = (sessionId: string, events: ProcessedEvent[]) => {
    // Save current research if exists
    if (processedEventsTimeline.length > 0 && currentSessionId) {
      saveResearchToStorage(currentSessionId, processedEventsTimeline);
    }
    
    // Restore the selected research
    setCurrentSessionId(sessionId);
    setProcessedEventsTimeline(events);
    setRightPanelKey((prev) => prev + 1); // Force refresh RightPanel
  };

  const deleteResearch = (sessionId: string) => {
    try {
      const existingData = JSON.parse(localStorage.getItem('locaith-research') || '{}');
      delete existingData[sessionId];
      localStorage.setItem('locaith-research', JSON.stringify(existingData));
      setPersistentResearch(existingData);
    } catch (error) {
      console.warn('Failed to delete research from localStorage:', error);
    }
  };

  // Retry/backoff state for stream stability
  const lastPayloadRef = useRef<any>(null);
  const retryAttemptRef = useRef(0);
  const retryTimerRef = useRef<number | undefined>(undefined);
  const MAX_RETRIES = 3;

  // Load persistent research on mount
  useEffect(() => {
    loadResearchFromStorage();
    if (!currentSessionId) {
      setCurrentSessionId(generateSessionId());
    }
  }, []);

  // Auto-save research when processedEventsTimeline changes
  useEffect(() => {
    if (processedEventsTimeline.length > 0 && currentSessionId) {
      saveResearchToStorage(currentSessionId, processedEventsTimeline);
    }
  }, [processedEventsTimeline, currentSessionId]);

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
        msg.includes("ConnectTimeout") ||
        msg.includes("WinError 10060") ||
        msg.includes("connection attempt failed") ||
        msg.includes("502") ||
        msg.includes("503") ||
        msg.includes("504");
        
      const isBackendError = 
        msg.includes("ConnectTimeout") ||
        msg.includes("Google Search API") ||
        msg.includes("Search failed") ||
        msg.includes("web_research");
        
      // Silently ignore abort errors - they're normal during streaming
      if (isAbort) {
        console.info("Stream connection reset (normal):", msg);
        return;
      }
      
      if (isBackendError) {
        console.warn("Backend service error:", msg);
        setError("Dịch vụ tìm kiếm tạm thời gặp sự cố. Vui lòng thử lại sau ít phút.");
        return;
      }
      
      // Simplified retry logic - only for genuine network issues
      if (isNetworkError) {
        console.warn("Network error detected:", msg);
        const attempt = retryAttemptRef.current;
        if (attempt < MAX_RETRIES) {
          // Clear any existing timer
          if (retryTimerRef.current) {
            clearTimeout(retryTimerRef.current);
            retryTimerRef.current = undefined;
          }
          
          // Simple retry with fixed delay
          const delay = 2000; // Fixed 2 second delay
          console.info(`Retrying connection in ${delay}ms (attempt ${attempt + 1}/${MAX_RETRIES})`);
          
          retryTimerRef.current = window.setTimeout(() => {
            if (lastPayloadRef.current) {
              retryAttemptRef.current = attempt + 1;
              thread.submit(lastPayloadRef.current);
            }
          }, delay);
        } else {
          setError("Kết nối không ổn định. Vui lòng kiểm tra mạng và thử lại.");
          retryAttemptRef.current = 0; // Reset for next attempt
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
      
      // Save current research before starting new one
      if (processedEventsTimeline.length > 0 && currentSessionId) {
        saveResearchToStorage(currentSessionId, processedEventsTimeline);
      }

      // Create new session for new research
      const newSessionId = generateSessionId();
      setCurrentSessionId(newSessionId);
      
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

      // Reset hoàn toàn state trước khi gửi tin nhắn mới
      setProcessedEventsTimeline([]);
      setError(null);
      setRightPanelKey(prev => prev + 1); // Force reset RightPanel
      hasFinalizeEventOccurredRef.current = false;
      
      // Reset word preview state
      setWordPreviewActive(false);
      setWordDocument(null);
      setWordError(null);
      setWordIsGenerating(false);
      
      // Tạo tin nhắn mới hoàn toàn
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

  const handleError = useCallback((errorMessage: string) => {
    // Add error message as AI response to chat
    const errorAiMessage: Message = {
      type: "ai",
      content: errorMessage,
      id: `error_${Date.now()}`,
    };
    
    // Add the error message to the thread
    if (thread.messages) {
      thread.messages.push(errorAiMessage);
    }
    
    // Trigger a re-render by updating hasEverHadMessages
    setHasEverHadMessages(true);
  }, [thread]);

  const handleNewChat = useCallback(() => {
    // Save current research before resetting
    if (processedEventsTimeline.length > 0 && currentSessionId) {
      saveResearchToStorage(currentSessionId, processedEventsTimeline);
    }

    // Reset hoàn toàn tất cả state
    thread.stop();
    
    // Create new session for new chat
    const newSessionId = generateSessionId();
    setCurrentSessionId(newSessionId);
    
    // Clear tất cả state liên quan đến chat
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
    
    // Clear thread messages hoàn toàn
    if (thread.messages) {
      thread.messages.length = 0;
    }
    
    // Force tạo thread ID mới để tránh cache cũ
    // Trigger một event để các components khác biết cần reset
    window.dispatchEvent(new CustomEvent('chatReset', { 
      detail: { timestamp: Date.now() } 
    }));
    
    console.log('Chat reset completely with new session');
  }, [thread, processedEventsTimeline, currentSessionId, saveResearchToStorage, generateSessionId]);



  // Chỉ mở panel phải khi thật sự có research.
  // Dựa trên stream đã xử lý: nếu xuất hiện "Generating Search Queries" hoặc "Web Research" thì usedSearch = true.
  const usedSearch = processedEventsTimeline.some((e) => {
    const t = e.title.toLowerCase();
    return t.includes("generating search queries") || t.includes("web research");
  });

  // Smooth message compression để tránh UI jumping
  const compressMessages = useCallback((messages: Message[]): Message[] => {
    const out: Message[] = [];
    for (const m of messages) {
      const last = out[out.length - 1];
      if (last && last.type === "ai" && m.type === "ai") {
        // Smooth content merging - chỉ thay thế thay vì join để tránh jumping
        const curContent =
          typeof m.content === "string"
            ? m.content
            : JSON.stringify(m.content);
        
        // Nếu content mới dài hơn, sử dụng content mới (streaming update)
        // Nếu content mới ngắn hơn, giữ content cũ (tránh flicker)
        if (curContent && curContent.length > 0) {
          const lastContent = typeof last.content === "string" ? last.content : "";
          if (curContent.length >= lastContent.length || !lastContent) {
            last.content = curContent;
          }
        }
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
    const timestamp = Date.now();
    
    console.log('[handleImageStart] Creating image messages:', {
      id: start.id,
      timestamp: timestamp,
      timestampDate: new Date(timestamp).toLocaleString(),
      isEdit: start.isEdit,
      prompt: start.prompt
    });
    
    const userMessage: Message = {
      id: `user-img-${start.id}`,
      type: "human",
      timestamp: timestamp,
      content: start.isEdit
        ? `Chỉnh sửa ảnh: ${start.prompt}`
        : `Tạo ảnh: ${start.prompt}`,
    };

    const aiPlaceholder: Message = {
      id: `ai-img-pending-${start.id}`,
      type: "ai",
      timestamp: timestamp + 1, // Slightly later than user message
      content: `Tôi sẽ tạo ảnh giúp bạn...

• Prompt: ${start.prompt}
• Tỷ lệ khung: ${start.aspectRatio}

Đang tạo ảnh...`,
    };

    console.log('[handleImageStart] Created messages with timestamps:', {
      userMessage: { id: userMessage.id, timestamp: userMessage.timestamp },
      aiPlaceholder: { id: aiPlaceholder.id, timestamp: aiPlaceholder.timestamp }
    });

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
    console.log('[handleImageGenerated] Processing image:', {
      id: imageData.id,
      isEdit: imageData.isEdit,
      prompt: imageData.prompt
    });
    
    setImageMessages(prev => prev.map(m => {
      if (m.id === `ai-img-pending-${imageData.id}`) {
        console.log('[handleImageGenerated] Found placeholder message:', {
          id: m.id,
          originalTimestamp: m.timestamp,
          timestampDate: m.timestamp ? new Date(m.timestamp).toLocaleString() : 'No timestamp'
        });
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
        
        const finalMessage = {
          ...m,
          id: `ai-img-${imageData.id}`,
          // Keep the original timestamp from placeholder, don't create new one
          content: `![Generated Image](${finalUrl})\n\n**Prompt:** ${imageData.prompt}  \n**Aspect Ratio:** ${imageData.aspectRatio}  \n**Type:** ${imageData.isEdit ? 'Image Edit' : 'Image Generation'}`,
        };
        
        console.log('[handleImageGenerated] Created final message:', {
          id: finalMessage.id,
          timestamp: finalMessage.timestamp,
          timestampDate: finalMessage.timestamp ? new Date(finalMessage.timestamp).toLocaleString() : 'No timestamp',
          isEdit: imageData.isEdit
        });
        
        return finalMessage;
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

  // Get the most recent image URL from all messages for editing
  const getRecentImageUrl = useCallback(() => {
    console.log('[getRecentImageUrl] === DEBUGGING IMAGE SEARCH ===');
    console.log('[getRecentImageUrl] imageMessages count:', imageMessages.length);
    console.log('[getRecentImageUrl] thread.messages count:', thread.messages?.length || 0);

    // Combine all messages from both sources
    const allMessages = [
      ...(thread.messages || []),
      ...imageMessages
    ];

    console.log('[getRecentImageUrl] Total combined messages:', allMessages.length);

    // Find all AI messages with images and their timestamps
    const imageMessagesWithTime: Array<{ msg: any; timestamp: number; url: string; source: string }> = [];

    allMessages.forEach((msg, index) => {
      if (msg.type === "ai" && msg.content) {
        const content = typeof msg.content === "string" ? msg.content : JSON.stringify(msg.content);
        const imageUrlMatch = content.match(/!\[.*?\]\((.*?)\)/);
        
        if (imageUrlMatch && imageUrlMatch[1]) {
          let timestamp = Date.now();
          let source = 'unknown';
          
          // Determine source
          if (imageMessages.includes(msg)) {
            source = 'imageMessages';
          } else if (thread.messages?.includes(msg)) {
            source = 'thread.messages';
          }
          
          // Try to extract timestamp from ID
          if (msg.id?.startsWith("ai-img-")) {
            const parts = msg.id.split('-');
            const last = parts[parts.length - 1];
            const num = parseInt(last);
            if (!isNaN(num)) {
              timestamp = num;
            }
          } else if (msg.timestamp) {
            timestamp = msg.timestamp;
          }
          
          console.log('[getRecentImageUrl] Found image message:', {
            messageId: msg.id,
            timestamp: timestamp,
            timestampDate: new Date(timestamp).toLocaleString(),
            url: imageUrlMatch[1].substring(0, 50) + '...',
            source: source,
            index: index
          });
          
          imageMessagesWithTime.push({
            msg,
            timestamp,
            url: imageUrlMatch[1],
            source
          });
        }
      }
    });

    console.log('[getRecentImageUrl] Found', imageMessagesWithTime.length, 'image messages total');

    // Sort by timestamp (most recent first)
    imageMessagesWithTime.sort((a, b) => b.timestamp - a.timestamp);

    console.log('[getRecentImageUrl] After sorting by timestamp:');
    imageMessagesWithTime.forEach((item, index) => {
      console.log(`  ${index + 1}. ID: ${item.msg.id}, Timestamp: ${item.timestamp} (${new Date(item.timestamp).toLocaleString()}), Source: ${item.source}`);
    });

    if (imageMessagesWithTime.length > 0) {
      const mostRecent = imageMessagesWithTime[0];
      console.log('[getRecentImageUrl] ✅ Selected most recent image:', {
        url: mostRecent.url.substring(0, 50) + '...',
        timestamp: mostRecent.timestamp,
        timestampDate: new Date(mostRecent.timestamp).toLocaleString(),
        messageId: mostRecent.msg.id,
        source: mostRecent.source
      });
      return mostRecent.url;
    }

    console.log('[getRecentImageUrl] No recent image found');
    return null;
  }, [imageMessages, thread.messages]);

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
            persistentResearch={persistentResearch}
            currentSessionId={currentSessionId}
            onRestoreResearch={restoreResearch}
            onDeleteResearch={deleteResearch}
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
            onError={handleError}
            // pass global input mode to InputForm in Welcome view
            mode={globalInputMode}
            onModeChange={setGlobalInputMode}
            // pass recent image for editing
            recentPreview={getRecentImageUrl()}
            lastImageUrl={getRecentImageUrl()}
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
            onError={handleError}
            // controlled input mode props
            inputMode={globalInputMode}
            onModeChange={setGlobalInputMode}
            // pass recent image for editing
            recentPreview={getRecentImageUrl()}
            lastImageUrl={getRecentImageUrl()}
          />
        </div>
      )}
    </Layout>
  );
}
