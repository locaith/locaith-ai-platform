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

  return (
    <div className="app-shell">
      <div className="app-shell__background" aria-hidden="true">
        <div className="app-shell__grid" />
        <div className="app-shell__orb app-shell__orb--violet" />
        <div className="app-shell__orb app-shell__orb--cyan" />
        <div className="app-shell__orb app-shell__orb--mint" />
        <div className="app-shell__pointer" />
      </div>

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
        style={{ paddingRight: hasRight && showRight ? width : 0 }}
      >
        {children}
      </main>

      {/* RIGHT: fixed glassmorphism panel on the right side */}
      {hasRight && showRight && (
        <aside className="app-shell__aside" style={{ width }}>
          <div className="app-shell__aside-inner custom-scroll">{right}</div>
        </aside>
      )}
    </div>
  );
}
