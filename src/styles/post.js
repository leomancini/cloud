import styled, { css } from "styled-components";
import { RADIUS, RADIUS_SM, ICON_GAP } from "../theme.js";
import { innerBorder, avatarBase, avatarHover, shimmer } from "./common.js";

export const PostMediaContainer = styled.div`
  margin-top: 10px;
  display: grid;
  grid-template-columns: ${(p) => (p.$count === 1 ? "1fr" : "1fr 1fr")};
  gap: 4px;

  ${(p) => {
    const R = RADIUS;
    const S = "4px";
    const BL = p.$belowMedia ? S : R; // bottom-left
    const BR = p.$belowMedia ? S : R; // bottom-right

    if (p.$count === 2) return css`
      grid-template-rows: 1fr;
      & > * { height: 100%; max-height: 400px; }
      & > *:first-child, & > *:first-child img, & > *:first-child video { border-radius: ${R} ${S} ${S} ${BL} !important; }
      & > *:last-child, & > *:last-child img, & > *:last-child video { border-radius: ${S} ${R} ${BR} ${S} !important; }
    `;
    if (p.$count === 3) return css`
      & > *:first-child { grid-column: 1 / -1; max-height: 300px; }
      & > *:first-child, & > *:first-child img, & > *:first-child video { border-radius: ${R} ${R} ${S} ${S} !important; }
      & > *:nth-child(2), & > *:nth-child(2) img, & > *:nth-child(2) video { aspect-ratio: 3 / 4; border-radius: ${S} ${S} ${S} ${BL} !important; }
      & > *:nth-child(3), & > *:nth-child(3) img, & > *:nth-child(3) video { aspect-ratio: 3 / 4; border-radius: ${S} ${S} ${BR} ${S} !important; }
    `;
    if (p.$count >= 4) {
      // 2-column grid: figure out which items are in the last row
      const lastRow = p.$count % 2 === 0 ? [p.$count - 1, p.$count] : [p.$count];
      const isLastLeft = (n) => lastRow.includes(n) && n % 2 === 1;
      const isLastRight = (n) => lastRow.includes(n) && n % 2 === 0;
      // If odd count, last item spans full width — both bottom corners
      const oddLast = p.$count % 2 === 1;
      let rules = `
        & > *, & > * img, & > * video { border-radius: ${S} !important; }
        & > *:nth-child(1), & > *:nth-child(1) img, & > *:nth-child(1) video { border-radius: ${R} ${S} ${S} ${S} !important; }
        & > *:nth-child(2), & > *:nth-child(2) img, & > *:nth-child(2) video { border-radius: ${S} ${R} ${S} ${S} !important; }
      `;
      if (oddLast) {
        rules += `& > *:last-child, & > *:last-child img, & > *:last-child video { grid-column: 1 / -1; border-radius: ${S} ${S} ${BR} ${BL} !important; }`;
      } else {
        rules += `& > *:nth-child(${p.$count - 1}), & > *:nth-child(${p.$count - 1}) img, & > *:nth-child(${p.$count - 1}) video { border-radius: ${S} ${S} ${S} ${BL} !important; }`;
        rules += `& > *:nth-child(${p.$count}), & > *:nth-child(${p.$count}) img, & > *:nth-child(${p.$count}) video { border-radius: ${S} ${S} ${BR} ${S} !important; }`;
      }
      return css`${rules}`;
    }
  }}
`;

export const PostImage = styled.img`
  width: 100%;
  height: auto;
  display: block;
  border-radius: ${RADIUS};
  object-fit: cover;
  background: ${(p) => p.theme.bgControl};
  cursor: ${(p) => (p.$tappable ? "zoom-in" : "default")};
  ${innerBorder}
`;

export const PostVideo = styled.video`
  width: 100%;
  display: block;
  border-radius: ${RADIUS};
  object-fit: cover;
  background: ${(p) => p.theme.bgControl};
`;

