import React from 'react';

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Inner padding token size. Defaults to a comfortable 24px. */
  padding?: string;
}

/**
 * Glassmorphism surface container. Wraps the existing `.glass-panel` utility so
 * every card shares the same blur/border/shadow and a consistent padding.
 */
const Card = ({ padding = 'var(--space-6)', className, style, children, ...rest }: CardProps) => (
  <div
    className={className ? `glass-panel ${className}` : 'glass-panel'}
    style={{ padding, ...style }}
    {...rest}
  >
    {children}
  </div>
);

export default Card;
