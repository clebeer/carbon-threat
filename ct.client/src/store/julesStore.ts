import { create } from 'zustand';
import * as julesApi from '../api/jules';
import type { JulesSession, JulesActivity, CreateSessionPayload } from '../api/jules';

const POLL_INTERVAL_MS = 5000;
const TERMINAL_STATUSES = new Set(['done', 'error']);

interface JulesState {
  sessions: JulesSession[];
  total: number;
  detailSession: JulesSession | null;
  detailActivities: JulesActivity[];
  pollingIds: Set<string>;

  fetchSessions: (page?: number) => Promise<void>;
  createSession: (payload: CreateSessionPayload) => Promise<JulesSession>;
  fetchSessionDetail: (id: string) => Promise<void>;
  startPolling: (id: string) => void;
  stopPolling: (id: string) => void;
  approvePlan: (id: string) => Promise<void>;
  deleteSession: (id: string) => Promise<void>;
  clearDetail: () => void;
}

// Polling timers stored outside Zustand to avoid serialisation issues
const _timers = new Map<string, ReturnType<typeof setInterval>>();

export const useJulesStore = create<JulesState>((set, get) => ({
  sessions: [],
  total: 0,
  detailSession: null,
  detailActivities: [],
  pollingIds: new Set(),

  fetchSessions: async (page = 1) => {
    const result = await julesApi.listSessions(page);
    set({ sessions: result.sessions, total: result.total });
  },

  createSession: async (payload) => {
    const session = await julesApi.createSession(payload);
    set(s => ({ sessions: [session, ...s.sessions], total: s.total + 1 }));
    if (!TERMINAL_STATUSES.has(session.status)) {
      get().startPolling(session.id);
    }
    return session;
  },

  fetchSessionDetail: async (id) => {
    const { session, activities } = await julesApi.getSession(id);
    set({ detailSession: session, detailActivities: activities });
    set(s => ({
      sessions: s.sessions.map(ss => ss.id === id ? session : ss),
    }));
  },

  startPolling: (id) => {
    if (_timers.has(id)) return;
    set(s => ({ pollingIds: new Set([...s.pollingIds, id]) }));

    const timer = setInterval(async () => {
      const { session } = await julesApi.getSession(id);
      set(s => ({
        sessions: s.sessions.map(ss => ss.id === id ? session : ss),
        detailSession: s.detailSession?.id === id ? session : s.detailSession,
      }));

      if (TERMINAL_STATUSES.has(session.status)) {
        get().stopPolling(id);
      }
    }, POLL_INTERVAL_MS);

    _timers.set(id, timer);
  },

  stopPolling: (id) => {
    const timer = _timers.get(id);
    if (timer) { clearInterval(timer); _timers.delete(id); }
    set(s => {
      const next = new Set(s.pollingIds);
      next.delete(id);
      return { pollingIds: next };
    });
  },

  approvePlan: async (id) => {
    const session = await julesApi.approvePlan(id);
    set(s => ({
      sessions: s.sessions.map(ss => ss.id === id ? session : ss),
      detailSession: s.detailSession?.id === id ? session : s.detailSession,
    }));
    get().startPolling(id);
  },

  deleteSession: async (id) => {
    get().stopPolling(id);
    await julesApi.deleteSession(id);
    set(s => ({ sessions: s.sessions.filter(ss => ss.id !== id), total: Math.max(0, s.total - 1) }));
  },

  clearDetail: () => set({ detailSession: null, detailActivities: [] }),
}));
