import React from "react";
import type { Message } from "@langchain/langgraph-sdk";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Loader2, Copy, CopyCheck, Download } from "lucide-react";
import { InputForm } from "@/components/InputForm";
import { Button } from "@/components/ui/button";
import { useState, ReactNode } from "react";
import ReactMarkdown from "react-markdown";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import {
  ActivityTimeline,
  ProcessedEvent,
} from "@/components/ActivityTimeline"; // Assuming ActivityTimeline is in the same dir or adjust path
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { okaidia } from "react-syntax-highlighter/dist/esm/styles/prism";

// Markdown component props type from former ReportView
type MdComponentProps = {
  className?: string;
  children?: ReactNode;
  inline?: boolean;
  [key: string]: any;
};

// Markdown components (from former ReportView.tsx)
const mdComponents = {
  h1: ({ className, children, ...props }: MdComponentProps) => (
    <h1 className={cn("text-2xl font-bold mt-4 mb-2", className)} {...props}>
      {children}
    </h1>
  ),
  h2: ({ className, children, ...props }: MdComponentProps) => (
    <h2 className={cn("text-xl font-bold mt-3 mb-2", className)} {...props}>
      {children}
    </h2>
  ),
  h3: ({ className, children, ...props }: MdComponentProps) => (
    <h3 className={cn("text-lg font-bold mt-3 mb-1", className)} {...props}>
      {children}
    </h3>
  ),
  p: ({ className, children, ...props }: MdComponentProps) => (
    <p className={cn("mb-3 leading-7", className)} {...props}>
      {children}
    </p>
  ),
  a: ({ className, children, href, ...props }: MdComponentProps) => (
    <Badge className="text-xs mx-0.5">
      <a
        className={cn("text-blue-400 hover:text-blue-300 text-xs", className)}
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        {...props}
      >
        {children}
      </a>
    </Badge>
  ),
  ul: ({ className, children, ...props }: MdComponentProps) => (
    <ul className={cn("list-disc pl-6 mb-3", className)} {...props}>
      {children}
    </ul>
  ),
  ol: ({ className, children, ...props }: MdComponentProps) => (
    <ol className={cn("list-decimal pl-6 mb-3", className)} {...props}>
      {children}
    </ol>
  ),
  li: ({ className, children, ...props }: MdComponentProps) => (
    <li className={cn("mb-1", className)} {...props}>
      {children}
    </li>
  ),
  blockquote: ({ className, children, ...props }: MdComponentProps) => (
    <blockquote
      className={cn(
        "border-l-4 border-neutral-600 pl-4 italic my-3 text-sm",
        className
      )}
      {...props}
    >
      {children}
    </blockquote>
  ),
  code: ({ className, children, inline = false, ...props }: MdComponentProps) => {
    const match = /language-(\w+)/.exec(className || "");
    if (!inline && match) {
      return (
        <SyntaxHighlighter
          style={okaidia}
          language={match[1]}
          PreTag="div"
          wrapLongLines
          customStyle={{ borderRadius: 8, padding: 12, overflowX: "auto" }}
        >
          {String(children).replace(/\n$/, "")}
        </SyntaxHighlighter>
      );
    }
    return (
      <code
        className={cn(
          "bg-neutral-900 rounded px-1 py-0.5 font-mono text-xs",
          className
        )}
        {...props}
      >
        {children}
      </code>
    );
  },
  pre: ({ className, children, ...props }: MdComponentProps) => (
    <div className={cn("my-3 overflow-x-auto custom-scroll", className)} {...props}>
      {children}
    </div>
  ),
  hr: ({ className, ...props }: MdComponentProps) => (
    <hr className={cn("border-neutral-600 my-4", className)} {...props} />
  ),
  table: ({ className, children, ...props }: MdComponentProps) => (
    <div className="my-3 overflow-x-auto">
      <table className={cn("border-collapse w-full", className)} {...props}>
        {children}
      </table>
    </div>
  ),
  th: ({ className, children, ...props }: MdComponentProps) => (
    <th
      className={cn(
        "border border-neutral-600 px-3 py-2 text-left font-bold",
        className
      )}
      {...props}
    >
      {children}
    </th>
  ),
  td: ({ className, children, ...props }: MdComponentProps) => (
    <td
      className={cn("border border-neutral-600 px-3 py-2", className)}
      {...props}
    >
      {children}
    </td>
  ),
  // Add a safe image renderer to prevent empty src errors
  img: ({ className, children, src, alt = "image", ...props }: MdComponentProps) => {
    const s = typeof src === "string" ? src.trim() : "";
    if (!s) {
      // Render a harmless placeholder text when src is empty
      return (
        <span className={cn("text-xs text-neutral-400", className)} {...props}>
          {alt || "Image"}
        </span>
      );
    }
    return (
      <img
        src={s}
        alt={alt}
        className={cn("max-h-[420px] w-auto rounded-md border border-neutral-700", className)}
        loading="lazy"
        decoding="async"
        {...props}
      />
    );
  },
};