export const VideoWrap = styled.div`
  position: relative;
  border-radius: ${RADIUS};
  overflow: hidden;
  background: ${(p) => p.theme.bgControl};
  &::after {
    content: "";
    position: absolute;
    inset: 0;
    border-radius: inherit;
    box-shadow: inset 0 0 0 2px rgba(0, 0, 0, 0.1);
    pointer-events: none;
    z-index: 1;
  }
  & > video {
    border-radius: 0;
    width: 100%;
    display: block;
  }
`;

export const GameFrameWrap = styled.div`
  position: relative;
  width: 100%;
  aspect-ratio: 1;
  border-radius: ${RADIUS};
  overflow: hidden;
  margin-top: 10px;
  background: ${(p) => p.theme.bgControl};
  &::after {
    content: "";
    position: absolute;
    inset: 0;
    border-radius: inherit;
    box-shadow: inset 0 0 0 2px rgba(0, 0, 0, 0.1);
    pointer-events: none;
  }
`;

export const GameFrameInner = styled.iframe`
  width: 100%;
  height: 100%;
  border: none;
  display: block;
`;

export const MosaicBadgeBg = styled.div`
  position: absolute;
  inset: 0;
  border-radius: inherit;
  background: linear-gradient(
    110deg,
    rgba(255,255,255,0.12) 0%,
    rgba(255,255,255,0.25) 25%,
    rgba(255,255,255,0.12) 50%,
    rgba(255,255,255,0.25) 75%,
    rgba(255,255,255,0.12) 100%
  );
  background-size: 200% 100%;
  animation: ${shimmer} 8s linear infinite;
  mix-blend-mode: overlay;
`;

export const MosaicBadge = styled.a`
  position: absolute;
  bottom: 10px;
  right: 10px;
  padding: 10px 12px;
  border-radius: 10px;
  font-size: 14px;
  font-weight: 600;
  letter-spacing: 0.02em;
  color: #fff;
  text-decoration: none;
  display: flex;
  align-items: center;
  gap: 6px;
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  box-shadow: 0 2px 8px rgba(0,0,0,0.4), 0 8px 32px rgba(0,0,0,0.3);
  overflow: hidden;
`;

export const MediaWrapper = styled.div`
  position: relative;
  overflow: hidden;
  border-radius: ${RADIUS}
`;

export const LinkPreviewCard = styled.a`
  display: block;
  margin-top: 10px;
  text-decoration: none;
  color: inherit;
  -webkit-tap-highlight-color: transparent;
  ${(p) => !p.$static && `
    @media (hover: hover) {
      &:hover .link-body { border-color: rgba(0, 0, 0, 0.15); }
    }
    &:active .link-body { border-color: rgba(0, 0, 0, 0.18); }
  `}
`;

export const LinkPreviewImageWrap = styled.div`
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
    border-radius: inherit;
    box-shadow: inset 0 0 0 2px rgba(0, 0, 0, 0.1);
    pointer-events: none;
    transition: box-shadow 0.15s ease;
  }
  @media (hover: hover) {
    a:hover &::after {
      box-shadow: inset 0 0 0 2px rgba(0, 0, 0, 0.15);
    }
  }
  a:active &::after {
    box-shadow: inset 0 0 0 2px rgba(0, 0, 0, 0.18);
  }
`;

export const LinkPreviewImage = styled.img`
  width: 100%;
  max-height: 250px;
  object-fit: cover;
  display: block;
`;

export const LinkPreviewBody = styled.div`
  padding: 12px;
  border: 2px solid rgba(0, 0, 0, 0.1);
  border-top: ${(p) => p.$hasImage ? "none" : "2px solid rgba(0, 0, 0, 0.1)"};
  border-radius: ${(p) => p.$hasImage ? `0 0 ${RADIUS} ${RADIUS}` : RADIUS};
  transition: border-color 0.15s ease;
`;

