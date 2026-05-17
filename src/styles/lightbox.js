import styled, { keyframes, css } from "styled-components";
import { RADIUS, RADIUS_SM, ICON_GAP } from "../theme.js";

export const fadeIn = keyframes`from { opacity: 0; } to { opacity: 1; }`;
export const fadeOut = keyframes`from { opacity: 1; } to { opacity: 0; }`;
export const slideUp = keyframes`from { transform: translateY(20px) scale(0.96); opacity: 0; } to { transform: translateY(0) scale(1); opacity: 1; }`;
export const slideDown = keyframes`from { transform: translateY(0) scale(1); opacity: 1; } to { transform: translateY(40px) scale(0.94); opacity: 0; }`;

export const LightboxBackdrop = styled.div`
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

export const LightboxImg = styled.img`
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

export const LightboxClose = styled.button`
  position: fixed;
  top: 20px;
  right: 20px;
  width: 36px;
  height: 36px;
  border-radius: 50%;
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
