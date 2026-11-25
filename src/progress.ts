import { useSyncExternalStore } from 'react';

export interface LessonProgress {
  /** last position viewed: 0..n-1 = steps, n = quiz, n+1 = recap */
  pos: number;
  /** furthest position reached */
  furthest: number;
  total: number;
  quiz?: Record<number, number>;
  completed?: boolean;
  completedAt?: string;
  visitedAt: string;
}
interface Store {
  v: 1;
  lessons: Record<string, LessonProgress>;
  last?: string;
}

const KEY = 'groundwork:progress:v1';
const listeners = new Set<() => void>();

function read(): Store {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const s = JSON.parse(raw);
      if (s && s.v === 1 && s.lessons) return s;
    }
  } catch {
    /* storage unavailable or corrupt */
  }
  return { v: 1, lessons: {} };
}

let state: Store = read();

function write(next: Store) {
  state = next;
  try {
    localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    /* ignore quota / private mode */
  }
  listeners.forEach((l) => l());
}

if (typeof window !== 'undefined') {
  window.addEventListener('storage', (e) => {
    if (e.key === KEY) {
      state = read();
      listeners.forEach((l) => l());
    }
  });
}

export function useProgress(): Store {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    () => state,
  );
}

export function getLessonProgress(key: string): LessonProgress | undefined {
  return state.lessons[key];
}

export function updateLesson(key: string, patch: Partial<LessonProgress> & { total: number }) {
  const prev = state.lessons[key];
  const base: LessonProgress = prev ?? { pos: 0, furthest: 0, total: patch.total, visitedAt: '' };
  const merged: LessonProgress = { ...base, ...patch, visitedAt: new Date().toISOString() };
  merged.furthest = Math.max(prev?.furthest ?? 0, merged.pos, patch.furthest ?? 0);
  write({ ...state, lessons: { ...state.lessons, [key]: merged }, last: key });
}

export function resetLesson(key: string) {
  const lessons = { ...state.lessons };
  delete lessons[key];
  write({ ...state, lessons, last: state.last === key ? undefined : state.last });
}

export function resetAll() {
  write({ v: 1, lessons: {} });
}

/** 0..1 completion of one lesson (completed = 1). */
export function lessonRatio(p: LessonProgress | undefined, stepCount: number): number {
  if (!p) return 0;
  if (p.completed) return 1;
  const total = stepCount + 2;
  return Math.min(0.95, (p.furthest + 1) / total);
}
