import React, { useState } from 'react';

export function EdgeLabelModal({ current, onConfirm, onCancel }: { current: string; onConfirm: (label: string) => void; onCancel: () => void }) {
  const [val, setVal] = useState(current);
  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.5)' }}>
      <div className="glass-panel" style={{ padding: '24px', width: '320px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
        <p style={{ margin: 0, fontSize: '13px', color: 'var(--on-surface-muted)', fontFamily: 'var(--font-label)', letterSpacing: '0.5px' }}>EDGE LABEL / DATA FLOW</p>
        <input
          autoFocus
          type="text"
          value={val}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) => setVal(e.target.value)}
          onKeyDown={(e: React.KeyboardEvent<HTMLInputElement>) => { if (e.key === 'Enter') onConfirm(val); if (e.key === 'Escape') onCancel(); }}
          placeholder="e.g. HTTPS, TCP/443, gRPC, SQL…"
          style={{ padding: '10px 12px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: '#fff', borderRadius: '4px', fontSize: '14px', outline: 'none' }}
        />
        <div style={{ display: 'flex', gap: '10px' }}>
          <button onClick={onCancel} style={{ flex: 1, padding: '8px', background: 'transparent', border: '1px solid rgba(255,255,255,0.1)', color: 'var(--on-surface-muted)', borderRadius: '4px', cursor: 'pointer' }}>Cancel</button>
          <button onClick={() => onConfirm(val)} style={{ flex: 1, padding: '8px', background: 'var(--primary)', border: 'none', color: '#000', fontWeight: 'bold', borderRadius: '4px', cursor: 'pointer' }}>Apply</button>
        </div>
      </div>
    </div>
  );
}