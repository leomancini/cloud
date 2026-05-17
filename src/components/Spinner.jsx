import React from "react";
import { SpinnerRing } from "../styles/common.js";

export const Spinner = ({ size } = {}) => <SpinnerRing $size={size} />;
export const BigSpinner = () => <Spinner size="24px" />;
