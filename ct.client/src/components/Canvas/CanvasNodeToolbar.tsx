import React from 'react';

export function CanvasNodeToolbar({ nodeId, onDelete, onDuplicate, onRename, onConnect }: {
  nodeId: string;
  onDelete: (id: string) => void;
  onDuplicate: (id: string) => void;
  onRename: (id: string) => void;
  onConnect: (id: string) => void;
}) {
  const btnStyle: React.CSSProperties = {
    width: '26px', height: '26px', display: 'flex', alignItems: 'center', justifyContent: 'center',
    borderRadius: '4px', border: '1px solid rgba(255,255,255,0.15)',
    background: 'rgba(20,20,35,0.92)', color: 'var(--on-surface-muted)',
    cursor: 'pointer', fontSize: '12px', transition: 'all 0.15s',
  };
  return (
    <div style={{
      position: 'absolute', top: '-36px', left: '50%', transform: 'translateX(-50%)',
      display: 'flex', gap: '4px', zIndex: 40,
      background: 'rgba(15,15,30,0.95)', padding: '4px 6px', borderRadius: '8px',
      border: '1px solid rgba(255,255,255,0.1)', boxShadow: '0 4px 12px rgba(0,0,0,0.4)',
    }}>
      <button aria-label="Connect" title="Connect" onClick={() => onConnect(nodeId)} style={btnStyle} onMouseEnter={e => { e.currentTarget.style.color = 'var(--primary)'; e.currentTarget.style.borderColor = 'var(--primary)'; }} onMouseLeave={e => { e.currentTarget.style.color = 'var(--on-surface-muted)'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.15)'; }}>🔗</button>
      <button aria-label="Rename" title="Rename" onClick={() => onRename(nodeId)} style={btnStyle} onMouseEnter={e => { e.currentTarget.style.color = 'var(--secondary)'; e.currentTarget.style.borderColor = 'var(--secondary)'; }} onMouseLeave={e => { e.currentTarget.style.color = 'var(--on-surface-muted)'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.15)'; }}>✏️</button>
      <button aria-label="Duplicate" title="Duplicate" onClick={() => onDuplicate(nodeId)} style={btnStyle} onMouseEnter={e => { e.currentTarget.style.color = '#22c55e'; e.currentTarget.style.borderColor = '#22c55e'; }} onMouseLeave={e => { e.currentTarget.style.color = 'var(--on-surface-muted)'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.15)'; }}>📋</button>
      <button aria-label="Delete" title="Delete" onClick={() => onDelete(nodeId)} style={btnStyle} onMouseEnter={e => { e.currentTarget.style.color = 'var(--error)'; e.currentTarget.style.borderColor = 'var(--error)'; }} onMouseLeave={e => { e.currentTarget.style.color = 'var(--on-surface-muted)'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.15)'; }}>🗑</button>
    </div>
  );
}