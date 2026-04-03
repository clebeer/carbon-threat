/**
 * ReactFlow mock — replaces the real package in jsdom tests.
 *
 * ReactFlow depends on browser APIs (ResizeObserver, SVG, pointer events)
 * that jsdom cannot fully emulate. This minimal stub lets components that
 * render <ReactFlow> or import its hooks compile and mount without errors.
 */

import React from 'react';

// ── types (minimal subset used in the codebase) ───────────────────────────────

export type Node = { id: string; type?: string; data?: unknown; position?: { x: number; y: number } };
export type Edge = { id: string; source: string; target: string };
export type OnSelectionChangeParams = { nodes: Node[]; edges: Edge[] };
export type NodeProps = { id: string; data: unknown };
export type Connection = { source: string; target: string };
export type ReactFlowInstance = {
  getNodes: () => Node[];
  setNodes: (nodes: Node[]) => void;
};

// ── component ─────────────────────────────────────────────────────────────────

const ReactFlow = React.forwardRef<HTMLDivElement, Record<string, unknown>>(
  function ReactFlow({ children, ...rest }, ref) {
    return (
      <div
        ref={ref}
        data-testid="react-flow"
        {...(rest as React.HTMLAttributes<HTMLDivElement>)}
      >
        {children as React.ReactNode}
      </div>
    );
  }
);

export default ReactFlow;

// ── named exports ─────────────────────────────────────────────────────────────

export const Background = () => null;
export const Controls   = () => null;
export const MiniMap    = () => null;
export const Handle     = () => null;
export const Panel      = ({ children }: { children?: React.ReactNode }) => <div>{children}</div>;

export const ReactFlowProvider = ({ children }: { children?: React.ReactNode }) => <>{children}</>;

export const useReactFlow = (): ReactFlowInstance => ({
  getNodes: () => [],
  setNodes: () => {},
});

export const useNodesState = (initial: Node[]) => {
  const [nodes, setNodes] = React.useState(initial);
  return [nodes, setNodes, () => {}] as const;
};

export const useEdgesState = (initial: Edge[]) => {
  const [edges, setEdges] = React.useState(initial);
  return [edges, setEdges, () => {}] as const;
};

export const addEdge = (connection: Connection, edges: Edge[]): Edge[] => [
  ...edges,
  { id: `${connection.source}-${connection.target}`, ...connection },
];

export const MarkerType = { Arrow: 'arrow', ArrowClosed: 'arrowclosed' } as const;
export const Position   = { Top: 'top', Bottom: 'bottom', Left: 'left', Right: 'right' } as const;
