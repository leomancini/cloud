import styled from "styled-components";
import { RADIUS, RADIUS_SM, ICON_GAP } from "../theme.js";
import { composeFieldBase } from "./common.js";

export const ComposeBox = styled.div`
  margin-bottom: 12px;
  padding-bottom: 12px;
`;

export const ComposeWrapper = styled.div`
  position: relative;
  width: 100%;
`;

export const ComposeInput = styled.textarea`
  width: 100%;
  ${composeFieldBase}
  border-color: ${(p) => p.theme.border};
  resize: none;
  outline: none;
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

export const ComposeHighlight = styled.div`
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  ${composeFieldBase}
  overflow: hidden;
  color: ${(p) => p.theme.text};
  pointer-events: none;
`;

export const ComposeActions = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-top: 10px;
`;

export const ComposeActionsLeft = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
`;

export const IconButton = styled.button`
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

export const HiddenFileInput = styled.input`
  display: none;
`;

export const MediaPreviews = styled.div`
  display: flex;
  gap: 8px;
  margin-top: 8px;
  flex-wrap: wrap;
`;

export const MediaPreview = styled.div`
  position: relative;
  border-radius: inherit;
  overflow: hidden;
`;

export const PreviewImage = styled.img`
  height: 100px;
  border-radius: ${RADIUS};
  display: block;
`;

export const PreviewVideo = styled.video`
  height: 100px;
  border-radius: ${RADIUS};
  display: block;
`;

export const RemoveMedia = styled.button`
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
  transition: background 0.15s ease;
  @media (hover: hover) { &:hover { background: rgba(0,0,0,0.7); } }
  &:active { background: rgba(0,0,0,0.8); }
  line-height: 1;
  z-index: 1;
`;

export const LocationSearch = styled.div`
  position: relative;
  margin-top: 8px;
  z-index: 10;
`;

export const LocationInput = styled.input`
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

export const LocationResults = styled.div`
  position: absolute;
  top: calc(100% + 4px);
  left: 0;
  right: 0;
  background: ${(p) => p.theme.bgElevated};
  border-radius: ${RADIUS};
  box-shadow: 0 2px 12px ${(p) => p.theme.shadowMd};
  overflow: hidden;
  z-index: 10;
`;

export const LocationResult = styled.div`
  padding: 12px;
  cursor: pointer;

  @media (hover: hover) {
    &:hover {
      background: ${(p) => p.theme.bgHover};
    }
  }
`;

export const LocationName = styled.div`
  font-size: 16px;
  font-weight: 500;
  color: ${(p) => p.theme.text};
`;

export const LocationAddress = styled.div`
  font-size: 14px;
  color: ${(p) => p.theme.textSecondary};
  margin-top: 2px;
`;

export const SelectedLocation = styled.div`
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

export const RemoveLocation = styled.button`
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
  transition: background 0.15s ease;
  @media (hover: hover) { &:hover { background: rgba(0,0,0,0.7); } }
  &:active { background: rgba(0,0,0,0.8); }
  line-height: 1;
  z-index: 1;
`;
