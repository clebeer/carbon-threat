/**
 * ScannerView — Integrated OSV Vulnerability Scanner
 *
 * Tab layout:
 *  • New Scan  — file upload (lockfile / SBOM) or manual package entry
 *  • History   — paginated list of past scan runs; click to view findings
 *  • Policy    — ignored vulns, severity threshold, auto-enrich setting (admin)
 *
 * Design follows the Carbon Threat glass-panel / CSS-var system defined in
 * index.css and visible throughout AdminView / ThreatsView.
 */

import React, { useRef, useState, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  listScans,
  getScanFindings,
  createLockfileScan,
  createSbomScan,
  createManualScan,
  createGitScan,
  createContainerScan,
  deleteScan,
  getScannerPolicy,
  updateScannerPolicy,
  downloadScanExport,
  type ScanRun,
  type ScanFinding,
  type ScannerPolicy,
  type ManualPackage,
  type Severity,
} from '../api/scanner';
import { useAuthStore } from '../store/authStore';

// ── Design constants ──────────────────────────────────────────────────────────

const SEVERITY_COLOR: Record<string, string> = {
  Critical: 'var(--error)',
  High:     '#f97316',
  Medium:   '#f59e0b',
  Low:      'var(--on-surface-muted)',
};

const SEVERITY_ORDER: Severity[] = ['Critical', 'High', 'Medium', 'Low'];

const LOCKFILE_TYPES: Record<string, string> = {
  'npm-package-lock':    'npm (package-lock.json)',
  'yarn':                'Yarn (yarn.lock)',
  'pnpm':                'pnpm (pnpm-lock.yaml)',
  'requirements-txt':    'Python (requirements.txt)',
  'pipfile-lock':        'Pipenv (Pipfile.lock)',
  'go-sum':              'Go (go.sum)',
  'cargo-lock':          'Rust (Cargo.lock)',
  'gemfile-lock':        'Ruby (Gemfile.lock)',
  'nuget-packages-lock': 'NuGet (packages.lock.json)',
  'composer-lock':       'PHP (composer.lock)',
  'spdx-json':           'SPDX SBOM (*.spdx.json)',
  'cyclonedx-json':      'CycloneDX SBOM (*.json)',
};

const ECOSYSTEMS = ['npm', 'PyPI', 'Go', 'Maven', 'NuGet', 'RubyGems', 'crates.io', 'Packagist', 'Docker'];

// ── Sub-components ────────────────────────────────────────────────────────────

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <h3
      className="label-text glow-text-cyan"
      style={{ fontSize: '13px', margin: '0 0 4px', letterSpacing: '1px' }}
    >
      {children}
    </h3>
  );
}

function StatusBadge({ status }: { status: ScanRun['status'] }) {
  const cfg: Record<string, { color: string; label: string }> = {
    pending:  { color: 'var(--on-surface-muted)', label: 'PENDING'  },
    running:  { color: 'var(--primary)',           label: 'RUNNING'  },
    complete: { color: '#52c41a',                  label: 'COMPLETE' },
    error:    { color: 'var(--error)',             label: 'ERROR'    },
  };
  const { color, label } = cfg[status] ?? cfg.pending;
  return (
    <span style={{ fontSize: '11px', color, letterSpacing: '0.5px' }}>
      ● {label}
    </span>
  );
}

function SeverityBadge({ severity }: { severity?: string }) {
  const color = SEVERITY_COLOR[severity ?? ''] ?? 'var(--on-surface-muted)';
  return (
    <span
      style={{
        fontSize: '10px',
        padding: '2px 7px',
        borderRadius: '4px',
        background: `${color}22`,
        color,
        border: `1px solid ${color}44`,
        fontWeight: 600,
        letterSpacing: '0.3px',
      }}
    >
      {severity ?? '–'}
    </span>
  );
}

// ── Severity distribution row ─────────────────────────────────────────────────

function SeverityBar({ bySeverity, total }: { bySeverity: Partial<Record<string, number>>; total: number }) {
  return (
    <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
      {SEVERITY_ORDER.map(sev => (
        <div
          key={sev}
          style={{
            padding: '12px 16px',
            borderRadius: '8px',
            background: 'rgba(255,255,255,0.02)',
            border: `1px solid ${SEVERITY_COLOR[sev]}22`,
            minWidth: '72px',
            textAlign: 'center',
          }}
        >
          <div style={{ fontSize: '20px', fontWeight: 700, color: SEVERITY_COLOR[sev], fontFamily: 'var(--font-display)' }}>
            {bySeverity[sev] ?? 0}
          </div>
          <div style={{ fontSize: '10px', color: 'var(--on-surface-muted)', marginTop: '3px', letterSpacing: '0.5px' }}>
            {sev}
          </div>
        </div>
      ))}
      <div style={{ padding: '12px 16px', borderRadius: '8px', background: 'rgba(0,242,255,0.04)', border: '1px solid rgba(0,242,255,0.15)', minWidth: '72px', textAlign: 'center' }}>
        <div style={{ fontSize: '20px', fontWeight: 700, color: 'var(--primary)', fontFamily: 'var(--font-display)' }}>{total}</div>
        <div style={{ fontSize: '10px', color: 'var(--on-surface-muted)', marginTop: '3px', letterSpacing: '0.5px' }}>Total</div>
      </div>
    </div>
  );
}

// ── Findings table ────────────────────────────────────────────────────────────

