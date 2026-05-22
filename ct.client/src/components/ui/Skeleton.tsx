import React from 'react';

export interface SkeletonProps {
  width?: string | number;
  height?: string | number;
  radius?: string;
  style?: React.CSSProperties;
}

/** Placeholder block for async content. Decorative — hidden from screen readers. */
const Skeleton = ({ width = '100%', height = 16, radius = 'var(--radius-sm)', style }: SkeletonProps) => (
  <span
    aria-hidden="true"
    style={{
      display: 'block',
      width,
      height,
      borderRadius: radius,
      background: 'var(--border-subtle)',
      animation: 'ct-skeleton-pulse 1.4s ease-in-out infinite',
      ...style,
    }}
  />
);

export default Skeleton;
