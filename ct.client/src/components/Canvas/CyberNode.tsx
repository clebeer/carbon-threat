/* eslint-disable react-refresh/only-export-components */
import React, { useState } from 'react';
import { Handle, Position, type NodeProps } from 'reactflow';
import type { DomainPack } from '../../api/domainPacks';
import { DomainIcon } from './DomainIcon';
import { CanvasNodeToolbar } from './CanvasNodeToolbar';
import { useAnalysisStore } from '../../store/analysisStore';

export interface CyberNodeData {
  label: string;
  kind: string;
  selected?: boolean;
  highlighted?: boolean;
  packSlug?: string;
}

/** Mutable shared state (set by ThreatFlowInner, read by CyberNode) */
export const cyberNodeState = {
  activePack: null as DomainPack | null,
  toolbarActions: null as {
    onDelete: (id: string) => void;
    onDuplicate: (id: string) => void;
    onRename: (id: string) => void;
    onConnect: (id: string) => void;
  } | null,
};

export const CyberNode = ({ data, id }: NodeProps<CyberNodeData>) => {
  const highlightedNodeIds = useAnalysisStore(s => s.highlightedNodeIds);
  const isHighlighted = highlightedNodeIds.has(id);
  const [hovered, setHovered] = useState(false);

  return (
    <div
      style={{ position: 'relative', display: 'flex', justifyContent: 'center' }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {/* Mini-toolbar on hover */}
      {hovered && cyberNodeState.toolbarActions && (
        <CanvasNodeToolbar
          nodeId={id}
          onDelete={cyberNodeState.toolbarActions.onDelete}
          onDuplicate={cyberNodeState.toolbarActions.onDuplicate}
          onRename={cyberNodeState.toolbarActions.onRename}
          onConnect={cyberNodeState.toolbarActions.onConnect}
        />
      )}
      <div
        className="ct-node"
        style={{
          borderColor: isHighlighted ? 'var(--error)' : data.selected ? 'var(--secondary)' : undefined,
          boxShadow: isHighlighted
            ? '0 0 20px rgba(255,77,79,0.6), 0 0 40px rgba(255,77,79,0.3)'
            : data.selected ? '0 0 18px var(--secondary)' : undefined,
          transition: 'box-shadow 0.2s, border-color 0.2s',
        }}
      >
        <DomainIcon kind={data.kind} pack={cyberNodeState.activePack} />
      </div>
      <div className="ct-node-label">{data.label}</div>
      <Handle type="target" position={Position.Top}    style={{ background: 'var(--primary)', width: 8, height: 8, border: 'none' }} />
      <Handle type="source" position={Position.Bottom} style={{ background: 'var(--primary)', width: 8, height: 8, border: 'none' }} />
      <Handle type="source" position={Position.Right}  style={{ background: 'var(--primary)', width: 8, height: 8, border: 'none' }} id="r" />
      <Handle type="target" position={Position.Left}   style={{ background: 'var(--primary)', width: 8, height: 8, border: 'none' }} id="l" />
    </div>
  );
};