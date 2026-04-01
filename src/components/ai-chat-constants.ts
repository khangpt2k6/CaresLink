import type { Transition, Variants } from "framer-motion";

/* ─── Panel ─── */

export const WIDTH_DEFAULT = 370;
export const WIDTH_EXPANDED = 540;

export const panelTransition: Transition = {
  type: "spring",
  damping: 28,
  stiffness: 300,
};

/* ─── Messages ─── */

export const messageVariants: Variants = {
  hidden: { opacity: 0, y: 8, scale: 0.97 },
  visible: { opacity: 1, y: 0, scale: 1 },
};

export const messageTransition: Transition = {
  duration: 0.22,
  ease: [0.16, 1, 0.3, 1],
};

/* ─── Empty state / welcome ─── */

export const welcomeTransition: Transition = {
  delay: 0.15,
  duration: 0.3,
};

/* ─── Quick‑action buttons (staggered) ─── */

export function quickActionTransition(index: number): Transition {
  return {
    delay: 0.2 + index * 0.05,
    duration: 0.25,
    ease: [0.16, 1, 0.3, 1],
  };
}

/* ─── History dropdown ─── */

export const dropdownVariants: Variants = {
  hidden: { opacity: 0, y: -4 },
  visible: { opacity: 1, y: 0 },
};

export const dropdownTransition: Transition = {
  duration: 0.15,
};

/* ─── Integrations panel ─── */

export const integrationsPanelVariants: Variants = {
  hidden: { height: 0, opacity: 0 },
  visible: { height: "auto", opacity: 1 },
};

export const integrationsPanelTransition: Transition = {
  duration: 0.2,
};

/* ─── Loading dots ─── */

export const loadingDotAnimate = { y: [0, -4, 0] };

export function loadingDotTransition(index: number): Transition {
  return {
    delay: index * 0.15,
    repeat: Infinity,
    duration: 0.8,
    ease: "easeInOut",
  };
}

/* ─── Button micro‑interactions ─── */

export const buttonHover = { scale: 1.1 };
export const buttonTap = { scale: 0.9 };
export const fabHover = { scale: 1.06 };
export const fabTap = { scale: 0.94 };
export const sendHover = { scale: 1.08 };
export const sendTap = { scale: 0.92 };
export const deleteHover = { scale: 1.15 };

/* ─── Colors (design tokens) ─── */

export const colors = {
  primary: "#0090d9",
  primaryDark: "#0077b6",
  bgLight: "#fafbfc",
  bgCard: "#f5f7fa",
  bgBubble: "#f5f7fa",
  bgAccent: "#e8f4fd",
  text: "#1a2b3c",
  textMuted: "#8a95a3",
  textFaint: "#b0bec8",
  border: "#e2e8f0",
  borderInner: "#e8ecf2",
  bullet: "#0090d9",
} as const;
