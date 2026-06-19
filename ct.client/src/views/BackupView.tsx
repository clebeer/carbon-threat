import React, { useState, useEffect, useCallback, useRef } from 'react';
import { listBackups, createBackup, downloadBackup, deleteBackup, listSchedules, createSchedule, deleteSchedule, restoreBackup, type BackupRecord, type BackupSchedule } from '../api/backup';

export default function BackupView() {
  const [backups, setBackups] = useState<BackupRecord[]>([]);
  const [schedules, setSchedules] = useState<BackupSchedule[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState('');
  const [showScheduleForm, setShowScheduleForm] = useState(false);
  const [scheduleName, setScheduleName] = useState('');
  const [scheduleFreq, setScheduleFreq] = useState('daily');
  const [restoring, setRestoring] = useState(false);
  const [restoreResult, setRestoreResult] = useState<{ restored: Record<string, number>; errors: string[] } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [b, s] = await Promise.all([listBackups(), listSchedules()]);
      setBackups(b);
      setSchedules(s);
    } catch {
      setError('Failed to load backups');
    } finally {
      setLoading(false);
    }
  }, []);

  // eslint-disable-next-line react-hooks/set-state-in-effect -- legitimate data-fetching via async callback
  useEffect(() => { loadData(); }, [loadData]);

  const handleCreate = useCallback(async () => {
    setCreating(true);
    setError('');
    try {
      const backup = await createBackup();
      setBackups(prev => [backup, ...prev]);
    } catch {
      setError('Failed to create backup');
    } finally {
      setCreating(false);
    }
  }, []);

  const handleDelete = useCallback(async (id: string) => {
    if (!confirm('Delete this backup?')) return;
    try {
      await deleteBackup(id);
      setBackups(prev => prev.filter(b => b.id !== id));
    } catch {
      setError('Failed to delete backup');
    }
  }, []);

  const handleDownload = useCallback(async (id: string) => {
    try {
      await downloadBackup(id);
    } catch {
      setError('Failed to download backup');
    }
  }, []);

  const handleRestore = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setRestoring(true);
    setRestoreResult(null);
    setError('');
    try {
      const text = await file.text();
      const data = JSON.parse(text);
      const result = await restoreBackup(data);
      setRestoreResult(result);
      loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Restore failed');
    } finally {
      setRestoring(false);
    }
  }, [loadData]);

  const handleCreateSchedule = useCallback(async () => {
    if (!scheduleName.trim()) return;
    try {
      const s = await createSchedule({ name: scheduleName, frequency: scheduleFreq });
      setSchedules(prev => [s, ...prev]);
      setScheduleName('');
      setShowScheduleForm(false);
    } catch {
      setError('Failed to create schedule');
    }
  }, [scheduleName, scheduleFreq]);

  const handleDeleteSchedule = useCallback(async (id: string) => {
    if (!confirm('Delete this schedule?')) return;
    try {
      await deleteSchedule(id);
      setSchedules(prev => prev.filter(s => s.id !== id));
    } catch {
      setError('Failed to delete schedule');
    }
  }, []);

  const formatSize = (bytes: number) => {
    if (!bytes) return '—';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const statusColor = (status: string) => {
    switch (status) {
      case 'complete': return '#10b981';
      case 'running': return '#f59e0b';
      case 'error': return '#ef4444';
      default: return 'var(--on-surface-muted)';
    }
  };

  if (loading) {
    return <div style={{ padding: '40px', color: 'var(--on-surface-muted)', fontSize: '14px' }}>Loading backups…</div>;
  }

  return (
    <div style={{ padding: '24px', maxWidth: '1100px', margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <div>
          <h2 style={{ color: '#fff', fontSize: '22px', margin: '0 0 4px 0' }}>Backup & Restore</h2>
          <p style={{ color: 'var(--on-surface-muted)', fontSize: '13px', margin: 0 }}>Create, download, and restore application backups</p>
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button
            onClick={() => fileRef.current?.click()}
            disabled={restoring}
            style={{
              padding: '8px 16px', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.1)',
              background: 'transparent', color: 'var(--on-surface-muted)', cursor: 'pointer', fontSize: '12px',
            }}
          >
            {restoring ? 'Restoring…' : '📤 Restore from file'}
            <input ref={fileRef} type="file" accept=".json" style={{ display: 'none' }} onChange={handleRestore} />
          </button>
          <button
            onClick={handleCreate}
            disabled={creating}
            style={{
              padding: '8px 20px', borderRadius: '6px', border: 'none',
              background: creating ? 'rgba(255,255,255,0.1)' : 'var(--primary)',
              color: creating ? 'var(--on-surface-muted)' : '#000',
              cursor: creating ? 'not-allowed' : 'pointer', fontSize: '12px', fontWeight: 700,
            }}
          >
            {creating ? 'Creating…' : '+ Create Backup'}
          </button>
        </div>
      </div>

      {error && <div style={{ color: '#ef4444', fontSize: '12px', marginBottom: '16px', padding: '8px 12px', background: 'rgba(239,68,68,0.1)', borderRadius: '6px' }}>{error}</div>}

      {restoreResult && (
        <div style={{ marginBottom: '16px', padding: '12px 16px', borderRadius: '6px', background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.2)' }}>
          <div style={{ color: '#10b981', fontSize: '13px', fontWeight: 600, marginBottom: '4px' }}>Restore complete</div>
          <div style={{ fontSize: '12px', color: 'var(--on-surface-muted)' }}>
            {Object.entries(restoreResult.restored).map(([table, count]) => `${table}: ${count}`).join(' · ')}
          </div>
          {restoreResult.errors.length > 0 && (
            <div style={{ marginTop: '8px', fontSize: '11px', color: '#f59e0b' }}>
              {restoreResult.errors.map((e, i) => <div key={i}>⚠ {e}</div>)}
            </div>
          )}
        </div>
      )}

      {/* Schedules */}
      <div style={{ marginBottom: '24px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
          <h3 style={{ color: '#fff', fontSize: '15px', margin: 0 }}>Schedules</h3>
          <button onClick={() => setShowScheduleForm(!showScheduleForm)} style={{ padding: '4px 12px', borderRadius: '4px', border: '1px solid rgba(255,255,255,0.1)', background: 'transparent', color: 'var(--primary)', cursor: 'pointer', fontSize: '11px' }}>+ New Schedule</button>
        </div>

        {showScheduleForm && (
          <div style={{ display: 'flex', gap: '8px', marginBottom: '12px', padding: '12px', background: 'rgba(255,255,255,0.03)', borderRadius: '6px' }}>
            <input value={scheduleName} onChange={e => setScheduleName(e.target.value)} placeholder="Schedule name" style={{ flex: 1, padding: '6px 10px', borderRadius: '4px', border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.04)', color: '#e2e8f0', fontSize: '12px' }} />
            <select value={scheduleFreq} onChange={e => setScheduleFreq(e.target.value)} style={{ padding: '6px 10px', borderRadius: '4px', border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.04)', color: '#e2e8f0', fontSize: '12px' }}>
              <option value="daily">Daily</option>
              <option value="weekly">Weekly</option>
              <option value="monthly">Monthly</option>
            </select>
            <button onClick={handleCreateSchedule} style={{ padding: '6px 16px', borderRadius: '4px', border: 'none', background: 'var(--primary)', color: '#000', cursor: 'pointer', fontSize: '12px', fontWeight: 700 }}>Save</button>
          </div>
        )}

        {schedules.length === 0 ? (
          <div style={{ color: 'var(--on-surface-muted)', fontSize: '12px', padding: '12px' }}>No schedules configured</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            {schedules.map(s => (
              <div key={s.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', borderRadius: '6px', background: 'rgba(255,255,255,0.03)' }}>
                <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                  <span style={{ color: '#e2e8f0', fontSize: '13px', fontWeight: 500 }}>{s.name}</span>
                  <span style={{ fontSize: '11px', padding: '2px 8px', borderRadius: '4px', background: 'rgba(0,242,255,0.1)', color: 'var(--primary)' }}>{s.frequency}</span>
                  <span style={{ fontSize: '11px', color: s.is_active ? '#10b981' : 'var(--on-surface-muted)' }}>{s.is_active ? 'Active' : 'Paused'}</span>
                </div>
                <button aria-label={`Delete schedule ${s.id}`} onClick={() => handleDeleteSchedule(s.id)} style={{ padding: '4px 8px', borderRadius: '4px', border: '1px solid rgba(239,68,68,0.2)', background: 'transparent', color: '#ef4444', cursor: 'pointer', fontSize: '11px' }}>Delete</button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Backups list */}
      <div>
        <h3 style={{ color: '#fff', fontSize: '15px', margin: '0 0 12px 0' }}>Backups ({backups.length})</h3>
        {backups.length === 0 ? (
          <div style={{ color: 'var(--on-surface-muted)', fontSize: '12px', padding: '24px', textAlign: 'center', border: '1px dashed rgba(255,255,255,0.1)', borderRadius: '8px' }}>No backups yet. Click "Create Backup" to get started.</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            {backups.map(b => (
              <div key={b.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', borderRadius: '6px', background: 'rgba(255,255,255,0.03)' }}>
                <div style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
                  <span style={{ color: '#e2e8f0', fontSize: '13px', fontWeight: 500 }}>{b.name}</span>
                  <span style={{ fontSize: '11px', padding: '2px 8px', borderRadius: '4px', background: `${statusColor(b.status)}20`, color: statusColor(b.status) }}>{b.status}</span>
                  <span style={{ fontSize: '11px', color: 'var(--on-surface-muted)' }}>{b.storage_type}</span>
                  <span style={{ fontSize: '11px', color: 'var(--on-surface-muted)' }}>{formatSize(b.file_size)}</span>
                  <span style={{ fontSize: '11px', color: 'var(--on-surface-muted)' }}>{new Date(b.created_at).toLocaleString()}</span>
                </div>
                <div style={{ display: 'flex', gap: '6px' }}>
                  {b.status === 'complete' && (
                    <button aria-label={`Download backup ${b.id}`} onClick={() => handleDownload(b.id)} style={{ padding: '4px 10px', borderRadius: '4px', border: '1px solid rgba(0,242,255,0.2)', background: 'transparent', color: 'var(--primary)', cursor: 'pointer', fontSize: '11px' }}>Download</button>
                  )}
                  <button aria-label={`Delete backup ${b.id}`} onClick={() => handleDelete(b.id)} style={{ padding: '4px 10px', borderRadius: '4px', border: '1px solid rgba(239,68,68,0.2)', background: 'transparent', color: '#ef4444', cursor: 'pointer', fontSize: '11px' }}>Delete</button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}