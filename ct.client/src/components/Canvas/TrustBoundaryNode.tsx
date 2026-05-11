import { Handle, Position, type NodeProps } from 'reactflow';
import type { CyberNodeData } from './CyberNode';

export function TrustBoundaryNode({ data }: NodeProps<CyberNodeData>) {
  return (
    <div style={{
      width: '100%', height: '100%',
      border: '2px dashed #f59e0b',
      borderRadius: '12px',
      background: 'rgba(245, 158, 11, 0.06)',
      display: 'flex', alignItems: 'flex-start', justifyContent: 'flex-start',
      padding: '8px 14px',
      minHeight: '120px', minWidth: '200px',
    }}>
      <span style={{
        fontSize: '11px', fontWeight: 600, color: '#f59e0b',
        letterSpacing: '0.5px', textTransform: 'uppercase',
        background: 'rgba(15,15,25,0.7)', padding: '2px 8px', borderRadius: '4px',
      }}>
        ⬡ {data.label}
      </span>
      <Handle type="target" position={Position.Top} style={{ background: '#f59e0b', width: 8, height: 8, border: 'none' }} />
      <Handle type="source" position={Position.Bottom} style={{ background: '#f59e0b', width: 8, height: 8, border: 'none' }} />
      <Handle type="source" position={Position.Right} style={{ background: '#f59e0b', width: 8, height: 8, border: 'none' }} id="r" />
      <Handle type="target" position={Position.Left} style={{ background: '#f59e0b', width: 8, height: 8, border: 'none' }} id="l" />
    </div>
  );
}