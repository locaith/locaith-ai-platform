import React, { useState, useEffect } from "react";
import { ChatHistory } from './ChatHistory';

interface LayoutProps {
  children: React.ReactNode;
  right: React.ReactNode;
  width?: number; // width of aside in px
  onNewChat?: () => void;
}

export default function Layout({ children, right, width = 420, onNewChat }: LayoutProps) {
  const hasRight = Boolean(right);
  const [showRight, setShowRight] = useState(hasRight);
  const [showChatHistory, setShowChatHistory] = useState(false);
  const [currentSessionId, setCurrentSessionId] = useState<string>('1');

  useEffect(() => {
    // keep the toggle state in sync with the presence of the right panel content
    setShowRight(Boolean(right));
  }, [right]);

  useEffect(() => {
    const root = document.documentElement;
    const pointerMedia = window.matchMedia("(pointer: fine)");
    const setCenter = () => {
      root.style.setProperty("--pointer-x", "50vw");
      root.style.setProperty("--pointer-y", "50vh");
    };
    const updatePointer = (event: PointerEvent) => {
      root.style.setProperty("--pointer-x", `${event.clientX}px`);
      root.style.setProperty("--pointer-y", `${event.clientY}px`);
    };

    setCenter();

    if (pointerMedia.matches) {
      window.addEventListener("pointermove", updatePointer);
    }

    return () => {
      window.removeEventListener("pointermove", updatePointer);
    };
  }, []);

  const handleSessionSelect = (sessionId: string) => {
    setCurrentSessionId(sessionId);
    // Trong thực tế, sẽ load lại cuộc trò chuyện từ sessionId
    console.log('Selected session:', sessionId);
  };

  const handleNewChat = () => {
    setCurrentSessionId('');
    // Gọi callback từ parent để reset hoàn toàn
    if (onNewChat) {
      onNewChat();
    }
    console.log('Starting new chat');
  };

  return (
    <div className="app-shell">
      <div className="app-shell__background" aria-hidden="true">
        <div className="app-shell__grid" />
        <div className="app-shell__orb app-shell__orb--violet" />
        <div className="app-shell__orb app-shell__orb--cyan" />
        <div className="app-shell__orb app-shell__orb--mint" />
        <div className="app-shell__pointer" />
      </div>

      {/* Chat History Sidebar */}
      <ChatHistory
        isOpen={showChatHistory}
        onToggle={() => setShowChatHistory(!showChatHistory)}
        currentSessionId={currentSessionId}
        onSessionSelect={handleSessionSelect}
        onNewChat={handleNewChat}
      />

      {hasRight && (
        <button
          onClick={() => setShowRight((v) => !v)}
          className="app-shell__toggle"
          aria-label="Toggle insights panel"
        >
          {showRight ? "Hide panel" : "Show panel"}
        </button>
      )}

      {/* MAIN: adjust right padding when insights panel is visible */}
      <main
        className="app-shell__main h-full overflow-hidden"
        style={{ 
          paddingRight: hasRight && showRight ? width : 0,
          paddingLeft: showChatHistory ? 320 : 0,
          paddingBottom: 40 // Space for footer
        }}
      >
        {children}
      </main>

      {/* RIGHT: fixed glassmorphism panel on the right side */}
      {hasRight && showRight && (
        <aside className="app-shell__aside" style={{ width }}>
          <div className="app-shell__aside-inner custom-scroll">{right}</div>
        </aside>
      )}

      {/* FOOTER: fixed at bottom */}
      <footer className="fixed bottom-0 left-0 right-0 z-10 bg-neutral-900/80 backdrop-blur-sm border-t border-neutral-700/50">
        <div className="text-center py-2">
          <p className="text-xs text-neutral-500">
            Powered by Locaith Solution Tech and Partner 2025.
          </p>
        </div>
      </footer>
    </div>
  );
}
