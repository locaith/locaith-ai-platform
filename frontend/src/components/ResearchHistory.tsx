import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ProcessedEvent } from "@/components/ActivityTimeline";
import { History, RotateCcw, Trash2, Search, Clock } from "lucide-react";

interface ResearchHistoryProps {
  persistentResearch: Record<string, ProcessedEvent[]>;
  onRestoreResearch: (sessionId: string, events: ProcessedEvent[]) => void;
  onDeleteResearch: (sessionId: string) => void;
  currentSessionId: string;
}

export const ResearchHistory: React.FC<ResearchHistoryProps> = ({
  persistentResearch,
  onRestoreResearch,
  onDeleteResearch,
  currentSessionId,
}) => {
  const [isExpanded, setIsExpanded] = useState(false);

  const formatSessionTime = (sessionId: string) => {
    try {
      const timestamp = sessionId.split('_')[1];
      if (timestamp) {
        const date = new Date(parseInt(timestamp));
        return date.toLocaleString('vi-VN', {
          day: '2-digit',
          month: '2-digit',
          year: 'numeric',
          hour: '2-digit',
          minute: '2-digit'
        });
      }
    } catch (error) {
      console.warn('Failed to parse session timestamp:', error);
    }
    return 'Không xác định';
  };

  const getResearchSummary = (events: ProcessedEvent[]) => {
    const searchEvents = events.filter(e => 
      e.title.toLowerCase().includes('search') || 
      e.title.toLowerCase().includes('actor')
    );
    
    if (searchEvents.length === 0) return 'Không có kết quả tìm kiếm';
    
    const topics = searchEvents
      .map(e => e.details?.query || e.data?.query || '')
      .filter(Boolean)
      .slice(0, 2);
    
    return topics.length > 0 ? topics.join(', ') : `${searchEvents.length} kết quả tìm kiếm`;
  };

  const researchSessions = Object.entries(persistentResearch)
    .filter(([sessionId]) => sessionId !== currentSessionId)
    .sort(([a], [b]) => {
      const timeA = a.split('_')[1] || '0';
      const timeB = b.split('_')[1] || '0';
      return parseInt(timeB) - parseInt(timeA);
    });

  if (researchSessions.length === 0) {
    return (
      <Card className="bg-neutral-800 border-neutral-700">
        <CardHeader>
          <CardTitle className="text-neutral-100 text-sm flex items-center gap-2">
            <History className="h-4 w-4" /> Lịch sử Research
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-xs text-neutral-400">Chưa có research nào được lưu.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="bg-neutral-800 border-neutral-700">
      <CardHeader>
        <CardTitle className="text-neutral-100 text-sm flex items-center gap-2 justify-between">
          <div className="flex items-center gap-2">
            <History className="h-4 w-4" /> Lịch sử Research
            <Badge variant="secondary" className="text-xs">
              {researchSessions.length}
            </Badge>
          </div>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => setIsExpanded(!isExpanded)}
            className="text-xs h-6 px-2"
          >
            {isExpanded ? 'Thu gọn' : 'Xem tất cả'}
          </Button>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <ScrollArea className={isExpanded ? "h-64" : "h-32"}>
          <div className="space-y-2">
            {researchSessions.slice(0, isExpanded ? undefined : 3).map(([sessionId, events]) => (
              <div
                key={sessionId}
                className="p-3 bg-neutral-700 rounded-lg border border-neutral-600"
              >
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <Clock className="h-3 w-3 text-neutral-400" />
                      <span className="text-xs text-neutral-300">
                        {formatSessionTime(sessionId)}
                      </span>
                    </div>
                    <p className="text-xs text-neutral-400 truncate">
                      {getResearchSummary(events)}
                    </p>
                  </div>
                  <div className="flex gap-1">
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => onRestoreResearch(sessionId, events)}
                      className="h-6 w-6 p-0 text-green-400 hover:text-green-300"
                      title="Khôi phục research này"
                    >
                      <RotateCcw className="h-3 w-3" />
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => onDeleteResearch(sessionId)}
                      className="h-6 w-6 p-0 text-red-400 hover:text-red-300"
                      title="Xóa research này"
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Search className="h-3 w-3 text-neutral-500" />
                  <Badge variant="outline" className="text-xs">
                    {events.length} sự kiện
                  </Badge>
                </div>
              </div>
            ))}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
};