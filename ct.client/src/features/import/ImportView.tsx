import { useEffect, useRef, useState } from 'react';
import { Button, Field, Icon, ICONS, Select } from '../../ui/primitives';
import { useToast } from '../../components/ui';
import { ImportFormat, ImportJobState } from '../../domain/types';

const FORMATS: ImportFormat[] = ['SARIF', 'Burp', 'ZAP', 'Nessus', 'Nuclei', 'Semgrep', 'Trivy', 'OSV'];

/** Fixed demo counters shown once a job completes (matches the reference design). */
const DONE_COUNTS = { created: 14, updated: 5, reopened: 3, errors: 0 };

export default function ImportView() {
  const { notify } = useToast();
  const [jobState, setJobState] = useState<ImportJobState>('idle');
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const submitImport = () => {
    if (jobState === 'processing') return;
    setJobState('processing');
    notify('Import job queued', 'success');
    timerRef.current = setTimeout(() => {
      setJobState('done');
    }, 1500);
  };

  useEffect(() => () => {
    if (timerRef.current) clearTimeout(timerRef.current);
  }, []);

  return (
    <div>
      <h1 className="cd-page-h1" style={{ marginBottom: 4 }}>Import Scan</h1>
      <p className="cd-page-sub" style={{ marginBottom: 20 }}>Upload a scanner report into an assessment</p>

      <div className="cd-grid" style={{ gridTemplateColumns: 'repeat(auto-fit,minmax(300px,1fr))', alignItems: 'start' }}>
        {/* Scope */}
        <div className="cd-card cd-card-pad">
          <h3 className="cd-h3" style={{ marginBottom: 16 }}>Scope</h3>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
            <Field label="Organization">
              <Select aria-label="Organization"><option>Acme Corp</option></Select>
            </Field>
            <Field label="Business Unit">
              <Select aria-label="Business Unit"><option>Plataforma</option></Select>
            </Field>
            <Field label="Product">
              <Select aria-label="Product"><option>carbon-dojo</option></Select>
            </Field>
            <Field label="Engagement">
              <Select aria-label="Engagement"><option>Pentest 2026-Q2</option></Select>
            </Field>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
            <Field label="Assessment">
              <Select aria-label="Assessment"><option>Q2 baseline</option></Select>
            </Field>
            <Field label="Format">
              <Select aria-label="Format">
                {FORMATS.map((f) => <option key={f}>{f}</option>)}
              </Select>
            </Field>
          </div>

          <span className="cd-label">Report file</span>
          <div
            className="cd-dropzone"
            role="button"
            tabIndex={0}
            aria-label="Drop a scanner report here, or click to browse"
            onClick={submitImport}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                submitImport();
              }
            }}
          >
            <div style={{
              width: 40, height: 40, borderRadius: 10, background: 'var(--accent-soft)', color: 'var(--accent-text)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 10px',
            }}>
              <Icon path={ICONS.import} size={20} strokeWidth={2} />
            </div>
            <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 2 }}>Drop a scanner report here</div>
            <div style={{ fontSize: 12, color: 'var(--text-2)' }}>or click to browse · SARIF, Burp, ZAP, Nessus…</div>
          </div>

          <Button variant="primary" block style={{ marginTop: 16 }} onClick={submitImport} loading={jobState === 'processing'}>
            Submit import
          </Button>
        </div>

        {/* Job status */}
        <div className="cd-card cd-card-pad">
          <h3 className="cd-h3" style={{ marginBottom: 16 }}>Job status</h3>

          {jobState === 'idle' && (
            <div style={{ padding: '30px 0', textAlign: 'center', color: 'var(--text-3)', fontSize: 13 }}>
              No active import. Submit a report to start a job.
            </div>
          )}

          {jobState === 'processing' && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: 16, background: 'var(--surface-2)', borderRadius: 10 }}>
              <span className="cd-spinner" role="status" aria-label="Loading" />
              <div>
                <div style={{ fontSize: 14, fontWeight: 600 }}>Processing import…</div>
                <div style={{ fontSize: 12, color: 'var(--text-2)' }}>Parsing SARIF · de-duplicating findings</div>
              </div>
            </div>
          )}

          {jobState === 'done' && (
            <div>
              <div style={{
                display: 'flex', alignItems: 'center', gap: 10, padding: '12px 14px',
                background: 'color-mix(in srgb, var(--success) 15%, transparent)', borderRadius: 10, marginBottom: 16,
                color: 'var(--success)',
              }}>
                <Icon path={ICONS.check} size={18} strokeWidth={2.4} />
                <span style={{ fontSize: 14, fontWeight: 600 }}>Import completed</span>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <div style={{ padding: 14, background: 'var(--surface-2)', borderRadius: 10 }}>
                  <div style={{ fontSize: 24, fontWeight: 700, color: 'var(--success)' }}>{DONE_COUNTS.created}</div>
                  <div style={{ fontSize: 12, color: 'var(--text-2)' }}>Created</div>
                </div>
                <div style={{ padding: 14, background: 'var(--surface-2)', borderRadius: 10 }}>
                  <div style={{ fontSize: 24, fontWeight: 700, color: 'var(--accent-text)' }}>{DONE_COUNTS.updated}</div>
                  <div style={{ fontSize: 12, color: 'var(--text-2)' }}>Updated</div>
                </div>
                <div style={{ padding: 14, background: 'var(--surface-2)', borderRadius: 10 }}>
                  <div style={{ fontSize: 24, fontWeight: 700, color: 'var(--warning)' }}>{DONE_COUNTS.reopened}</div>
                  <div style={{ fontSize: 12, color: 'var(--text-2)' }}>Reopened</div>
                </div>
                <div style={{ padding: 14, background: 'var(--surface-2)', borderRadius: 10 }}>
                  <div style={{ fontSize: 24, fontWeight: 700, color: 'var(--danger)' }}>{DONE_COUNTS.errors}</div>
                  <div style={{ fontSize: 12, color: 'var(--text-2)' }}>Errors</div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
