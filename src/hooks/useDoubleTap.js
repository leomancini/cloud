import { useRef, useCallback } from "react";

export function useDoubleTap(onDoubleTap, delay = 300) {
  const lastTap = useRef(0);
  const timer = useRef(null);

  const handleTap = useCallback((e) => {
    const now = Date.now();
    if (now - lastTap.current < delay) {
      clearTimeout(timer.current);
      lastTap.current = 0;
      onDoubleTap(e);
    } else {
      lastTap.current = now;
      timer.current = setTimeout(() => { lastTap.current = 0; }, delay);
    }
  }, [onDoubleTap, delay]);

  return { onTouchEnd: handleTap, onClick: handleTap };
}

const SCROLL_THRESHOLD = 10;
const TAP_WINDOW = 300;

export function useReactionDoubleTap(onReact) {
  const touchStartY = useRef(null);
  const lastTapTime = useRef(0);
  const wasPinch = useRef(false);

  const handleTouchStart = useCallback((e) => {
    if (e.touches.length > 1) { wasPinch.current = true; return; }
    touchStartY.current = e.touches[0].clientY;
    wasPinch.current = false;
  }, []);

  const handleTouchMove = useCallback((e) => {
    if (e.touches.length >= 2) { wasPinch.current = true; return; }
    if (touchStartY.current === null) return;
    if (Math.abs(e.touches[0].clientY - touchStartY.current) > SCROLL_THRESHOLD) {
      touchStartY.current = null;
    }
  }, []);

  const handleTouchEnd = useCallback((e) => {
    if (wasPinch.current) { wasPinch.current = false; touchStartY.current = null; return; }
    if (touchStartY.current === null) return;
    touchStartY.current = null;

    const now = Date.now();
    if (lastTapTime.current && now - lastTapTime.current < TAP_WINDOW) {
      lastTapTime.current = 0;
      e.preventDefault();
      e.stopPropagation();
      onReact(e);
    } else {
      lastTapTime.current = now;
    }
  }, [onReact]);

  const handleDoubleClick = useCallback((e) => {
    if (!("ontouchstart" in window)) onReact(e);
  }, [onReact]);

  return {
    onTouchStart: handleTouchStart,
    onTouchMove: handleTouchMove,
    onTouchEnd: handleTouchEnd,
    onDoubleClick: handleDoubleClick,
  };
}
