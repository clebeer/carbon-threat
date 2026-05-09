export const EDGE_TYPES_LIST = [
  { type: 'data-flow', label: 'Data Flow', color: 'var(--primary)', icon: '→' },
  { type: 'trust-crossing', label: 'Trust Crossing', color: '#f59e0b', icon: '⇢' },
  { type: 'control-flow', label: 'Control Flow', color: '#22c55e', icon: '⟿' },
] as const;

export const EDGE_TYPE_STYLES: Record<string, { stroke: string; strokeDasharray?: string; strokeWidth: number }> = {
  'data-flow':     { stroke: 'var(--primary)', strokeWidth: 2 },
  'trust-crossing': { stroke: '#f59e0b', strokeDasharray: '8 4', strokeWidth: 2 },
  'control-flow':  { stroke: '#22c55e', strokeDasharray: '4 4', strokeWidth: 2 },
};