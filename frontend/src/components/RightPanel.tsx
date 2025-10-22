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

// Shimmer effect for the "Thinking" title
const ThinkingTitleShimmer: React.FC = () => (
  <div className="flex items-center space-x-2">
    <span className="text-sm font-medium text-neutral-200">Thinking</span>
    <div className="flex space-x-1">
      <div className="w-1 h-1 bg-blue-400 rounded-full animate-pulse"></div>
      <div className="w-1 h-1 bg-blue-400 rounded-full animate-pulse" style={{animationDelay: '0.2s'}}></div>
      <div className="w-1 h-1 bg-blue-400 rounded-full animate-pulse" style={{animationDelay: '0.4s'}}></div>
    </div>
  </div>
);

// Extract sources from processed events
function extractSources(processedEvents: ProcessedEvent[]): Array<{url: string, title: string}> {
  const sources: Array<{url: string, title: string}> = [];
  
  processedEvents.forEach(event => {
    // Check for sources in event.sources (primary location)
    if (event.sources && Array.isArray(event.sources)) {
      event.sources.forEach((source: any) => {
        if (source.url && source.title) {
          sources.push({
            url: source.url,
            title: source.title
          });
        } else if (source.link && source.label) {
          // Alternative naming convention
          sources.push({
            url: source.link,
            title: source.label
          });
        }
      });
    }
    
    // Check for sources in event.details.sources
    if (event.details && event.details.sources && Array.isArray(event.details.sources)) {
      event.details.sources.forEach((source: any) => {
        if (source.url && source.title) {
          sources.push({
            url: source.url,
            title: source.title
          });
        }
      });
    }
    
    // Check for sources in event.data (various structures)
    if (event.data && typeof event.data === 'object') {
      // Check if data has sources property
      if (event.data.sources && Array.isArray(event.data.sources)) {
        event.data.sources.forEach((source: any) => {
          if (source.url && source.title) {
            sources.push({
              url: source.url,
              title: source.title
            });
          }
        });
      }
      
      // Check if data has results property with sources
      if (event.data.results && Array.isArray(event.data.results)) {
        event.data.results.forEach((result: any) => {
          if (result.url && result.title) {
            sources.push({
              url: result.url,
              title: result.title
            });
          }
        });
      }
      
      // Check if data has sources_gathered (from web_research events)
      if (event.data.sources_gathered && Array.isArray(event.data.sources_gathered)) {
        event.data.sources_gathered.forEach((source: any) => {
          if (source.url && source.title) {
            sources.push({
              url: source.url,
              title: source.title
            });
          } else if (source.link && source.label) {
            sources.push({
              url: source.link,
              title: source.label
            });
          }
        });
      }
    }
    
    // Special handling for Web Research events
    if (event.title.toLowerCase().includes('web research') || event.title.toLowerCase().includes('research')) {
      // Check if the event itself contains sources in various formats
      const eventSources = event.sources || event.details?.sources || [];
      eventSources.forEach((source: any) => {
        if (source.url && (source.title || source.label)) {
          sources.push({
            url: source.url,
            title: source.title || source.label
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

// Get detailed thinking content from actual events
function getDetailedThinkingContent(processedEvents: ProcessedEvent[], isLoading: boolean): JSX.Element[] {
  const content: JSX.Element[] = [];
  
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
              {event.queries.map((query, idx) => (
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
  wordPreviewActive, 
  wordDocument, 
  wordError, 
  wordIsGenerating 
}) => {
  const sources = extractSources(processedEvents);
  const thinkingContent = getDetailedThinkingContent(processedEvents, isLoading);
  
  return (
    <div className="p-4 space-y-6">
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

      {/* Sources Section - Changed to "Nguồn" */}
      <div>
        <h3 className="text-sm font-medium text-neutral-200 mb-3">Nguồn</h3>
        <div className="space-y-2">
          {sources.length > 0 ? (
            sources.map((source, index) => {
              // Extract domain name from URL for better display
              const getDomainName = (url: string) => {
                try {
                  const domain = new URL(url).hostname.replace('www.', '');
                  // Convert domain to readable name
                  if (domain.includes('thoibaotaichinhvietnam')) return 'Thời báo tài chính Việt Nam';
                  if (domain.includes('vnexpress')) return 'VnExpress';
                  if (domain.includes('tuoitre')) return 'Tuổi Trẻ';
                  if (domain.includes('thanhnien')) return 'Thanh Niên';
                  if (domain.includes('dantri')) return 'Dân Trí';
                  if (domain.includes('vietnamnet')) return 'VietnamNet';
                  if (domain.includes('baomoi')) return 'Báo Mới';
                  if (domain.includes('cafef')) return 'CafeF';
                  if (domain.includes('google')) return 'Google';
                  if (domain.includes('github')) return 'GitHub';
                  if (domain.includes('stackoverflow')) return 'Stack Overflow';
                  // Default: capitalize first letter of domain
                  return domain.split('.')[0].charAt(0).toUpperCase() + domain.split('.')[0].slice(1);
                } catch {
                  return 'Website';
                }
              };

              return (
                <div key={index} className="flex items-start space-x-2">
                  <div className="w-1 h-1 bg-neutral-400 rounded-full mt-2 flex-shrink-0"></div>
                  <div className="text-xs">
                    <span className="text-neutral-300">{getDomainName(source.url)}: </span>
                    <a
                      href={source.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-neutral-400 hover:text-white hover:underline transition-colors duration-200 break-words"
                      title={source.title}
                    >
                      {source.url}
                    </a>
                  </div>
                </div>
              );
            })
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