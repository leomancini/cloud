import React, { useState, useEffect, useRef, useCallback, createContext, useContext } from "react";
import styled, { ThemeProvider, createGlobalStyle, keyframes, css } from "styled-components";
import data from "@emoji-mart/data";
import Picker from "@emoji-mart/react";
import PullToRefresh from "pulltorefreshjs";
import ReactDOMServer from "react-dom/server";

const RADIUS = "20px";
const RADIUS_SM = "14px";
const ICON_GAP = "8px";

// ─── Themes ──────────────────────────────────────────────────────────────────
const lightTheme = {
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

const darkTheme = {
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

// ─── System-preference hook ───────────────────────────────────────────────────
function useSystemDark() {
  const mq = window.matchMedia("(prefers-color-scheme: dark)");
  const [dark, setDark] = useState(mq.matches);
  useEffect(() => {
    const handler = (e) => setDark(e.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);
  return dark;
}

// ─── Theme context (for user override) ───────────────────────────────────────
// preference: "system" | "light" | "dark"
const ThemePrefContext = createContext({ preference: "system", setPreference: () => {} });

const GlobalStyle = createGlobalStyle`
  body {
    background: ${(p) => p.theme.bg};
    color: ${(p) => p.theme.text};
    transition: background 0.2s ease, color 0.2s ease;
  }
  .ptr--ptr {
    box-shadow: none !important;
  }
  .ptr--icon {
    font-size: 1.5rem;
    color: ${(p) => p.theme.textMuted};
  }
`;

const Spinner = ({ size } = {}) => <i className="fa-solid fa-circle-notch fa-spin" style={size ? { fontSize: size } : undefined} />;
const BigSpinner = () => <Spinner size="24px" />;

const parseText = (text, users = []) => {
  if (!text) return [];
  const base = users.some((u) => u.name === "Sol") ? users : [...users, { id: "sol-ai", name: "Sol" }];
  const allUsers = [];
  for (const u of base) {
    allUsers.push(u);
    if (u.google_name && u.google_name !== u.name) allUsers.push({ ...u, name: u.google_name });
  }
  const sorted = [...allUsers].sort((a, b) => b.name.length - a.name.length);
  const mentions = [];
  const atRegex = /@/g;
  let m;
  while ((m = atRegex.exec(text)) !== null) {
    const after = text.slice(m.index + 1);
    for (const u of sorted) {
      if (after.toLowerCase().startsWith(u.name.toLowerCase())) {
        const ch = after[u.name.length];
        if (!ch || /[^a-zA-Z0-9]/.test(ch)) {
          mentions.push({ start: m.index, end: m.index + 1 + u.name.length, name: u.name, userId: u.id });
          break;
        }
      }
    }
  }
  const parts = [];
  let last = 0;
  for (const mn of mentions) {
    if (mn.start < last) continue;
    if (mn.start > last) parts.push({ type: "text", content: text.slice(last, mn.start) });
    parts.push({ type: "mention", content: mn.name, userId: mn.userId });
    last = mn.end;
  }
  if (last < text.length) parts.push({ type: "text", content: text.slice(last) });
  return parts.length > 0 ? parts : [{ type: "text", content: text }];
};

const MentionSpan = styled.span`
  font-weight: 600;
`;

const MentionHighlight = styled.span`
  background: ${(p) => p.theme.mentionBg};
  border-radius: 3px;
`;

const MentionDropdown = styled.div`
  position: absolute;
  top: calc(100% + 4px);
  left: 0;
  right: 0;
  background: ${(p) => p.theme.bgElevated};
  border: 2px solid ${(p) => p.theme.border};
  border-radius: ${RADIUS};
  max-height: 150px;
  overflow-y: auto;
  z-index: 10;
  box-shadow: 0 2px 8px ${(p) => p.theme.shadowMd};
`;

const MentionOption = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  cursor: pointer;
  font-size: 14px;
  color: ${(p) => p.theme.text};
  @media (hover: hover) { &:hover { background: ${(p) => p.theme.bgHover}; } }
`;

const innerBorder = "outline: 2px solid rgba(0, 0, 0, 0.1); outline-offset: -2px;";

const MentionAvatar = styled.img`
  width: 24px;
  height: 24px;
  border-radius: 50%;
  ${innerBorder}
`;

const Page = styled.div`
  min-height: 100vh;
  font-family: system-ui, -apple-system, BlinkMacSystemFont, sans-serif;
  background: ${(p) => p.theme.bg};
  color: ${(p) => p.theme.text};
  padding: 20px 20px 48px;
  transition: background 0.2s ease, color 0.2s ease;
`;

const Header = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  max-width: 500px;
  margin: 0 auto 32px;
`;

const HeaderProfile = styled.div`
  display: flex;
  align-items: center;
  gap: 10px;
  cursor: pointer;
`;

const SmallAvatar = styled.img`
  width: 36px;
  height: 36px;
  border-radius: 50%;
  ${innerBorder}
`;

const HeaderName = styled.span`
  font-size: 16px;
  font-weight: 600;
  color: ${(p) => p.theme.text};
`;

const LoginCard = styled.div`
  text-align: center;
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
`;

const Title = styled.h1`
  font-size: 22px;
  color: ${(p) => p.theme.text};
  margin: 0 0 6px;
`;

const Subtitle = styled.p`
  font-size: 16px;
  color: ${(p) => p.theme.textSecondary};
  margin: 0 0 24px;
`;

const SignInButton = styled.a`
  display: inline-block;
  padding: 12px 24px;
  border-radius: ${RADIUS};
  font-size: 16px;
  font-weight: 500;
  text-decoration: none;
  cursor: pointer;
  background: ${(p) => p.theme.btnPrimary};
  color: ${(p) => p.theme.btnPrimaryText};

  @media (hover: hover) {
    &:hover {
      background: ${(p) => p.theme.btnPrimaryHover};
    }
  }
`;

const SegmentedControl = styled.div`
  display: flex;
  background: ${(p) => p.theme.bgControl};
  border-radius: ${RADIUS};
  padding: 3px;
`;

const Segment = styled.button`
  flex: 1 1 0;
  padding: 6px 16px;
  border-radius: ${RADIUS_SM};
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  border: none;
  background: ${(p) => (p.$active ? p.theme.bgElevated : "transparent")};
  color: ${(p) => (p.$active ? p.theme.text : p.theme.textMuted)};
  box-shadow: ${(p) => (p.$active ? `0 1px 3px ${p.theme.shadow}` : "none")};
  transition: all 0.15s ease;
`;

const BackButton = styled.button`
  padding: 8px 0;
  font-size: 16px;
  cursor: pointer;
  border: none;
  background: none;
  color: ${(p) => p.theme.textSecondary};
  text-transform: lowercase;
  display: flex;
  align-items: center;
  gap: 8px;
`;

const LogoutButton = styled.button`
  padding: 8px 16px;
  border-radius: ${RADIUS};
  font-size: 14px;
  cursor: pointer;
  border: 2px solid ${(p) => p.theme.borderStrong};
  background: ${(p) => p.theme.bgElevated};
  color: #666;

  @media (hover: hover) {
    &:hover {
      background: ${(p) => p.theme.bgHover};
    }
  }
`;

const Content = styled.div`
  max-width: 500px;
  margin: 0 auto;
`;

const ComposeBox = styled.div`
  margin-bottom: 12px;
  padding-bottom: 12px;
`;

const ComposeWrapper = styled.div`
  position: relative;
  width: 100%;
`;

const ComposeInput = styled.textarea`
  width: 100%;
  border: 2px solid ${(p) => p.theme.border};
  border-radius: ${RADIUS};
  padding: 14px;
  font-size: 16px;
  font-family: system-ui, -apple-system, BlinkMacSystemFont, sans-serif;
  resize: none;
  outline: none;
  box-sizing: border-box;
  color: transparent;
  caret-color: ${(p) => p.theme.text};
  position: relative;
  z-index: 1;
  background: transparent;
  overflow: auto;

  &:focus {
    border-color: #ccc;
  }
`;

const ComposeHighlight = styled.div`
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  padding: 14px;
  font-size: 16px;
  font-family: system-ui, -apple-system, BlinkMacSystemFont, sans-serif;
  line-height: normal;
  white-space: pre-wrap;
  word-wrap: break-word;
  overflow: hidden;
  color: ${(p) => p.theme.text};
  pointer-events: none;
  border: 2px solid transparent;
  border-radius: ${RADIUS};
  box-sizing: border-box;
`;

const ComposeActions = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-top: 10px;
`;

const IconButton = styled.button`
  display: flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  border-radius: 50%;
  font-size: 16px;
  cursor: pointer;
  border: none;
  background: ${(p) => (p.$active ? p.theme.bgControl : "transparent")};
  color: ${(p) => (p.$active ? p.theme.text : p.theme.textSecondary)};

  @media (hover: hover) {
    &:hover {
      background: ${(p) => p.theme.bgControl};
    }
  }
`;

const LocationSearch = styled.div`
  position: relative;
  margin-top: 8px;
`;

const LocationInput = styled.input`
  width: 100%;
  min-height: 40px;
  border: 2px solid ${(p) => p.theme.border};
  border-radius: ${RADIUS};
  padding: 8px 12px;
  font-size: 16px;
  font-family: system-ui, -apple-system, BlinkMacSystemFont, sans-serif;
  line-height: 22px;
  outline: none;
  box-sizing: border-box;
  background: ${(p) => p.theme.bgInput};
  color: ${(p) => p.theme.text};

  &:focus {
    border-color: #ccc;
  }
`;

const LocationResults = styled.div`
  position: absolute;
  top: calc(100% + 4px);
  left: 0;
  right: 0;
  background: ${(p) => p.theme.bgElevated};
  border: 2px solid ${(p) => p.theme.border};
  border-radius: ${RADIUS};
  max-height: 150px;
  overflow-y: auto;
  z-index: 10;
  box-shadow: 0 2px 8px ${(p) => p.theme.shadowMd};
`;

const LocationResult = styled.div`
  padding: 8px 12px;
  cursor: pointer;

  @media (hover: hover) {
    &:hover {
      background: ${(p) => p.theme.bgHover};
    }
  }
`;

const LocationName = styled.div`
  font-size: 14px;
  font-weight: 500;
  color: ${(p) => p.theme.text};
`;

const LocationAddress = styled.div`
  font-size: 12px;
  color: ${(p) => p.theme.textSecondary};
  margin-top: 2px;
`;

const SelectedLocation = styled.div`
  position: relative;
  display: flex;
  align-items: center;
  gap: ${ICON_GAP};
  margin-top: 8px;
  padding: 14px 36px 14px 14px;
  background: ${(p) => p.theme.bgHover};
  border-radius: ${RADIUS};
  font-size: 16px;
  color: ${(p) => p.theme.text};

  span {
    display: flex;
    align-items: center;
    gap: ${ICON_GAP};
  }
`;

const RemoveLocation = styled.button`
  position: absolute;
  right: 8px;
  top: 8px;
  border: none;
  background: rgba(0,0,0,0.5);
  color: #fff;
  cursor: pointer;
  font-size: 16px;
  width: 28px;
  height: 28px;
  border-radius: ${RADIUS_SM};
  padding: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  line-height: 1;
  z-index: 1;
`;

const ComposeActionsLeft = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
`;


const HiddenFileInput = styled.input`
  display: none;
`;

const MediaPreviews = styled.div`
  display: flex;
  gap: 8px;
  margin-top: 8px;
  flex-wrap: wrap;
`;

const MediaPreview = styled.div`
  position: relative;
  border-radius: inherit;
  overflow: hidden;
`;

const PreviewImage = styled.img`
  height: 100px;
  border-radius: ${RADIUS};
  display: block;
`;

const PreviewVideo = styled.video`
  height: 100px;
  border-radius: ${RADIUS};
  display: block;
`;

const RemoveMedia = styled.button`
  position: absolute;
  right: 8px;
  top: 8px;
  border: none;
  background: rgba(0,0,0,0.5);
  color: #fff;
  cursor: pointer;
  font-size: 16px;
  width: 28px;
  height: 28px;
  border-radius: ${RADIUS_SM};
  padding: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  line-height: 1;
  z-index: 1;
`;

const LinkPreviewCard = styled.a`
  display: block;
  margin-top: 10px;
  border: 2px solid ${(p) => p.theme.border};
  border-radius: ${RADIUS};
  overflow: hidden;
  text-decoration: none;
  color: inherit;
  @media (hover: hover) { &:hover { background: ${(p) => p.theme.bgHover} }; }
`;

const LinkPreviewImage = styled.img`
  width: 100%;
  max-height: 250px;
  object-fit: cover;
  display: block;
`;

const LinkPreviewBody = styled.div`
  padding: 10px 12px;
`;

const LinkPreviewSite = styled.div`
  font-size: 12px;
  color: ${(p) => p.theme.textSecondary};
  text-transform: uppercase;
  letter-spacing: 0.3px;
`;

const LinkPreviewTitle = styled.div`
  font-size: 16px;
  font-weight: 600;
  color: ${(p) => p.theme.text};
  margin-top: 2px;
  line-height: 1.3;
`;

const LinkPreviewDesc = styled.div`
  font-size: 14px;
  color: ${(p) => p.theme.textSecondary};
  margin-top: 4px;
  line-height: 1.4;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
`;

const PostMediaContainer = styled.div`
  margin-top: 10px;
  display: grid;
  grid-template-columns: ${(p) => (p.$count === 1 ? "1fr" : "1fr 1fr")};
  gap: 4px;

  ${(p) => p.$count === 2 && css`
    grid-template-rows: 1fr;
    & > * {
      height: 100%;
      max-height: 400px;
    }
    & > *:first-child, & > *:first-child img, & > *:first-child video { border-radius: ${RADIUS} 4px 4px ${RADIUS} !important; }
    & > *:last-child, & > *:last-child img, & > *:last-child video { border-radius: 4px ${RADIUS} ${RADIUS} 4px !important; }
  `}

  ${(p) => p.$count === 3 && css`
    & > *:first-child {
      grid-column: 1 / -1;
      max-height: 300px;
    }
    & > *:first-child, & > *:first-child img, & > *:first-child video { border-radius: ${RADIUS} ${RADIUS} 4px 4px !important; }
    & > *:nth-child(2), & > *:nth-child(2) img, & > *:nth-child(2) video {
      aspect-ratio: 3 / 4;
      border-radius: 4px 4px 4px ${RADIUS} !important;
    }
    & > *:nth-child(3), & > *:nth-child(3) img, & > *:nth-child(3) video {
      aspect-ratio: 3 / 4;
      border-radius: 4px 4px ${RADIUS} 4px !important;
    }
  `}

  ${(p) => p.$count >= 4 && css`
    & > *:nth-child(1), & > *:nth-child(1) img, & > *:nth-child(1) video { border-radius: ${RADIUS} 4px 4px 4px !important; }
    & > *:nth-child(2), & > *:nth-child(2) img, & > *:nth-child(2) video { border-radius: 4px ${RADIUS} 4px 4px !important; }
    & > *:nth-child(3), & > *:nth-child(3) img, & > *:nth-child(3) video { border-radius: 4px 4px 4px ${RADIUS} !important; }
    & > *:nth-child(4), & > *:nth-child(4) img, & > *:nth-child(4) video { border-radius: 4px 4px ${RADIUS} 4px !important; }
  `}
`;

const PostImage = styled.img`
  width: 100%;
  display: block;
  border-radius: ${RADIUS};
  object-fit: cover;
  background: ${(p) => p.theme.bgControl};
  min-height: ${(p) => (p.$single ? "200px" : "auto")};
  cursor: ${(p) => (p.$tappable ? "zoom-in" : "default")};
  ${innerBorder}
`;

const PostVideo = styled.video`
  width: 100%;
  display: block;
  border-radius: ${RADIUS};
  object-fit: cover;
  background: ${(p) => p.theme.bgControl};
  min-height: ${(p) => (p.$single ? "200px" : "auto")};
  ${innerBorder}
`;

/* ── Lightbox ── */
const fadeIn = keyframes`from { opacity: 0; } to { opacity: 1; }`;
const fadeOut = keyframes`from { opacity: 1; } to { opacity: 0; }`;
const slideUp = keyframes`from { transform: translateY(20px) scale(0.96); opacity: 0; } to { transform: translateY(0) scale(1); opacity: 1; }`;
const slideDown = keyframes`from { transform: translateY(0) scale(1); opacity: 1; } to { transform: translateY(40px) scale(0.94); opacity: 0; }`;

const LightboxBackdrop = styled.div`
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.88);
  z-index: 1000;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 20px;
  box-sizing: border-box;
  animation: ${(p) => (p.$closing ? css`${fadeOut} 0.22s ease forwards` : css`${fadeIn} 0.18s ease forwards`)};
  touch-action: none;
`;

const LightboxImg = styled.img`
  max-width: 100%;
  max-height: 90vh;
  width: 100%;
  object-fit: contain;
  border-radius: ${RADIUS};
  display: block;
  animation: ${(p) => (p.$closing ? css`${slideDown} 0.22s ease forwards` : css`${slideUp} 0.18s ease forwards`)};
  pointer-events: none;
  user-select: none;
`;

const LightboxClose = styled.button`
  position: fixed;
  top: 20px;
  right: 20px;
  width: 36px;
  height: 36px;
  border-radius: ${RADIUS_SM};
  border: none;
  background: rgba(255, 255, 255, 0.15);
  color: white;
  font-size: 20px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1001;
  transition: background 0.15s ease;
  @media (hover: hover) { &:hover { background: rgba(255, 255, 255, 0.25); } }
`;

const PostButton = styled.button`
  height: 36px;
  padding: 0 20px;
  border-radius: ${RADIUS};
  font-size: 14px;
  font-weight: 700;
  cursor: pointer;
  border: none;
  background: ${(p) => p.theme.btnPrimary};
  color: ${(p) => p.theme.btnPrimaryText};

  @media (hover: hover) {
    &:hover {
      background: ${(p) => p.theme.btnPrimaryHover};
    }
  }

  &:disabled {
    background: #ccc;
    cursor: default;
  }
`;

const PostItem = styled.div`
  padding: 16px 0;
`;

const PostHeader = styled.div`
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 16px;
`;

const PostHeaderText = styled.div`
  display: flex;
  align-items: baseline;
  gap: 10px;
  flex: 1;
  min-width: 0;
`;

const Avatar = styled.img`
  width: 36px;
  height: 36px;
  border-radius: 50%;
  ${innerBorder}
`;

const PostAuthor = styled.span`
  font-size: 16px;
  font-weight: 600;
  color: ${(p) => p.theme.text};
`;

const PostTime = styled.span`
  font-size: 12px;
  color: ${(p) => p.theme.textSecondary};
`;

const PostHeaderRight = styled.div`
  margin-left: auto;
`;

const PostMenuWrapper = styled.div`
  position: relative;
`;

const PostMenuButton = styled.button`
  border: none;
  background: none;
  color: #ccc;
  cursor: pointer;
  font-size: 14px;
  padding: 4px;
  display: flex;
  align-items: center;

  @media (hover: hover) {
    &:hover {
      color: ${(p) => p.theme.textSecondary};
    }
  }
`;

const PostMenu = styled.div`
  position: absolute;
  right: 0;
  top: 100%;
  background: ${(p) => p.theme.bgElevated};
  border: 2px solid ${(p) => p.theme.border};
  border-radius: ${RADIUS};
  box-shadow: 0 2px 8px ${(p) => p.theme.shadow};
  z-index: 10;
  overflow: hidden;
  min-width: 120px;
`;

const PostMenuItem = styled.button`
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  padding: 10px 14px;
  border: none;
  background: none;
  font-size: 14px;
  cursor: pointer;
  color: ${(p) => (p.$danger ? "#e53e3e" : p.theme.text)};

  @media (hover: hover) {
    &:hover {
      background: ${(p) => p.theme.bgHover};
    }
  }
`;

const PostContent = styled.p`
  font-size: 16px;
  color: ${(p) => p.theme.text};
  margin: 0;
  line-height: 1.4;
  white-space: pre-wrap;
`;

const DEFAULT_REACTION_EMOJIS = ["❤️", "😂", "😮", "🔥", "👏", "😢"];

const ReactionsRow = styled.div`
  display: flex;
  align-items: center;
  gap: 12px;
  margin-top: 14px;
  flex-wrap: wrap;
`;

const ReactionChip = styled.button`
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 0;
  border: none;
  background: none;
  font-size: 24px;
  line-height: 1;
  cursor: pointer;
`;

const ReactionNames = styled.span`
  font-size: 16px;
  color: ${(p) => p.theme.text};
  font-weight: 600;
`;

const EmojiOption = styled.button`
  display: flex;
  align-items: center;
  justify-content: center;
  border: none;
  background: none;
  font-size: 24px;
  line-height: 1;
  padding: 0;
  cursor: pointer;
  border-radius: ${RADIUS_SM};
  opacity: ${(p) => (p.$dimmed ? 0.35 : 1)};
  @media (hover: hover) {
    &:hover {
      background: none;
    }
  }
`;

const EmojiEditButton = styled.button`
  display: flex;
  align-items: center;
  justify-content: center;
  width: 34px;
  height: 34px;
  border: none;
  background: none;
  font-size: 14px;
  color: ${(p) => p.theme.textSecondary};
  cursor: pointer;
  border-radius: ${RADIUS_SM};
  padding: 0;
  @media (hover: hover) { &:hover { color: ${(p) => p.theme.text} }; }
`;

const QuickReactButton = styled.button`
  display: flex;
  align-items: center;
  justify-content: center;
  width: 34px;
  height: 34px;
  border: none;
  background: none;
  font-size: 16px;
  color: ${(p) => p.theme.textSecondary};
  cursor: pointer;
  border-radius: ${RADIUS_SM};
  padding: 0;
  @media (hover: hover) { &:hover { color: ${(p) => p.theme.text} }; }
`;

const EmojiPickerWrap = styled.div`
  position: relative;
  margin-top: 8px;
  em-emoji-picker {
    width: 100%;
    --border-radius: ${RADIUS};
  }
`;

// ─── Reaction settings styled components ─────────────────────────────────────

const ReactionSettingsSection = styled.div`
  text-align: left;
  margin: 0 auto 24px;
`;

const ReactionContextBlock = styled.div`
  margin-bottom: 20px;
`;

const ReactionContextHeader = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 10px;
`;

const ReactionContextLabel = styled.div`
  font-size: 14px;
  font-weight: 600;
  color: ${(p) => p.theme.text};
  display: flex;
  align-items: center;
  gap: 6px;
`;

const ReactionContextSubLabel = styled.div`
  font-size: 12px;
  font-weight: 400;
  color: ${(p) => p.theme.textSecondary};
`;

const ReactionResetButton = styled.button`
  font-size: 12px;
  color: ${(p) => p.theme.textSecondary};
  border: none;
  background: none;
  cursor: pointer;
  padding: 2px 6px;
  border-radius: ${RADIUS_SM};
  @media (hover: hover) { &:hover { background: ${(p) => p.theme.bgHover}; color: ${(p) => p.theme.text}; } }
`;

const EmojiChipRow = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-bottom: 10px;
`;

const EmojiChip = styled.div`
  display: inline-flex;
  align-items: center;
  gap: 4px;
  background: ${(p) => p.theme.bgControl};
  border-radius: 20px;
  padding: 4px 8px 4px 10px;
  font-size: 22px;
  line-height: 1;
  cursor: default;
  user-select: none;
`;

const EmojiChipRemove = styled.button`
  display: flex;
  align-items: center;
  justify-content: center;
  width: 16px;
  height: 16px;
  border-radius: ${RADIUS_SM};
  border: none;
  background: ${(p) => p.theme.textSecondary};
  color: ${(p) => p.theme.bgElevated};
  font-size: 12px;
  cursor: pointer;
  flex-shrink: 0;
  opacity: 0.7;
  @media (hover: hover) { &:hover { opacity: 1; } }
`;

const EmojiChipDragHandle = styled.span`
  font-size: 12px;
  color: ${(p) => p.theme.textMuted};
  cursor: grab;
  margin-right: 2px;
  &:active { cursor: grabbing; }
`;

const AddEmojiRow = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
`;

const EmojiInput = styled.input`
  width: 56px;
  text-align: center;
  font-size: 20px;
  border: 2px solid ${(p) => p.theme.border};
  border-radius: ${RADIUS_SM};
  padding: 6px 8px;
  background: ${(p) => p.theme.bgInput};
  color: ${(p) => p.theme.text};
  outline: none;
  &:focus { border-color: ${(p) => p.theme.borderStrong}; }
`;

const AddEmojiButton = styled.button`
  padding: 6px 14px;
  border-radius: ${RADIUS_SM};
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  border: 2px solid ${(p) => p.theme.borderStrong};
  background: ${(p) => p.theme.bgElevated};
  color: ${(p) => p.theme.text};
  @media (hover: hover) { &:hover { background: ${(p) => p.theme.bgHover} }; }
  &:disabled { opacity: 0.4; cursor: default; }
`;

const ReactionContextDivider = styled.div`
  height: 1px;
  background: ${(p) => p.theme.border};
  margin: 16px 0;
`;

const ReactionPreviewRow = styled.div`
  display: flex;
  gap: 4px;
  align-items: center;
  margin-top: 6px;
  flex-wrap: wrap;
`;

const ReactionPreviewEmoji = styled.span`
  font-size: 20px;
  opacity: 0.85;
`;

const ReactionInheritNote = styled.div`
  font-size: 12px;
  color: ${(p) => p.theme.textSecondary};
  font-style: italic;
  margin-top: 4px;
`;

// ─── End reaction settings styled components ──────────────────────────────────

const CommentsSection = styled.div`
  margin-top: 14px;
`;

const thumbsUpPop = keyframes`
  0%   { transform: scale(0.5); opacity: 0; }
  60%  { transform: scale(1.3); opacity: 1; }
  100% { transform: scale(1);   opacity: 1; }
`;

const CommentRow = styled.div`
  display: flex;
  align-items: flex-start;
  gap: 8px;
  margin-top: 10px;
  position: relative;
  user-select: none;
  -webkit-user-select: none;
`;

const CommentThumbsBadge = styled.button`
  display: flex;
  align-items: center;
  gap: 3px;
  border: none;
  background: none;
  padding: 0;
  cursor: pointer;
  flex-shrink: 0;
  align-self: center;
  color: ${(p) => (p.$active ? "#2563EB" : p.theme.textSecondary)};
  font-size: 14px;
  line-height: 1;
  opacity: ${(p) => (p.$visible ? 1 : 0)};
  pointer-events: ${(p) => (p.$visible ? "auto" : "none")};
  transition: color 0.15s ease, opacity 0.15s ease;

  &:active { opacity: 0.6; }
`;

const ThumbsUpEmoji = styled.span`
  font-size: 14px;
  display: inline-block;
  animation: ${(p) => (p.$animate ? css`${thumbsUpPop} 0.35s ease forwards` : "none")};
`;

const CommentAvatar = styled.img`
  width: 24px;
  height: 24px;
  border-radius: 50%;
  flex-shrink: 0;
  margin-top: -1px;
  ${innerBorder}
`;

const CommentBody = styled.div`
  flex: 1;
  min-width: 0;
`;

const CommentAuthor = styled.span`
  font-size: 16px;
  font-weight: 600;
  color: ${(p) => p.theme.text};
  margin-right: 6px;
`;

const CommentText = styled.span`
  font-size: 16px;
  color: ${(p) => p.theme.text};
  line-height: 1.4;
`;

const CommentTime = styled.span`
  font-size: 12px;
  color: ${(p) => p.theme.textSecondary};
  margin-left: 8px;
  vertical-align: baseline;
`;

const CommentInputRow = styled.div`
  display: flex;
  align-items: flex-end;
  gap: 8px;
  margin-top: 16px;
`;

const CommentInputWrapper = styled.div`
  position: relative;
  flex: 1;
  min-width: 0;
`;

const CommentInput = styled.textarea`
  width: 100%;
  min-height: 40px;
  border: 2px solid ${(p) => p.theme.border};
  border-radius: ${RADIUS};
  padding: 7px 12px;
  font-size: 16px;
  font-family: system-ui, -apple-system, BlinkMacSystemFont, sans-serif;
  outline: none;
  min-width: 0;
  color: transparent;
  caret-color: ${(p) => p.theme.text};
  position: relative;
  z-index: 1;
  background: transparent;
  box-sizing: border-box;
  resize: none;
  overflow: hidden;
  line-height: 22px;
  display: block;
  vertical-align: top;

  &:focus {
    border-color: #ccc;
  }
`;

const CommentHighlight = styled.div`
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  padding: 7px 12px;
  font-size: 16px;
  font-family: system-ui, -apple-system, BlinkMacSystemFont, sans-serif;
  line-height: 22px;
  white-space: pre-wrap;
  word-wrap: break-word;
  overflow: hidden;
  color: ${(p) => p.theme.text};
  pointer-events: none;
  border: 2px solid transparent;
  border-radius: ${RADIUS};
  box-sizing: border-box;
`;

const CommentPostButton = styled.button`
  border: 2px solid transparent;
  background: ${(p) => p.theme.btnPrimary};
  color: ${(p) => p.theme.btnPrimaryText};
  font-size: 16px;
  cursor: pointer;
  padding: 0;
  width: 40px;
  height: 40px;
  border-radius: ${RADIUS};
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  box-sizing: border-box;

  @media (hover: hover) {
    &:hover {
      background: ${(p) => p.theme.btnPrimaryHover};
    }
  }
`;

const CommentCount = styled.button`
  border: none;
  background: none;
  color: ${(p) => p.theme.textSecondary};
  font-size: 14px;
  cursor: pointer;
  padding: 0;
  margin-top: 8px;

  @media (hover: hover) {
    &:hover {
      color: ${(p) => p.theme.text};
    }
  }
`;

const PostLocation = styled.div`
  margin-top: 10px;
`;

const PostMapWrapper = styled.div`
  position: relative;
  border-radius: ${RADIUS} ${RADIUS} 0 0;
  overflow: hidden;

  &::after {
    content: "";
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    border-radius: ${RADIUS} ${RADIUS} 0 0;
    box-shadow: inset 0 0 0 2px ${(p) => p.theme.shadow};
    pointer-events: none;
  }
`;

const PostMap = styled.img`
  width: 100%;
  height: 150px;
  object-fit: cover;
  display: block;
`;

const PostPlaceName = styled.div`
  padding: 10px 12px;
  font-size: 14px;
  font-weight: 500;
  color: ${(p) => p.theme.text};
  border: 2px solid ${(p) => p.theme.border};
  border-top: none;
  border-radius: 0 0 ${RADIUS} ${RADIUS};
  display: flex;
  align-items: center;
  justify-content: space-between;
`;

const PostPlaceAddress = styled.span`
  font-weight: 400;
  color: ${(p) => p.theme.textSecondary};
`;

const UserList = styled.div`
  display: flex;
  flex-direction: column;
  gap: 8px;
`;

const UserRow = styled.div`
  padding: 12px 0;
  display: flex;
  align-items: center;
  justify-content: space-between;

  &:last-child {
    padding-bottom: 0;
  }
`;

const UserInfo = styled.div`
  display: flex;
  align-items: center;
  gap: 12px;
`;

const UserAvatar = styled.img`
  width: 36px;
  height: 36px;
  border-radius: 50%;
  ${innerBorder}
`;

const UserName = styled.span`
  font-size: 16px;
  font-weight: 500;
  color: ${(p) => p.theme.text};
`;

const UserStatus = styled.div`
  font-size: 12px;
  color: ${(p) => p.theme.textSecondary};
  margin-top: 1px;
`;

const FilterDescription = styled.div`
  font-size: 14px;
  color: ${(p) => p.theme.textSecondary};
  text-align: center;
  margin-top: 24px;
  margin-bottom: 16px;
`;

const PeopleGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: ${(p) => p.$compact ? "4px" : "12px"};
`;

const PeopleCard = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  gap: 12px;
  padding: 12px 0;
  min-width: 0;
`;

const PeopleCardAvatar = styled.img`
  width: 80px;
  height: 80px;
  border-radius: 50%;
  ${innerBorder}
`;

const PeopleCardName = styled.span`
  font-size: 16px;
  font-weight: 500;
  color: ${(p) => p.theme.text};
  line-height: 1.3;
  margin-bottom: 4px;
  display: block;
`;

const PeopleCardStatus = styled.div`
  font-size: 14px;
  color: ${(p) => p.theme.textSecondary};
  margin-top: 0px;
`;

const UserProfileHeader = styled.div`
  text-align: center;
  padding: 20px;
  margin-bottom: 16px;
`;

const UserProfileAvatar = styled.img`
  width: 80px;
  height: 80px;
  border-radius: 50%;
  margin-bottom: 12px;
  ${innerBorder}
`;

const UserProfileName = styled.h2`
  font-size: 22px;
  color: ${(p) => p.theme.text};
  margin: 0 0 4px;
`;

const UserProfileStats = styled.div`
  display: flex;
  justify-content: center;
  gap: 24px;
  margin: 16px 0;
`;

const UserProfileStat = styled.div`
  font-size: 14px;
  color: ${(p) => p.theme.textSecondary};
  span {
    font-weight: 600;
    color: ${(p) => p.theme.text};
  }
`;

const UserProfilePrivate = styled.div`
  text-align: center;
  padding: 48px 24px;
  color: ${(p) => p.theme.textSecondary};
  font-size: 14px;
`;

const DegreeBadge = styled.span`
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 12px;
  font-weight: 600;
  padding: 2px 7px;
  border-radius: 20px;
  letter-spacing: 0.01em;
  background: ${(p) =>
    p.$degree === 1
      ? "rgba(37,99,235,0.12)"
      : p.$degree === 2
      ? "rgba(124,58,237,0.12)"
      : p.theme.bgTag};
  color: ${(p) =>
    p.$degree === 1
      ? "#2563EB"
      : p.$degree === 2
      ? "#7C3AED"
      : p.theme.textMuted};
`;

const DegreeFilterBar = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 16px;
  flex-wrap: wrap;
`;

const DegreeFilterLabel = styled.span`
  font-size: 12px;
  font-weight: 600;
  color: ${(p) => p.theme.textMuted};
  text-transform: uppercase;
  letter-spacing: 0.05em;
  margin-right: 2px;
`;

const DegreeFilterChip = styled.button`
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 5px 12px;
  border-radius: 20px;
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
  border: 1.5px solid
    ${(p) =>
      p.$active
        ? p.$degree === 1
          ? "#2563EB"
          : p.$degree === 2
          ? "#7C3AED"
          : p.theme.borderStrong
        : p.theme.border};
  background: ${(p) =>
    p.$active
      ? p.$degree === 1
        ? "rgba(37,99,235,0.1)"
        : p.$degree === 2
        ? "rgba(124,58,237,0.1)"
        : p.theme.bgControl
      : "transparent"};
  color: ${(p) =>
    p.$active
      ? p.$degree === 1
        ? "#2563EB"
        : p.$degree === 2
        ? "#7C3AED"
        : p.theme.text
      : p.theme.textMuted};
  transition: all 0.15s ease;

  @media (hover: hover) {
    &:hover {
      border-color: ${(p) =>
        p.$degree === 1
          ? "#2563EB"
          : p.$degree === 2
          ? "#7C3AED"
          : p.theme.borderStrong};
      background: ${(p) =>
        p.$degree === 1
          ? "rgba(37,99,235,0.08)"
          : p.$degree === 2
          ? "rgba(124,58,237,0.08)"
          : p.theme.bgHover};
    }
  }
`;

const FollowButton = styled.button`
  padding: 8px 18px;
  border-radius: ${RADIUS};
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  border: 2px solid ${(p) => (p.$status === "pending" ? p.theme.borderStrong : p.$following ? p.theme.borderStrong : p.theme.btnPrimary)};
  background: ${(p) => (p.$status === "pending" ? p.theme.bgElevated : p.$following ? p.theme.bgElevated : p.theme.btnPrimary)};
  color: ${(p) => (p.$status === "pending" ? p.theme.textSecondary : p.$following ? p.theme.textMuted : p.theme.btnPrimaryText)};

  @media (hover: hover) {
    &:hover {
      background: ${(p) => (p.$status === "pending" ? p.theme.bgHover : p.$following ? p.theme.bgHover : p.theme.btnPrimaryHover)};
    }
  }
`;

const FollowBtn = ({ user, onFollow, busy }) => {
  const status = user.follow_status;
  const following = user.is_following;
  const followsYou = user.follows_you;
  const label = status === "pending" ? "Requested" : following ? "Following" : followsYou ? "Follow back" : "Follow";
  return (
    <FollowButton
      $following={!!following}
      $status={status}
      disabled={busy}
      onClick={() => onFollow(user.id, status || (following ? "approved" : null))}
    >
      {busy ? <Spinner /> : label}
    </FollowButton>
  );
};

const PeopleFollowButton = styled(FollowButton)``;

const PeopleFollowBtn = ({ user, onFollow, busy }) => {
  const status = user.follow_status;
  const following = user.is_following;
  const followsYou = user.follows_you;
  const label = status === "pending" ? "Requested" : following ? "Following" : followsYou ? "Follow back" : "Follow";
  return (
    <PeopleFollowButton
      $following={!!following}
      $status={status}
      disabled={busy}
      onClick={() => onFollow(user.id, status || (following ? "approved" : null))}
    >
      {busy ? <Spinner /> : label}
    </PeopleFollowButton>
  );
};

const RequestActions = styled.div`
  display: flex;
  gap: 8px;
`;

const ApproveButton = styled.button`
  padding: 8px 18px;
  border-radius: ${RADIUS};
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  border: none;
  background: ${(p) => p.theme.btnPrimary};
  color: ${(p) => p.theme.btnPrimaryText};

  @media (hover: hover) {
    &:hover {
      background: ${(p) => p.theme.btnPrimaryHover};
    }
  }
`;

const RejectButton = styled.button`
  padding: 8px 18px;
  border-radius: ${RADIUS};
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  border: 2px solid ${(p) => p.theme.borderStrong};
  background: ${(p) => p.theme.bgElevated};
  color: #666;

  @media (hover: hover) {
    &:hover {
      background: ${(p) => p.theme.bgHover};
    }
  }
`;

const EmptyState = styled.p`
  text-align: center;
  color: ${(p) => p.theme.textSecondary};
  font-size: 16px;
  margin-top: 40px;
`;

const SuggestionsBox = styled.div`
  background: ${(p) => p.theme.bgSecondary};
  border-radius: ${RADIUS};
  padding: 16px;
  margin-bottom: 24px;
`;

const SectionTitle = styled.div`
  font-size: 14px;
  font-weight: 600;
  color: ${(p) => p.theme.text};
  margin-bottom: 12px;
`;

const SectionHeader = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: ${(p) => (p.$open ? "12px" : "0")};
`;

const CollapseButton = styled.button`
  display: flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  border: none;
  background: none;
  color: ${(p) => p.theme.textSecondary};
  cursor: pointer;
  font-size: 12px;
  padding: 0;
  border-radius: ${RADIUS_SM};
  transition: color 0.15s ease, background 0.15s ease;

  @media (hover: hover) {
    &:hover {
      color: ${(p) => p.theme.text};
      background: ${(p) => p.theme.bgHover};
    }
  }
`;

const ProfilePage = styled.div`
  text-align: center;
  padding-top: 40px;
`;

const ProfileAvatar = styled.img`
  width: 80px;
  height: 80px;
  border-radius: 50%;
  margin-bottom: 16px;
  ${innerBorder}
`;

const ProfileName = styled.h2`
  font-size: 22px;
  color: ${(p) => p.theme.text};
  margin: 0 0 4px;
`;

const ProfileEmail = styled.p`
  font-size: 14px;
  color: ${(p) => p.theme.textSecondary};
  margin: 0 0 32px;
`;

const ThemeToggleLabel = styled.div`
  font-size: 14px;
  font-weight: 500;
  color: ${(p) => p.theme.textSecondary};
  margin-bottom: 8px;
`;

const ThemeToggleWrap = styled.div`
  margin-bottom: 24px;
`;

const ThemeToggle = styled.div`
  display: inline-flex;
  background: ${(p) => p.theme.bgControl};
  border-radius: ${RADIUS};
  padding: 3px;

  @media (max-width: 600px) {
    display: flex;
  }
`;

const ThemeSegment = styled.button`
  flex: 1;
  padding: 6px 20px;
  border-radius: ${RADIUS_SM};
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  border: none;
  background: ${(p) => (p.$active ? p.theme.bgElevated : "transparent")};
  color: ${(p) => (p.$active ? p.theme.text : p.theme.textMuted)};
  box-shadow: ${(p) => (p.$active ? `0 1px 3px ${p.theme.shadow}` : "none")};
  transition: all 0.15s ease;
`;

const PushSection = styled.div`
  text-align: left;
  margin: 0 auto 24px;
`;

const PushRow = styled.label`
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 0;
  cursor: pointer;

  &:not(:last-child) {
    border-bottom: 2px solid ${(p) => p.theme.border};
  }
`;

const PushRowLabel = styled.span`
  font-size: 14px;
  color: ${(p) => p.theme.text};
`;

const ToggleTrack = styled.div`
  width: 44px;
  height: 24px;
  border-radius: 12px;
  background: ${(p) => (p.$on ? p.theme.btnPrimary : p.theme.bgControl)};
  position: relative;
  flex-shrink: 0;
  transition: background 0.2s ease;
`;

const ToggleThumb = styled.div`
  width: 20px;
  height: 20px;
  border-radius: 50%;
  background: ${(p) => (p.$on ? p.theme.btnPrimaryText : p.theme.textMuted)};
  position: absolute;
  top: 2px;
  left: ${(p) => (p.$on ? "22px" : "2px")};
  transition: left 0.2s ease, background 0.2s ease;
`;

const Banner = styled.div`
  max-width: 500px;
  margin: 0 auto 20px;
  padding: 14px 16px;
  background: ${(p) => p.theme.bgSecondary};
  border: 2px solid ${(p) => p.theme.border};
  border-radius: ${RADIUS};
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;

  @media (min-width: 601px) {
    display: none;
  }
`;

const BannerText = styled.span`
  font-size: 14px;
  color: ${(p) => p.theme.text};
  flex: 1;
`;

const BannerButton = styled.button`
  padding: 8px 14px;
  border-radius: ${RADIUS};
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  border: none;
  background: ${(p) => p.theme.btnPrimary};
  color: ${(p) => p.theme.btnPrimaryText};
  white-space: nowrap;
  flex-shrink: 0;

  @media (hover: hover) {
    &:hover {
      background: ${(p) => p.theme.btnPrimaryHover};
    }
  }
`;

const BannerDismiss = styled.button`
  border: none;
  background: none;
  color: ${(p) => p.theme.textMuted};
  cursor: pointer;
  font-size: 14px;
  padding: 0;
  flex-shrink: 0;
`;

function shortAddress(address) {
  if (!address) return null;
  const parts = address.split(",").map((s) => s.trim());
  if (parts.length >= 3) {
    const state = parts[parts.length - 2].replace(/\s*\d{5}.*/, "");
    const city = parts[parts.length - 3];
    return `${city}, ${state}`;
  }
  return parts.slice(-2).join(", ");
}

function timeAgo(dateStr) {
  const date = new Date(dateStr + "Z");
  const seconds = Math.floor((Date.now() - date) / 1000);
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes} minute${minutes === 1 ? "" : "s"} ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 8) return `${hours} hour${hours === 1 ? "" : "s"} ago`;
  return date.toLocaleString(undefined, {
    month: "short", day: "numeric", hour: "numeric", minute: "2-digit",
  });
}

function urlBase64ToUint8Array(base64String) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  const arr = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) arr[i] = raw.charCodeAt(i);
  return arr;
}

function PhotoLightbox({ src, onClose }) {
  const [closing, setClosing] = useState(false);
  const touchStartY = useRef(null);
  const touchStartX = useRef(null);

  const dismiss = useCallback(() => {
    setClosing(true);
    setTimeout(onClose, 220);
  }, [onClose]);

  // Close on Escape key
  useEffect(() => {
    const handleKey = (e) => { if (e.key === "Escape") dismiss(); };
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [dismiss]);

  // Prevent body scroll while open
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
    // Swipe down ≥ 60px and more vertical than horizontal → dismiss
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

// ─── useDoubleTap hook ────────────────────────────────────────────────────────
// Returns touch/click event props that fire `onDoubleTap` on a double-tap/click.
// `delay` is the max ms between two taps to count as a double-tap (default 300).
function useDoubleTap(onDoubleTap, delay = 300) {
  const lastTap = useRef(0);
  const timer = useRef(null);

  const handleTap = useCallback((e) => {
    const now = Date.now();
    if (now - lastTap.current < delay) {
      // Double tap detected
      clearTimeout(timer.current);
      lastTap.current = 0;
      onDoubleTap(e);
    } else {
      lastTap.current = now;
      // Reset after delay so a slow third tap doesn't accidentally trigger
      timer.current = setTimeout(() => { lastTap.current = 0; }, delay);
    }
  }, [onDoubleTap, delay]);

  return { onTouchEnd: handleTap, onClick: handleTap };
}

// ─── useReactionDoubleTap hook ────────────────────────────────────────────────
// Double-tap / double-click handler for reaction triggers.
// Scroll discrimination: records Y on touchstart, nullifies on touchmove if
// finger travels > SCROLL_THRESHOLD px. touchend only fires if Y is still set.
// Pinch gestures are also ignored. Desktop uses native onDoubleClick.
const SCROLL_THRESHOLD = 10;  // px — vertical movement beyond this = scroll, not tap
const TAP_WINDOW       = 300; // ms — max gap between two taps for a double-tap

function useReactionDoubleTap(onReact) {
  const touchStartY  = useRef(null);    // Y position at touchstart; null = scrolling
  const lastTapTime  = useRef(0);       // timestamp of previous qualifying tap
  const wasPinch     = useRef(false);   // true if multi-touch detected during gesture

  const handleTouchStart = useCallback((e) => {
    if (e.touches.length > 1) { wasPinch.current = true; return; }
    touchStartY.current = e.touches[0].clientY;
    wasPinch.current = false;
  }, []);

  const handleTouchMove = useCallback((e) => {
    if (e.touches.length >= 2) { wasPinch.current = true; return; }
    if (touchStartY.current === null) return;
    if (Math.abs(e.touches[0].clientY - touchStartY.current) > SCROLL_THRESHOLD) {
      touchStartY.current = null; // nullify — this gesture is a scroll
    }
  }, []);

  const handleTouchEnd = useCallback((e) => {
    if (wasPinch.current) { wasPinch.current = false; touchStartY.current = null; return; }
    if (touchStartY.current === null) return; // was scrolling — ignore
    touchStartY.current = null;

    const now = Date.now();
    if (lastTapTime.current && now - lastTapTime.current < TAP_WINDOW) {
      lastTapTime.current = 0;
      e.preventDefault();
      onReact(e);
    } else {
      lastTapTime.current = now;
    }
  }, [onReact]);

  // Desktop: native double-click is reliable, no scroll disambiguation needed
  const handleDoubleClick = useCallback((e) => {
    if (!("ontouchstart" in window)) onReact(e);
  }, [onReact]);

  return {
    onTouchStart:  handleTouchStart,
    onTouchMove:   handleTouchMove,
    onTouchEnd:    handleTouchEnd,
    onDoubleClick: handleDoubleClick,
  };
}

// ─── PostItemWithReaction ─────────────────────────────────────────────────────
// Thin wrapper that owns the useReactionDoubleTap hook for a single post and
// passes the resulting event props down via a render-prop, so the hook's refs
// are stable across re-renders (hooks can't be called inside .map() directly).
function PostItemWithReaction({ post, getReactionEmojis, onReact, renderContent }) {
  const handleReact = useCallback(() => {
    onReact(post.id, getReactionEmojis("posts")[0]);
  }, [post.id, onReact, getReactionEmojis]);

  const reactProps = useReactionDoubleTap(handleReact);
  return renderContent(reactProps);
}

// ─── CommentRowWithReaction ───────────────────────────────────────────────────
// Same pattern for individual comment rows.
function CommentRowWithReaction({ postId, commentId, onReact, renderContent }) {
  const handleReact = useCallback(() => {
    onReact(postId, commentId);
  }, [postId, commentId, onReact]);

  const reactProps = useReactionDoubleTap(handleReact);
  return renderContent(reactProps);
}

function App() {
  const [themePref, setThemePref] = useState(() => localStorage.getItem("theme-pref") || "system");
  const systemDark = useSystemDark();
  const resolvedTheme = themePref === "system" ? (systemDark ? darkTheme : lightTheme) : themePref === "dark" ? darkTheme : lightTheme;

  const updateThemePref = (pref) => {
    setThemePref(pref);
    localStorage.setItem("theme-pref", pref);
  };

  const [user, setUser] = useState(null);
  const [users, setUsers] = useState([]);
  const [posts, setPosts] = useState([]);
  const [feedHasMore, setFeedHasMore] = useState(false);
  const [feedLoadingMore, setFeedLoadingMore] = useState(false);
  const [followers, setFollowers] = useState([]);
  const [followRequests, setFollowRequests] = useState([]);
  const initialProfileId = useRef(null);
  const [tab, setTabState] = useState(() => {
    const path = window.location.pathname;
    if (path === "/people") return "people";
    if (path === "/profile") return "profile";
    const userMatch = path.match(/^\/user\/(\d+)$/);
    if (userMatch) { initialProfileId.current = parseInt(userMatch[1]); return "user-profile"; }
    return "feed";
  });
  const setTab = (newTab) => {
    const slug = newTab === "feed" ? "/" : newTab === "people" ? "/people" : newTab === "profile" ? "/profile" : null;
    if (slug) window.history.pushState({ scrollY: window.scrollY }, "", slug);
    setTabState(newTab);
    window.scrollTo(0, 0);
  };
  useEffect(() => {
    const onPopState = (e) => {
      const path = window.location.pathname;
      const userMatch = path.match(/^\/user\/(\d+)$/);
      if (userMatch) {
        setTabState("user-profile");
        loadUserProfile(parseInt(userMatch[1]), true);
      } else if (path === "/people") setTabState("people");
      else if (path === "/profile") setTabState("profile");
      else setTabState("feed");
      if (e.state?.scrollY != null) {
        requestAnimationFrame(() => window.scrollTo(0, e.state.scrollY));
      }
    };
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, []);
  const [compose, setCompose] = useState("");
  const [loading, setLoading] = useState(true);
  const [posting, setPosting] = useState(false);
  const [busyActions, setBusyActions] = useState(new Set());

  // Location state
  const [showLocationSearch, setShowLocationSearch] = useState(false);
  const [locationQuery, setLocationQuery] = useState("");
  const [locationResults, setLocationResults] = useState([]);
  const [selectedLocation, setSelectedLocation] = useState(null);
  const [userLocation, setUserLocation] = useState(null);
  const searchTimeout = useRef(null);

  // Link preview state
  const [ogPreview, setOgPreview] = useState(null);
  const [ogLoading, setOgLoading] = useState(false);
  const ogFetchedUrl = useRef(null);

  // Media state
  const [mediaFiles, setMediaFiles] = useState([]);
  const [mediaPreviews, setMediaPreviews] = useState([]);
  const fileInputRef = useRef(null);
  const [openMenuId, setOpenMenuId] = useState(null);
  const [commentInputs, setCommentInputs] = useState({});
  const [expandedComments, setExpandedComments] = useState({});
  const [mentionQuery, setMentionQuery] = useState(null); // { field: "compose" | postId, query: string }
  const composeRef = useRef(null);
  const composeHighlightRef = useRef(null);
  const commentRefs = useRef({});

  const renderTextPart = (str, keyPrefix) => {
    const urlRegex = /(https?:\/\/[^\s]+)/g;
    const pieces = str.split(urlRegex);
    return pieces.map((piece, j) =>
      urlRegex.test(piece) ? <a key={`${keyPrefix}-${j}`} href={piece} target="_blank" rel="noopener noreferrer" style={{ color: "#2563EB" }}>{piece}</a> : <span key={`${keyPrefix}-${j}`}>{piece}</span>
    );
  };

  const renderText = (text) => {
    const parts = parseText(text, users);
    return parts.map((p, i) =>
      p.type === "mention" ? <MentionSpan key={i}>@{p.content}</MentionSpan> : <span key={i}>{renderTextPart(p.content, i)}</span>
    );
  };

  const renderHighlightPart = (str, keyPrefix) => {
    const urlRegex = /(https?:\/\/[^\s]+)/g;
    const pieces = str.split(urlRegex);
    return pieces.map((piece, j) =>
      urlRegex.test(piece) ? <span key={`${keyPrefix}-${j}`} style={{ color: "#2563EB", textDecoration: "underline" }}>{piece}</span> : <span key={`${keyPrefix}-${j}`}>{piece}</span>
    );
  };

  const renderHighlight = (text) => {
    const parts = parseText(text, users);
    return parts.map((p, i) =>
      p.type === "mention" ? <MentionHighlight key={i}>@{p.content}</MentionHighlight> : <span key={i}>{renderHighlightPart(p.content, i)}</span>
    );
  };

  const mentionUsers = users.some((u) => u.name === "Sol")
    ? users
    : [...users, { id: "sol-ai", name: "Sol", picture: "/api/pictures/sol.jpg" }];

  const handleMentionInput = (value, field) => {
    const ref = field === "compose" ? composeRef.current : commentRefs.current[field];
    if (!ref) return setMentionQuery(null);
    const pos = ref.selectionStart;
    const before = value.slice(0, pos);
    const atIdx = before.lastIndexOf("@");
    if (atIdx === -1 || (atIdx > 0 && /\S/.test(before[atIdx - 1]))) return setMentionQuery(null);
    const query = before.slice(atIdx + 1);
    if (/\s/.test(query) && query.length > 0) return setMentionQuery(null);
    setMentionQuery({ field, query: query.toLowerCase() });
  };

  const insertMention = (userName, field) => {
    const ref = field === "compose" ? composeRef.current : commentRefs.current[field];
    const val = ref.value;
    const pos = ref.selectionStart;
    const before = val.slice(0, pos);
    const atIdx = before.lastIndexOf("@");
    const after = val.slice(pos);
    const insertion = "@" + userName + "\u00A0";
    const newVal = before.slice(0, atIdx) + insertion + after;
    const newPos = atIdx + insertion.length;

    // Use native setter to trigger React's onChange
    const nativeSetter = Object.getOwnPropertyDescriptor(
      HTMLTextAreaElement.prototype,
      "value"
    ).set;
    nativeSetter.call(ref, newVal);
    ref.dispatchEvent(new Event("input", { bubbles: true }));

    setMentionQuery(null);
    requestAnimationFrame(() => {
      ref.focus();
      ref.setSelectionRange(newPos, newPos);
    });
  };
  const [suggestionsOpen, setSuggestionsOpen] = useState(false);
  const [openCommentMenuId, setOpenCommentMenuId] = useState(null);
  const [connectionDegrees, setConnectionDegrees] = useState({}); // userId -> 1 | 2
  const [peopleFilter, setPeopleFilter] = useState("friends"); // "all" | "friends" | "fof"
  const [editingComment, setEditingComment] = useState(null);
  const [editingName, setEditingName] = useState(null);
  const [editCommentText, setEditCommentText] = useState("");
  const [lightboxSrc, setLightboxSrc] = useState(null);
  const [commentThumbsAnimate, setCommentThumbsAnimate] = useState({}); // commentId -> bool

  // Reaction preferences state
  const [reactionPrefs, setReactionPrefs] = useState(null); // { global: [...], posts: null|[...], comments: null|[...] }
  const [reactionSaving, setReactionSaving] = useState({});
  const [editingEmojiSlot, setEditingEmojiSlot] = useState(null); // index in profile settings
  const [emojiPickerPostId, setEmojiPickerPostId] = useState(null); // post id for inline picker
  const [emojiPickerSlot, setEmojiPickerSlot] = useState(null); // slot index being replaced
  const [commentReactionPicker, setCommentReactionPicker] = useState(null); // { postId, commentId }
  const [quickReactPickerPostId, setQuickReactPickerPostId] = useState(null); // post id for quick one-off reaction

  // User profile page state
  const [viewingProfile, setViewingProfile] = useState(null); // { profile, posts, canViewPosts, hasMore }
  const [viewingProfileLoading, setViewingProfileLoading] = useState(false);
  const profileBackTab = useRef("people"); // track where to go back to

  // Returns the resolved emoji set for a given context, falling back: context → global → default
  const getReactionEmojis = (context = "posts") => {
    if (!reactionPrefs) return DEFAULT_REACTION_EMOJIS;
    if (context !== "global" && reactionPrefs[context] && reactionPrefs[context].length > 0) {
      return reactionPrefs[context];
    }
    if (reactionPrefs.global && reactionPrefs.global.length > 0) {
      return reactionPrefs.global;
    }
    return DEFAULT_REACTION_EMOJIS;
  };

  // Push notification state
  const [pushPrefs, setPushPrefs] = useState(null);
  const [pushSupported] = useState(() => "serviceWorker" in navigator && "PushManager" in window);
  const [isStandalone] = useState(() => window.navigator.standalone || window.matchMedia("(display-mode: standalone)").matches);
  const [isMobile] = useState(() => /iPhone|iPad|iPod|Android/i.test(navigator.userAgent));
  const [installBannerDismissed, setInstallBannerDismissed] = useState(() => localStorage.getItem("install-banner-dismissed") === "true");
  const [notifBannerDismissed, setNotifBannerDismissed] = useState(() => localStorage.getItem("notif-banner-dismissed") === "true");

  const startBusy = (key) => setBusyActions((prev) => new Set(prev).add(key));
  const endBusy = (key) => setBusyActions((prev) => { const next = new Set(prev); next.delete(key); return next; });
  const isBusy = (key) => busyActions.has(key);

  // Pull-to-refresh in PWA mode
  const ptrRef = useRef(null);
  useEffect(() => {
    if (!isStandalone) return;
    ptrRef.current = PullToRefresh.init({
      mainElement: "body",
      onRefresh: () => { window.location.reload(); },
      distThreshold: 60,
      distMax: 500,
      distReload: 50,
      instructionsPullToRefresh: " ",
      instructionsReleaseToRefresh: " ",
      instructionsRefreshing: " ",
      refreshTimeout: 500,
      iconArrow: ReactDOMServer.renderToString(<i className="fa-solid fa-rotate" />),
      iconRefreshing: ReactDOMServer.renderToString(<i className="fa-solid fa-rotate fa-spin" />),
    });
    return () => { if (ptrRef.current) { ptrRef.current.destroy(); ptrRef.current = null; } };
  }, [isStandalone]);

  useEffect(() => {
    const handleClickOutside = () => { setOpenMenuId(null); setOpenCommentMenuId(null); };
    document.addEventListener("click", handleClickOutside);
    return () => document.removeEventListener("click", handleClickOutside);
  }, []);

  const loadMoreRef = useRef(null);

  useEffect(() => {
    fetch("/api/auth/me")
      .then((res) => { if (res.ok) return res.json(); })
      .then((data) => {
        if (!data) { setLoading(false); return; }
        setUser(data.user);
        setLoading(false);
        if (data.user) {
          loadFeed();
          loadUsers();
          loadFollowers();
          loadFollowRequests();
          loadConnectionDegrees();
          if (initialProfileId.current) {
            loadUserProfile(initialProfileId.current, true);
            initialProfileId.current = null;
          }
        }
      })
      .catch(() => { setLoading(false); });
  }, []);

  useEffect(() => {
    if (!user) return;
    const proto = window.location.protocol === "https:" ? "wss:" : "ws:";
    const ws = new WebSocket(`${proto}//${window.location.host}/ws?userId=${user.id}`);
    ws.onmessage = (e) => {
      const msg = JSON.parse(e.data);
      if (msg.type === "follow-request") loadFollowRequests();
      if (msg.type === "follow-approved" || msg.type === "follow-rejected") { loadUsers(); loadFollowers(); }
      if (msg.type === "feed-update") loadFeed();
    };
    return () => ws.close();
  }, [user]);

  const loadFeed = () => {
    fetch("/api/feed")
      .then((res) => { if (res.ok) return res.json(); })
      .then((data) => { if (data) { setPosts(data.posts); setFeedHasMore(data.hasMore); } })
      .catch(() => {});
  };

  const loadMoreFeed = () => {
    if (feedLoadingMore || !feedHasMore) return;
    setFeedLoadingMore(true);
    fetch(`/api/feed?offset=${posts.length}`)
      .then((res) => { if (res.ok) return res.json(); })
      .then((data) => {
        if (data) {
          setPosts((prev) => [...prev, ...data.posts]);
          setFeedHasMore(data.hasMore);
        }
      })
      .catch(() => {})
      .finally(() => setFeedLoadingMore(false));
  };
  loadMoreRef.current = loadMoreFeed;
  useEffect(() => {
    if (tab !== "feed") return;
    const handleScroll = () => {
      if (window.innerHeight + window.scrollY >= document.body.offsetHeight - 300) {
        loadMoreRef.current();
      }
    };
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, [tab]);

  const loadFollowRequests = () => {
    fetch("/api/follow-requests")
      .then((res) => { if (res.ok) return res.json(); })
      .then((data) => { if (data) setFollowRequests(data.requests); })
      .catch(() => {});
  };

  const loadFollowers = () => {
    fetch("/api/followers")
      .then((res) => { if (res.ok) return res.json(); })
      .then((data) => { if (data) setFollowers(data.followers); })
      .catch(() => {});
  };

  const loadUsers = () => {
    fetch("/api/users")
      .then((res) => { if (res.ok) return res.json(); })
      .then((data) => { if (data) setUsers(data.users); })
      .catch(() => {});
  };

  const loadUserProfile = (userId, skipPush) => {
    profileBackTab.current = tab === "user-profile" ? profileBackTab.current : tab;
    // Seed with data we already have from the users list so the header renders instantly
    const cached = users.find((u) => u.id === userId);
    if (cached) {
      setViewingProfile({
        profile: { id: cached.id, name: cached.name, picture: cached.picture, follow_status: cached.follow_status, follows_you: cached.follows_you, is_following: cached.is_following, post_count: null, followers_count: null, following_count: null },
        posts: [],
        canViewPosts: cached.follow_status === "approved",
        hasMore: false,
      });
      setViewingProfileLoading(false);
    } else {
      setViewingProfileLoading(true);
      setViewingProfile(null);
    }
    if (!skipPush) {
      window.history.pushState({ scrollY: window.scrollY }, "", `/user/${userId}`);
      window.scrollTo(0, 0);
    }
    setTabState("user-profile");
    fetch(`/api/users/${userId}/profile`)
      .then((res) => { if (res.ok) return res.json(); })
      .then((data) => { if (data) setViewingProfile(data); })
      .catch(() => {})
      .finally(() => setViewingProfileLoading(false));
  };

  const loadConnectionDegrees = () => {
    fetch("/api/users/connections")
      .then((res) => { if (res.ok) return res.json(); })
      .then((data) => { if (data) setConnectionDegrees(data.degrees || {}); })
      .catch(() => {});
  };

  // ── Reaction preferences ────────────────────────────────────────────────────
  const loadReactionPrefs = () => {
    fetch("/api/reaction-prefs")
      .then((res) => { if (res.ok) return res.json(); })
      .then((data) => {
        if (data?.prefs) setReactionPrefs(data.prefs);
      })
      .catch(() => {});
  };

  useEffect(() => {
    if (user) loadReactionPrefs();
  }, [user]);

  const saveReactionEmojis = async (context, emojis) => {
    setReactionSaving((prev) => ({ ...prev, [context]: true }));
    const res = await fetch(`/api/reaction-prefs/${context}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ emojis }),
    });
    if (res.ok) {
      const data = await res.json();
      if (data.ok) {
        setReactionPrefs((prev) => ({ ...prev, [context]: data.emojis }));
      }
    }
    setReactionSaving((prev) => ({ ...prev, [context]: false }));
  };

  const addEmojiToContext = (context) => {
    const raw = (emojiInputs[context] || "").trim();
    if (!raw) return;
    // Extract just the first grapheme cluster (emoji)
    const segmenter = typeof Intl !== "undefined" && Intl.Segmenter
      ? new Intl.Segmenter()
      : null;
    const emoji = segmenter
      ? [...segmenter.segment(raw)].map((s) => s.segment)[0]
      : [...raw][0];
    if (!emoji) return;

    const currentSet = reactionPrefs
      ? (reactionPrefs[context] ?? (context === "global" ? DEFAULT_REACTION_EMOJIS : getReactionEmojis("global")))
      : DEFAULT_REACTION_EMOJIS;

    if (currentSet.includes(emoji)) {
      setEmojiInputs((prev) => ({ ...prev, [context]: "" }));
      return;
    }
    const newSet = [...currentSet, emoji].slice(0, 12);
    setEmojiInputs((prev) => ({ ...prev, [context]: "" }));
    saveReactionEmojis(context, newSet);
  };

  const removeEmojiFromContext = (context, emoji) => {
    const currentSet = reactionPrefs
      ? (reactionPrefs[context] ?? (context === "global" ? DEFAULT_REACTION_EMOJIS : getReactionEmojis("global")))
      : DEFAULT_REACTION_EMOJIS;
    const newSet = currentSet.filter((e) => e !== emoji);
    saveReactionEmojis(context, newSet.length > 0 ? newSet : null);
  };

  const moveEmojiInContext = (context, fromIndex, toIndex) => {
    const currentSet = reactionPrefs
      ? (reactionPrefs[context] ?? (context === "global" ? DEFAULT_REACTION_EMOJIS : getReactionEmojis("global")))
      : DEFAULT_REACTION_EMOJIS;
    const newSet = [...currentSet];
    const [item] = newSet.splice(fromIndex, 1);
    newSet.splice(toIndex, 0, item);
    saveReactionEmojis(context, newSet);
  };

  const resetContextToInherited = (context) => {
    saveReactionEmojis(context, null);
  };

  const replaceEmojiInSlot = (context, index, raw) => {
    const segmenter = typeof Intl !== "undefined" && Intl.Segmenter ? new Intl.Segmenter() : null;
    const emoji = segmenter ? [...segmenter.segment(raw)].map((s) => s.segment)[0] : [...raw][0];
    if (!emoji) return;
    const currentSet = [...getReactionEmojis(context)];
    currentSet[index] = emoji;
    saveReactionEmojis(context, currentSet);
    setEditingEmojiSlot(null);
  };

  const addEmojiSlot = (context) => {
    const currentSet = [...getReactionEmojis(context)];
    if (currentSet.length >= 12) return;
    currentSet.push("⭐");
    saveReactionEmojis(context, currentSet);
  };

  const removeEmojiSlot = (context, index) => {
    const currentSet = [...getReactionEmojis(context)];
    if (currentSet.length <= 3) return;
    currentSet.splice(index, 1);
    if (emojiPickerSlot != null && emojiPickerSlot >= currentSet.length) setEmojiPickerSlot(null);
    saveReactionEmojis(context, currentSet);
  };

  // ── Push notifications ──────────────────────────────────────────────────────
  const loadPushPrefs = () => {
    fetch("/api/push/prefs")
      .then((res) => { if (res.ok) return res.json(); })
      .then((data) => { if (data) setPushPrefs(data); })
      .catch(() => {});
  };

  useEffect(() => {
    if (user) loadPushPrefs();
  }, [user]);

  const subscribeToPush = async () => {
    try {
      const reg = await navigator.serviceWorker.register("/sw.js");
      const vapidRes = await fetch("/api/push/vapid-key");
      if (!vapidRes.ok) return;
      const { publicKey } = await vapidRes.json();
      if (!publicKey) return;

      const permission = await Notification.requestPermission();
      if (permission !== "granted") return;

      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(publicKey),
      });
      const json = sub.toJSON();
      await fetch("/api/push/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ endpoint: json.endpoint, keys: json.keys }),
      });
      loadPushPrefs();
    } catch (err) {
      console.error("Push subscribe error:", err);
    }
  };

  const unsubscribeFromPush = async () => {
    try {
      const reg = await navigator.serviceWorker.getRegistration();
      const sub = reg && await reg.pushManager.getSubscription();
      if (sub) {
        await fetch("/api/push/unsubscribe", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ endpoint: sub.endpoint }),
        });
        await sub.unsubscribe();
      } else {
        // No local subscription — still tell server to disable
        await fetch("/api/push/unsubscribe", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({}),
        });
      }
      loadPushPrefs();
    } catch (err) {
      console.error("Push unsubscribe error:", err);
    }
  };

  const updatePushPref = async (key, value) => {
    setPushPrefs((prev) => ({ ...prev, [key]: value }));
    await fetch("/api/push/prefs", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ [key]: value }),
    });
  };
  // ── End push notifications ──────────────────────────────────────────────────

  const searchPlaces = (query) => {
    setLocationQuery(query);
    if (searchTimeout.current) clearTimeout(searchTimeout.current);
    if (!query.trim()) {
      setLocationResults([]);
      return;
    }
    searchTimeout.current = setTimeout(async () => {
      const params = new URLSearchParams({ query });
      if (userLocation) {
        params.set("lat", userLocation.lat);
        params.set("lng", userLocation.lng);
      }
      const res = await fetch(`/api/places/search?${params}`);
      if (!res.ok) return;
      const data = await res.json();
      setLocationResults(data.places || []);
    }, 300);
  };

  const selectLocation = (place) => {
    setSelectedLocation(place);
    setLocationQuery("");
    setLocationResults([]);
    setShowLocationSearch(false);
  };

  const compressImage = (file, maxWidth = 1600, quality = 0.8) =>
    new Promise((resolve) => {
      if (!file.type.startsWith("image/")) return resolve(file);
      const img = new Image();
      img.onload = () => {
        const scale = Math.min(1, maxWidth / img.width);
        const canvas = document.createElement("canvas");
        canvas.width = img.width * scale;
        canvas.height = img.height * scale;
        canvas.getContext("2d").drawImage(img, 0, 0, canvas.width, canvas.height);
        canvas.toBlob((blob) => resolve(new File([blob], file.name, { type: "image/jpeg" })), "image/jpeg", quality);
        URL.revokeObjectURL(img.src);
      };
      img.src = URL.createObjectURL(file);
    });

  const handleMediaSelect = async (e) => {
    const files = Array.from(e.target.files);
    const processed = await Promise.all(files.map((f) => compressImage(f)));
    setMediaFiles((prev) => [...prev, ...processed]);
    const newPreviews = processed.map((file) => ({
      url: URL.createObjectURL(file),
      type: file.type.startsWith("video/") ? "video" : "image",
    }));
    setMediaPreviews((prev) => [...prev, ...newPreviews]);
    e.target.value = "";
  };

  const removeMedia = (index) => {
    URL.revokeObjectURL(mediaPreviews[index].url);
    setMediaFiles((prev) => prev.filter((_, i) => i !== index));
    setMediaPreviews((prev) => prev.filter((_, i) => i !== index));
  };

  const fetchOgPreview = async (text) => {
    const urlMatch = text.match(/(https?:\/\/[^\s]+)/);
    if (!urlMatch) {
      setOgPreview(null);
      ogFetchedUrl.current = null;
      return;
    }
    const url = urlMatch[1];
    if (url === ogFetchedUrl.current) return;
    ogFetchedUrl.current = url;
    setOgLoading(true);
    try {
      const res = await fetch(`/api/og?url=${encodeURIComponent(url)}`);
      if (res.ok) {
        const data = await res.json();
        setOgPreview(data);
      } else {
        setOgPreview(null);
      }
    } catch {
      setOgPreview(null);
    }
    setOgLoading(false);
  };

  const handlePost = async () => {
    if (posting) return;
    if (!compose.trim() && mediaFiles.length === 0 && !selectedLocation) return;
    setPosting(true);
    const formData = new FormData();
    formData.append("content", compose);
    if (selectedLocation) {
      formData.append("place_name", selectedLocation.name);
      formData.append("place_lat", selectedLocation.lat);
      formData.append("place_lng", selectedLocation.lng);
      if (selectedLocation.address) formData.append("place_address", selectedLocation.address);
    }
    for (const file of mediaFiles) {
      formData.append("media", file);
    }
    if (ogPreview) {
      formData.append("og_preview", JSON.stringify(ogPreview));
    }
    await fetch("/api/posts", {
      method: "POST",
      body: formData,
    });
    setCompose("");
    setOgPreview(null);
    ogFetchedUrl.current = null;
    setMentionQuery(null);
    setSelectedLocation(null);
    mediaPreviews.forEach((p) => URL.revokeObjectURL(p.url));
    setMediaFiles([]);
    setMediaPreviews([]);
    setPosting(false);
    loadFeed();
  };

  const handleDelete = async (id) => {
    setOpenMenuId(null);
    startBusy(`delete-${id}`);
    await fetch(`/api/posts/${id}`, { method: "DELETE" });
    setPosts((prev) => prev.filter((p) => p.id !== id));
    setViewingProfile((prev) => prev ? { ...prev, posts: prev.posts.filter((p) => p.id !== id) } : prev);
    endBusy(`delete-${id}`);
  };

  // Helper: update a post in both feed and profile states
  const updatePostInState = (mapper) => {
    setPosts((prev) => prev.map(mapper));
    setViewingProfile((prev) => prev ? { ...prev, posts: prev.posts.map(mapper) } : prev);
  };

  const handleReact = async (postId, emoji) => {
    const res = await fetch(`/api/posts/${postId}/react`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ emoji }),
    });
    if (!res.ok) return;
    const { action, previous } = await res.json();
    updatePostInState((p) => {
      if (p.id !== postId) return p;
      let reactions = [...(p.reactions || [])];

      // Remove user from previous emoji if changing
      if (action === "changed" && previous) {
        const prevIdx = reactions.findIndex((r) => r.emoji === previous);
        if (prevIdx >= 0) {
          const names = reactions[prevIdx].names.filter((n) => n !== user.name);
          if (names.length === 0) reactions.splice(prevIdx, 1);
          else reactions[prevIdx] = { ...reactions[prevIdx], names, user_reacted: 0 };
        }
      }

      if (action === "added" || action === "changed") {
        const idx = reactions.findIndex((r) => r.emoji === emoji);
        if (idx >= 0) {
          reactions[idx] = { ...reactions[idx], names: [...reactions[idx].names, user.name], user_reacted: 1 };
        } else {
          reactions.push({ emoji, names: [user.name], user_reacted: 1 });
        }
      } else if (action === "removed") {
        const idx = reactions.findIndex((r) => r.emoji === emoji);
        if (idx >= 0) {
          const names = reactions[idx].names.filter((n) => n !== user.name);
          if (names.length === 0) reactions.splice(idx, 1);
          else reactions[idx] = { ...reactions[idx], names, user_reacted: 0 };
        }
      }

      return { ...p, reactions };
    });
  };

  const handleCommentReact = async (postId, commentId) => {
    const emoji = getReactionEmojis("posts")[0];
    const res = await fetch(`/api/comments/${commentId}/react`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ emoji }),
    });
    if (!res.ok) return;
    const data = await res.json();
    updatePostInState((p) => {
      if (p.id !== postId) return p;
      return {
        ...p,
        comments: (p.comments || []).map((c) =>
          c.id === commentId ? { ...c, comment_reactions: data.comment_reactions } : c
        ),
      };
    });
  };

  const handleComment = async (postId) => {
    const content = (commentInputs[postId] || "").trim();
    if (!content) return;
    startBusy(`comment-${postId}`);
    const res = await fetch(`/api/posts/${postId}/comments`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content }),
    });
    if (!res.ok) { endBusy(`comment-${postId}`); return; }
    const comment = await res.json();
    updatePostInState((p) =>
      p.id === postId ? { ...p, comments: [...(p.comments || []), comment] } : p
    );
    setCommentInputs((prev) => ({ ...prev, [postId]: "" }));
    if (commentRefs.current[postId]) commentRefs.current[postId].style.height = "auto";
    setMentionQuery(null);
    endBusy(`comment-${postId}`);
  };

  const handleDeleteComment = async (commentId, postId) => {
    setOpenCommentMenuId(null);
    await fetch(`/api/comments/${commentId}`, { method: "DELETE" });
    updatePostInState((p) =>
      p.id === postId ? { ...p, comments: p.comments.filter((c) => c.id !== commentId) } : p
    );
  };

  const handleEditComment = async (commentId, postId) => {
    const content = editCommentText.trim();
    if (!content) return;
    startBusy(`edit-comment-${commentId}`);
    await fetch(`/api/comments/${commentId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content }),
    });
    updatePostInState((p) =>
      p.id === postId
        ? { ...p, comments: p.comments.map((c) => (c.id === commentId ? { ...c, content } : c)) }
        : p
    );
    endBusy(`edit-comment-${commentId}`);
    setEditingComment(null);
    setEditCommentText("");
  };

  const handleFollow = async (id, followStatus) => {
    const key = `follow-${id}`;
    startBusy(key);
    if (followStatus === "approved" || followStatus === "pending") {
      await fetch(`/api/unfollow/${id}`, { method: "POST" });
      setUsers((prev) =>
        prev.map((u) => (u.id === id ? { ...u, is_following: 0, follow_status: null } : u))
      );
      setFollowers((prev) =>
        prev.map((u) => (u.id === id ? { ...u, is_following: 0, follow_status: null } : u))
      );
    } else {
      await fetch(`/api/follow/${id}`, { method: "POST" });
      setUsers((prev) =>
        prev.map((u) => (u.id === id ? { ...u, is_following: 0, follow_status: "pending" } : u))
      );
    }
    endBusy(key);
    loadFeed();
    loadUsers();
    loadFollowRequests();
  };

  const handleApproveFollow = async (id) => {
    startBusy(`approve-${id}`);
    await fetch(`/api/follow-requests/${id}/approve`, { method: "POST" });
    setFollowRequests((prev) => prev.map((r) => (r.id === id ? { ...r, approved: true } : r)));
    endBusy(`approve-${id}`);
    loadFollowers();
    loadUsers();
    loadFeed();
  };

  const handleRejectFollow = async (id) => {
    startBusy(`reject-${id}`);
    await fetch(`/api/follow-requests/${id}/reject`, { method: "POST" });
    setFollowRequests((prev) => prev.filter((r) => r.id !== id));
    endBusy(`reject-${id}`);
  };

  const handleLogout = async () => {
    startBusy("logout");
    await fetch("/api/auth/logout", { method: "POST" });
    setUser(null);
    setUsers([]);
    setPosts([]);
  };

  const renderPostCard = (post, { disableProfileLink } = {}) => (
    <PostItemWithReaction
      key={post.id}
      post={post}
      getReactionEmojis={getReactionEmojis}
      onReact={handleReact}
      renderContent={(postReactProps) => (
        <PostItem data-post-id={post.id} {...postReactProps}>
          <PostHeader onTouchStart={e => e.stopPropagation()} onTouchMove={e => e.stopPropagation()} onTouchEnd={e => e.stopPropagation()} onDoubleClick={e => e.stopPropagation()}>
            <Avatar src={post.author_picture} alt={post.author_name} onClick={disableProfileLink ? undefined : () => post.user_id === user.id ? setTab("profile") : loadUserProfile(post.user_id)} style={disableProfileLink ? undefined : { cursor: "pointer" }} />
            <PostHeaderText onClick={disableProfileLink ? undefined : () => post.user_id === user.id ? setTab("profile") : loadUserProfile(post.user_id)} style={disableProfileLink ? undefined : { cursor: "pointer" }}>
              <PostAuthor>{post.author_name}</PostAuthor>
              <PostTime>{timeAgo(post.created_at)}</PostTime>
            </PostHeaderText>
            {post.user_id === user.id && (
              <PostHeaderRight>
                <PostMenuWrapper>
                  <PostMenuButton onClick={(e) => {
                    e.stopPropagation();
                    setOpenMenuId(openMenuId === post.id ? null : post.id);
                  }}>
                    <i className="fa-solid fa-ellipsis-vertical" />
                  </PostMenuButton>
                  {openMenuId === post.id && (
                    <PostMenu onClick={(e) => e.stopPropagation()}>
                      <PostMenuItem $danger onClick={() => handleDelete(post.id)}>
                        <i className="fa-solid fa-trash" /> Delete
                      </PostMenuItem>
                    </PostMenu>
                  )}
                </PostMenuWrapper>
              </PostHeaderRight>
            )}
          </PostHeader>
          {post.content && <PostContent>{renderText(post.content)}</PostContent>}
          {post.og_preview && (
            <LinkPreviewCard href={post.og_preview.url} target="_blank" rel="noopener noreferrer">
              {post.og_preview.image && <LinkPreviewImage src={post.og_preview.image} />}
              <LinkPreviewBody>
                {post.og_preview.siteName && <LinkPreviewSite>{post.og_preview.siteName}</LinkPreviewSite>}
                {post.og_preview.title && <LinkPreviewTitle>{post.og_preview.title}</LinkPreviewTitle>}
                {post.og_preview.description && <LinkPreviewDesc>{post.og_preview.description}</LinkPreviewDesc>}
              </LinkPreviewBody>
            </LinkPreviewCard>
          )}
          {post.media && post.media.length > 0 && (
            <PostMediaContainer $count={post.media.length}>
              {post.media.map((m, i) =>
                m.type === "video" ? (
                  <PostVideo key={i} src={m.url} autoPlay loop muted playsInline $single={post.media.length === 1} />
                ) : (
                  <PostImage
                    key={i}
                    src={m.url}
                    $single={post.media.length === 1}
                    $tappable={post.media.length > 1}
                    onClick={post.media.length > 1 ? () => {
                      const el = document.querySelector(`[data-post-id="${post.id}"]`);
                      if (el && el._touchHandled) return;
                      const url = m.url;
                      const timer = setTimeout(() => setLightboxSrc(url), 300);
                      if (el) { if (el._lightboxTimer) clearTimeout(el._lightboxTimer); el._lightboxTimer = timer; }
                    } : undefined}
                  />
                )
              )}
            </PostMediaContainer>
          )}
          {post.place_name && post.place_lat && (
            <PostLocation>
              <PostMapWrapper>
                <PostMap src={`/api/staticmap?lat=${post.place_lat}&lng=${post.place_lng}&v=4`} alt={post.place_name} />
              </PostMapWrapper>
              <PostPlaceName>
                <span>{post.place_name}</span>
                {post.place_address && <PostPlaceAddress>{shortAddress(post.place_address)}</PostPlaceAddress>}
              </PostPlaceName>
            </PostLocation>
          )}
          {(post.reactions || []).length > 0 && (
            <ReactionsRow onTouchStart={e => e.stopPropagation()} onTouchMove={e => e.stopPropagation()} onTouchEnd={e => e.stopPropagation()} onDoubleClick={e => e.stopPropagation()}>
              {(post.reactions || []).map((r) => (
                <ReactionChip key={r.emoji} $active={r.user_reacted} onClick={() => handleReact(post.id, r.emoji)}>
                  <span style={{ width: 24, textAlign: "center", flexShrink: 0 }}>{r.emoji}</span> <ReactionNames>{(r.names || []).join(", ")}</ReactionNames>
                </ReactionChip>
              ))}
            </ReactionsRow>
          )}
          {emojiPickerPostId === post.id ? (
            <>
              <ReactionsRow onTouchStart={e => e.stopPropagation()} onTouchMove={e => e.stopPropagation()} onTouchEnd={e => e.stopPropagation()} onDoubleClick={e => e.stopPropagation()}>
                {getReactionEmojis("global").map((emoji, i) => (
                  <div key={emoji + i} style={{ position: "relative" }}>
                    <EmojiOption
                      onClick={() => setEmojiPickerSlot(emojiPickerSlot === i ? null : i)}
                      style={{ width: 44, height: 44, fontSize: 24, paddingBottom: 2, background: "transparent", border: emojiPickerSlot === i ? `2px solid ${resolvedTheme.btnPrimary}` : `2px dashed ${resolvedTheme.border}`, borderRadius: RADIUS_SM, opacity: 1 }}
                    >{emoji}</EmojiOption>
                    {getReactionEmojis("global").length > 3 && (
                      <EmojiEditButton onClick={() => removeEmojiSlot("global", i)} style={{ position: "absolute", top: -8, right: -8, width: 20, height: 20, fontSize: 10, background: resolvedTheme.bgElevated, border: `2px solid ${resolvedTheme.border}`, borderRadius: "50%" }}>
                        <i className="fa-solid fa-minus" />
                      </EmojiEditButton>
                    )}
                  </div>
                ))}
                {getReactionEmojis("global").length < 12 && (
                  <EmojiEditButton
                    onClick={() => { const currentSet = [...getReactionEmojis("global")]; if (currentSet.length >= 12) return; const newIndex = currentSet.length; const pool = ["⭐","🎉","💪","🙌","💯","✨","🎶","🌈","☀️","🍕","🌊","🧡","💜","💚","🤩","😎","🥳","🫡","🤝","👀","💡","🌟","🍀","🦋","🐶","🎯","🚀","⚡","🪴","🧸","🎨","🏆","🎸","🌸","🍩","🧁","☕","🫶","🤙","👏","🙏","💎","🔮","🎪","🌻","🐱","🦊","🐻","🌮","🍦","🎲","🛹","🏄","⛷️","🎭","🪩","🫧","🌙","🦄","🐝","🍉","🥑","🧊","🎹","🪻","🌺","🫰","🤟","✌️","🤘","💫","🥂","🍿","☁️","🌴","🦩","🐚","🪸","🎠","🧲"]; currentSet.push(pool[Math.floor(Math.random() * pool.length)]); saveReactionEmojis("global", currentSet); setEmojiPickerSlot(newIndex); }}
                    style={{ width: 44, height: 44, fontSize: 16, background: "transparent", border: `2px dashed ${resolvedTheme.border}`, borderRadius: RADIUS_SM, color: resolvedTheme.textSecondary }}
                  ><i className="fa-solid fa-plus" /></EmojiEditButton>
                )}
                <EmojiEditButton onClick={() => { setEmojiPickerPostId(null); setEmojiPickerSlot(null); }}><i className="fa-solid fa-check" /></EmojiEditButton>
              </ReactionsRow>
              {emojiPickerSlot != null && (
                <EmojiPickerWrap>
                  <Picker data={data} dynamicWidth={true} theme={resolvedTheme === darkTheme ? "dark" : "light"} previewPosition="none" maxFrequentRows={0} emojiSize={32} emojiButtonSize={48} emojiButtonRadius="0.5rem" searchPosition="static" onEmojiSelect={(e) => { replaceEmojiInSlot("global", emojiPickerSlot, e.native); }} />
                </EmojiPickerWrap>
              )}
            </>
          ) : (
            <>
              <ReactionsRow onTouchStart={e => e.stopPropagation()} onTouchMove={e => e.stopPropagation()} onTouchEnd={e => e.stopPropagation()} onDoubleClick={e => e.stopPropagation()}>
                {(() => {
                  const hasAnyReaction = (post.reactions || []).some((r) => r.user_reacted);
                  return getReactionEmojis("posts").map((emoji) => {
                    const userReacted = (post.reactions || []).some((r) => r.emoji === emoji && r.user_reacted);
                    return <EmojiOption key={emoji} $dimmed={hasAnyReaction && !userReacted} onClick={() => handleReact(post.id, emoji)}>{emoji}</EmojiOption>;
                  });
                })()}
                <QuickReactButton title="React with any emoji" onClick={(e) => { e.stopPropagation(); setQuickReactPickerPostId(quickReactPickerPostId === post.id ? null : post.id); }}>
                  <i className="fa-regular fa-face-smile" />
                </QuickReactButton>
                <EmojiEditButton onClick={() => { setEmojiPickerPostId(post.id); setEmojiPickerSlot(null); setQuickReactPickerPostId(null); }}>
                  <i className="fa-solid fa-pen" />
                </EmojiEditButton>
              </ReactionsRow>
              {quickReactPickerPostId === post.id && (
                <EmojiPickerWrap>
                  <Picker data={data} dynamicWidth={true} theme={resolvedTheme === darkTheme ? "dark" : "light"} previewPosition="none" maxFrequentRows={1} emojiSize={32} emojiButtonSize={48} emojiButtonRadius="0.5rem" searchPosition="static" onEmojiSelect={(e) => { handleReact(post.id, e.native); setQuickReactPickerPostId(null); }} onClickOutside={() => setQuickReactPickerPostId(null)} />
                </EmojiPickerWrap>
              )}
            </>
          )}
          <CommentsSection>
            {post.comments && post.comments.length > 0 && (
              <>
                {post.comments.map((c) => (
                  <CommentRowWithReaction key={c.id} postId={post.id} commentId={c.id} onReact={handleCommentReact}
                    renderContent={(commentReactProps) => (
                      <CommentRow {...commentReactProps}>
                        <CommentAvatar src={c.author_picture} alt={c.author_name} onClick={(e) => { e.stopPropagation(); loadUserProfile(c.user_id); }} style={{ cursor: "pointer" }} />
                        <CommentBody>
                          <CommentAuthor onClick={(e) => { e.stopPropagation(); loadUserProfile(c.user_id); }} style={{ cursor: "pointer" }}>{c.author_name}</CommentAuthor>
                          {editingComment === c.id ? (
                            <CommentInputRow>
                              <CommentInput value={editCommentText} onChange={(e) => setEditCommentText(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") handleEditComment(c.id, post.id); if (e.key === "Escape") { setEditingComment(null); setEditCommentText(""); } }} autoFocus style={{ color: resolvedTheme.text }} />
                              <CommentPostButton onClick={() => handleEditComment(c.id, post.id)} disabled={isBusy(`edit-comment-${c.id}`)}>
                                {isBusy(`edit-comment-${c.id}`) ? <Spinner /> : <i className="fa-solid fa-check" />}
                              </CommentPostButton>
                            </CommentInputRow>
                          ) : (
                            <>
                              <CommentText style={c.content === "thinking..." ? { color: "#999" } : undefined}>
                                {c.content === "thinking..." ? c.content : renderText(c.content)}
                              </CommentText>
                              {c.content !== "thinking..." && <CommentTime>{timeAgo(c.created_at)}</CommentTime>}
                              {c.comment_reactions && c.comment_reactions.length > 0 && (
                                <CommentTime onTouchStart={e => e.stopPropagation()} onTouchMove={e => e.stopPropagation()} onTouchEnd={e => e.stopPropagation()} onDoubleClick={e => e.stopPropagation()} style={{ display: "flex", gap: 12, marginTop: 4, marginLeft: 0, flexWrap: "wrap" }}>
                                  {c.comment_reactions.map((r) => (
                                    <span key={r.emoji} style={r.user_reacted ? { cursor: "pointer" } : undefined}
                                      onClick={r.user_reacted ? () => { if (commentReactionPicker?.commentId === c.id) { setCommentReactionPicker(null); } else { setTimeout(() => setCommentReactionPicker({ postId: post.id, commentId: c.id }), 0); } } : undefined}
                                    >{r.emoji}&ensp;<span style={{ fontWeight: 600, color: resolvedTheme.text }}>{r.names.join(", ")}</span></span>
                                  ))}
                                </CommentTime>
                              )}
                              {commentReactionPicker?.commentId === c.id && (
                                <EmojiPickerWrap>
                                  <Picker data={data} dynamicWidth={true} theme={resolvedTheme === darkTheme ? "dark" : "light"} previewPosition="none" maxFrequentRows={0} emojiSize={32} emojiButtonSize={48} emojiButtonRadius="0.5rem" searchPosition="static"
                                    onEmojiSelect={async (e) => {
                                      const res = await fetch(`/api/comments/${c.id}/react`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ emoji: e.native }) });
                                      if (res.ok) { const d = await res.json(); updatePostInState((p) => p.id !== post.id ? p : { ...p, comments: (p.comments || []).map((cm) => cm.id === c.id ? { ...cm, comment_reactions: d.comment_reactions } : cm) }); }
                                      setCommentReactionPicker(null);
                                    }}
                                    onClickOutside={() => setCommentReactionPicker(null)}
                                  />
                                </EmojiPickerWrap>
                              )}
                            </>
                          )}
                        </CommentBody>
                        {(c.user_id === user.id || (c.author_name === "Sol" && user.email === "leo@leomancinidesign.com")) && editingComment !== c.id && (
                          <PostMenuWrapper>
                            <PostMenuButton onClick={(e) => { e.stopPropagation(); setOpenCommentMenuId(openCommentMenuId === c.id ? null : c.id); }}>
                              <i className="fa-solid fa-ellipsis-vertical" />
                            </PostMenuButton>
                            {openCommentMenuId === c.id && (
                              <PostMenu onClick={(e) => e.stopPropagation()}>
                                {c.user_id === user.id && (
                                  <PostMenuItem onClick={() => { setOpenCommentMenuId(null); setEditingComment(c.id); setEditCommentText(c.content); }}>
                                    <i className="fa-solid fa-pen" /> Edit
                                  </PostMenuItem>
                                )}
                                <PostMenuItem $danger onClick={() => handleDeleteComment(c.id, post.id)}>
                                  <i className="fa-solid fa-trash" /> Delete
                                </PostMenuItem>
                              </PostMenu>
                            )}
                          </PostMenuWrapper>
                        )}
                      </CommentRow>
                    )}
                  />
                ))}
              </>
            )}
            <div style={{ position: "relative" }}>
              <CommentInputRow>
                <CommentInputWrapper>
                  <CommentHighlight>{renderHighlight(commentInputs[post.id] || "")}</CommentHighlight>
                  <CommentInput
                    ref={(el) => (commentRefs.current[post.id] = el)}
                    placeholder="Add a comment..."
                    rows={1}
                    value={commentInputs[post.id] || ""}
                    onFocus={(e) => { e.target.style.height = e.target.scrollHeight + "px"; }}
                    onChange={(e) => { setCommentInputs((prev) => ({ ...prev, [post.id]: e.target.value })); handleMentionInput(e.target.value, post.id); e.target.style.height = "auto"; e.target.style.height = e.target.scrollHeight + "px"; }}
                    onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleComment(post.id); } }}
                  />
                </CommentInputWrapper>
                {(commentInputs[post.id] || "").trim() && (
                  <CommentPostButton onClick={() => handleComment(post.id)} disabled={isBusy(`comment-${post.id}`)}>
                    {isBusy(`comment-${post.id}`) ? <Spinner /> : <i className="fa-solid fa-arrow-up" />}
                  </CommentPostButton>
                )}
              </CommentInputRow>
              {mentionQuery && mentionQuery.field === post.id && (() => {
                const threadUserIds = new Set([post.user_id, ...(post.comments || []).map((c) => c.user_id)]);
                threadUserIds.delete(user.id);
                const filtered = mentionUsers.filter((u) => u.name.toLowerCase().includes(mentionQuery.query));
                if (!filtered.length) return null;
                const sorted = [...filtered].sort((a, b) => (threadUserIds.has(a.id) ? 0 : 1) - (threadUserIds.has(b.id) ? 0 : 1));
                return (
                  <MentionDropdown>
                    {sorted.map((u) => (
                      <MentionOption key={u.id} onMouseDown={(e) => { e.preventDefault(); insertMention(u.name, post.id); }} onTouchEnd={(e) => { e.preventDefault(); insertMention(u.name, post.id); }}>
                        <MentionAvatar src={u.picture} /> {u.name}
                      </MentionOption>
                    ))}
                  </MentionDropdown>
                );
              })()}
            </div>
          </CommentsSection>
        </PostItem>
      )}
    />
  );

  if (loading) return null;

  if (!user) {
    return (
      <ThemePrefContext.Provider value={{ preference: themePref, setPreference: updateThemePref }}>
        <ThemeProvider theme={resolvedTheme}>
          <GlobalStyle />
          <Page>
            <LoginCard>
              <Title>Cloud</Title>
              <Subtitle>Share your day</Subtitle>
              <SignInButton href="/api/auth/google">Log in with Google</SignInButton>
            </LoginCard>
          </Page>
        </ThemeProvider>
      </ThemePrefContext.Provider>
    );
  }

  return (
    <ThemePrefContext.Provider value={{ preference: themePref, setPreference: updateThemePref }}>
      <ThemeProvider theme={resolvedTheme}>
        <GlobalStyle />
        <Page>
      {lightboxSrc && <PhotoLightbox src={lightboxSrc} onClose={() => setLightboxSrc(null)} />}
      <Header>
        {tab === "profile" || tab === "user-profile" ? (
          <BackButton onClick={() => setTab(tab === "user-profile" ? profileBackTab.current : "feed")}><i className="fa-solid fa-arrow-left" /> Back</BackButton>
        ) : (
          <>
            <HeaderProfile onClick={() => setTab("profile")}>
              <SmallAvatar src={user.picture} alt={user.name} />
              <HeaderName>{user.name}</HeaderName>
            </HeaderProfile>
            <SegmentedControl>
              <Segment $active={tab === "feed"} onClick={() => setTab("feed")} style={{ padding: "6px 24px" }}>
                Feed
              </Segment>
              <Segment $active={tab === "people"} onClick={() => { setTab("people"); loadUsers(); loadFollowRequests(); loadFollowers(); loadConnectionDegrees(); }} style={{ padding: "6px 24px" }}>
                People
              </Segment>
            </SegmentedControl>
          </>
        )}
      </Header>
      <Content>
        {isMobile && !isStandalone && !installBannerDismissed && tab === "feed" && (
          <Banner>
            <BannerText>Add Cloud to your home screen to turn on push notifications</BannerText>
            <BannerDismiss onClick={() => { setInstallBannerDismissed(true); localStorage.setItem("install-banner-dismissed", "true"); }}>
              <i className="fa-solid fa-xmark" />
            </BannerDismiss>
          </Banner>
        )}
        {isMobile && isStandalone && !notifBannerDismissed && pushSupported && pushPrefs && !pushPrefs.enabled && tab === "feed" && (
          <Banner>
            <BannerText>Turn on notifications</BannerText>
            <BannerButton onClick={subscribeToPush}>Enable</BannerButton>
            <BannerDismiss onClick={() => { setNotifBannerDismissed(true); localStorage.setItem("notif-banner-dismissed", "true"); }}>
              <i className="fa-solid fa-xmark" />
            </BannerDismiss>
          </Banner>
        )}
        {tab === "profile" ? (
          <ProfilePage>
            <ProfileAvatar src={user.picture} alt={user.name} />
            {editingName !== null ? (
              <form onSubmit={(e) => {
                e.preventDefault();
                const trimmed = editingName.trim();
                fetch("/api/profile/name", {
                  method: "PUT",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ display_name: trimmed || null }),
                })
                  .then((res) => { if (res.ok) return res.json(); })
                  .then((data) => {
                    if (data) { setUser((u) => ({ ...u, name: data.name, display_name: data.display_name })); loadFeed(); }
                  })
                  .catch(() => {});
                setEditingName(null);
              }} style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, marginBottom: 4 }}>
                <input
                  autoFocus
                  value={editingName}
                  onChange={(e) => setEditingName(e.target.value)}
                  placeholder={user.google_name || user.name}
                  style={{
                    fontSize: 22, fontWeight: 700, textAlign: "center", border: `2px solid ${resolvedTheme.border}`,
                    borderRadius: RADIUS, padding: "6px 12px", outline: "none", background: resolvedTheme.bgInput,
                    color: resolvedTheme.text, fontFamily: "inherit", width: 200,
                  }}
                />
                <CommentPostButton type="submit" style={{ width: 36, height: 36 }}>
                  <i className="fa-solid fa-check" />
                </CommentPostButton>
              </form>
            ) : (
              <ProfileName onClick={() => setEditingName(user.display_name || "")} style={{ cursor: "pointer" }}>
                {user.name} <i className="fa-solid fa-pen" style={{ fontSize: 14, color: resolvedTheme.textSecondary, marginLeft: 4 }} />
              </ProfileName>
            )}
            <ProfileEmail>{user.email}</ProfileEmail>
            <ThemeToggleWrap>
              <ThemeToggleLabel>Appearance</ThemeToggleLabel>
              <ThemeToggle>
                <ThemeSegment $active={themePref === "system"} onClick={() => updateThemePref("system")}>System</ThemeSegment>
                <ThemeSegment $active={themePref === "light"} onClick={() => updateThemePref("light")}>Light</ThemeSegment>
                <ThemeSegment $active={themePref === "dark"} onClick={() => updateThemePref("dark")}>Dark</ThemeSegment>
              </ThemeToggle>
            </ThemeToggleWrap>
            {pushPrefs && (
              <PushSection>
                <ThemeToggleLabel>Push Notifications</ThemeToggleLabel>
                <PushRow onClick={(e) => { e.preventDefault(); pushPrefs.enabled ? unsubscribeFromPush() : subscribeToPush(); }}>
                  <PushRowLabel>Enable notifications</PushRowLabel>
                  <ToggleTrack $on={pushPrefs.enabled}><ToggleThumb $on={pushPrefs.enabled} /></ToggleTrack>
                </PushRow>
                {pushPrefs.enabled && (
                  <>
                    <PushRow onClick={(e) => { e.preventDefault(); updatePushPref("new_posts", !pushPrefs.new_posts); }}>
                      <PushRowLabel>New posts from friends</PushRowLabel>
                      <ToggleTrack $on={pushPrefs.new_posts}><ToggleThumb $on={pushPrefs.new_posts} /></ToggleTrack>
                    </PushRow>
                    <PushRow onClick={(e) => { e.preventDefault(); updatePushPref("mentions", !pushPrefs.mentions); }}>
                      <PushRowLabel>Mentions</PushRowLabel>
                      <ToggleTrack $on={pushPrefs.mentions}><ToggleThumb $on={pushPrefs.mentions} /></ToggleTrack>
                    </PushRow>
                    <PushRow onClick={(e) => { e.preventDefault(); updatePushPref("reactions", !pushPrefs.reactions); }}>
                      <PushRowLabel>Reactions</PushRowLabel>
                      <ToggleTrack $on={pushPrefs.reactions}><ToggleThumb $on={pushPrefs.reactions} /></ToggleTrack>
                    </PushRow>
                    <PushRow onClick={(e) => { e.preventDefault(); updatePushPref("comments", !pushPrefs.comments); }}>
                      <PushRowLabel>Comments</PushRowLabel>
                      <ToggleTrack $on={pushPrefs.comments}><ToggleThumb $on={pushPrefs.comments} /></ToggleTrack>
                    </PushRow>
                    <PushRow onClick={(e) => { e.preventDefault(); updatePushPref("replies", !pushPrefs.replies); }}>
                      <PushRowLabel>Replies</PushRowLabel>
                      <ToggleTrack $on={pushPrefs.replies}><ToggleThumb $on={pushPrefs.replies} /></ToggleTrack>
                    </PushRow>
                  </>
                )}
              </PushSection>
            )}
            <LogoutButton onClick={handleLogout} disabled={isBusy("logout")}>{isBusy("logout") ? <Spinner /> : "Log out"}</LogoutButton>
          </ProfilePage>
        ) : tab === "feed" ? (
          <>
            <ComposeBox>
              <ComposeWrapper>
                <ComposeHighlight ref={composeHighlightRef}>{renderHighlight(compose)}</ComposeHighlight>
                <ComposeInput
                  ref={composeRef}
                  rows={3}
                  placeholder="What's on your mind?"
                  value={compose}
                  onChange={(e) => { setCompose(e.target.value); handleMentionInput(e.target.value, "compose"); fetchOgPreview(e.target.value); }}
                  onScroll={(e) => { if (composeHighlightRef.current) composeHighlightRef.current.scrollTop = e.target.scrollTop; }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && e.metaKey) handlePost();
                  }}
                />
                {mentionQuery && mentionQuery.field === "compose" && (() => {
                  const filtered = mentionUsers.filter((u) => u.name.toLowerCase().includes(mentionQuery.query));
                  if (!filtered.length) return null;
                  return (
                    <MentionDropdown>
                      {filtered.map((u) => (
                        <MentionOption key={u.id} onMouseDown={(e) => { e.preventDefault(); insertMention(u.name, "compose"); }} onTouchEnd={(e) => { e.preventDefault(); insertMention(u.name, "compose"); }}>
                          <MentionAvatar src={u.picture} /> {u.name}
                        </MentionOption>
                      ))}
                    </MentionDropdown>
                  );
                })()}
              </ComposeWrapper>
              {mediaPreviews.length > 0 && (
                <PostMediaContainer $count={mediaPreviews.length} style={{ marginTop: 8 }}>
                  {mediaPreviews.map((preview, i) => (
                    <MediaPreview key={i}>
                      {preview.type === "video" ? (
                        <PostVideo src={preview.url} muted $single={mediaPreviews.length === 1} />
                      ) : (
                        <PostImage src={preview.url} $single={mediaPreviews.length === 1} />
                      )}
                      <RemoveMedia onClick={() => removeMedia(i)}><i className="fa-solid fa-xmark" /></RemoveMedia>
                    </MediaPreview>
                  ))}
                </PostMediaContainer>
              )}
              {selectedLocation && (
                <PostLocation style={{ position: "relative" }}>
                  <PostMapWrapper>
                    <PostMap
                      src={`/api/staticmap?lat=${selectedLocation.lat}&lng=${selectedLocation.lng}&v=4`}
                      alt={selectedLocation.name}
                    />
                  </PostMapWrapper>
                  <PostPlaceName>
                    <span>{selectedLocation.name}</span>
                    {selectedLocation.address && <PostPlaceAddress>{shortAddress(selectedLocation.address)}</PostPlaceAddress>}
                  </PostPlaceName>
                  <RemoveLocation onClick={() => setSelectedLocation(null)}>
                    <i className="fa-solid fa-xmark" />
                  </RemoveLocation>
                </PostLocation>
              )}
              {showLocationSearch && !selectedLocation && (
                <LocationSearch>
                  <LocationInput
                    placeholder="Search for a place..."
                    value={locationQuery}
                    onChange={(e) => searchPlaces(e.target.value)}
                    autoFocus
                  />
                  {locationResults.length > 0 && (
                    <LocationResults>
                      {locationResults.map((place, i) => (
                        <LocationResult key={i} onClick={() => selectLocation(place)}>
                          <LocationName>{place.name}</LocationName>
                          <LocationAddress>{place.address}</LocationAddress>
                        </LocationResult>
                      ))}
                    </LocationResults>
                  )}
                </LocationSearch>
              )}
              {ogPreview && (
                <LinkPreviewCard as="div" style={{ cursor: "default", position: "relative" }}>
                  {ogPreview.image && <LinkPreviewImage src={ogPreview.image} />}
                  <LinkPreviewBody>
                    {ogPreview.siteName && <LinkPreviewSite>{ogPreview.siteName}</LinkPreviewSite>}
                    {ogPreview.title && <LinkPreviewTitle>{ogPreview.title}</LinkPreviewTitle>}
                    {ogPreview.description && <LinkPreviewDesc>{ogPreview.description}</LinkPreviewDesc>}
                  </LinkPreviewBody>
                  <EmojiEditButton onClick={() => { setOgPreview(null); ogFetchedUrl.current = "dismissed"; }} style={{ position: "absolute", top: 8, right: 8, background: resolvedTheme.bgElevated, border: `2px solid ${resolvedTheme.border}`, borderRadius: "50%", width: 24, height: 24 }}>
                    <i className="fa-solid fa-xmark" />
                  </EmojiEditButton>
                </LinkPreviewCard>
              )}
              {ogLoading && <CommentTime style={{ marginTop: 8 }}>Loading preview...</CommentTime>}
              <HiddenFileInput
                ref={fileInputRef}
                type="file"
                accept="image/*,video/*"
                multiple
                onChange={handleMediaSelect}
              />
              <ComposeActions>
                <ComposeActionsLeft>
                  <IconButton
                    $active={mediaFiles.length > 0}
                    onClick={() => fileInputRef.current?.click()}
                  >
                    <i className="fa-solid fa-image" />
                  </IconButton>
                  <IconButton
                    $active={showLocationSearch || selectedLocation}
                    onClick={() => {
                      if (selectedLocation) {
                        setSelectedLocation(null);
                      } else {
                        if (!showLocationSearch && !userLocation && navigator.geolocation) {
                          navigator.geolocation.getCurrentPosition(
                            (pos) => setUserLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
                            () => {}
                          );
                        }
                        setShowLocationSearch(!showLocationSearch);
                      }
                      setLocationQuery("");
                      setLocationResults([]);
                    }}
                  >
                    <i className="fa-solid fa-location-dot" />
                  </IconButton>
                </ComposeActionsLeft>
                <PostButton
                  onClick={handlePost}
                  disabled={posting || (!compose.trim() && mediaFiles.length === 0 && !selectedLocation)}
                >
                  {posting ? <i className="fa-solid fa-circle-notch fa-spin" /> : "Post"}
                </PostButton>
              </ComposeActions>
            </ComposeBox>
            {followRequests.length > 0 && (
              <SuggestionsBox>
                <SectionTitle>Follow requests</SectionTitle>
                {followRequests.map((r) => (
                  <UserRow key={r.id}>
                    <UserInfo>
                      <UserAvatar src={r.picture} alt={r.name} />
                      <UserName>{r.name}</UserName>
                    </UserInfo>
                    {r.approved ? (
                      <FollowBtn
                        user={users.find((u) => u.id === r.id) || { id: r.id, follows_you: true }}
                        onFollow={handleFollow}
                        busy={isBusy(`follow-${r.id}`)}
                      />
                    ) : (
                      <RequestActions>
                        <ApproveButton disabled={isBusy(`approve-${r.id}`)} onClick={() => handleApproveFollow(r.id)}>
                          {isBusy(`approve-${r.id}`) ? <Spinner /> : "Approve"}
                        </ApproveButton>
                        <RejectButton disabled={isBusy(`reject-${r.id}`)} onClick={() => handleRejectFollow(r.id)}>
                          {isBusy(`reject-${r.id}`) ? <Spinner /> : "Reject"}
                        </RejectButton>
                      </RequestActions>
                    )}
                  </UserRow>
                ))}
              </SuggestionsBox>
            )}
            {users.filter((u) => u.is_following).length < 5 &&
              users.filter((u) => !u.is_following && u.follow_status !== "pending").length > 0 && (
              <SuggestionsBox>
                <SectionHeader $open={suggestionsOpen}>
                  <SectionTitle style={{ marginBottom: 0 }}>People you might know</SectionTitle>
                  <CollapseButton
                    onClick={() => setSuggestionsOpen((o) => !o)}
                    aria-label={suggestionsOpen ? "Collapse suggestions" : "Expand suggestions"}
                  >
                    <i className={`fa-solid fa-chevron-${suggestionsOpen ? "up" : "down"}`} />
                  </CollapseButton>
                </SectionHeader>
                {suggestionsOpen && users
                  .filter((u) => !u.is_following)
                  .map((u) => (
                    <UserRow key={u.id}>
                      <UserInfo>
                        <UserAvatar src={u.picture} alt={u.name} />
                        <UserName>{u.name}</UserName>
                      </UserInfo>
                      <FollowBtn user={u} onFollow={handleFollow} busy={isBusy(`follow-${u.id}`)} />
                    </UserRow>
                  ))}
              </SuggestionsBox>
            )}
            {posts.length === 0 ? (
              <EmptyState><BigSpinner /></EmptyState>
            ) : (
              posts.map((post) => renderPostCard(post))
            )}
            {feedLoadingMore && <EmptyState><BigSpinner /></EmptyState>}
          </>
        ) : tab === "user-profile" ? (
          viewingProfileLoading ? (
            <EmptyState><BigSpinner /></EmptyState>
          ) : viewingProfile ? (
            <>
              <UserProfileHeader>
                <UserProfileAvatar src={viewingProfile.profile.picture} alt={viewingProfile.profile.name} />
                <UserProfileName>{viewingProfile.profile.name}</UserProfileName>
                <div style={{ marginTop: 24 }} />
                <FollowBtn
                  user={{
                    id: viewingProfile.profile.id,
                    follow_status: viewingProfile.profile.follow_status,
                    is_following: viewingProfile.profile.is_following,
                    follows_you: viewingProfile.profile.follows_you,
                  }}
                  onFollow={(id, status) => {
                    handleFollow(id, status);
                    // Refresh profile after follow action
                    setTimeout(() => loadUserProfile(viewingProfile.profile.id), 500);
                  }}
                  busy={isBusy(`follow-${viewingProfile.profile.id}`)}
                />
              </UserProfileHeader>
              {!viewingProfile.canViewPosts ? (
                <UserProfilePrivate>
                  <i className="fa-solid fa-lock" style={{ fontSize: 24, marginBottom: 12, display: "block" }} />
                  Follow {viewingProfile.profile.name} to see their posts
                </UserProfilePrivate>
              ) : viewingProfile.posts.length === 0 ? (
                <EmptyState>No posts yet</EmptyState>
              ) : (
                viewingProfile.posts.map((post) => renderPostCard(post, { disableProfileLink: true }))
              )}
            </>
          ) : null
        ) : (
          <>
            <SegmentedControl style={{ marginBottom: 8 }}>
              <Segment $active={peopleFilter === "friends"} onClick={() => setPeopleFilter("friends")}>Friends</Segment>
              <Segment $active={peopleFilter === "fof"} onClick={() => setPeopleFilter("fof")}>Connected</Segment>
              <Segment $active={peopleFilter === "all"} onClick={() => setPeopleFilter("all")}>Everyone</Segment>
            </SegmentedControl>
            <FilterDescription>
              {peopleFilter === "friends" && "Mutual followers"}
              {peopleFilter === "fof" && "One-way followers"}
              {peopleFilter === "all" && "Everyone on Cloud"}
            </FilterDescription>
            <PeopleGrid $compact={peopleFilter === "friends"}>
              {users.length === 0 ? (
                <EmptyState style={{ gridColumn: "1 / -1" }}>No other users yet</EmptyState>
              ) : (
                users
                  .filter((u) => peopleFilter === "all" || (peopleFilter === "friends" && connectionDegrees[u.id] === 1) || (peopleFilter === "fof" && connectionDegrees[u.id] === 2))
                  .map((u) => (
                  <PeopleCard key={u.id} onClick={() => loadUserProfile(u.id)} style={{ cursor: "pointer" }}>
                    <PeopleCardAvatar src={u.picture} alt={u.name} />
                    <div>
                      <PeopleCardName>{u.name.includes(" ") ? u.name.split(" ")[0] : u.name}</PeopleCardName>
                      {peopleFilter !== "friends" && (u.follows_you || !!u.is_following) && (
                        <PeopleCardStatus>
                          {u.follows_you && u.is_following ? "Friends" : u.follows_you ? "Follows you" : "Following"}
                        </PeopleCardStatus>
                      )}
                    </div>
                  </PeopleCard>
                ))
              )}
            </PeopleGrid>
          </>
        )}
      </Content>
    </Page>
    </ThemeProvider>
    </ThemePrefContext.Provider>
  );
}

export default App;
