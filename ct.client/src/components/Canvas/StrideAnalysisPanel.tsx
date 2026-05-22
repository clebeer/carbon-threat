/**
 * StrideAnalysisPanel — UI for running STRIDE GPT AI analysis.
 * Replaces the old AISuggestionsPanel.
 */
import React, { useState } from 'react';
import { runAiAnalysis, StrideAnalysisPayload, StrideAnalysisResult } from '../../api/strideAnalysis';

interface Props {
  modelId: string;
  onAnalysisComplete?: () => void;
}

const APP_TYPES = [
  'Traditional application',
  'Generative AI application',
  'Agentic AI application',
] as const;

const StrideAnalysisPanel: React.FC<Props> = ({ modelId, onAnalysisComplete }) => {
  const [appType, setAppType] = useState<string>('Traditional application');
  const [authentication, setAuthentication] = useState('None');
  const [internetFacing, setInternetFacing] = useState(false);
  const [sensitiveData, setSensitiveData] = useState(false);
  const [description, setDescription] = useState('');
  const [runDread, setRunDread] = useState(true);
  const [runMitigations, setRunMitigations] = useState(true);
  const [runTestCases, setRunTestCases] = useState(true);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<StrideAnalysisResult | null>(null);

  const handleRun = async () => {
    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const payload: StrideAnalysisPayload = {
        appType: appType as any,
        authentication,
        internetFacing,
        sensitiveData,
        runDread,
        runMitigations,
        runTestCases,
        description,
      };
      const data = await runAiAnalysis(modelId, payload);
      setResult(data);
      onAnalysisComplete?.();
    } catch (err: any) {
      const msg =
        err?.response?.data?.error ||
        err?.response?.data?.detail ||
        err?.message ||
        'Analysis failed';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ padding: 16, fontFamily: 'sans-serif', fontSize: 13 }}>
      <h3 style={{ margin: '0 0 12px 0', fontSize: 15 }}>STRIDE GPT Analysis</h3>

      {/* Application Type */}
      <div style={{ marginBottom: 8 }}>
        <label style={{ display: 'block', fontWeight: 600, marginBottom: 4 }}>
          Application Type
        </label>
        <select
          value={appType}
          onChange={(e) => setAppType(e.target.value)}
          style={{ width: '100%', padding: 6, borderRadius: 4, border: '1px solid #ccc' }}
        >
          {APP_TYPES.map((t) => (
            <option key={t} value={t}>{t}</option>
          ))}
        </select>
      </div>

      {/* Authentication */}
      <div style={{ marginBottom: 8 }}>
        <label style={{ display: 'block', fontWeight: 600, marginBottom: 4 }}>
          Authentication
        </label>
        <input
          type="text"
          value={authentication}
          onChange={(e) => setAuthentication(e.target.value)}
          placeholder="e.g., JWT, OAuth2, API Key"
          style={{ width: '100%', padding: 6, borderRadius: 4, border: '1px solid #ccc', boxSizing: 'border-box' }}
        />
      </div>

      {/* Toggles */}
      <div style={{ display: 'flex', gap: 16, marginBottom: 8 }}>
        <label style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <input type="checkbox" checked={internetFacing} onChange={(e) => setInternetFacing(e.target.checked)} />
          Internet Facing
        </label>
        <label style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <input type="checkbox" checked={sensitiveData} onChange={(e) => setSensitiveData(e.target.checked)} />
          Sensitive Data
        </label>
      </div>

      {/* Description */}
      <div style={{ marginBottom: 8 }}>
        <label style={{ display: 'block', fontWeight: 600, marginBottom: 4 }}>
          Additional Description
        </label>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Optional: provide more context about the application..."
          rows={3}
          style={{ width: '100%', padding: 6, borderRadius: 4, border: '1px solid #ccc', boxSizing: 'border-box', resize: 'vertical' }}
        />
      </div>

      {/* Analysis options */}
      <div style={{ display: 'flex', gap: 16, marginBottom: 12 }}>
        <label style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <input type="checkbox" checked={runDread} onChange={(e) => setRunDread(e.target.checked)} />
          DREAD
        </label>
        <label style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <input type="checkbox" checked={runMitigations} onChange={(e) => setRunMitigations(e.target.checked)} />
          Mitigations
        </label>
        <label style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <input type="checkbox" checked={runTestCases} onChange={(e) => setRunTestCases(e.target.checked)} />
          Test Cases
        </label>
      </div>

      {/* Run button */}
      <button
        onClick={handleRun}
        disabled={loading}
        style={{
          width: '100%',
          padding: '10px 16px',
          backgroundColor: loading ? '#6c757d' : '#0d6efd',
          color: '#fff',
          border: 'none',
          borderRadius: 6,
          cursor: loading ? 'not-allowed' : 'pointer',
          fontWeight: 600,
          fontSize: 13,
        }}
      >
        {loading ? '⏳ Running Analysis...' : '🚀 Run STRIDE GPT Analysis'}
      </button>

      {/* Error */}
      {error && (
        <div style={{ marginTop: 12, padding: 8, background: '#f8d7da', color: '#842029', borderRadius: 4, fontSize: 12 }}>
          {error}
        </div>
      )}

      {/* Results */}
      {result && (
        <div style={{ marginTop: 12 }}>
          <h4 style={{ fontSize: 14, margin: '0 0 8px 0' }}>
            ✅ Analysis Complete — {result.threats.length} threats generated
          </h4>

          {result.improvement_suggestions.length > 0 && (
            <div style={{ marginBottom: 8 }}>
              <strong>Suggestions for improvement:</strong>
              <ul style={{ margin: '4px 0', paddingLeft: 20, fontSize: 12 }}>
                {result.improvement_suggestions.map((s, i) => (
                  <li key={i}>{s}</li>
                ))}
              </ul>
            </div>
          )}

          <div style={{ maxHeight: 300, overflowY: 'auto' }}>
            {result.threats.map((t: any, i: number) => (
              <div
                key={i}
                style={{
                  padding: 8,
                  marginBottom: 6,
                  background: '#f8f9fa',
                  borderRadius: 4,
                  borderLeft: `4px solid ${severityColor(t.severity)}`,
                  fontSize: 12,
                }}
              >
                <div style={{ fontWeight: 600 }}>{t.title}</div>
                <div style={{ color: '#666', marginTop: 2 }}>
                  [{t.stride_category}] • {t.severity} • {t.source}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

function severityColor(sev: string): string {
  switch (sev) {
    case 'Critical': return '#dc3545';
    case 'High': return '#fd7e14';
    case 'Medium': return '#ffc107';
    case 'Low': return '#198754';
    default: return '#6c757d';
  }
}

export default StrideAnalysisPanel;