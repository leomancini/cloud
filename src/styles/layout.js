import styled from "styled-components";
import { RADIUS, RADIUS_SM, ICON_GAP } from "../theme.js";
import { innerBorder, avatarBase, avatarHover } from "./common.js";

export const Page = styled.div`
  min-height: 100dvh;
  box-sizing: border-box;
  font-family: system-ui, -apple-system, BlinkMacSystemFont, sans-serif;
  background: ${(p) => p.theme.bg};
  color: ${(p) => p.theme.text};
  padding: 20px 20px 48px;
  transition: background 0.2s ease, color 0.2s ease;
`;

export const Header = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  max-width: 500px;
  margin: 0 auto 32px;
`;

export const HeaderProfile = styled.div`
  display: flex;
  align-items: center;
  gap: 10px;
  cursor: pointer;
`;

export const SmallAvatar = styled.div`
  width: 36px;
  height: 36px;
  ${avatarBase}
  ${innerBorder}
  ${avatarHover}
`;

export const HeaderName = styled.span`
  font-size: 16px;
  font-weight: 600;
  color: ${(p) => p.theme.text};
`;

export const LoginCard = styled.div`
  text-align: center;
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
`;

export const Title = styled.h1`
  font-size: 22px;
  color: ${(p) => p.theme.text};
  margin: 0 0 6px;
`;

export const Subtitle = styled.p`
  font-size: 16px;
  color: ${(p) => p.theme.textSecondary};
  margin: 0 0 24px;
`;

export const SignInButton = styled.a`
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

export const SegmentedControl = styled.div`
  display: flex;
  background: ${(p) => p.theme.bgControl};
  border-radius: ${RADIUS};
  padding: 3px;
`;

export const Segment = styled.button`
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

export const BackButton = styled.button`
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

export const LogoutButton = styled.button`
  padding: 8px 16px;
  border-radius: ${RADIUS};
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  border: 2px solid ${(p) => p.theme.borderStrong};
  background: ${(p) => p.theme.bgElevated};
  color: #666;
  width: 100%;

  @media (hover: hover) {
    &:hover {
      background: ${(p) => p.theme.bgHover};
    }
  }
`;

export const Content = styled.div`
  max-width: 500px;
  margin: 0 auto;
`;

export const Banner = styled.div`
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

export const BannerText = styled.span`
  font-size: 14px;
  color: ${(p) => p.theme.text};
  flex: 1;
`;

export const BannerButton = styled.button`
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

export const BannerDismiss = styled.button`
  border: none;
  background: none;
  color: ${(p) => p.theme.textMuted};
  cursor: pointer;
  font-size: 14px;
  padding: 0;
  flex-shrink: 0;
`;

export const EmptyState = styled.div`
  text-align: center;
  color: ${(p) => p.theme.textSecondary};
  font-size: 16px;
  margin-top: 40px;
`;
