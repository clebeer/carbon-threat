import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { listPacks, type DomainPack } from '../../api/domainPacks';

interface DomainSelectorProps {
  activePack: string;
  onPackChange: (slug: string) => void;
}

export default function DomainSelector({ activePack, onPackChange }: DomainSelectorProps) {
  const [open, setOpen] = useState(false);

  const { data: packs = [] } = useQuery<DomainPack[]>({
    queryKey: ['domain-packs'],
    queryFn: listPacks,
    staleTime: Infinity,
  });

  const current = packs.find(p => p.slug === activePack);

  const PACK_ICONS: Record<string, string> = {
    generic: '⬡',
    aws:     '☁',
    azure:   '△',
    iot:     '◉',
    k8s:     '⎈',
  };

  return (
    <div style={{ position: 'relative' }}>
      <button
        onClick={() => setOpen(v => !v)}
        title="Switch domain pack"
        style={{
          display: 'flex', alignItems: 'center', gap: '6px',
          padding: '5px 10px', borderRadius: '6px',
          border: `1px solid ${open ? 'rgba(0,242,255,0.4)' : 'rgba(255,255,255,0.12)'}`,
          background: open ? 'rgba(0,242,255,0.08)' : 'rgba(255,255,255,0.04)',
          color: open ? 'var(--primary)' : 'var(--on-surface-muted)',
          fontSize: '12px', cursor: 'pointer', transition: 'all 0.15s',
        }}
      >
        <span>{PACK_ICONS[activePack] ?? '⬡'}</span>
        <span style={{ fontFamily: 'var(--font-label)', letterSpacing: '0.5px' }}>
          {current?.name ?? activePack.toUpperCase()}
        </span>
        <span style={{ fontSize: '9px', opacity: 0.6 }}>▼</span>
      </button>

      {open && (
        <div
          className="glass-panel"
          style={{ position: 'absolute', top: 'calc(100% + 6px)', left: 0, minWidth: '200px', zIndex: 100, padding: '8px', display: 'flex', flexDirection: 'column', gap: '4px' }}
        >
          <div style={{ fontSize: '10px', color: 'var(--on-surface-muted)', padding: '2px 8px 6px', letterSpacing: '0.5px' }}>DOMAIN PACK</div>
          {packs.map(p => (
            <button
              key={p.slug}
              onClick={() => { onPackChange(p.slug); setOpen(false); }}
              style={{
                display: 'flex', alignItems: 'center', gap: '10px',
                padding: '8px 10px', borderRadius: '6px', textAlign: 'left',
                border: `1px solid ${p.slug === activePack ? 'rgba(0,242,255,0.3)' : 'transparent'}`,
                background: p.slug === activePack ? 'rgba(0,242,255,0.08)' : 'transparent',
                color: p.slug === activePack ? 'var(--primary)' : '#e2e8f0',
                cursor: 'pointer', fontSize: '13px', width: '100%', transition: 'all 0.1s',
              }}
            >
              <span style={{ fontSize: '18px' }}>{PACK_ICONS[p.slug] ?? '⬡'}</span>
              <div>
                <div style={{ fontWeight: 500 }}>{p.name}</div>
                {p.description && <div style={{ fontSize: '10px', color: 'var(--on-surface-muted)', marginTop: '1px' }}>{p.description}</div>}
              </div>
              {p.slug === activePack && <span style={{ marginLeft: 'auto', fontSize: '12px' }}>✓</span>}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