function FindingsTable({
  findings,
  bySeverity,
  scan,
  onExport,
}: {
  findings: ScanFinding[];
  bySeverity: Partial<Record<string, number>>;
  scan: ScanRun;
  onExport: (format: 'json' | 'csv' | 'markdown') => void;
}) {
  const [filterSev, setFilterSev] = useState<string>('All');
  const [exporting, setExporting] = useState<string | null>(null);

  const filtered = filterSev === 'All' ? findings : findings.filter(f => f.severity === filterSev);
  const total    = findings.length;

  async function handleExport(format: 'json' | 'csv' | 'markdown') {
    setExporting(format);
    try { await onExport(format); }
    finally { setExporting(null); }
  }

  return (
    <div>
      {/* Severity distribution */}
      <div style={{ marginBottom: '20px' }}>
        <SeverityBar bySeverity={bySeverity} total={total} />
      </div>

      {/* Toolbar */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px', flexWrap: 'wrap', gap: '10px' }}>
        <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
          <span style={{ fontSize: '12px', color: 'var(--on-surface-muted)' }}>Filter:</span>
          {['All', ...SEVERITY_ORDER].map(s => (
            <button
              key={s}
              onClick={() => setFilterSev(s)}
              style={{
                padding: '4px 10px', borderRadius: '4px', border: 'none', cursor: 'pointer',
                fontSize: '11px', fontWeight: filterSev === s ? 700 : 400, letterSpacing: '0.3px',
                background: filterSev === s ? (s === 'All' ? 'rgba(0,242,255,0.15)' : `${SEVERITY_COLOR[s]}22`) : 'rgba(255,255,255,0.04)',
                color:      filterSev === s ? (s === 'All' ? 'var(--primary)' : SEVERITY_COLOR[s]) : 'var(--on-surface-muted)',
              }}
            >
              {s}
            </button>
          ))}
        </div>

        <div style={{ display: 'flex', gap: '6px' }}>
          {(['json', 'csv', 'markdown'] as const).map(fmt => (
            <button
              key={fmt}
              onClick={() => handleExport(fmt)}
              disabled={!!exporting}
              style={{
                padding: '5px 12px', borderRadius: '5px', fontSize: '11px', cursor: 'pointer',
                border: '1px solid rgba(0,242,255,0.25)', background: 'rgba(0,242,255,0.06)',
                color: exporting ? 'rgba(0,242,255,0.3)' : 'var(--primary)',
                fontFamily: 'var(--font-label)', letterSpacing: '0.3px',
              }}
            >
              {exporting === fmt ? '…' : fmt.toUpperCase()}
            </button>
          ))}
        </div>
      </div>

      {findings.length === 0 && (
        <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--on-surface-muted)', fontSize: '13px' }}>
          No vulnerabilities found.
        </div>
      )}

      {findings.length > 0 && (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                {['Package', 'Version', 'Ecosystem', 'Vuln ID', 'Summary', 'Sev.', 'CVSS', 'Fixed In'].map(h => (
                  <th key={h} style={{ padding: '8px 10px', textAlign: 'left', color: 'var(--on-surface-muted)', fontWeight: 500, letterSpacing: '0.3px', whiteSpace: 'nowrap' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map(f => (
                <tr
                  key={f.id}
                  style={{
                    borderBottom: '1px solid rgba(255,255,255,0.04)',
                    opacity: f.is_ignored ? 0.4 : 1,
                    transition: 'background 0.15s',
                  }}
                  onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.025)')}
                  onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                >
                  <td style={{ padding: '8px 10px', color: '#e2e8f0', fontFamily: 'monospace', fontSize: '11px' }}>{f.package_name}</td>
                  <td style={{ padding: '8px 10px', color: 'var(--on-surface-muted)', fontFamily: 'monospace', fontSize: '11px' }}>{f.package_version ?? '–'}</td>
                  <td style={{ padding: '8px 10px', color: 'var(--on-surface-muted)' }}>{f.ecosystem ?? '–'}</td>
                  <td style={{ padding: '8px 10px' }}>
                    <a
                      href={`https://osv.dev/vulnerability/${f.vuln_id}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{ color: 'var(--primary)', textDecoration: 'none', fontFamily: 'monospace', fontSize: '11px' }}
                    >
                      {f.vuln_id}
                    </a>
                  </td>
                  <td style={{ padding: '8px 10px', color: '#e2e8f0', maxWidth: '300px' }}>
                    {/* title in DB == OSV summary field; show full text on hover */}
                    <span title={f.title ?? ''} style={{ display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {f.title ?? '–'}
                    </span>
                  </td>
                  <td style={{ padding: '8px 10px' }}>
                    <SeverityBadge severity={f.severity} />
                  </td>
                  <td style={{ padding: '8px 10px', color: f.cvss_score ? SEVERITY_COLOR[f.severity ?? ''] ?? 'var(--on-surface-muted)' : 'var(--on-surface-muted)' }}>
                    {f.cvss_score ?? '–'}
                  </td>
                  <td style={{ padding: '8px 10px', color: f.fixed_version ? '#52c41a' : 'var(--on-surface-muted)', fontFamily: 'monospace', fontSize: '11px' }}>
                    {f.fixed_version ?? '–'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {filtered.length < findings.length && (
            <p style={{ fontSize: '11px', color: 'var(--on-surface-muted)', textAlign: 'right', marginTop: '8px' }}>
              Showing {filtered.length} of {findings.length} findings
            </p>
          )}
        </div>
      )}
    </div>
  );
}

// ── New Scan tab ──────────────────────────────────────────────────────────────

type ScanMode = 'file' | 'manual' | 'git' | 'container';

const SCAN_MODES: { id: ScanMode; label: string }[] = [
  { id: 'file',      label: 'Upload File'      },
  { id: 'manual',    label: 'Manual Packages'  },
  { id: 'git',       label: 'Git Repository'   },
  { id: 'container', label: 'Container Image'  },
];

function NewScanPanel({ onScanStarted }: { onScanStarted: (id: string) => void }) {
  const [scanName, setScanName]       = useState('');
  const [mode, setMode]               = useState<ScanMode>('file');
  const [file, setFile]               = useState<File | null>(null);
  const [fileContent, setFileContent] = useState('');
  const [dragOver, setDragOver]       = useState(false);
  const [scanError, setScanError]     = useState<string | null>(null);
  const [manualPkgs, setManualPkgs]   = useState<ManualPackage[]>([{ name: '', version: '', ecosystem: 'npm' }]);
  const [repoUrl, setRepoUrl]         = useState('');
  const [imageName, setImageName]     = useState('');
  const fileInputRef                  = useRef<HTMLInputElement>(null);

  const qc = useQueryClient();

  const createMutation = useMutation({
    mutationFn: async () => {
      if (mode === 'file') {
        const name = scanName.trim() || (file?.name ?? 'Lockfile Scan');
        if (!file || !fileContent) throw new Error('Please select a lockfile or SBOM to scan.');
        const isSbom = file.name.includes('spdx') || file.name.includes('cyclonedx') || file.name === 'bom.json';
        return isSbom
          ? createSbomScan(name, file.name, fileContent)
          : createLockfileScan(name, file.name, fileContent);

      } else if (mode === 'manual') {
        const name = scanName.trim() || 'Manual Package Check';
        const valid = manualPkgs.filter(p => p.name.trim() && p.version.trim());
        if (valid.length === 0) throw new Error('Add at least one package with name and version.');
        return createManualScan(name, valid);

      } else if (mode === 'git') {
        const name = scanName.trim() || repoUrl.trim().split('/').pop() || 'Git Repo Scan';
        if (!repoUrl.trim()) throw new Error('Enter a repository URL.');
        return createGitScan(name, repoUrl.trim());

      } else {
        const name = scanName.trim() || imageName.trim() || 'Container Scan';
        if (!imageName.trim()) throw new Error('Enter a container image name.');
        return createContainerScan(name, imageName.trim());
      }
    },
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ['scanner-scans'] });
      setScanError(null);
      onScanStarted(data.scan.id);
      // Reset form
      setScanName('');
      setFile(null);
      setFileContent('');
      setManualPkgs([{ name: '', version: '', ecosystem: 'npm' }]);
      setRepoUrl('');
      setImageName('');
    },
    onError: (err: { response?: { data?: { error?: string } }; message?: string }) => {
      setScanError(err?.response?.data?.error ?? err?.message ?? 'Scan failed');
    },
  });

  const readFile = useCallback((f: File) => {
    if (f.size > 50 * 1024 * 1024) {
      setScanError('File exceeds the 50 MB limit');
      return;
    }
    const reader = new FileReader();
    reader.onload = (e) => {
      setFileContent((e.target?.result as string) ?? '');
      setScanError(null);
    };
    reader.onerror = () => setScanError('Could not read the file');
    reader.readAsText(f);
    setFile(f);
  }, []);

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragOver(false);
    const f = e.dataTransfer.files[0];
    if (f) readFile(f);
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (f) readFile(f);
    e.target.value = '';
  }

  function addManualRow() {
    setManualPkgs(prev => [...prev, { name: '', version: '', ecosystem: 'npm' }]);
  }
  function removeManualRow(idx: number) {
    setManualPkgs(prev => prev.filter((_, i) => i !== idx));
  }
  function updateManualRow(idx: number, field: keyof ManualPackage, value: string) {
    setManualPkgs(prev => prev.map((p, i) => i === idx ? { ...p, [field]: value } : p));
  }

  const canSubmit =
    mode === 'file'      ? !!fileContent :
    mode === 'manual'    ? manualPkgs.some(p => p.name.trim() && p.version.trim()) :
    mode === 'git'       ? !!repoUrl.trim() :
    /* container */        !!imageName.trim();

  const inputStyle: React.CSSProperties = {
    width: '100%', padding: '10px 12px', borderRadius: '6px',
    border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.04)',
    color: '#e2e8f0', fontSize: '13px', outline: 'none', boxSizing: 'border-box',
  };

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '20px', maxWidth: '800px' }}>

      {/* Scan name */}
      <div>
        <label style={{ display: 'block', fontSize: '12px', color: 'var(--on-surface-muted)', marginBottom: '6px', letterSpacing: '0.3px' }}>
          Scan Name (optional)
        </label>
        <input
          type="text"
          value={scanName}
          onChange={e => setScanName(e.target.value)}
          placeholder={
            mode === 'file'      ? (file?.name ?? 'my-app lockfile scan') :
            mode === 'manual'    ? 'Manual package check' :
            mode === 'git'       ? 'my-repo vulnerability scan' :
                                   'nginx:latest scan'
          }
          style={inputStyle}
        />
      </div>

      {/* Mode toggle — 4-way segmented control */}
      <div style={{ display: 'flex' }}>
        {SCAN_MODES.map((m, idx) => (
          <button
            key={m.id}
            onClick={() => { setMode(m.id); setScanError(null); }}
            style={{
              flex: 1, padding: '9px 6px', border: '1px solid rgba(255,255,255,0.1)',
              borderLeft: idx === 0 ? '1px solid rgba(255,255,255,0.1)' : 'none',
              cursor: 'pointer', fontSize: '12px', fontFamily: 'var(--font-label)',
              letterSpacing: '0.4px', transition: 'all 0.2s',
              borderRadius: idx === 0 ? '6px 0 0 6px' : idx === SCAN_MODES.length - 1 ? '0 6px 6px 0' : '0',
              background: mode === m.id ? 'rgba(0,242,255,0.12)' : 'rgba(255,255,255,0.03)',
              color:      mode === m.id ? 'var(--primary)'       : 'var(--on-surface-muted)',
              fontWeight: mode === m.id ? 600                    : 400,
            }}
          >
            {m.label}
          </button>
        ))}
      </div>

      {/* ── File upload mode ── */}
      {mode === 'file' && (
        <div>
          <div
            onDragOver={e => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            style={{
              border: `2px dashed ${dragOver ? 'var(--primary)' : 'rgba(255,255,255,0.12)'}`,
              borderRadius: '8px', padding: '36px 24px', textAlign: 'center',
              cursor: 'pointer', transition: 'all 0.2s',
              background: dragOver ? 'rgba(0,242,255,0.04)' : 'rgba(255,255,255,0.01)',
            }}
          >
            <input ref={fileInputRef} type="file" style={{ display: 'none' }} onChange={handleFileChange} />
            {file ? (
              <div>
                <div style={{ fontSize: '28px', marginBottom: '8px' }}>📄</div>
                <div style={{ color: 'var(--primary)', fontSize: '14px', fontWeight: 600 }}>{file.name}</div>
                <div style={{ color: 'var(--on-surface-muted)', fontSize: '12px', marginTop: '4px' }}>
                  {(file.size / 1024).toFixed(1)} KB — click or drop to replace
                </div>
              </div>
            ) : (
              <div>
                <div style={{ fontSize: '28px', marginBottom: '8px' }}>⬆</div>
                <div style={{ color: 'var(--on-surface-muted)', fontSize: '13px' }}>
                  Drop a lockfile or SBOM here, or <span style={{ color: 'var(--primary)' }}>click to browse</span>
                </div>
                <div style={{ color: 'rgba(255,255,255,0.2)', fontSize: '11px', marginTop: '8px' }}>
                  package-lock.json · yarn.lock · pnpm-lock.yaml · requirements.txt · go.sum · Cargo.lock · Gemfile.lock · *.spdx.json · cyclonedx*.json · …
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Manual packages mode ── */}
      {mode === 'manual' && (
        <div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '10px' }}>
            {manualPkgs.map((pkg, idx) => (
              <div key={idx} style={{ display: 'grid', gridTemplateColumns: '2fr 1.2fr 1.5fr auto', gap: '8px', alignItems: 'center' }}>
                <input
                  type="text"
                  placeholder="Package name"
                  value={pkg.name}
                  onChange={e => updateManualRow(idx, 'name', e.target.value)}
                  style={{ padding: '8px 10px', borderRadius: '5px', border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.04)', color: '#e2e8f0', fontSize: '12px', outline: 'none' }}
                />
                <input
                  type="text"
                  placeholder="Version"
                  value={pkg.version}
                  onChange={e => updateManualRow(idx, 'version', e.target.value)}
                  style={{ padding: '8px 10px', borderRadius: '5px', border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.04)', color: '#e2e8f0', fontSize: '12px', outline: 'none' }}
                />
                <select
                  value={pkg.ecosystem}
                  onChange={e => updateManualRow(idx, 'ecosystem', e.target.value)}
                  style={{ padding: '8px 10px', borderRadius: '5px', border: '1px solid rgba(255,255,255,0.1)', background: '#12161f', color: '#e2e8f0', fontSize: '12px', outline: 'none' }}
                >
                  {ECOSYSTEMS.map(eco => <option key={eco} value={eco}>{eco}</option>)}
                </select>
                <button
                  onClick={() => removeManualRow(idx)}
                  disabled={manualPkgs.length === 1}
                  style={{ background: 'transparent', border: 'none', color: manualPkgs.length === 1 ? 'rgba(255,255,255,0.1)' : 'var(--on-surface-muted)', cursor: manualPkgs.length === 1 ? 'default' : 'pointer', fontSize: '18px', lineHeight: 1, padding: '0 4px' }}
                >
                  ×
                </button>
              </div>
            ))}
          </div>
          <button
            onClick={addManualRow}
            style={{ background: 'transparent', border: '1px dashed rgba(0,242,255,0.25)', color: 'var(--primary)', padding: '6px 14px', borderRadius: '5px', cursor: 'pointer', fontSize: '12px', letterSpacing: '0.3px' }}
          >
            + Add package
          </button>
        </div>
      )}

      {/* ── Git repository mode ── */}
      {mode === 'git' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <div>
            <label style={{ display: 'block', fontSize: '12px', color: 'var(--on-surface-muted)', marginBottom: '6px', letterSpacing: '0.3px' }}>
              Repository URL
            </label>
            <input
              type="url"
              value={repoUrl}
              onChange={e => setRepoUrl(e.target.value)}
              placeholder="https://github.com/org/repo.git"
              style={inputStyle}
              autoComplete="off"
            />
          </div>
          <div style={{ padding: '12px 14px', background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '6px', fontSize: '11px', color: 'var(--on-surface-muted)', lineHeight: '1.6' }}>
            The server will perform a shallow clone (<code style={{ color: 'var(--primary)', background: 'rgba(0,242,255,0.08)', padding: '1px 5px', borderRadius: '3px' }}>--depth 1</code>), detect all lockfiles in the repository, and scan them against OSV.
            Requires <code style={{ color: 'var(--primary)', background: 'rgba(0,242,255,0.08)', padding: '1px 5px', borderRadius: '3px' }}>git</code> on the server. Public repositories only (no credentials sent).
          </div>
        </div>
      )}

      {/* ── Container image mode ── */}
      {mode === 'container' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <div>
            <label style={{ display: 'block', fontSize: '12px', color: 'var(--on-surface-muted)', marginBottom: '6px', letterSpacing: '0.3px' }}>
              Image Name
            </label>
            <input
              type="text"
              value={imageName}
              onChange={e => setImageName(e.target.value)}
              placeholder="nginx:latest  or  python:3.12-slim  or  gcr.io/org/app:v1.2.3"
              style={inputStyle}
              autoComplete="off"
            />
          </div>
          <div style={{ padding: '12px 14px', background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '6px', fontSize: '11px', color: 'var(--on-surface-muted)', lineHeight: '1.6' }}>
            The server will run <code style={{ color: 'var(--primary)', background: 'rgba(0,242,255,0.08)', padding: '1px 5px', borderRadius: '3px' }}>docker pull</code>, export the container filesystem, locate all lockfiles inside it, and scan against OSV.
            Requires <code style={{ color: 'var(--primary)', background: 'rgba(0,242,255,0.08)', padding: '1px 5px', borderRadius: '3px' }}>docker</code> on the server. Large images may take several minutes.
          </div>
        </div>
      )}

      {/* Error */}
      {scanError && (
        <div style={{ padding: '10px 14px', background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.25)', borderRadius: '6px', fontSize: '12px', color: 'var(--error)' }}>
          {scanError}
        </div>
      )}

      {/* Submit */}
      <button
        onClick={() => { setScanError(null); createMutation.mutate(); }}
        disabled={!canSubmit || createMutation.isPending}
        style={{
          padding: '12px', borderRadius: '6px', border: 'none',
          cursor: canSubmit && !createMutation.isPending ? 'pointer' : 'not-allowed',
          background: canSubmit && !createMutation.isPending ? 'var(--primary)' : 'rgba(0,242,255,0.15)',
          color:      canSubmit && !createMutation.isPending ? '#000'          : 'rgba(255,255,255,0.2)',
          fontWeight: 700, fontSize: '13px', fontFamily: 'var(--font-label)', letterSpacing: '0.5px',
          transition: 'all 0.2s', maxWidth: '200px',
        }}
      >
        {createMutation.isPending ? 'Starting…' : '▶ Run Scan'}
      </button>
    </div>
  );
}

// ── History tab ───────────────────────────────────────────────────────────────

function HistoryPanel({
  scans,
  loading,
  selectedId,
  onSelect,
  onDelete,
}: {
  scans: ScanRun[];
  loading: boolean;
  selectedId: string | null;
  onSelect: (id: string) => void;
  onDelete: (id: string) => void;
}) {
  if (loading) return <p style={{ fontSize: '13px', color: 'var(--on-surface-muted)' }}>Loading scans…</p>;
  if (scans.length === 0) return (
    <div style={{ textAlign: 'center', padding: '60px 0', color: 'var(--on-surface-muted)' }}>
      <div style={{ fontSize: '32px', marginBottom: '12px' }}>🔍</div>
      <p style={{ fontSize: '13px', margin: 0 }}>No scans yet. Run your first scan from the <strong style={{ color: 'var(--primary)' }}>New Scan</strong> tab.</p>
    </div>
  );

  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
        <thead>
          <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
            {['Name', 'Type', 'Lockfile', 'Status', 'Packages', 'Vulns', 'Date', ''].map(h => (
              <th key={h} style={{ padding: '8px 10px', textAlign: 'left', color: 'var(--on-surface-muted)', fontWeight: 500, letterSpacing: '0.3px', whiteSpace: 'nowrap' }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {scans.map(scan => (
            <tr
              key={scan.id}
              onClick={() => onSelect(scan.id)}
              style={{
                borderBottom: '1px solid rgba(255,255,255,0.04)',
                cursor: 'pointer',
                background: selectedId === scan.id ? 'rgba(0,242,255,0.06)' : 'transparent',
                transition: 'background 0.15s',
              }}
              onMouseEnter={e => { if (selectedId !== scan.id) e.currentTarget.style.background = 'rgba(255,255,255,0.025)'; }}
              onMouseLeave={e => { e.currentTarget.style.background = selectedId === scan.id ? 'rgba(0,242,255,0.06)' : 'transparent'; }}
            >
              <td style={{ padding: '10px 10px', color: '#e2e8f0', fontWeight: 500 }}>
                {scan.name}
                {scan.error_message && <div style={{ fontSize: '10px', color: 'var(--error)', marginTop: '4px', whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{scan.error_message}</div>}
              </td>
              <td style={{ padding: '10px 10px', color: 'var(--on-surface-muted)', textTransform: 'uppercase', fontSize: '10px', letterSpacing: '0.3px' }}>{scan.scan_type}</td>
              <td style={{ padding: '10px 10px', color: 'var(--on-surface-muted)', fontSize: '11px', maxWidth: '200px' }}>
                {scan.lockfile_type
                  ? (LOCKFILE_TYPES[scan.lockfile_type] ?? scan.lockfile_type)
                  : (scan.source_filename
                      ? <span title={scan.source_filename} style={{ display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{scan.source_filename}</span>
                      : '–')
                }
              </td>
              <td style={{ padding: '10px 10px' }}><StatusBadge status={scan.status} /></td>
              <td style={{ padding: '10px 10px', color: 'var(--primary)', fontFamily: 'var(--font-display)', fontWeight: 700 }}>{scan.packages_scanned}</td>
              <td style={{ padding: '10px 10px' }}>
                <span style={{ color: scan.vulns_found > 0 ? 'var(--error)' : '#52c41a', fontFamily: 'var(--font-display)', fontWeight: 700 }}>
                  {scan.vulns_found}
                </span>
              </td>
              <td style={{ padding: '10px 10px', color: 'var(--on-surface-muted)', whiteSpace: 'nowrap' }}>
                {new Date(scan.created_at).toLocaleString()}
              </td>
              <td style={{ padding: '10px 10px' }}>
                <button
                  onClick={e => { e.stopPropagation(); if (window.confirm(`Delete scan "${scan.name}"?`)) onDelete(scan.id); }}
                  style={{ background: 'transparent', border: 'none', color: 'var(--on-surface-muted)', cursor: 'pointer', fontSize: '16px', lineHeight: 1, padding: '0 4px' }}
                  title="Delete scan"
                >
                  ×
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ── Policy tab ────────────────────────────────────────────────────────────────

function PolicyPanel({ isAdmin }: { isAdmin: boolean }) {
  const qc   = useQueryClient();
  const [newIgnoreId, setNewIgnoreId] = useState('');
  const [saveNotice, setSaveNotice]   = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['scanner-policy'],
    queryFn:  getScannerPolicy,
  });
  const policy = data?.policy;

  const saveMutation = useMutation({
    mutationFn: updateScannerPolicy,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['scanner-policy'] });
      setSaveNotice('Policy saved.');
      setTimeout(() => setSaveNotice(null), 3000);
    },
  });

  function addIgnoredId() {
    const id = newIgnoreId.trim().toUpperCase();
    if (!id || !policy) return;
    const next = [...new Set([...policy.ignored_vuln_ids, id])];
    saveMutation.mutate({ ignored_vuln_ids: next });
    setNewIgnoreId('');
  }

  function removeIgnoredId(id: string) {
    if (!policy) return;
    saveMutation.mutate({ ignored_vuln_ids: policy.ignored_vuln_ids.filter(v => v !== id) });
  }

  if (isLoading) return <p style={{ fontSize: '13px', color: 'var(--on-surface-muted)' }}>Loading policy…</p>;
  if (!policy)   return null;

  return (
    <div style={{ maxWidth: '680px', display: 'flex', flexDirection: 'column', gap: '24px' }}>

      {!isAdmin && (
        <div style={{ padding: '10px 14px', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '6px', fontSize: '12px', color: 'var(--on-surface-muted)' }}>
          View-only — Administrator access required to change scanner policy.
        </div>
      )}

      {saveNotice && (
        <div style={{ padding: '10px 14px', background: 'rgba(0,242,255,0.06)', border: '1px solid rgba(0,242,255,0.2)', borderRadius: '6px', fontSize: '12px', color: 'var(--primary)' }}>
          {saveNotice}
        </div>
      )}

      {/* Severity threshold */}
      <div>
        <label style={{ display: 'block', fontSize: '12px', color: 'var(--on-surface-muted)', marginBottom: '8px', letterSpacing: '0.3px' }}>
          Minimum severity to report
        </label>
        <div style={{ display: 'flex', gap: '8px' }}>
          {SEVERITY_ORDER.map(sev => (
            <button
              key={sev}
              onClick={() => isAdmin && saveMutation.mutate({ severity_threshold: sev })}
              disabled={!isAdmin || saveMutation.isPending}
              style={{
                padding: '7px 14px', borderRadius: '5px', border: `1px solid ${policy.severity_threshold === sev ? SEVERITY_COLOR[sev] : 'rgba(255,255,255,0.1)'}`,
                cursor: isAdmin ? 'pointer' : 'default',
                background: policy.severity_threshold === sev ? `${SEVERITY_COLOR[sev]}22` : 'rgba(255,255,255,0.03)',
                color:      policy.severity_threshold === sev ? SEVERITY_COLOR[sev] : 'var(--on-surface-muted)',
                fontSize: '12px', fontWeight: policy.severity_threshold === sev ? 700 : 400, transition: 'all 0.2s',
              }}
            >
              {sev}
            </button>
          ))}
        </div>
        <p style={{ fontSize: '11px', color: 'var(--on-surface-muted)', marginTop: '6px' }}>
          Findings below this severity are still stored but displayed at lower prominence.
        </p>
      </div>

      {/* Auto-enrich threats */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 16px', background: 'rgba(255,255,255,0.02)', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.06)' }}>
        <div>
          <div style={{ color: '#e2e8f0', fontSize: '13px', fontWeight: 500 }}>Auto-enrich threat records</div>
          <div style={{ color: 'var(--on-surface-muted)', fontSize: '12px', marginTop: '3px' }}>
            Link scanner findings to existing STRIDE threat entries automatically after each scan.
          </div>
        </div>
        <button
          onClick={() => isAdmin && saveMutation.mutate({ auto_enrich_threats: !policy.auto_enrich_threats })}
          disabled={!isAdmin || saveMutation.isPending}
          style={{
            width: '44px', height: '24px', borderRadius: '12px', border: 'none', cursor: isAdmin ? 'pointer' : 'default',
            background: policy.auto_enrich_threats ? 'var(--primary)' : 'rgba(255,255,255,0.12)', transition: 'background 0.2s', position: 'relative', flexShrink: 0,
          }}
        >
          <span style={{
            position: 'absolute', top: '3px', width: '18px', height: '18px', borderRadius: '50%',
            background: policy.auto_enrich_threats ? '#000' : 'rgba(255,255,255,0.4)', transition: 'left 0.2s',
            left: policy.auto_enrich_threats ? '23px' : '3px',
          }} />
        </button>
      </div>

      {/* Ignored vulnerabilities */}
      <div>
        <div style={{ color: '#e2e8f0', fontSize: '13px', fontWeight: 500, marginBottom: '8px' }}>Ignored Vulnerabilities</div>
        <p style={{ fontSize: '12px', color: 'var(--on-surface-muted)', marginTop: 0, marginBottom: '12px' }}>
          Findings matching these IDs will be flagged as ignored in all future scans. Enter a CVE or GHSA ID.
        </p>

        {isAdmin && (
          <div style={{ display: 'flex', gap: '8px', marginBottom: '12px' }}>
            <input
              type="text"
              value={newIgnoreId}
              onChange={e => setNewIgnoreId(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && addIgnoredId()}
              placeholder="e.g. CVE-2024-12345 or GHSA-xxxx-yyyy-zzzz"
              style={{ flex: 1, padding: '8px 12px', borderRadius: '5px', border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.04)', color: '#e2e8f0', fontSize: '12px', outline: 'none' }}
            />
            <button
              onClick={addIgnoredId}
              disabled={!newIgnoreId.trim() || saveMutation.isPending}
              style={{ padding: '8px 16px', borderRadius: '5px', border: 'none', background: 'var(--primary)', color: '#000', fontWeight: 600, fontSize: '12px', cursor: 'pointer' }}
            >
              Add
            </button>
          </div>
        )}

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
          {policy.ignored_vuln_ids.length === 0 && (
            <span style={{ fontSize: '12px', color: 'var(--on-surface-muted)' }}>No ignored vulnerabilities.</span>
          )}
          {policy.ignored_vuln_ids.map(id => (
            <span
              key={id}
              style={{ display: 'flex', alignItems: 'center', gap: '5px', padding: '3px 10px', borderRadius: '4px', background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', fontSize: '11px', color: 'var(--error)', fontFamily: 'monospace' }}
            >
              {id}
              {isAdmin && (
                <button
                  onClick={() => removeIgnoredId(id)}
                  style={{ background: 'transparent', border: 'none', color: 'var(--error)', cursor: 'pointer', fontSize: '14px', lineHeight: 1, padding: 0, marginLeft: '2px' }}
                >
                  ×
                </button>
              )}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Main ScannerView ──────────────────────────────────────────────────────────

export default function ScannerView() {
  const user    = useAuthStore(s => s.user);
  const isAdmin = user?.role === 'admin';
  const qc      = useQueryClient();

  const [activeTab, setActiveTab]       = useState<'new' | 'history' | 'policy'>('new');
  const [selectedScanId, setSelectedScanId] = useState<string | null>(null);

  // ── Scans list ──────────────────────────────────────────────────────────
  const { data: scansData, isLoading: scansLoading } = useQuery({
    queryKey: ['scanner-scans'],
    queryFn:  listScans,
    refetchInterval: (query) => {
      // Auto-poll while any scan is running
      const running = query.state.data?.scans.some(s => s.status === 'running' || s.status === 'pending');
      return running ? 2500 : false;
    },
  });
  const scans = scansData?.scans ?? [];

  // ── Findings for selected scan ──────────────────────────────────────────
  const { data: findingsData, isLoading: findingsLoading } = useQuery({
    queryKey: ['scanner-findings', selectedScanId],
    queryFn:  () => getScanFindings(selectedScanId!),
    enabled:  !!selectedScanId,
    refetchInterval: (query) => {
      return query.state.data?.scan.status === 'running' ? 2000 : false;
    },
  });

  const deleteMutation = useMutation({
    mutationFn: deleteScan,
    onSuccess: (_, deletedId) => {
      qc.invalidateQueries({ queryKey: ['scanner-scans'] });
      if (selectedScanId === deletedId) setSelectedScanId(null);
    },
  });

  function handleScanStarted(id: string) {
    setActiveTab('history');
    setSelectedScanId(id);
  }

  function handleExport(format: 'json' | 'csv' | 'markdown') {
    if (!selectedScanId) return Promise.resolve();
    return downloadScanExport(selectedScanId, format);
  }

  const TABS: { id: typeof activeTab; label: string }[] = [
    { id: 'new',     label: 'New Scan'                             },
    { id: 'history', label: `History${scans.length > 0 ? ` (${scans.length})` : ''}` },
    { id: 'policy',  label: 'Policy'                               },
  ];

  return (
    <div style={{ padding: '32px', paddingTop: '96px', height: '100%', overflowY: 'auto', boxSizing: 'border-box' }}>

      {/* Page header */}
      <h1 className="font-display" style={{ fontSize: '28px', marginBottom: '6px', color: '#fff' }}>
        Vulnerability Scanner
      </h1>
      <p className="label-text" style={{ color: 'var(--on-surface-muted)', marginBottom: '28px' }}>
        Scan lockfiles, SBOMs, git repositories, container images, and individual packages against the{' '}
        <a href="https://osv.dev" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--primary)', textDecoration: 'none' }}>
          OSV (Open Source Vulnerabilities)
        </a>{' '}
        database.
      </p>

      {/* Tab bar */}
      <div style={{ display: 'flex', gap: '2px', marginBottom: '24px', borderBottom: '1px solid rgba(255,255,255,0.06)', paddingBottom: '0' }}>
        {TABS.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            style={{
              padding: '9px 18px', background: 'transparent', border: 'none', cursor: 'pointer',
              fontSize: '13px', letterSpacing: '0.3px', transition: 'all 0.2s',
              color:         activeTab === tab.id ? 'var(--primary)' : 'var(--on-surface-muted)',
              fontWeight:    activeTab === tab.id ? 600               : 400,
              borderBottom:  activeTab === tab.id ? '2px solid var(--primary)' : '2px solid transparent',
              marginBottom: '-1px',
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* ── NEW SCAN ── */}
      {activeTab === 'new' && (
        <div className="glass-panel" style={{ padding: '28px', borderTop: '2px solid rgba(0,242,255,0.15)' }}>
          <SectionLabel>NEW SCAN</SectionLabel>
          <p style={{ fontSize: '12px', color: 'var(--on-surface-muted)', marginBottom: '24px', marginTop: '4px' }}>
            Upload a dependency lockfile or SBOM, or enter packages manually to check for known CVEs.
          </p>
          <NewScanPanel onScanStarted={handleScanStarted} />
        </div>
      )}

      {/* ── HISTORY ── */}
      {activeTab === 'history' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <div className="glass-panel" style={{ padding: '24px', borderTop: '2px solid rgba(0,242,255,0.15)' }}>
            <SectionLabel>SCAN HISTORY</SectionLabel>
            <p style={{ fontSize: '12px', color: 'var(--on-surface-muted)', marginBottom: '20px', marginTop: '4px' }}>
              Click a row to view detailed findings.
            </p>
            <HistoryPanel
              scans={scans}
              loading={scansLoading}
              selectedId={selectedScanId}
              onSelect={setSelectedScanId}
              onDelete={id => deleteMutation.mutate(id)}
            />
          </div>

          {/* Findings panel — shown when a scan is selected */}
          {selectedScanId && (
            <div className="glass-panel" style={{ padding: '24px', borderTop: '2px solid rgba(0,242,255,0.08)' }}>
              {findingsLoading && (
                <p style={{ fontSize: '13px', color: 'var(--on-surface-muted)' }}>Loading findings…</p>
              )}

              {findingsData && (
                <>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '20px', flexWrap: 'wrap', gap: '12px' }}>
                    <div>
                      <SectionLabel>
                        FINDINGS — {findingsData.scan.name.toUpperCase()}
                      </SectionLabel>
                      <div style={{ display: 'flex', gap: '16px', marginTop: '6px', fontSize: '11px', color: 'var(--on-surface-muted)' }}>
                        <span>Type: <strong style={{ color: '#e2e8f0' }}>{findingsData.scan.scan_type}</strong></span>
                        {findingsData.scan.lockfile_type && (
                          <span>Format: <strong style={{ color: '#e2e8f0' }}>{LOCKFILE_TYPES[findingsData.scan.lockfile_type] ?? findingsData.scan.lockfile_type}</strong></span>
                        )}
                        {!findingsData.scan.lockfile_type && findingsData.scan.source_filename && (
                          <span title={findingsData.scan.source_filename} style={{ maxWidth: '260px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            Source: <strong style={{ color: '#e2e8f0' }}>{findingsData.scan.source_filename}</strong>
                          </span>
                        )}
                        <span>Packages: <strong style={{ color: 'var(--primary)' }}>{findingsData.scan.packages_scanned}</strong></span>
                        <StatusBadge status={findingsData.scan.status} />
                      </div>
                    </div>
                    {findingsData.scan.status === 'running' && (
                      <div style={{ fontSize: '12px', color: 'var(--primary)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <span style={{ display: 'inline-block', animation: 'spin 1s linear infinite' }}>↻</span>
                        Scanning in progress…
                      </div>
                    )}
                  </div>

                  <FindingsTable
                    findings={findingsData.findings}
                    bySeverity={findingsData.bySeverity}
                    scan={findingsData.scan}
                    onExport={handleExport}
                  />
                </>
              )}
            </div>
          )}
        </div>
      )}

      {/* ── POLICY ── */}
      {activeTab === 'policy' && (
        <div className="glass-panel" style={{ padding: '24px', borderTop: '2px solid rgba(0,242,255,0.15)' }}>
          <SectionLabel>SCANNER POLICY</SectionLabel>
          <p style={{ fontSize: '12px', color: 'var(--on-surface-muted)', marginBottom: '24px', marginTop: '4px' }}>
            Configure how vulnerability findings are processed and reported.
          </p>
          <PolicyPanel isAdmin={isAdmin} />
        </div>
      )}
    </div>
  );
}
