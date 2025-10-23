import { SearchResultsPanel } from "@/components/SearchResultsPanel";
import { ProcessedEvent } from "@/components/ActivityTimeline";
import React from "react";

import { WordPreviewPanel } from "@/components/WordPreviewPanel";
import { ResearchHistory } from "@/components/ResearchHistory";

interface RightPanelProps {
  processedEvents: ProcessedEvent[];
  isLoading: boolean;
  // Word preview (optional)
  wordPreviewActive?: boolean;
  wordDocument?: any;
  wordError?: string | null;
  wordIsGenerating?: boolean;
  // Research history (optional)
  persistentResearch?: Record<string, ProcessedEvent[]>;
  currentSessionId?: string;
  onRestoreResearch?: (sessionId: string, events: ProcessedEvent[]) => void;
  onDeleteResearch?: (sessionId: string) => void;
}

















// Get detailed thinking content from actual events
function getDetailedThinkingContent(processedEvents: ProcessedEvent[], isLoading: boolean): React.ReactElement[] {
  const content: React.ReactElement[] = [];
  
  processedEvents.forEach((event, index) => {
    if (event.title.toLowerCase().includes('generating')) {
      content.push(
        <div key={`generating-${index}`} className="mb-4">
          <div className="text-blue-400 font-medium mb-2">Đang tạo câu hỏi tìm kiếm</div>
          <div className="text-neutral-300 text-sm leading-relaxed">
            Tôi đang phân tích câu hỏi của bạn và tạo ra các câu hỏi tìm kiếm phù hợp để thu thập thông tin cần thiết.
          </div>
          {event.queries && Array.isArray(event.queries) && (
            <div className="mt-2 space-y-1">
              <div className="text-neutral-400 text-xs">Các câu hỏi được tạo:</div>
              {event.queries.map((query: string, idx: number) => (
                <div key={idx} className="text-neutral-200 text-xs pl-2 border-l-2 border-blue-400/30">
                  "{query}"
                </div>
              ))}
            </div>
          )}
        </div>
      );
    }
    
    if (event.title.toLowerCase().includes('research')) {
      const sources = event.sources || [];
      content.push(
        <div key={`research-${index}`} className="mb-4">
          <div className="text-green-400 font-medium mb-2">Đang tìm kiếm thông tin</div>
          <div className="text-neutral-300 text-sm leading-relaxed">
            Tôi đang tìm kiếm các thông tin liên quan từ nhiều nguồn khác nhau trên internet để đảm bảo câu trả lời chính xác và đầy đủ.
          </div>
          {sources.length > 0 && (
            <div className="mt-2 space-y-1">
              <div className="text-neutral-400 text-xs">Đã tìm thấy {sources.length} nguồn thông tin:</div>
              {sources.slice(0, 3).map((source: any, idx: number) => (
                <div key={idx} className="text-neutral-200 text-xs pl-2 border-l-2 border-green-400/30">
                  {source.title || source.label || `Nguồn ${idx + 1}`}
                </div>
              ))}
              {sources.length > 3 && (
                <div className="text-neutral-400 text-xs pl-2">
                  và {sources.length - 3} nguồn khác...
                </div>
              )}
            </div>
          )}
        </div>
      );
    }
    
    if (event.title.toLowerCase().includes('reflection')) {
      content.push(
        <div key={`reflection-${index}`} className="mb-4">
          <div className="text-purple-400 font-medium mb-2">Đang phân tích kết quả</div>
          <div className="text-neutral-300 text-sm leading-relaxed">
            Tôi đang phân tích và đánh giá chất lượng thông tin đã thu thập được, loại bỏ những thông tin không chính xác và tổng hợp những điểm quan trọng nhất.
          </div>
        </div>
      );
    }
    
    if (event.title.toLowerCase().includes('planner')) {
      content.push(
        <div key={`planner-${index}`} className="mb-4">
          <div className="text-yellow-400 font-medium mb-2">Đang lập kế hoạch nghiên cứu</div>
          <div className="text-neutral-300 text-sm leading-relaxed">
            Tôi đang phân tích câu hỏi của bạn và xây dựng kế hoạch nghiên cứu chi tiết để đảm bảo thu thập được thông tin đầy đủ và chính xác nhất.
          </div>
          {event.details?.plan && (
            <div className="mt-2 text-neutral-200 text-xs pl-2 border-l-2 border-yellow-400/30">
              Kế hoạch: {typeof event.details.plan === 'string' ? event.details.plan : JSON.stringify(event.details.plan)}
            </div>
          )}
        </div>
      );
    }
    
    if (event.title.toLowerCase().includes('actor')) {
      content.push(
        <div key={`actor-${index}`} className="mb-4">
          <div className="text-orange-400 font-medium mb-2">Đang phân tích và tổng hợp</div>
          <div className="text-neutral-300 text-sm leading-relaxed">
            Tôi đang phân tích sâu các thông tin đã thu thập, kết hợp với kiến thức có sẵn để tạo ra câu trả lời toàn diện và chính xác cho câu hỏi của bạn.
          </div>
          {event.details?.artifacts && Array.isArray(event.details.artifacts) && event.details.artifacts.length > 0 && (
            <div className="mt-2 text-neutral-200 text-xs pl-2 border-l-2 border-orange-400/30">
              Đang xử lý {event.details.artifacts.length} thành phần dữ liệu
            </div>
          )}
        </div>
      );
    }
    
    if (event.title.toLowerCase().includes('self-check')) {
      content.push(
        <div key={`selfcheck-${index}`} className="mb-4">
          <div className="text-cyan-400 font-medium mb-2">Đang kiểm tra chất lượng</div>
          <div className="text-neutral-300 text-sm leading-relaxed">
            Tôi đang kiểm tra lại câu trả lời để đảm bảo tính chính xác, đầy đủ và phù hợp với câu hỏi của bạn.
          </div>
          {event.data && (
            <div className="mt-2 text-neutral-200 text-xs pl-2 border-l-2 border-cyan-400/30">
              {event.data}
            </div>
          )}
        </div>
      );
    }
    
    if (event.title.toLowerCase().includes('finalizing')) {
      content.push(
        <div key={`finalizing-${index}`} className="mb-4">
          <div className="text-emerald-400 font-medium mb-2">Đang hoàn thiện câu trả lời</div>
          <div className="text-neutral-300 text-sm leading-relaxed">
            Tôi đang hoàn thiện và trình bày câu trả lời một cách rõ ràng, dễ hiểu và đầy đủ thông tin cho bạn.
          </div>
        </div>
      );
    }
  });
  
  if (isLoading && content.length === 0) {
    content.push(
      <div key="initializing" className="mb-4">
        <div className="text-blue-400 font-medium mb-2">Đang khởi tạo</div>
        <div className="text-neutral-300 text-sm leading-relaxed">
          Tôi đang chuẩn bị để xử lý câu hỏi của bạn...
        </div>
      </div>
    );
  }
  
  return content;
}

