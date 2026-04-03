import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '../api/client';

interface Asset {
  id: string;
  name: string;
  type: string;
  confidentiality: string;
  source?: string;
}

function confColor(c: string): string {
  switch (c) {
    case 'Critical': return 'var(--error)';
    case 'High':     return '#f59e0b';
    case 'Medium':   return 'var(--secondary)';
    default:         return 'var(--on-surface-muted)';
  }
}

export default function AssetsView() {
  const { data, isLoading, isError, refetch, isFetching } = useQuery<{ assets: Asset[] }>({
    queryKey: ['assets'],
    queryFn: async () => {
      const { data } = await apiClient.get<{ assets: Asset[] }>('/assets');
      return data;
    },
    retry: false,
  });

  const assets = data?.assets ?? [];

  return (
    <div style={{ padding: '32px', paddingTop: '96px', height: '100%', overflowY: 'auto', boxSizing: 'border-box' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '32px' }}>
        <div>
          <h1 className="font-display" style={{ fontSize: '28px', marginBottom: '8px', color: '#fff' }}>Asset Inventory</h1>
          <p className="label-text" style={{ color: 'var(--on-surface-muted)', margin: 0 }}>
            Data assets, servers, and trust boundaries used in threat modeling.
          </p>
        </div>
        <button
          onClick={() => refetch()}
          disabled={isFetching}
          style={{
            background: 'var(--surface-container-high)', border: '1px solid var(--secondary)',
            color: 'var(--secondary)', padding: '10px 20px', borderRadius: '6px',
            cursor: isFetching ? 'wait' : 'pointer', fontFamily: 'var(--font-label)',
            display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px',
          }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
            <polyline points="7 10 12 15 17 10"/>
            <line x1="12" y1="15" x2="12" y2="3"/>
          </svg>
          {isFetching ? 'Syncing…' : 'Refresh'}
        </button>
      </div>

      {isLoading && (
        <p style={{ color: 'var(--on-surface-muted)', fontSize: '13px' }}>Loading assets…</p>
      )}

      {isError && (
        <div style={{ padding: '16px', background: 'rgba(255,77,79,0.08)', border: '1px solid var(--error)', borderRadius: '8px', color: 'var(--error)', fontSize: '13px', marginBottom: '24px' }}>
          Failed to load assets. The asset registry endpoint may not be configured yet.
        </div>
      )}

      {!isLoading && assets.length === 0 && !isError && (
        <div style={{ padding: '48px', textAlign: 'center', border: '1px dashed rgba(255,255,255,0.1)', borderRadius: '8px' }}>
          <p style={{ color: 'var(--on-surface-muted)', fontSize: '14px', margin: 0 }}>
            No assets registered. Assets are imported from integrations (ServiceNow, GitHub) or added via the API.
          </p>
        </div>
      )}

      {assets.length > 0 && (
        <div className="glass-panel" style={{ overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '14px' }}>
            <thead>
              <tr style={{ background: 'rgba(255,255,255,0.04)', color: 'var(--on-surface-muted)' }}>
                {['ASSET ID', 'NAME', 'TYPE', 'CONFIDENTIALITY'].map(h => (
                  <th key={h} style={{ padding: '14px 24px', borderBottom: '1px solid rgba(255,255,255,0.08)', fontFamily: 'var(--font-label)', fontSize: '11px', letterSpacing: '1px' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {assets.map((a: Asset) => (
                <tr key={a.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                  <td className="tech-text" style={{ padding: '14px 24px', color: 'var(--primary)' }}>{a.id}</td>
                  <td style={{ padding: '14px 24px', color: '#fff' }}>{a.name}</td>
                  <td style={{ padding: '14px 24px', color: 'var(--on-surface-muted)' }}>{a.type}</td>
                  <td style={{ padding: '14px 24px' }}>
                    <span style={{
                      padding: '4px 10px', borderRadius: '4px', fontSize: '12px',
                      background: a.confidentiality === 'Critical' ? 'rgba(255,77,79,0.15)' : a.confidentiality === 'High' ? 'rgba(245,158,11,0.15)' : 'rgba(255,255,255,0.05)',
                      color: confColor(a.confidentiality),
                    }}>
                      {a.confidentiality}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
