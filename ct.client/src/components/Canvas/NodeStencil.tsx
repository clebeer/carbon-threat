import React from 'react';
import type { DomainPack } from '../../api/domainPacks';
import { DomainIcon } from './DomainIcon';
import { DEFAULT_STENCIL } from './assets/stencil';

export function NodeStencil({ onAdd, pack }: { onAdd: (kind: string) => void; pack?: DomainPack | null }) {
  const stencilItems = pack?.icon_manifest?.nodeTypes
    ? Object.entries(pack.icon_manifest.nodeTypes).map(([kind, def]) => ({ kind, label: def.label }))
    : DEFAULT_STENCIL;

  const onDragStart = (e: React.DragEvent<HTMLButtonElement>, kind: string) => {
    e.dataTransfer.setData('application/reactflow-kind', kind);
    e.dataTransfer.effectAllowed = 'move';
  };

  return (
    <div className="glass-panel" style={{ width: '72px', display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '10px 6px', gap: '6px', borderRadius: 0, borderTop: 'none', borderBottom: 'none', borderLeft: 'none', borderRight: '1px solid rgba(255,255,255,0.06)', zIndex: 20, overflowY: 'auto' }}>
      <div style={{ fontSize: '9px', letterSpacing: '1px', color: 'var(--on-surface-muted)', marginBottom: '6px', textTransform: 'uppercase', textAlign: 'center' }}>ADD</div>
      {stencilItems.map(({ kind, label }) => (
        <button
          key={kind}
          title={`Add ${label}`}
          draggable
          onDragStart={(e) => onDragStart(e, kind)}
          onClick={() => onAdd(kind)}
          style={{ width: '56px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px', padding: '8px 4px', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.08)', background: 'rgba(255,255,255,0.03)', color: 'var(--on-surface-muted)', cursor: 'grab', transition: 'all 0.15s', fontSize: '10px' }}
          onMouseEnter={(e: React.MouseEvent<HTMLButtonElement>) => { e.currentTarget.style.borderColor = 'rgba(0,242,255,0.4)'; e.currentTarget.style.color = 'var(--primary)'; }}
          onMouseLeave={(e: React.MouseEvent<HTMLButtonElement>) => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.08)'; e.currentTarget.style.color = 'var(--on-surface-muted)'; }}
        >
          <DomainIcon kind={kind} pack={pack} />
          <span style={{ textAlign: 'center', lineHeight: 1.2 }}>{label}</span>
        </button>
      ))}
    </div>
  );
}