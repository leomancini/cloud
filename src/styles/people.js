import styled from "styled-components";
import { RADIUS, RADIUS_SM, ICON_GAP } from "../theme.js";
import { innerBorder, avatarBase, avatarHover } from "./common.js";

export const UserList = styled.div`
  display: flex;
  flex-direction: column;
  gap: 8px;
`;

export const UserRow = styled.div`
  padding: 12px 0;
  display: flex;
  align-items: center;
  justify-content: space-between;

  &:last-child {
    padding-bottom: 0;
  }
`;

export const UserInfo = styled.div`
  display: flex;
  align-items: center;
  gap: 12px;
`;

export const UserAvatar = styled.div`
  width: 36px;
  height: 36px;
  ${avatarBase}
  ${innerBorder}
  ${avatarHover}
`;

export const UserName = styled.span`
  font-size: 16px;
  font-weight: 600;
  color: ${(p) => p.theme.text};
`;

export const UserStatus = styled.div`
  font-size: 12px;
  color: ${(p) => p.theme.textSecondary};
  margin-top: 1px;
`;

export const FilterDescription = styled.div`
  font-size: 14px;
  color: ${(p) => p.theme.textSecondary};
  text-align: center;
  margin-top: 24px;
  margin-bottom: 16px;
`;

export const PeopleGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  column-gap: 12px;
  row-gap: ${(p) => p.$compact ? "4px" : "12px"};
`;

export const PeopleCard = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  gap: 12px;
  padding: 12px 0;
  min-width: 0;
  @media (hover: hover) {
    &:hover > div:first-child { transform: rotate(calc(var(--tilt) * 1deg)); }
  }
  &:active > div:first-child { transform: rotate(calc(var(--tilt) * 1deg)); }
`;

export const PeopleCardAvatar = styled.div`
  width: 80px;
  height: 80px;
  ${avatarBase}
  ${innerBorder}
  ${avatarHover}
`;

export const PeopleCardName = styled.span`
  font-size: 16px;
  font-weight: 600;
  color: ${(p) => p.theme.text};
  line-height: 1.3;
  margin-bottom: 4px;
  display: block;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  max-width: 100%;
`;

export const PeopleCardStatus = styled.div`
  font-size: 14px;
  color: ${(p) => p.theme.textSecondary};
  margin-top: 0px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  max-width: 100%;
`;

export const UserProfileHeader = styled.div`
  text-align: center;
  padding: 20px;
  margin-bottom: 16px;
`;

export const UserProfileAvatar = styled.div`
  width: 80px;
  height: 80px;
  ${avatarBase}
  margin: 0 auto 12px;
  ${innerBorder}
  ${avatarHover}
`;

export const UserProfileName = styled.h2`
  font-size: 22px;
  color: ${(p) => p.theme.text};
  margin: 0 0 4px;
`;

export const UserProfileStats = styled.div`
  display: flex;
  justify-content: center;
  gap: 24px;
  margin: 16px 0;
`;

export const UserProfileStat = styled.div`
  font-size: 14px;
  color: ${(p) => p.theme.textSecondary};
  span {
    font-weight: 600;
    color: ${(p) => p.theme.text};
  }
`;

export const UserProfilePrivate = styled.div`
  text-align: center;
  padding: 48px 24px;
  color: ${(p) => p.theme.textSecondary};
  font-size: 14px;
`;

export const DegreeBadge = styled.span`
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 12px;
  font-weight: 600;
  padding: 2px 7px;
  border-radius: 20px;
  letter-spacing: normal;
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

export const DegreeFilterBar = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 16px;
  flex-wrap: wrap;
`;

export const DegreeFilterLabel = styled.span`
  font-size: 12px;
  font-weight: 600;
  color: ${(p) => p.theme.textMuted};
  text-transform: uppercase;
  letter-spacing: normal;
  margin-right: 2px;
`;

export const DegreeFilterChip = styled.button`
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

export const FollowButton = styled.button`
  padding: 8px 18px;
  min-height: 36px;
  min-width: 80px;
  border-radius: ${RADIUS};
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  box-sizing: border-box;
  border: 2px solid ${(p) => (p.$status === "pending" ? p.theme.borderStrong : p.$following ? p.theme.borderStrong : p.theme.btnPrimary)};
  background: ${(p) => (p.$status === "pending" ? p.theme.bgElevated : p.$following ? p.theme.bgElevated : p.theme.btnPrimary)};
  color: ${(p) => (p.$status === "pending" ? p.theme.textSecondary : p.$following ? p.theme.textMuted : p.theme.btnPrimaryText)};

  @media (hover: hover) {
    &:hover {
      background: ${(p) => (p.$status === "pending" ? p.theme.bgHover : p.$following ? p.theme.bgHover : p.theme.btnPrimaryHover)};
    }
  }
`;

export const PeopleFollowButton = styled(FollowButton)``;

export const RequestActions = styled.div`
  display: flex;
  gap: 8px;
`;

export const ApproveButton = styled.button`
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

export const RejectButton = styled.button`
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

export const SuggestionsBox = styled.div`
  background: ${(p) => p.theme.bgSecondary};
  border-radius: ${RADIUS};
  padding: 16px;
  margin-bottom: 24px;
`;

export const SectionTitle = styled.div`
  font-size: 14px;
  font-weight: 600;
  color: ${(p) => p.theme.text};
  margin-bottom: 12px;
`;

export const SectionHeader = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: ${(p) => (p.$open ? "12px" : "0")};
`;

export const CollapseButton = styled.button`
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
