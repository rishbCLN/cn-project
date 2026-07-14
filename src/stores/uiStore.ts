import { create } from 'zustand';
import { Notification, EventType } from '../types';
import { genId } from '../utils/helpers';

interface UIStore {
  activePanel: 'device' | 'link' | 'send' | 'inspector' | 'stats' | null;
  showMinimap: boolean;
  showTimeline: boolean;
  notifications: Notification[];
  searchQuery: string;
  inspectedPacketId: string | null;

  isDraggingConnection: boolean;
  connectionSourceId: string | null;

  setPanel: (panel: UIStore['activePanel']) => void;
  toggleMinimap: () => void;
  toggleTimeline: () => void;
  pushNotification: (message: string, type: EventType) => void;
  dismissNotification: (id: string) => void;
  setSearchQuery: (query: string) => void;
  setInspectedPacket: (id: string | null) => void;
  startDraggingConnection: (sourceId: string) => void;
  stopDraggingConnection: () => void;
}

export const useUIStore = create<UIStore>((set) => ({
  activePanel: 'send',
  showMinimap: true,
  showTimeline: true,
  notifications: [],
  searchQuery: '',
  inspectedPacketId: null,

  isDraggingConnection: false,
  connectionSourceId: null,

  setPanel: (panel) => set({ activePanel: panel }),
  toggleMinimap: () => set(s => ({ showMinimap: !s.showMinimap })),
  toggleTimeline: () => set(s => ({ showTimeline: !s.showTimeline })),

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
