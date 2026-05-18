import React from 'react';
import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion';

export type SlideSceneProps = {
  title: string;
  subtitle?: string;
  bullets: string[];
  accent?: string;
  kicker?: string;
  fontFamily: string;
};

export const SlideScene: React.FC<SlideSceneProps> = ({
  title,
  subtitle,
  bullets,
  accent = '#f97316',
  kicker,
  fontFamily,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const entrance = spring({ frame, fps, config: { damping: 18, mass: 0.7 } });
  const slideY = interpolate(entrance, [0, 1], [48, 0]);
  const fade = interpolate(frame, [0, 10], [0, 1], { extrapolateRight: 'clamp' });

  return (
    <AbsoluteFill
      style={{
        background: 'linear-gradient(155deg, #0c0a09 0%, #1c1917 38%, #292524 72%, #431407 100%)',
        fontFamily,
        color: '#fafaf9',
        padding: '100px 120px',
        boxSizing: 'border-box',
      }}
    >
      <div
        style={{
          opacity: fade,
          transform: `translateY(${slideY}px)`,
          maxWidth: 1520,
        }}
      >
        {kicker ? (
          <p
            style={{
              margin: '0 0 20px',
              fontSize: 28,
              fontWeight: 600,
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
              color: accent,
            }}
          >
            {kicker}
          </p>
        ) : null}
        <h1
          style={{
            margin: 0,
            fontSize: 86,
            fontWeight: 900,
            lineHeight: 1.05,
            letterSpacing: -2,
          }}
        >
          {title}
        </h1>
        {subtitle ? (
          <p
            style={{
              margin: '28px 0 0',
              fontSize: 38,
              fontWeight: 500,
              color: '#d6d3d1',
              lineHeight: 1.35,
              maxWidth: '42ch',
            }}
          >
            {subtitle}
          </p>
        ) : null}
        <ul
          style={{
            margin: '52px 0 0',
            padding: 0,
            listStyle: 'none',
            display: 'flex',
            flexDirection: 'column',
            gap: 22,
          }}
        >
          {bullets.map((line, i) => {
            const delay = 8 + i * 5;
            const itemOp = interpolate(frame, [delay, delay + 12], [0, 1], {
              extrapolateLeft: 'clamp',
              extrapolateRight: 'clamp',
            });
            const itemX = interpolate(frame, [delay, delay + 12], [24, 0], {
              extrapolateLeft: 'clamp',
              extrapolateRight: 'clamp',
            });
            return (
              <li
                key={i}
                style={{
                  opacity: itemOp,
                  transform: `translateX(${itemX}px)`,
                  fontSize: 34,
                  fontWeight: 500,
                  color: '#e7e5e4',
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: 20,
                }}
              >
                <span style={{ color: accent, fontWeight: 800, flexShrink: 0 }}>✓</span>
                <span>{line}</span>
              </li>
            );
          })}
        </ul>
      </div>
    </AbsoluteFill>
  );
};
