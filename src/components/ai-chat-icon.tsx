"use client";

import { motion } from "framer-motion";

interface CaresLinkIconProps {
  size?: number;
  animate?: boolean;
  className?: string;
}

/**
 * Animated cosmic orb — glowing rings, shifting gradients, floating particles.
 * Inspired by Claude's orb aesthetic. Pure SVG + framer-motion, no images.
 */
export function CaresLinkIcon({
  size = 32,
  animate = false,
  className,
}: CaresLinkIconProps) {
  const id = animate ? "anim" : "static";

  return (
    <motion.svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 100 100"
      width={size}
      height={size}
      fill="none"
      className={className}
      whileHover={{ scale: 1.1 }}
    >
      <defs>
        {/* Core radial glow */}
        <radialGradient id={`${id}-core`} cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#a78bfa" stopOpacity="0.9" />
          <stop offset="50%" stopColor="#6366f1" stopOpacity="0.7" />
          <stop offset="100%" stopColor="#0ea5e9" stopOpacity="0" />
        </radialGradient>

        {/* Outer halo */}
        <radialGradient id={`${id}-halo`} cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#c4b5fd" stopOpacity="0" />
          <stop offset="60%" stopColor="#818cf8" stopOpacity="0.15" />
          <stop offset="100%" stopColor="#38bdf8" stopOpacity="0.3" />
        </radialGradient>

        {/* Inner shine */}
        <radialGradient id={`${id}-shine`} cx="38%" cy="35%" r="30%">
          <stop offset="0%" stopColor="white" stopOpacity="0.6" />
          <stop offset="100%" stopColor="white" stopOpacity="0" />
        </radialGradient>

        {/* Blur for glow effect */}
        <filter id={`${id}-blur`}>
          <feGaussianBlur stdDeviation="2" />
        </filter>
        <filter id={`${id}-blur-lg`}>
          <feGaussianBlur stdDeviation="4" />
        </filter>
      </defs>

      {/* ── Outer pulsing halo ── */}
      <motion.circle
        cx="50"
        cy="50"
        r="46"
        fill={`url(#${id}-halo)`}
        animate={animate ? { r: [44, 48, 44], opacity: [0.4, 0.7, 0.4] } : undefined}
        transition={animate ? { duration: 3, repeat: Infinity, ease: "easeInOut" } : undefined}
      />

      {/* ── Orbiting ring 1 ── */}
      <motion.ellipse
        cx="50"
        cy="50"
        rx="34"
        ry="12"
        stroke="url(#cross-ring1)"
        strokeWidth="1.2"
        fill="none"
        opacity="0.5"
        animate={animate ? { rotate: 360 } : { rotate: 0 }}
        transition={animate ? { duration: 8, repeat: Infinity, ease: "linear" } : undefined}
        style={{ originX: "50px", originY: "50px" }}
      />
      <defs>
        <linearGradient id="cross-ring1" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#a78bfa" stopOpacity="0.8" />
          <stop offset="50%" stopColor="#38bdf8" stopOpacity="0.1" />
          <stop offset="100%" stopColor="#a78bfa" stopOpacity="0.8" />
        </linearGradient>
      </defs>

      {/* ── Orbiting ring 2 (tilted) ── */}
      <motion.ellipse
        cx="50"
        cy="50"
        rx="30"
        ry="10"
        stroke="#818cf8"
        strokeWidth="0.8"
        fill="none"
        opacity="0.35"
        transform="rotate(-35 50 50)"
        animate={animate ? { rotate: -360 } : { rotate: -35 }}
        transition={animate ? { duration: 12, repeat: Infinity, ease: "linear" } : undefined}
        style={{ originX: "50px", originY: "50px", transformBox: "fill-box" }}
      />

      {/* ── Orbiting ring 3 (opposite tilt) ── */}
      <motion.ellipse
        cx="50"
        cy="50"
        rx="36"
        ry="8"
        stroke="#6366f1"
        strokeWidth="0.6"
        fill="none"
        opacity="0.25"
        transform="rotate(55 50 50)"
        animate={animate ? { rotate: 360 } : { rotate: 55 }}
        transition={animate ? { duration: 15, repeat: Infinity, ease: "linear" } : undefined}
        style={{ originX: "50px", originY: "50px", transformBox: "fill-box" }}
      />

      {/* ── Core orb with breathing glow ── */}
      <motion.circle
        cx="50"
        cy="50"
        r="20"
        fill={`url(#${id}-core)`}
        filter={`url(#${id}-blur)`}
        animate={animate ? { r: [19, 22, 19], opacity: [0.85, 1, 0.85] } : undefined}
        transition={animate ? { duration: 2.5, repeat: Infinity, ease: "easeInOut" } : undefined}
      />

      {/* ── Solid inner sphere ── */}
      <circle cx="50" cy="50" r="16" fill="#6366f1" />
      <motion.circle
        cx="50"
        cy="50"
        r="16"
        fill="url(#inner-shift)"
        animate={animate ? { opacity: [0.3, 0.6, 0.3] } : { opacity: 0.4 }}
        transition={animate ? { duration: 3.5, repeat: Infinity, ease: "easeInOut" } : undefined}
      />
      <defs>
        <linearGradient id="inner-shift" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#0ea5e9" />
          <stop offset="100%" stopColor="#a78bfa" />
        </linearGradient>
      </defs>

      {/* ── Inner highlight / shine ── */}
      <circle cx="50" cy="50" r="16" fill={`url(#${id}-shine)`} />

      {/* ── Floating particles ── */}
      {animate && (
        <>
          {[
            { cx: 28, cy: 30, delay: 0, dur: 3.2 },
            { cx: 72, cy: 26, delay: 0.8, dur: 2.8 },
            { cx: 24, cy: 65, delay: 1.5, dur: 3.5 },
            { cx: 74, cy: 70, delay: 0.4, dur: 3.0 },
            { cx: 50, cy: 18, delay: 2.0, dur: 2.6 },
            { cx: 38, cy: 78, delay: 1.2, dur: 3.3 },
          ].map((p, i) => (
            <motion.circle
              key={i}
              cx={p.cx}
              cy={p.cy}
              r="1.5"
              fill="#c4b5fd"
              animate={{
                cy: [p.cy, p.cy - 8, p.cy],
                opacity: [0.3, 0.9, 0.3],
                scale: [0.8, 1.3, 0.8],
              }}
              transition={{
                delay: p.delay,
                duration: p.dur,
                repeat: Infinity,
                ease: "easeInOut",
              }}
            />
          ))}
        </>
      )}

      {/* ── Sparkle flares ── */}
      {animate && (
        <>
          {[
            { x: 35, y: 35, delay: 0 },
            { x: 62, y: 42, delay: 1.5 },
            { x: 48, y: 62, delay: 3 },
          ].map((s, i) => (
            <motion.g key={`s${i}`} transform={`translate(${s.x}, ${s.y})`}>
              <motion.line
                x1="-3" y1="0" x2="3" y2="0"
                stroke="white"
                strokeWidth="1"
                strokeLinecap="round"
                animate={{ opacity: [0, 0.8, 0], scaleX: [0.5, 1, 0.5] }}
                transition={{
                  delay: s.delay,
                  duration: 2,
                  repeat: Infinity,
                  ease: "easeInOut",
                }}
              />
              <motion.line
                x1="0" y1="-3" x2="0" y2="3"
                stroke="white"
                strokeWidth="1"
                strokeLinecap="round"
                animate={{ opacity: [0, 0.8, 0], scaleY: [0.5, 1, 0.5] }}
                transition={{
                  delay: s.delay,
                  duration: 2,
                  repeat: Infinity,
                  ease: "easeInOut",
                }}
              />
            </motion.g>
          ))}
        </>
      )}
    </motion.svg>
  );
}