export const RightPanel: React.FC<RightPanelProps> = ({
  processedEvents,
  isLoading,
  wordPreviewActive = false,
  wordDocument,
  wordError,
  wordIsGenerating = false,
  persistentResearch = {},
  currentSessionId = "",
  onRestoreResearch,
  onDeleteResearch,
}) => {
  const thinkingContent = getDetailedThinkingContent(processedEvents, isLoading);
  
  return (
    <div className="p-4 space-y-6">
      {/* Word Preview Panel */}
      {wordPreviewActive && (
        <WordPreviewPanel 
          documentJson={wordDocument}
          isGenerating={wordIsGenerating}
          error={wordError || undefined}
        />
      )}

      {/* Thinking Section with Detailed Content */}
      <div>
        {isLoading ? (
          <div className="mb-3">
            <div className="inline-block">
              <span className="text-sm font-medium text-neutral-200">
                {"Thinking".split("").map((ch, idx) => (
                  <span
                    key={idx}
                    className="char-shimmer"
                    style={{ animationDelay: `${idx * 0.08}s` }}
                  >
                    {ch}
                  </span>
                ))}
              </span>
            </div>
          </div>
        ) : (
          <h3 className="text-sm font-medium text-neutral-200 mb-3">Thinking</h3>
        )}
        <div className="text-xs space-y-3">
          {thinkingContent.length > 0 ? (
            thinkingContent
          ) : (
            <div className="text-neutral-400">
              {isLoading ? "Đang chuẩn bị..." : "Chưa có hoạt động suy nghĩ"}
            </div>
          )}
        </div>
      </div>

      {/* Search Results Panel */}
      <SearchResultsPanel 
        processedEvents={processedEvents} 
        isLoading={isLoading} 
      />

      {/* Research History Panel */}
      {onRestoreResearch && onDeleteResearch && (
        <ResearchHistory
          persistentResearch={persistentResearch}
          currentSessionId={currentSessionId}
          onRestoreResearch={onRestoreResearch}
          onDeleteResearch={onDeleteResearch}
        />
      )}
    </div>
  );
};