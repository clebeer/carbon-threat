import React, { useState } from 'react';
import Modal from '../ui/Modal';
import Field from '../ui/Field';
import Button from '../ui/Button';

export function EdgeLabelModal({ current, onConfirm, onCancel }: {
  current: string;
  onConfirm: (label: string) => void;
  onCancel: () => void;
}) {
  const [val, setVal] = useState(current);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    onConfirm(val);
  }

  return (
    <Modal open onClose={onCancel} title="Edge Label / Data Flow" style={{ width: 320 }}>
      <form onSubmit={handleSubmit}>
        <Field
          label="Label"
          autoFocus
          placeholder="e.g. HTTPS, TCP/443, gRPC, SQL…"
          value={val}
          onChange={(e) => setVal(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Escape') onCancel(); }}
        />
        <div style={{ display: 'flex', gap: 'var(--space-3)', marginTop: 'var(--space-2)' }}>
          <Button variant="secondary" style={{ flex: 1 }} onClick={onCancel} type="button">
            Cancel
          </Button>
          <Button variant="primary" style={{ flex: 1 }} type="submit">
            Apply
          </Button>
        </div>
      </form>
    </Modal>
  );
}