// Props for HumanMessageBubble
interface HumanMessageBubbleProps {
  message: Message;
  mdComponents: typeof mdComponents;
}

// HumanMessageBubble Component
function HumanMessageBubble({
  message,
  mdComponents,
}: HumanMessageBubbleProps) {
  return (
    <div className="text-white rounded-3xl break-words min-h-7 bg-neutral-700 max-w-[100%] sm:max-w-[90%] px-4 pt-3 rounded-br-lg">
      <ReactMarkdown components={mdComponents}>
        {typeof message.content === "string"
          ? message.content
          : JSON.stringify(message.content)}
      </ReactMarkdown>
    </div>
  );
}

// Props for AiMessageBubble
interface AiMessageBubbleProps {
  message: Message;
  historicalActivity: ProcessedEvent[] | undefined;
  liveActivity: ProcessedEvent[] | undefined;
  isLastMessage: boolean;
  isOverallLoading: boolean;
  mdComponents: typeof mdComponents;
  handleCopy: (text: string, messageId: string) => void;
  copiedMessageId: string | null;
}

// AiMessageBubble Component
function AiMessageBubble({
  message,
  historicalActivity,
  liveActivity,
  isLastMessage,
  isOverallLoading,
  mdComponents,
  handleCopy,
  copiedMessageId,
}: AiMessageBubbleProps) {
  // Determine which activity events to show and if it's for a live loading message
  const activityForThisBubble =
    isLastMessage && isOverallLoading ? liveActivity : historicalActivity;
  const isLiveActivityForThisBubble = isLastMessage && isOverallLoading;

  // Gating: hide early English streaming to avoid flicker; show only when Vietnamese diacritics appear
  // or when the stream has matured (length threshold / markdown structure) or loading completes.
  const rawContentStr =
    typeof message.content === "string"
      ? message.content
      : JSON.stringify(message.content);
  const contentStr = rawContentStr || "";
  const hasVi = /[àáảãạăắằẳẵặâấầẩẫậèéẻẽẹêếềểễệìíỉĩịòóỏõọôốồổỗộơớờởỡợùúủũụưứừửữựỳýỷỹỵđÀÁẢÃẠĂẮẰẲẴẶÂẤẦẨẪẬÈÉẺẼẸÊẾỀỂỄỆÌÍỈĨỊÒÓỎÕỌÔỐỒỔỖỘƠỚỜỞỠỢÙÚỦŨỤƯỨỪỬỮỰỲÝỶỸỴĐ]/.test(
    contentStr
  );
  const lenOk = contentStr.trim().length >= 80; // wait for enough tokens to reduce flicker
  const hasStructure = /(\n-\s|\n\*\s|```|^#{1,6}\s|\n\d+\.\s)/m.test(contentStr);
  const hideLiveEarly = isLastMessage && isOverallLoading && !(hasVi || lenOk || hasStructure);
  const hasText = contentStr && contentStr.length > 0;

  return (
    <div className={`relative break-words flex flex-col`}>
      {activityForThisBubble && activityForThisBubble.length > 0 && (
        <div className="mb-3 border-b border-neutral-700 pb-3 text-xs">
          <ActivityTimeline
            processedEvents={activityForThisBubble}
            isLoading={isLiveActivityForThisBubble}
          />
        </div>
      )}
      {hideLiveEarly ? (
        <div className="flex items-center gap-2 text-neutral-400 text-sm">
          <Loader2 className="h-4 w-4 animate-spin" />
          <span>Đang tạo phản hồi...</span>
        </div>
      ) : (
        <ReactMarkdown components={mdComponents}>{contentStr}</ReactMarkdown>
      )}
      <Button
        variant="default"
        className={`cursor-pointer bg-neutral-700 border-neutral-600 text-neutral-300 self-end ${
          hasText && !hideLiveEarly ? "visible" : "hidden"
        }`}
        onClick={() => handleCopy(contentStr, message.id!)}
      >
        {copiedMessageId === message.id ? "Copied" : "Copy"}
        {copiedMessageId === message.id ? <CopyCheck /> : <Copy />}
      </Button>
    </div>
  );
}


interface ChatMessagesViewProps {
  messages: Message[];
  isLoading: boolean;
  scrollAreaRef: React.RefObject<HTMLDivElement | null>;
  onSubmit: (inputValue: string, effort: string) => void;
  onCancel: () => void;
  liveActivityEvents: ProcessedEvent[];
  historicalActivities: Record<string, ProcessedEvent[]>;
  onImageStart?: (imageData: { id: string; prompt: string; aspectRatio: string; isEdit: boolean; originalFile?: File }) => void;
  onImageGenerated?: (imageData: { id: string; dataUrl: string; prompt: string; aspectRatio: string; isEdit: boolean; originalFile?: File }) => void;
  // NEW: controlled input mode from parent
  inputMode: "chat" | "image";
  onModeChange: (mode: "chat" | "image") => void;
}

export function ChatMessagesView({
  messages,
  isLoading,
  scrollAreaRef,
  onSubmit,
  onCancel,
  liveActivityEvents,
  historicalActivities,
  onImageStart,
  onImageGenerated,
  inputMode,
  onModeChange,
}: ChatMessagesViewProps) {
  const [copiedMessageId, setCopiedMessageId] = useState<string | null>(null);
  // REMOVED: local inputMode state; now controlled by parent
  // const [inputMode, setInputMode] = useState<"chat" | "image">("chat");

  const handleCopy = async (text: string, messageId: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedMessageId(messageId);
      setTimeout(() => setCopiedMessageId(null), 2000); // Reset after 2 seconds
    } catch (err) {
      console.error("Failed to copy text: ", err);
    }
  };
  return (
    <div className="flex flex-col h-full">
      <ScrollArea className="flex-1 overflow-y-auto custom-scroll" ref={scrollAreaRef}>
        <div className="p-4 md:p-6 space-y-2 max-w-4xl mx-auto pt-16">
          {messages.map((message, index) => {
            const isLast = index === messages.length - 1;
            let bubble: ReactNode;
            if (message.type === "human") {
              bubble = (
                <HumanMessageBubble message={message} mdComponents={mdComponents} />
              );
            } else if (message.id?.startsWith("ai-img-pending-")) {
              bubble = (
                <div className="relative group max-w-[85%] md:max-w-[80%] rounded-xl p-3 shadow-sm break-words bg-neutral-800 text-neutral-100 rounded-bl-none w-full min-h-[56px]">
                  <div className="flex items-center gap-2 text-neutral-300 text-sm">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span>Đang tạo ảnh...</span>
                  </div>
                </div>
              );
            } else if (message.id?.startsWith("ai-img-")) {
              const raw = typeof message.content === "string" ? message.content : JSON.stringify(message.content);
              const imgMatch = raw.match(/!\[[^\]]*\]\((.*?)\)/);
              const imgUrl = imgMatch?.[1]?.trim() || "";
              const metaText = imgUrl ? raw.replace(imgMatch![0], "").trim() : raw;
              // Extract prompt for suggestions but do not show raw meta
              const promptMatch = metaText.match(/\*\*Prompt:\*\*\s*(.*)/i);
              const promptForSuggest = promptMatch?.[1]?.trim() || "";
              const suggestions = [
                "Bạn muốn đổi phong cách cho ảnh này không (điện ảnh, hoạt hình, tối giản)?",
                "Có cần thay đổi tỉ lệ khung hình (16:9, 9:16, 4:3)?",
                "Bạn muốn thêm/bớt chi tiết nào (ánh sáng, nền, phụ kiện)?",
              ];
              bubble = (
                <div className="relative group max-w-[85%] md:max-w-[80%] break-words w-full">
                  {imgUrl ? (
                    <img
                      src={imgUrl}
                      alt="Generated"
                      className="max-h-[420px] w-auto rounded-md border border-neutral-700"
                      loading="lazy"
                      decoding="async"
                    />
                  ) : (
                    <div className="text-neutral-400 text-xs">Không có ảnh để hiển thị</div>
                  )}
                  {/* Suggestions + Download (no gray bubble background) */}
                  <div className="mt-2 text-xs text-neutral-300">
                    <div className="flex items-center justify-between mb-1">
                      <span>Gợi ý chỉnh sửa</span>
                      {imgUrl && (
                        <a
                          href={imgUrl}
                          download={`locaith-image-${Date.now()}.png`}
                          className="text-white text-xs no-underline hover:no-underline cursor-pointer"
                        >
                          Tải về
                        </a>
                      )}
                    </div>
                    <ul className="list-disc pl-5">
                      {suggestions.map((s, i) => (
                        <li key={i}>{s}</li>
                      ))}
                    </ul>
                  </div>
                </div>
              );
            } else {
              bubble = (
                <AiMessageBubble
                  message={message}
                  historicalActivity={historicalActivities[message.id!]}
                  liveActivity={liveActivityEvents}
                  isLastMessage={isLast}
                  isOverallLoading={isLoading}
                  mdComponents={mdComponents}
                  handleCopy={handleCopy}
                  copiedMessageId={copiedMessageId}
                />
              );
            }

            return (
              <div key={message.id || `msg-${index}`} className="space-y-3">
                <div className={`flex items-start gap-3 ${message.type === "human" ? "justify-end" : ""}`}>
                  {bubble}
                </div>
              </div>
            );
          })}
          {isLoading &&
            (messages.length === 0 ||
              messages[messages.length - 1].type === "human") && (
              <div className="flex items-start gap-3 mt-3">
                <div className="relative group max-w-[85%] md:max-w-[80%] rounded-xl p-3 shadow-sm break-words bg-neutral-800 text-neutral-100 rounded-bl-none w-full min-h-[56px]">
                  {liveActivityEvents.length > 0 ? (
                    <div className="text-xs">
                      <ActivityTimeline
                        processedEvents={liveActivityEvents}
                        isLoading={true}
                      />
                    </div>
                  ) : (
                    <div className="flex items-center justify-start h-full">
                      <Loader2 className="h-5 w-5 animate-spin text-neutral-400 mr-2" />
                      <span>Processing...</span>
                    </div>
                  )}
                </div>
              </div>
            )}
        </div>
      </ScrollArea>
      <InputForm
        onSubmit={onSubmit}
        isLoading={isLoading}
        onCancel={onCancel}
        hasHistory={messages.length > 0}
        mode={inputMode}
        onModeChange={onModeChange}
        onImageStart={onImageStart}
        onImageGenerated={onImageGenerated}
      />
    </div>
  );
}
