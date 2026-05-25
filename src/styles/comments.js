import styled, { keyframes, css } from "styled-components";
import { RADIUS, RADIUS_SM, ICON_GAP } from "../theme.js";
import { avatarBase, avatarHover, commentFieldBase } from "./common.js";

export const CommentsSection = styled.div`
  margin-top: 14px;
`;

// ─── Threading styled components ─────────────────────────────────────────────

export const ThreadContainer = styled.div`
  position: relative;
`;

export const ThreadedReplyGroup = styled.div`
  padding-left: 32px;
  margin-top: 4px;
`;

export const ThreadConnector = styled.div`
  position: absolute;
  left: 11px;
  top: 14px;
  width: 20px;
  height: 2px;
  background: ${(p) => p.theme.border};
  border-radius: 2px;
`;

export const ReplyButton = styled.button`
  border: none;
  background: none;
  font-size: 12px;
  font-weight: 600;
  color: ${(p) => p.theme.textSecondary};
  cursor: pointer;
  padding: 2px 0;
  margin-top: 4px;
  display: inline-flex;
  align-items: center;
  gap: 4px;
  letter-spacing: normal;

  @media (hover: hover) {
    &:hover { color: ${(p) => p.theme.text}; }
  }
  &:active { opacity: 0.6; }
`;

export const CollapseThreadButton = styled.button`
  border: none;
  background: none;
  font-size: 12px;
  font-weight: 600;
  color: ${(p) => p.theme.textSecondary};
  cursor: pointer;
  padding: 2px 0 2px 4px;
  margin-top: 2px;
  display: inline-flex;
  align-items: center;
  gap: 4px;

  @media (hover: hover) {
    &:hover { color: ${(p) => p.theme.text}; }
  }
  &:active { opacity: 0.6; }
`;

export const CollapsedThreadPill = styled.button`
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 6px;
  margin-left: 32px;
  padding: 6px 12px;
  background: ${(p) => p.theme.bgControl};
  border: none;
  border-radius: 20px;
  font-size: 13px;
  font-weight: 600;
  color: ${(p) => p.theme.textSecondary};
  cursor: pointer;

  @media (hover: hover) {
    &:hover {
      background: ${(p) => p.theme.bgHover};
      color: ${(p) => p.theme.text};
    }
  }
  &:active { opacity: 0.7; }
`;

export const ViewThreadButton = styled.button`
  border: none;
  background: none;
  font-size: 12px;
  font-weight: 600;
  color: ${(p) => p.theme.textSecondary};
  cursor: pointer;
  padding: 2px 0;
  margin-top: 2px;
  margin-left: 4px;
  display: inline-flex;
  align-items: center;
  gap: 4px;

  @media (hover: hover) {
    &:hover { color: ${(p) => p.theme.text}; }
  }
  &:active { opacity: 0.6; }
`;

export const ThreadFocusOverlay = styled.div`
  position: fixed;
  inset: 0;
  background: ${(p) => p.theme.bgOverlay};
  z-index: 500;
  display: flex;
  align-items: flex-end;
  justify-content: center;
`;

export const ThreadFocusSheet = styled.div`
  background: ${(p) => p.theme.bg};
  border-radius: ${RADIUS} ${RADIUS} 0 0;
  width: 100%;
  max-width: 560px;
  max-height: 88dvh;
  overflow-y: auto;
  overscroll-behavior: contain;
  padding: 20px 20px 40px;
  box-sizing: border-box;
`;

export const ThreadFocusHeader = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 16px;
`;

export const ThreadFocusTitle = styled.div`
  font-size: 16px;
  font-weight: 700;
  color: ${(p) => p.theme.text};
`;

export const ThreadFocusClose = styled.button`
  width: 32px;
  height: 32px;
  border-radius: 50%;
  border: none;
  background: ${(p) => p.theme.bgControl};
  color: ${(p) => p.theme.text};
  font-size: 16px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  @media (hover: hover) { &:hover { background: ${(p) => p.theme.bgHover}; } }
`;

export const ReplyInputBanner = styled.div`
  font-size: 12px;
  color: ${(p) => p.theme.textSecondary};
  margin-bottom: 4px;
  display: flex;
  align-items: center;
  gap: 6px;
`;

export const CancelReplyButton = styled.button`
  border: none;
  background: none;
  font-size: 12px;
  font-weight: 600;
  color: ${(p) => p.theme.textSecondary};
  cursor: pointer;
  padding: 0;
  @media (hover: hover) { &:hover { color: ${(p) => p.theme.text}; } }
`;

// ─── End threading styled components ─────────────────────────────────────────

export const thumbsUpPop = keyframes`
  0%   { transform: scale(0.5); opacity: 0; }
  60%  { transform: scale(1.3); opacity: 1; }
  100% { transform: scale(1);   opacity: 1; }
