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
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState('');
  
  // Mock data - trong thực tế sẽ lấy từ API hoặc local storage
  const [chatSessions, setChatSessions] = useState<ChatSession[]>([
    {
      id: '1',
      title: 'Hỏi về Locaith AI',
      timestamp: new Date(Date.now() - 1000 * 60 * 30),
      preview: 'Chào bạn! Tôi là Locaith AI. Tôi có thể giúp gì cho bạn?'
    },
    {
      id: '2', 
      title: 'Tạo nội dung marketing',
      timestamp: new Date(Date.now() - 1000 * 60 * 60 * 2),
      preview: 'Hãy tạo cho tôi một bài viết marketing về sản phẩm AI...'
    },
    {
      id: '3',
      title: 'Soạn thảo văn bản',
      timestamp: new Date(Date.now() - 1000 * 60 * 60 * 24),
      preview: 'Tôi cần viết một email chuyên nghiệp...'
    },
    {
      id: '4',
      title: 'Phân tích dữ liệu bán hàng',
      timestamp: new Date(Date.now() - 1000 * 60 * 60 * 48),
      preview: 'Giúp tôi phân tích dữ liệu bán hàng tháng này...'
    },
    {
      id: '5',
      title: 'Viết báo cáo dự án',
      timestamp: new Date(Date.now() - 1000 * 60 * 60 * 72),
      preview: 'Tôi cần viết báo cáo tiến độ dự án...'
    },
    {
      id: '6',
      title: 'Tối ưu SEO website',
      timestamp: new Date(Date.now() - 1000 * 60 * 60 * 96),
      preview: 'Làm thế nào để tối ưu SEO cho website...'
    },
    {
      id: '7',
      title: 'Chiến lược social media',
      timestamp: new Date(Date.now() - 1000 * 60 * 60 * 120),
      preview: 'Xây dựng chiến lược social media hiệu quả...'
    },
    {
      id: '8',
      title: 'Phân tích đối thủ cạnh tranh',
      timestamp: new Date(Date.now() - 1000 * 60 * 60 * 144),
      preview: 'Phân tích đối thủ cạnh tranh trong ngành...'
    },
    {
      id: '9',
      title: 'Kế hoạch kinh doanh 2025',
      timestamp: new Date(Date.now() - 1000 * 60 * 60 * 168),
      preview: 'Lập kế hoạch kinh doanh cho năm 2025...'
    },
    {
      id: '10',
      title: 'Tư vấn đầu tư startup',
      timestamp: new Date(Date.now() - 1000 * 60 * 60 * 192),
      preview: 'Tư vấn về đầu tư vào startup công nghệ...'
    }
  ]);



  const handleRename = (sessionId: string, currentTitle: string) => {
    setEditingId(sessionId);
    setEditTitle(currentTitle);
  };

  const saveRename = (sessionId: string) => {
    if (editTitle.trim()) {
      setChatSessions(sessions => 
        sessions.map(session => 
          session.id === sessionId 
            ? { ...session, title: editTitle.trim() }
            : session
        )
      );
    }
    setEditingId(null);
    setEditTitle('');
  };

  const cancelRename = () => {
    setEditingId(null);
    setEditTitle('');
  };

  const handleDelete = (sessionId: string) => {
    if (confirm('Bạn có chắc chắn muốn xóa cuộc trò chuyện này?')) {
      setChatSessions(sessions => sessions.filter(session => session.id !== sessionId));
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
            className="w-full bg-gradient-to-br from-cyan-400 to-teal-500 hover:from-cyan-500 hover:to-teal-600 text-slate-900 font-semibold border-none shadow-lg hover:shadow-cyan-500/25 active:scale-95 transition-all duration-200"
          >
            Cuộc trò chuyện mới
          </Button>
        </div>

        {/* Chat Sessions */}
        <div className="flex-1 overflow-y-auto px-4 pb-4">
          <div className="space-y-1">
            {chatSessions.map((session) => (
              <div
                key={session.id}
                className={`w-full px-3 py-2 rounded-lg transition-colors group ${
                  currentSessionId === session.id
                    ? 'bg-white/10 border border-white/20'
                    : 'bg-neutral-800/50 hover:bg-neutral-700/50 border border-transparent'
                }`}
              >
                {editingId === session.id ? (
                  <div className="space-y-2">
                    <input
                      type="text"
                      value={editTitle}
                      onChange={(e) => setEditTitle(e.target.value)}
                      className="w-full bg-neutral-700 text-white text-sm px-2 py-1 rounded border border-neutral-600 focus:border-white focus:outline-none"
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') saveRename(session.id);
                        if (e.key === 'Escape') cancelRename();
                      }}
                      autoFocus
                    />
                    <div className="flex gap-2">
                      <button
                        onClick={() => saveRename(session.id)}
                        className="text-xs px-2 py-1 bg-white text-black rounded hover:bg-gray-100"
                      >
                        Lưu
                      </button>
                      <button
                        onClick={cancelRename}
                        className="text-xs px-2 py-1 bg-neutral-600 text-white rounded hover:bg-neutral-500"
                      >
                        Hủy
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center justify-between group">
                    <div 
                      className="cursor-pointer flex-1 min-w-0 py-1"
                      onClick={() => onSessionSelect(session.id)}
                    >
                      <div className="text-sm font-medium text-neutral-200 truncate">
                        {session.title}
                      </div>
                    </div>
                    <div className="flex gap-1 ml-2 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleRename(session.id, session.title);
                        }}
                        className="text-xs p-1 text-neutral-400 hover:text-white hover:bg-neutral-600 rounded"
                        title="Đổi tên"
                      >
                        ✏️
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDelete(session.id);
                        }}
                        className="text-xs p-1 text-neutral-400 hover:text-white hover:bg-red-600 rounded"
                        title="Xóa"
                      >
                        🗑️
                      </button>
                    </div>
                  </div>
                )}
              </div>
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
                  darkMode ? 'bg-white' : 'bg-neutral-600'
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full transition-transform ${
                    darkMode ? 'bg-black translate-x-6' : 'bg-white translate-x-1'
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