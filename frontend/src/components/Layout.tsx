import React, { useState, useEffect } from "react";

interface LayoutProps {
  children: React.ReactNode;
  right: React.ReactNode;
  width?: number; // width of aside in px
}

export default function Layout({ children, right, width = 420 }: LayoutProps) {
  const hasRight = Boolean(right);
  const [showRight, setShowRight] = useState(hasRight);

  useEffect(() => {
    // Đồng bộ trạng thái hiển thị panel phải theo sự hiện diện của nội dung 'right'
    setShowRight(Boolean(right));
  }, [right]);

  return (
    <div className="h-screen w-screen overflow-hidden bg-neutral-900 text-neutral-100">
      {hasRight && (
        <button
          onClick={() => setShowRight((v) => !v)}
          className="fixed right-3 top-3 z-50 rounded-full bg-neutral-800/80 px-3 py-2 text-sm hover:bg-neutral-700"
          aria-label="Toggle insights panel"
        >
          {showRight ? "Ẩn" : "Hiện"}
        </button>
      )}

      {/* MAIN: chừa padding phải đúng bằng width aside khi panel mở */}
      <main
        className="h-full overflow-hidden"
        style={{ paddingRight: hasRight && showRight ? width : 0 }}
      >
        {children}
      </main>

      {/* RIGHT: aside cố định, dính mép phải */}
      {hasRight && showRight && (
        <aside
          className="fixed right-0 top-0 z-40 h-screen border-l border-neutral-800 bg-neutral-950/60 backdrop-blur-sm"
          style={{ width }}
        >
          <div className="h-full overflow-y-auto p-4 custom-scroll">{right}</div>
        </aside>
      )}
    </div>
  );
}