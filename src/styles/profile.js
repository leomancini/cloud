import styled from "styled-components";
import { RADIUS, RADIUS_SM, ICON_GAP } from "../theme.js";
import { innerBorder, avatarBase, avatarHover } from "./common.js";

export const ProfilePage = styled.div`
  text-align: center;
  padding-top: 40px;
`;

export const ProfileAvatar = styled.div`
  width: 80px;
  height: 80px;
  ${avatarBase}
  margin: 0 auto 16px;
  ${innerBorder}
  ${avatarHover}
`;

export const ProfileName = styled.h2`
  font-size: 22px;
  color: ${(p) => p.theme.text};
  margin: 0 0 4px;
`;

export const ProfileEmail = styled.p`
  font-size: 14px;
  color: ${(p) => p.theme.textSecondary};
  margin: 0 0 32px;
`;

export const ThemeToggleLabel = styled.div`
  font-size: 14px;
  font-weight: 500;
  color: ${(p) => p.theme.textSecondary};
  margin-bottom: 8px;
`;

export const ThemeToggleWrap = styled.div`
  margin-bottom: 24px;
`;

export const ThemeToggle = styled.div`
  display: inline-flex;
  background: ${(p) => p.theme.bgControl};
  border-radius: ${RADIUS};
  padding: 3px;

  @media (max-width: 600px) {
    display: flex;
  }
`;

export const ThemeSegment = styled.button`
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

export const PushSection = styled.div`
  text-align: left;
  margin: 0 auto 24px;
`;

export const PushRow = styled.label`
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 0;
  cursor: pointer;

  &:not(:last-child) {
    border-bottom: 2px solid ${(p) => p.theme.border};
  }
`;

export const PushRowLabel = styled.span`
  font-size: 14px;
  color: ${(p) => p.theme.text};
`;

export const ToggleTrack = styled.div`
  width: 44px;
  height: 24px;
  border-radius: 12px;
  background: ${(p) => (p.$on ? p.theme.btnPrimary : p.theme.bgControl)};
  position: relative;
  flex-shrink: 0;
  transition: background 0.2s ease;
`;

export const ToggleThumb = styled.div`
  width: 20px;
  height: 20px;
  border-radius: 50%;
  background: ${(p) => (p.$on ? p.theme.btnPrimaryText : p.theme.textMuted)};
  position: absolute;
  top: 2px;
  left: ${(p) => (p.$on ? "22px" : "2px")};
  transition: left 0.2s ease, background 0.2s ease;
`;
