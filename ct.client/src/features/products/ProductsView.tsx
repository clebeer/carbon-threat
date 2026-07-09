import React, { useState } from 'react';
import { Button, Icon, Mono, Spinner } from '../../ui/primitives';
import { useOrgs, useBusinessUnits, useProducts } from '../../api/carbon';
import { BusinessUnit, Organization, Product } from '../../domain/types';
import { useToast } from '../../components/ui';

/** Chevron-right glyph (not in the shared ICONS map — decorative "drill-in" affordance only). */
const CHEVRON_RIGHT = 'm9 18 6-6-6-6';

const columnHeaderStyle: React.CSSProperties = {
  padding: '14px 16px',
  borderBottom: '1px solid var(--border)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
};

const addBtnStyle: React.CSSProperties = {
  width: 26,
  height: 26,
  borderRadius: 7,
  background: 'var(--accent-soft)',
  color: 'var(--accent-text)',
  border: 'none',
  cursor: 'pointer',
  fontSize: 16,
  fontWeight: 600,
  lineHeight: 1,
  fontFamily: 'inherit',
};

function ColumnHeader({ title, addLabel, onAdd }: { title: string; addLabel: string; onAdd: () => void }) {
  return (
    <div style={columnHeaderStyle}>
      <h3 style={{ fontSize: 13, fontWeight: 600, margin: 0 }}>{title}</h3>
      <button type="button" style={addBtnStyle} aria-label={addLabel} onClick={onAdd}>+</button>
    </div>
  );
}

function EmptyRow({ message }: { message: string }) {
  return (
    <div style={{ padding: '24px 16px', fontSize: 13, color: 'var(--text-3)', textAlign: 'center' }}>{message}</div>
  );
}

function ListRow({
  selected, onSelect, isLast, children,
}: {
  selected?: boolean;
  onSelect?: () => void;
  isLast: boolean;
  children: React.ReactNode;
}) {
  const interactive = !!onSelect;
  return (
    <div
      role={interactive ? 'button' : undefined}
      tabIndex={interactive ? 0 : undefined}
      onClick={onSelect}
      onKeyDown={interactive ? (e: React.KeyboardEvent<HTMLDivElement>) => {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onSelect?.(); }
      } : undefined}
      style={{
        padding: '13px 16px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 10,
        flexWrap: 'wrap',
        cursor: interactive ? 'pointer' : 'default',
        background: selected ? 'var(--accent-soft)' : 'transparent',
        borderLeft: selected ? '2px solid var(--accent)' : '2px solid transparent',
        borderBottom: isLast ? 'none' : '1px solid var(--border)',
      }}
    >
      {children}
    </div>
  );
}

/* ── Columns ──────────────────────────────────────────────────────────────── */

function OrgsColumn({
  orgs, isLoading, selectedId, onSelect, onAdd,
}: {
  orgs: Organization[]; isLoading: boolean; selectedId?: string; onSelect: (id: string) => void; onAdd: () => void;
}) {
  return (
    <div className="cd-card" style={{ overflow: 'hidden' }}>
      <ColumnHeader title="Organizations" addLabel="Add organization" onAdd={onAdd} />
      {isLoading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: 24 }}><Spinner /></div>
      ) : orgs.length === 0 ? (
        <EmptyRow message="No organizations yet." />
      ) : (
        orgs.map((org, i) => (
          <ListRow key={org.id} selected={org.id === selectedId} onSelect={() => onSelect(org.id)} isLast={i === orgs.length - 1}>
            <div>
              <div style={{ fontSize: 14, fontWeight: 600 }}>{org.name}</div>
              <Mono style={{ fontSize: 11, color: 'var(--text-3)' }}>{org.id}</Mono>
            </div>
            <span style={{ color: 'var(--text-3)', display: 'inline-flex', flexShrink: 0 }}>
              <Icon path={CHEVRON_RIGHT} size={15} strokeWidth={2} />
            </span>
          </ListRow>
        ))
      )}
    </div>
  );
}

