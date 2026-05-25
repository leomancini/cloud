import styled from "styled-components";
import { RADIUS, RADIUS_SM, ICON_GAP } from "../theme.js";

// ─── Reaction settings styled components ─────────────────────────────────────

export const ReactionSettingsSection = styled.div`
  text-align: left;
  margin: 0 auto 24px;
`;

export const ReactionContextBlock = styled.div`
  margin-bottom: 20px;
`;

export const ReactionContextHeader = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 10px;
`;

export const ReactionContextLabel = styled.div`
  font-size: 14px;
  font-weight: 600;
  color: ${(p) => p.theme.text};
  display: flex;
  align-items: center;
  gap: 6px;
`;

export const ReactionContextSubLabel = styled.div`
  font-size: 12px;
  font-weight: 400;
  color: ${(p) => p.theme.textSecondary};
`;

export const ReactionResetButton = styled.button`
  font-size: 12px;
  color: ${(p) => p.theme.textSecondary};
  border: none;
  background: none;
  cursor: pointer;
  padding: 2px 6px;
  border-radius: ${RADIUS_SM};
  @media (hover: hover) { &:hover { background: ${(p) => p.theme.bgHover}; color: ${(p) => p.theme.text}; } }
`;

export const EmojiChipRow = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-bottom: 10px;
`;

export const EmojiChip = styled.div`
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

export const EmojiChipRemove = styled.button`
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

export const EmojiChipDragHandle = styled.span`
  font-size: 12px;
  color: ${(p) => p.theme.textMuted};
  cursor: grab;
  margin-right: 2px;
  &:active { cursor: grabbing; }
`;

export const AddEmojiRow = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
`;

export const EmojiInput = styled.input`
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

export const AddEmojiButton = styled.button`
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

export const ReactionContextDivider = styled.div`
  height: 1px;
  background: ${(p) => p.theme.border};
  margin: 16px 0;
`;

export const ReactionPreviewRow = styled.div`
  display: flex;
  gap: 4px;
  align-items: center;
  margin-top: 6px;
  flex-wrap: wrap;
`;

export const ReactionPreviewEmoji = styled.span`
  font-size: 20px;
  opacity: 0.85;
`;

export const ReactionInheritNote = styled.div`
  font-size: 12px;
  color: ${(p) => p.theme.textSecondary};
  font-style: italic;
  margin-top: 4px;
`;

// ─── End reaction settings styled components ──────────────────────────────────

// ─── Inline reaction display components ──────────────────────────────────────

export const ReactionsRow = styled.div`
  display: flex;
  align-items: center;
  gap: 12px;
  margin-top: 14px;
  flex-wrap: wrap;
  user-select: none;
  -webkit-user-select: none;
`;

export const ReactionChip = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 0;
  font-size: 24px;
  line-height: 1;
`;

export const ReactionNames = styled.span`
  font-size: 16px;
  color: ${(p) => p.theme.text};
  font-weight: 600;
`;

export const EmojiOption = styled.button`
  display: flex;
  align-items: center;
  justify-content: center;
  border: none;
  background: none;
  font-size: 24px;
  line-height: 1;
  padding: 0;
  width: 24px;
  height: 24px;
  cursor: pointer;
  border-radius: ${RADIUS_SM};
  opacity: ${(p) => (p.$dimmed ? 0.35 : 1)};
  transition: transform 0.1s ease;
  &:active {
    transform: scale(0.8);
  }
  @media (hover: hover) {
    &:hover {
      background: none;
    }
  }
`;

export const EmojiEditButton = styled.button`
  display: flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  border: none;
  background: none;
  font-size: 14px;
  color: ${(p) => p.theme.textSecondary};
  cursor: pointer;
  border-radius: ${RADIUS_SM};
  padding: 0;
  @media (hover: hover) { &:hover { color: ${(p) => p.theme.text} }; }
`;

export const QuickReactButton = styled.button`
  display: flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  border: none;
  background: none;
  font-size: 16px;
  color: ${(p) => p.theme.textSecondary};
  cursor: pointer;
  border-radius: ${RADIUS_SM};
  padding: 0;
  @media (hover: hover) { &:hover { color: ${(p) => p.theme.text} }; }
`;

export const EmojiPickerWrap = styled.div`
  position: relative;
  margin-top: 8px;
  border-radius: ${RADIUS};
  overflow: hidden;
  &::after {
    content: '';
    position: absolute;
    inset: 0;
    border-radius: ${RADIUS};
    box-shadow: inset 0 0 0 2px rgba(0, 0, 0, 0.1);
    pointer-events: none;
    z-index: 1;
  }
  em-emoji-picker {
    width: 100%;
    --border-radius: ${RADIUS};
    --shadow: none;
    --font-size: 16px;
  }
`;