`;

export const CommentRow = styled.div`
  display: flex;
  align-items: flex-start;
  gap: 8px;
  margin-top: 10px;
  position: relative;
  user-select: none;
  -webkit-user-select: none;
`;

export const CommentThumbsBadge = styled.button`
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

export const ThumbsUpEmoji = styled.span`
  font-size: 14px;
  display: inline-block;
  animation: ${(p) => (p.$animate ? css`${thumbsUpPop} 0.35s ease forwards` : "none")};
`;

export const popIn = keyframes`
  0%   { transform: translate(-50%, 0) scale(0.5); opacity: 0; }
  70%  { transform: translate(-50%, 0) scale(1.08); opacity: 1; }
  100% { transform: translate(-50%, 0) scale(1);   opacity: 1; }
`;

export const DoubleTapPickerBackdrop = styled.div`
  position: fixed;
  inset: 0;
  z-index: 2000;
`;

export const DoubleTapPickerPopover = styled.div`
  position: fixed;
  z-index: 2001;
  max-width: calc(100vw - 40px);
  width: fit-content;
  background: ${(p) => p.theme.bgElevated};
  border-radius: 999px;
  box-sizing: border-box;
  box-shadow: 0 2px 12px ${(p) => p.theme.shadowMd};
  animation: ${popIn} 0.2s ease forwards;
  overflow: hidden;
  &::before, &::after {
    content: "";
    position: absolute;
    top: 0;
    bottom: 0;
    width: 20px;
    z-index: 2;
    pointer-events: none;
  }
  &::before {
    left: 0;
    background: linear-gradient(to right, ${(p) => p.theme.bgElevated}, transparent);
    opacity: ${(p) => p.$scrollLeft ? 1 : 0};
    transition: opacity 0.15s;
  }
  &::after {
    right: 0;
    width: 32px;
    background: linear-gradient(to left, ${(p) => p.theme.bgElevated}, transparent);
    opacity: ${(p) => p.$scrollRight ? 1 : 0};
    transition: opacity 0.15s;
  }
`;

export const DoubleTapPickerScroll = styled.div`
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 10px 16px 10px 12px;
  overflow-x: auto;
  scrollbar-width: none;
  &::-webkit-scrollbar { display: none; }
`;

export const DoubleTapPickerEmoji = styled.button`
  font-size: 28px;
  line-height: 1;
  border: none;
  background: none;
  padding: 4px;
  cursor: pointer;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: transform 0.1s ease, background 0.1s ease;
  &:active { transform: scale(0.8); }
  @media (hover: hover) {
    &:hover { background: ${(p) => p.theme.bgHover}; transform: scale(1.2); }
  }
`;

export const CommentAvatar = styled.div`
  width: 24px;
  height: 24px;
  ${avatarBase}
  margin-top: -1px;
  outline: 1px solid rgba(0, 0, 0, 0.1);
  outline-offset: -1px;
  ${avatarHover}
`;

export const CommentBody = styled.div`
  flex: 1;
  min-width: 0;
`;

export const CommentAuthor = styled.span`
  font-size: 16px;
  font-weight: 600;
  color: ${(p) => p.theme.text};
  margin-right: 6px;
`;

export const CommentText = styled.span`
  font-size: 16px;
  color: ${(p) => p.theme.text};
  line-height: 1.4;
  user-select: text;
  -webkit-user-select: text;
`;

export const CommentTime = styled.span`
  font-size: 12px;
  color: ${(p) => p.theme.textSecondary};
  white-space: nowrap;
`;

export const CommentInputRow = styled.div`
  display: flex;
  align-items: flex-end;
  gap: 8px;
  margin-top: 16px;
`;

export const CommentInputWrapper = styled.div`
  position: relative;
  flex: 1;
  min-width: 0;
`;

export const CommentInput = styled.textarea`
  width: 100%;
  min-height: 40px;
  ${commentFieldBase}
  border-color: ${(p) => p.theme.border};
  outline: none;
  min-width: 0;
  color: transparent;
  caret-color: ${(p) => p.theme.text};
  position: relative;
  z-index: 1;
  background: transparent;
  resize: none;
  overflow: hidden;
  display: block;

  &:focus {
    border-color: #ccc;
  }
`;

export const CommentHighlight = styled.div`
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  ${commentFieldBase}
  overflow: hidden;
  color: ${(p) => p.theme.text};
  pointer-events: none;
`;

export const CommentPostButton = styled.button`
  border: 2px solid transparent;
  background: ${(p) => p.theme.btnPrimary};
  color: ${(p) => p.theme.btnPrimaryText};
  font-size: 16px;
  cursor: pointer;
  padding: 0;
  width: 40px;
  min-width: 40px;
  height: 40px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  box-sizing: border-box;
  overflow: hidden;

  @media (hover: hover) {
    &:hover {
      background: ${(p) => p.theme.btnPrimaryHover};
    }
  }
`;

export const CommentCount = styled.button`
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