function BusinessUnitsColumn({
  bus, isLoading, hasOrg, selectedId, onSelect, onAdd,
}: {
  bus: BusinessUnit[]; isLoading: boolean; hasOrg: boolean; selectedId?: string; onSelect: (id: string) => void; onAdd: () => void;
}) {
  return (
    <div className="cd-card" style={{ overflow: 'hidden' }}>
      <ColumnHeader title="Business units" addLabel="Add business unit" onAdd={onAdd} />
      {!hasOrg ? (
        <EmptyRow message="Select an organization to see its business units." />
      ) : isLoading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: 24 }}><Spinner /></div>
      ) : bus.length === 0 ? (
        <EmptyRow message="No business units yet." />
      ) : (
        bus.map((bu, i) => (
          <ListRow key={bu.id} selected={bu.id === selectedId} onSelect={() => onSelect(bu.id)} isLast={i === bus.length - 1}>
            <div>
              <div style={{ fontSize: 14, fontWeight: 600 }}>{bu.name}</div>
              <div style={{ fontSize: 11, color: 'var(--text-3)' }}>{bu.productCount} products</div>
            </div>
            <span style={{ color: 'var(--text-3)', display: 'inline-flex', flexShrink: 0 }}>
              <Icon path={CHEVRON_RIGHT} size={15} strokeWidth={2} />
            </span>
          </ListRow>
        ))
      )}
    </div>
  );
}

function ProductsColumn({
  products, isLoading, hasBu, onAdd, onEdit, onDelete,
}: {
  products: Product[]; isLoading: boolean; hasBu: boolean; onAdd: () => void; onEdit: (p: Product) => void; onDelete: (p: Product) => void;
}) {
  return (
    <div className="cd-card" style={{ overflow: 'hidden' }}>
      <ColumnHeader title="Products" addLabel="Add product" onAdd={onAdd} />
      {!hasBu ? (
        <EmptyRow message="Select a business unit to see its products." />
      ) : isLoading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: 24 }}><Spinner /></div>
      ) : products.length === 0 ? (
        <EmptyRow message="No products yet." />
      ) : (
        products.map((p, i) => (
          <ListRow key={p.id} isLast={i === products.length - 1}>
            <div>
              <div style={{ fontSize: 14, fontWeight: 600 }}>{p.name}</div>
              <div style={{ fontSize: 11, color: 'var(--text-3)' }}>{p.findingCount} findings</div>
            </div>
            <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
              <Button variant="secondary" sm onClick={() => onEdit(p)}>Edit</Button>
              <Button variant="danger" sm onClick={() => onDelete(p)}>Delete</Button>
            </div>
          </ListRow>
        ))
      )}
    </div>
  );
}

/* ── View ─────────────────────────────────────────────────────────────────── */

export default function ProductsView() {
  const { notify } = useToast();
  const [selectedOrgId, setSelectedOrgId] = useState<string | undefined>(undefined);
  const [selectedBuId, setSelectedBuId] = useState<string | undefined>(undefined);

  const { data: orgs = [], isLoading: orgsLoading } = useOrgs();
  // Derive the effective selection instead of syncing state in effects: the first
  // org/BU is used as a fallback until the user picks another, and the BU selection
  // resets automatically when it no longer belongs to the active org.
  const effectiveOrgId = selectedOrgId ?? orgs[0]?.id;
  const { data: bus = [], isLoading: busLoading } = useBusinessUnits(effectiveOrgId);
  const effectiveBuId = selectedBuId && bus.some((b) => b.id === selectedBuId) ? selectedBuId : bus[0]?.id;
  const { data: products = [], isLoading: productsLoading } = useProducts(effectiveBuId);

  const handleAdd = () => notify('Item created', 'success');
  const handleEdit = (p: Product) => notify(`${p.name} updated`, 'info');
  const handleDelete = (p: Product) => notify(`${p.name} deleted`, 'warning');

  const handleSelectOrg = (id: string) => setSelectedOrgId(id);
  const handleSelectBu = (id: string) => setSelectedBuId(id);

  return (
    <div>
      <h1 className="cd-page-h1" style={{ marginBottom: 4 }}>Assets</h1>
      <p className="cd-page-sub" style={{ marginBottom: 20 }}>Organizations → Business Units → Products</p>

      <div className="cd-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))' }}>
        <OrgsColumn orgs={orgs} isLoading={orgsLoading} selectedId={effectiveOrgId} onSelect={handleSelectOrg} onAdd={handleAdd} />
        <BusinessUnitsColumn
          bus={bus}
          isLoading={busLoading}
          hasOrg={!!effectiveOrgId}
          selectedId={effectiveBuId}
          onSelect={handleSelectBu}
          onAdd={handleAdd}
        />
        <ProductsColumn
          products={products}
          isLoading={productsLoading}
          hasBu={!!effectiveBuId}
          onAdd={handleAdd}
          onEdit={handleEdit}
          onDelete={handleDelete}
        />
      </div>
    </div>
  );
}
