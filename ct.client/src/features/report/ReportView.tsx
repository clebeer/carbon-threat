import React, { useMemo, useState } from 'react';
import { Button, Card, Field, PageHeader, Select, SeverityChip, Mono, Spinner, EmptyState, Icon, ICONS, countBySeverity } from '../../ui/primitives';
import { useDashboard, useFindings } from '../../api/carbon';
import { useToast } from '../../components/ui';
import { Severity } from '../../domain/types';

type ReportModel = 'executive' | 'technical';

const REPORT_MODEL_LABEL: Record<ReportModel, string> = {
  executive: 'Executive summary',
  technical: 'Technical report',
};

const REPORT_MODEL_HINT: Record<ReportModel, string> = {
  executive: 'High-level overview for stakeholders — key risks and business impact, minimal technical detail.',
  technical: 'Full technical detail for engineering teams — reproduction steps, CVSS scoring and remediation guidance.',
};

const SEV_VAR: Record<Severity, string> = {
  critical: 'var(--sev-critical)', high: 'var(--sev-high)', medium: 'var(--sev-medium)', low: 'var(--sev-low)', info: 'var(--sev-info)',
};

export default function ReportView() {
  const { notify } = useToast();
  const [reportModel, setReportModel] = useState<ReportModel>('executive');
  const { data: findings, isLoading } = useFindings();
  const { data: dashboard } = useDashboard();

  const bySeverity = dashboard?.bySeverity ?? countBySeverity(findings ?? []);
  const total = dashboard?.total ?? findings?.length ?? 0;

  const reportSummary = useMemo(() => ([
    { label: 'Critical', value: bySeverity.critical, color: SEV_VAR.critical },
    { label: 'High', value: bySeverity.high, color: SEV_VAR.high },
    { label: 'Medium', value: bySeverity.medium, color: SEV_VAR.medium },
    { label: 'Low', value: bySeverity.low, color: SEV_VAR.low },
    { label: 'Total', value: total, color: 'var(--text)' },
  ]), [bySeverity, total]);

  function handleExport() {
    notify('Report exported', 'success');
  }

  return (
    <div>
      <PageHeader
        title="Pentest Report"
        subtitle="Generate a client-facing report"
        actions={<Button variant="secondary" onClick={() => handleExport()}>Export / Print</Button>}
      />

      {/* Toolbar */}
      <div className="cd-filterbar" style={{ marginBottom: 14 }}>
        <div style={{ minWidth: 150 }}>
          <Field label="Engagement">
            <Select defaultValue="Pentest 2026-Q2">
              <option>Pentest 2026-Q2</option>
            </Select>
          </Field>
        </div>
        <div style={{ minWidth: 170 }}>
          <Field label="Report model">
            <Select value={reportModel} onChange={(e) => setReportModel(e.target.value as ReportModel)}>
              <option value="executive">Executive (summary)</option>
              <option value="technical">Technical (detailed)</option>
            </Select>
          </Field>
        </div>
        <div style={{ flex: 1 }} />
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <Button variant="primary" onClick={() => handleExport()}>HTML</Button>
          <Button variant="secondary" onClick={() => handleExport()}>CSV</Button>
          <Button variant="secondary" onClick={() => handleExport()}>JSON</Button>
        </div>
      </div>

      {/* Report preview */}
      <Card pad={false} style={{ overflow: 'hidden' }}>
        <div style={{ padding: 28, borderBottom: '1px solid var(--border)', background: 'linear-gradient(135deg, var(--accent-soft), transparent)' }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--accent-text)', letterSpacing: '0.05em', textTransform: 'uppercase' }}>
            Confidential · {REPORT_MODEL_LABEL[reportModel]}
          </div>
          <div style={{ fontSize: 24, fontWeight: 700, letterSpacing: '-0.02em', margin: '8px 0 4px' }}>
            Penetration Test Report — carbon-dojo
          </div>
          <div style={{ fontSize: 13, color: 'var(--text-2)' }}>
            Acme Corp · Plataforma · Pentest 2026-Q2 · June 2026
          </div>
          <div style={{ display: 'flex', gap: 10, marginTop: 18, flexWrap: 'wrap' }}>
            {reportSummary.map((s) => (
              <div key={s.label} style={{ padding: '10px 14px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 9, minWidth: 78 }}>
                <div style={{ fontSize: 20, fontWeight: 700, color: s.color }}>{s.value}</div>
                <div style={{ fontSize: 11, color: 'var(--text-2)' }}>{s.label}</div>
              </div>
            ))}
          </div>
        </div>

        <div style={{ padding: 24 }}>
          <h3 className="cd-h3" style={{ marginBottom: 4 }}>Findings ({total})</h3>
          <p style={{ fontSize: 12, color: 'var(--text-3)', margin: '0 0 16px' }}>{REPORT_MODEL_HINT[reportModel]}</p>

          {isLoading ? (
            <div style={{ display: 'flex', justifyContent: 'center', padding: 40 }}><Spinner /></div>
          ) : !findings?.length ? (
            <EmptyState title="No findings to report" message="Import or create findings for this engagement to populate the report."
              icon={<Icon path={ICONS.report} size={22} />} />
          ) : (
            findings.map((f) => (
              <div key={f.id} style={{ padding: '16px 0', borderBottom: '1px solid var(--border)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6, flexWrap: 'wrap' }}>
                  <SeverityChip severity={f.severity} />
                  <span style={{ fontSize: 14, fontWeight: 600 }}>{f.title}</span>
                  <Mono style={{ fontSize: 11, color: 'var(--text-3)', marginLeft: 'auto' }}>CVSS {f.cvss}</Mono>
                </div>
                <p style={{ fontSize: 13, color: 'var(--text-2)', margin: '0 0 8px', lineHeight: 1.6 }}>{f.description}</p>
                <div style={{ fontSize: 12, color: 'var(--text-2)', background: 'var(--surface-2)', borderLeft: '2px solid var(--accent)', padding: '8px 12px', borderRadius: '0 8px 8px 0' }}>
                  <strong style={{ color: 'var(--text)' }}>Remediation:</strong> {f.remediation}
                </div>
              </div>
            ))
          )}
        </div>
      </Card>
    </div>
  );
}
