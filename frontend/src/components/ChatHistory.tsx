import React, { useState } from 'react';
import { Button } from './ui/button';

interface ChatSession {
  id: string;
  title: string;
  timestamp: Date;
  preview: string;
}

interface ChatHistoryProps {
  isOpen: boolean;
  onToggle: () => void;
  currentSessionId?: string;
  onSessionSelect: (sessionId: string) => void;
  onNewChat: () => void;
}

export const ChatHistory: React.FC<ChatHistoryProps> = ({
  isOpen,
  onToggle,
  currentSessionId,
  onSessionSelect,
  onNewChat
}) => {
  const [darkMode, setDarkMode] = useState(false);
  
  // Mock data - trong thực tế sẽ lấy từ API hoặc local storage
  const [chatSessions] = useState<ChatSession[]>([
    {
      id: '1',
      title: 'Hỏi về Locaith AI',
      timestamp: new Date(Date.now() - 1000 * 60 * 30), // 30 phút trước
      preview: 'Chào bạn! Tôi là Locaith AI. Tôi có thể giúp gì cho bạn?'
    },
    {
      id: '2', 
      title: 'Tạo nội dung marketing',
      timestamp: new Date(Date.now() - 1000 * 60 * 60 * 2), // 2 giờ trước
      preview: 'Hãy tạo cho tôi một bài viết marketing về sản phẩm AI...'
    },
    {
      id: '3',
      title: 'Soạn thảo văn bản',
      timestamp: new Date(Date.now() - 1000 * 60 * 60 * 24), // 1 ngày trước
      preview: 'Tôi cần viết một email chuyên nghiệp...'
    }
  ]);

  const formatTime = (date: Date) => {
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffMins < 60) {
      return `${diffMins} phút trước`;
    } else if (diffHours < 24) {
      return `${diffHours} giờ trước`;
    } else {
      return `${diffDays} ngày trước`;
    }
  };

  if (!isOpen) {
    return (
      <button
        onClick={onToggle}
        className="fixed left-4 top-4 z-50 p-2 bg-neutral-800/80 backdrop-blur-sm border border-neutral-700/50 rounded-lg text-neutral-200 hover:bg-neutral-700/80 transition-colors"
        title="Mở lịch sử chat"
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M3 12L21 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
          <path d="M3 6L21 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
          <path d="M3 18L21 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
        </svg>
      </button>
    );
  }

  return (
    <>
      {/* Overlay */}
      <div 
        className="fixed inset-0 bg-black/20 backdrop-blur-sm z-40 lg:hidden"
        onClick={onToggle}
      />
      
      {/* Sidebar */}
      <div className="fixed left-0 top-0 h-full w-80 bg-neutral-900/95 backdrop-blur-sm border-r border-neutral-700/50 z-50 flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-neutral-700/50">
          <h2 className="text-lg font-semibold text-neutral-200">Lịch sử chat</h2>
          <button
            onClick={onToggle}
            className="p-1 text-neutral-400 hover:text-neutral-200 transition-colors"
            title="Đóng"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M18 6L6 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
              <path d="M6 6L18 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
            </svg>
          </button>
        </div>

        {/* New Chat Button */}
        <div className="p-4">
          <Button
            onClick={onNewChat}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white border-0"
          >
            Cuộc trò chuyện mới
          </Button>
        </div>

        {/* Chat Sessions */}
        <div className="flex-1 overflow-y-auto px-4 pb-4">
          <div className="space-y-2">
            {chatSessions.map((session) => (
              <button
                key={session.id}
                onClick={() => onSessionSelect(session.id)}
                className={`w-full text-left p-3 rounded-lg transition-colors ${
                  currentSessionId === session.id
                    ? 'bg-blue-600/20 border border-blue-500/30'
                    : 'bg-neutral-800/50 hover:bg-neutral-700/50 border border-transparent'
                }`}
              >
                <div className="text-sm font-medium text-neutral-200 truncate mb-1">
                  {session.title}
                </div>
                <div className="text-xs text-neutral-400 truncate mb-1">
                  {session.preview}
                </div>
                <div className="text-xs text-neutral-500">
                  {formatTime(session.timestamp)}
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Settings */}
        <div className="border-t border-neutral-700/50 p-4">
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm text-neutral-300">Chế độ tối</span>
              <button
                onClick={() => setDarkMode(!darkMode)}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                  darkMode ? 'bg-blue-600' : 'bg-neutral-600'
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    darkMode ? 'translate-x-6' : 'translate-x-1'
                  }`}
                />
              </button>
            </div>
            
            <button className="w-full text-left text-sm text-neutral-400 hover:text-neutral-200 transition-colors">
              Cài đặt khác
            </button>
          </div>
        </div>
      </div>
    </>
  );
};