export const LinkPreviewSite = styled.div`
  font-size: 12px;
  color: ${(p) => p.theme.textSecondary};
  text-transform: uppercase;
  letter-spacing: normal;
  margin-top: 6px;
`;

export const LinkPreviewTitle = styled.div`
  font-size: 16px;
  font-weight: 600;
  color: ${(p) => p.theme.text};
  line-height: 1.3;
`;

export const LinkPreviewDesc = styled.div`
  font-size: 14px;
  color: ${(p) => p.theme.textSecondary};
  margin-top: 4px;
  line-height: 1.4;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
`;

export const PostLocation = styled.div`
  margin-top: 10px;
  display: block;
  @media (hover: hover) {
    &[href]:hover .place-name { border-color: rgba(0, 0, 0, 0.15); }
  }
  &[href]:active .place-name { border-color: rgba(0, 0, 0, 0.18); }
`;

export const PostMapWrapper = styled.div`
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
    border-radius: inherit;
    box-shadow: inset 0 0 0 2px rgba(0, 0, 0, 0.1);
    pointer-events: none;
    transition: box-shadow 0.15s ease;
  }
  @media (hover: hover) {
    a:hover &::after {
      box-shadow: inset 0 0 0 2px rgba(0, 0, 0, 0.15);
    }
  }
  a:active &::after {
    box-shadow: inset 0 0 0 2px rgba(0, 0, 0, 0.18);
  }
`;

export const PostMap = styled.img`
  width: 100%;
  height: 150px;
  object-fit: cover;
  display: block;
`;

export const PostPlaceName = styled.div`
  padding: 14px 12px;
  font-size: 16px;
  font-weight: 500;
  color: ${(p) => p.theme.text};
  border: 2px solid rgba(0, 0, 0, 0.1);
  border-top: none;
  border-radius: 0 0 ${RADIUS} ${RADIUS};
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  transition: border-color 0.15s ease;
  & > span {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    min-width: 0;
  }
`;

export const PostPlaceAddress = styled.span`
  font-weight: 400;
  color: ${(p) => p.theme.textSecondary};
`;

export const SaveToListButton = styled.button`
  position: absolute;
  top: 0;
  right: 0;
  padding: 10px;
  padding-left: 10px;
  padding-right: 10px;
  border: none;
  background: none;
  cursor: pointer;
  z-index: 2;
  display: flex;
  align-items: center;
  justify-content: center;
  & > span {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
    height: 34px;
    min-width: 34px;
    padding: ${(p) => p.$loading ? "0" : "0 12px 0 8px"};
    border-radius: 10px;
    font-size: 13px;
    font-weight: 600;
    color: #fff;
    background: rgba(0, 0, 0, 0.5);
    backdrop-filter: blur(12px);
    -webkit-backdrop-filter: blur(12px);
    box-shadow: 0 2px 8px rgba(0,0,0,0.3);
  }
  @media (hover: hover) {
    &:hover > span { background: rgba(0, 0, 0, 0.65); }
  }
  &:active > span { background: rgba(0, 0, 0, 0.7); }
`;

export const SaveToListDropdown = styled.div`
  margin-top: 4px;
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

export const SaveToListItem = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px;
  min-height: 44px;
  box-sizing: border-box;
  cursor: pointer;
  font-size: 16px;
  font-weight: 600;
  color: ${(p) => p.theme.text};
  @media (hover: hover) { &:hover { background: ${(p) => p.theme.bgHover}; } }
  &[disabled] { opacity: 0.5; cursor: default; pointer-events: none; }
`;

export const ListItemIcon = styled.div`
  width: 24px;
  height: 24px;
  border-radius: 50%;
  background: ${(p) => p.theme.bgControl};
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 11px;
  color: ${(p) => p.theme.text};
  flex-shrink: 0;
  outline: 1px solid rgba(0, 0, 0, 0.1);
  outline-offset: -1px;
`;
