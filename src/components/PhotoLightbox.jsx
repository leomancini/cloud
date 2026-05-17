import React, { useState, useRef, useCallback, useEffect } from "react";
import { LightboxBackdrop, LightboxClose, LightboxImg } from "../styles/lightbox.js";

export function PhotoLightbox({ src, onClose }) {
  const [closing, setClosing] = useState(false);
  const touchStartY = useRef(null);
  const touchStartX = useRef(null);

  const dismiss = useCallback(() => {
    setClosing(true);
    setTimeout(onClose, 220);
  }, [onClose]);

  useEffect(() => {
    const handleKey = (e) => { if (e.key === "Escape") dismiss(); };
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [dismiss]);

  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, []);

  const handleTouchStart = (e) => {
    touchStartY.current = e.touches[0].clientY;
    touchStartX.current = e.touches[0].clientX;
  };

  const handleTouchEnd = (e) => {
    if (touchStartY.current === null) return;
    const deltaY = e.changedTouches[0].clientY - touchStartY.current;
    const deltaX = Math.abs(e.changedTouches[0].clientX - touchStartX.current);
    if (deltaY > 60 && deltaX < deltaY) dismiss();
    touchStartY.current = null;
    touchStartX.current = null;
  };

  return (
    <LightboxBackdrop
      $closing={closing}
      onClick={dismiss}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
      <LightboxClose onClick={(e) => { e.stopPropagation(); dismiss(); }} aria-label="Close">
        <i className="fa-solid fa-xmark" />
      </LightboxClose>
      <LightboxImg
        $closing={closing}
        src={src}
        onClick={(e) => e.stopPropagation()}
        draggable={false}
      />
    </LightboxBackdrop>
  );
}
