import { useState, useEffect, createContext } from "react";
import { createGlobalStyle } from "styled-components";

export const RADIUS = "20px";
export const RADIUS_SM = "14px";
export const ICON_GAP = "8px";

export const lightTheme = {
  bg:               "#ffffff",
  bgSecondary:      "#fafafa",
  bgElevated:       "#ffffff",
  bgHover:          "#f5f5f5",
  bgInput:          "transparent",
  bgControl:        "#f0f0f0",
  bgSegmentActive:  "#ffffff",
  bgTag:            "#f5f5f5",
  bgOverlay:        "rgba(0,0,0,0.6)",
  border:           "#eee",
  borderStrong:     "#ddd",
  text:             "#333",
  textSecondary:    "#999",
  textMuted:        "#888",
  textOnDark:       "#ffffff",
  btnPrimary:       "#000000",
  btnPrimaryHover:  "#222222",
  btnPrimaryText:   "#ffffff",
  shadow:           "rgba(0,0,0,0.1)",
  shadowMd:         "rgba(0,0,0,0.1)",
  mentionBg:        "#e8e8e8",
  mapBorder:        "rgba(0,0,0,0.1)",
};

export const darkTheme = {
  bg:               "#0f0f0f",
  bgSecondary:      "#1a1a1a",
  bgElevated:       "#1e1e1e",
  bgHover:          "#2a2a2a",
  bgInput:          "transparent",
  bgControl:        "#2a2a2a",
  bgSegmentActive:  "#3a3a3a",
  bgTag:            "#2a2a2a",
  bgOverlay:        "rgba(0,0,0,0.7)",
  border:           "#2e2e2e",
  borderStrong:     "#3a3a3a",
  text:             "#e8e8e8",
  textSecondary:    "#888",
  textMuted:        "#666",
  textOnDark:       "#ffffff",
  btnPrimary:       "#e8e8e8",
  btnPrimaryHover:  "#ffffff",
  btnPrimaryText:   "#0f0f0f",
  shadow:           "rgba(0,0,0,0.4)",
  shadowMd:         "rgba(0,0,0,0.4)",
  mentionBg:        "#3a3a3a",
  mapBorder:        "rgba(255,255,255,0.08)",
};

export function useSystemDark() {
  const mq = window.matchMedia("(prefers-color-scheme: dark)");
  const [dark, setDark] = useState(mq.matches);
  useEffect(() => {
    const handler = (e) => setDark(e.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);
  return dark;
}

export const ThemePrefContext = createContext({ preference: "system", setPreference: () => {} });

// Enable :active pseudo-class on iOS
document.addEventListener("touchstart", () => {}, { passive: true });

export const GlobalStyle = createGlobalStyle`
  body {
    background: ${(p) => p.theme.bg};
    color: ${(p) => p.theme.text};
    transition: background 0.2s ease, color 0.2s ease;
  }
  button, img, video {
    user-select: none;
    -webkit-user-select: none;
    -webkit-touch-callout: none;
    -webkit-user-drag: none;
  }
  .ptr--ptr {
    box-shadow: none !important;
  }
  .ptr--icon {
    font-size: 1.5rem;
    color: ${(p) => p.theme.textMuted};
  }
`;
