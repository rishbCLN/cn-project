import { create } from 'zustand';
import { Notification, EventType } from '../types';
import { genId } from '../utils/helpers';

export type TimelineView = 'log' | 'sequence';

interface UIStore {
  activePanel: 'device' | 'link' | 'send' | 'inspector' | 'stats' | null;
  showMinimap: boolean;
  showTimeline: boolean;
  timelineView: TimelineView;
  reducedMotion: boolean;
  notifications: Notification[];
  searchQuery: string;
  inspectedPacketId: string | null;

  isDraggingConnection: boolean;
  connectionSourceId: string | null;

  setPanel: (panel: UIStore['activePanel']) => void;
  toggleMinimap: () => void;
  toggleTimeline: () => void;
  setTimelineView: (view: TimelineView) => void;
  toggleReducedMotion: () => void;
  pushNotification: (message: string, type: EventType) => void;
  dismissNotification: (id: string) => void;
  setSearchQuery: (query: string) => void;
  setInspectedPacket: (id: string | null) => void;
  startDraggingConnection: (sourceId: string) => void;
  stopDraggingConnection: () => void;
}

// Respect the OS-level "prefers-reduced-motion" setting as the initial default.
const prefersReducedMotion =
  typeof window !== 'undefined' &&
  window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

export const useUIStore = create<UIStore>((set) => ({
  activePanel: 'send',
  showMinimap: true,
  showTimeline: true,
  timelineView: 'log',
  reducedMotion: !!prefersReducedMotion,
  notifications: [],
  searchQuery: '',
  inspectedPacketId: null,

  isDraggingConnection: false,
  connectionSourceId: null,

  setPanel: (panel) => set({ activePanel: panel }),
  toggleMinimap: () => set(s => ({ showMinimap: !s.showMinimap })),
  toggleTimeline: () => set(s => ({ showTimeline: !s.showTimeline })),
  setTimelineView: (view) => set({ timelineView: view }),
  toggleReducedMotion: () => set(s => ({ reducedMotion: !s.reducedMotion })),

  pushNotification: (message, type) => {
    const notification: Notification = {
      id: genId(),
      message,
      type,
      time: Date.now(),
    };
    set(s => ({
      notifications: [...s.notifications.slice(-19), notification], // Keep max 20
    }));

    // Auto-dismiss after 4 seconds
    setTimeout(() => {
      set(s => ({
        notifications: s.notifications.filter(n => n.id !== notification.id),
      }));
    }, 4000);
  },

  dismissNotification: (id) => {
    set(s => ({
      notifications: s.notifications.filter(n => n.id !== id),
    }));
  },

  setSearchQuery: (query) => set({ searchQuery: query }),
  setInspectedPacket: (id) => set({ inspectedPacketId: id, activePanel: id ? 'inspector' : null }),
  startDraggingConnection: (sourceId) => set({ isDraggingConnection: true, connectionSourceId: sourceId }),
  stopDraggingConnection: () => set({ isDraggingConnection: false, connectionSourceId: null }),
}));
