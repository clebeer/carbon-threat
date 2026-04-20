import React, { useState } from 'react';
import { JulesCreateSessionModal } from './JulesCreateSessionModal';
import type { ScanFinding } from '../../api/scanner';

interface Props {
  finding: ScanFinding;
  julesConfigured?: boolean;
}

export function JulesButton({ finding, julesConfigured = true }: Props) {
  const [showModal, setShowModal] = useState(false);

  if (!julesConfigured) {
    return (
      <span title="Configure JULES_API_KEY para usar esta feature" style={{ cursor: 'not-allowed' }}>
        <button
          disabled
          style={{
            padding: '3px 10px', borderRadius: '4px', fontSize: '10px', cursor: 'not-allowed',
            border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.03)',
            color: 'var(--on-surface-muted)', fontFamily: 'var(--font-label)', letterSpacing: '0.3px',
          }}
        >
          Jules
        </button>
      </span>
    );
  }

  return (
    <>
      <button
        onClick={e => { e.stopPropagation(); setShowModal(true); }}
        style={{
          padding: '3px 10px', borderRadius: '4px', fontSize: '10px', cursor: 'pointer',
          border: '1px solid rgba(0,242,255,0.3)', background: 'rgba(0,242,255,0.08)',
          color: 'var(--primary)', fontFamily: 'var(--font-label)', letterSpacing: '0.3px',
        }}
      >
        Jules
      </button>
      {showModal && (
        <JulesCreateSessionModal
          finding={finding}
          onClose={() => setShowModal(false)}
        />
      )}
    </>
  );
}
