
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

export interface SavedPoint {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
}

interface SavedPointsState {
  points: SavedPoint[];
  addPoint: (point: SavedPoint) => void;
  removePoint: (id: string) => void;
}

export const useSavedPointsStore = create<SavedPointsState>()(
  persist(
    (set) => ({
      points: [],

      addPoint: (point) =>
        set((state) => ({
          points: [...state.points, point],
        })),

      removePoint: (id) =>
        set((state) => ({
          points: state.points.filter((point) => point.id !== id),
        })),
    }),
    {
      name: 'lunar-saved-points',
      storage: createJSONStorage(() => localStorage),
    }
  )
);
