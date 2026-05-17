import styled, { keyframes } from "styled-components";
import { RADIUS, RADIUS_SM, ICON_GAP } from "../theme.js";

// ─── Shared CSS helpers ──────────────────────────────────────────────────────

export const innerBorder = "outline: 2px solid rgba(0, 0, 0, 0.1); outline-offset: -2px;";

export const avatarBase = `
  border-radius: 50%;
  background-size: cover;
  background-position: center;
  flex-shrink: 0;
  user-select: none;
  -webkit-user-select: none;
`;

export const randomTilt = () => {
  const deg = 10 + Math.random() * 10;
  return Math.random() < 0.5 ? deg : -deg;
};

export const avatarHover = `
  transition: transform 0.2s ease;
  @media (hover: hover) {
    &:hover {
      transform: rotate(calc(var(--tilt) * 1deg));
    }
  }
  &:active {
    transform: rotate(calc(var(--tilt) * 1deg));
  }
`;

export const composeFieldBase = `
  font-size: 16px;
  font-family: system-ui, -apple-system, BlinkMacSystemFont, sans-serif;
  line-height: 22px;
  letter-spacing: normal;
  word-spacing: normal;
  white-space: pre-wrap;
  word-wrap: break-word;
  overflow-wrap: break-word;
  -webkit-text-size-adjust: 100%;
  padding: 14px;
  border: 2px solid transparent;
  border-radius: ${RADIUS};
  box-sizing: border-box;
`;

export const commentFieldBase = `
  font-size: 16px;
  font-family: system-ui, -apple-system, BlinkMacSystemFont, sans-serif;
  line-height: 22px;
  letter-spacing: normal;
  word-spacing: normal;
  white-space: pre-wrap;
  word-wrap: break-word;
  overflow-wrap: break-word;
  -webkit-text-size-adjust: 100%;
  padding: 7px 12px;
  border: 2px solid transparent;
  border-radius: ${RADIUS};
  box-sizing: border-box;
`;

// ─── Keyframe animations ─────────────────────────────────────────────────────

export const spinAnim = keyframes`
  to { transform: rotate(360deg); }
`;

export const shimmer = keyframes`
  0% { background-position: -200% center; }
  100% { background-position: 200% center; }
`;

// ─── Styled components ───────────────────────────────────────────────────────

export const SpinnerRing = styled.div`
  width: ${(p) => p.$size || "16px"};
  height: ${(p) => p.$size || "16px"};
  border-radius: 50%;
  border: 2px solid transparent;
  border-top-color: currentColor;
  border-right-color: currentColor;
  opacity: 0.6;
  animation: ${spinAnim} 0.6s linear infinite;
  display: inline-block;
`;

export const MentionSpan = styled.span`
  font-weight: 600;
  cursor: pointer;
  &:active { opacity: 0.6; }
`;

export const MentionHighlight = styled.span`
  background: ${(p) => p.theme.mentionBg};
  border-radius: 3px;
  font-weight: inherit;
  font-size: inherit;
  letter-spacing: inherit;
`;

export const MentionDropdown = styled.div`
  position: absolute;
  top: calc(100% + 4px);
  left: 0;
  right: 0;
  background: ${(p) => p.theme.bgElevated};
  border-radius: ${RADIUS};
  box-shadow: 0 2px 12px ${(p) => p.theme.shadowMd};
  max-height: 150px;
  overflow-y: auto;
  overscroll-behavior: contain;
  z-index: 10;
  scrollbar-width: none;
  &::-webkit-scrollbar { display: none; }
`;

export const MentionOption = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px;
  cursor: pointer;
  font-size: 16px;
  font-weight: 600;
  color: ${(p) => p.theme.text};
  @media (hover: hover) { &:hover { background: ${(p) => p.theme.bgHover}; } }
`;

export const MentionAvatar = styled.div`
  width: 24px;
  height: 24px;
  ${avatarBase}
  outline: 1px solid rgba(0, 0, 0, 0.1);
  outline-offset: -1px;
  display: inline-block;
  vertical-align: middle;
`;
