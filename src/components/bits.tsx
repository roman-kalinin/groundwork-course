import { useEffect, useState } from 'react';
import { UiIcon } from './UiIcon';

export function ProgressRing({ ratio, done, size = 18 }: { ratio: number; done?: boolean; size?: number }) {
  const r = size / 2 - 2;
  const c = 2 * Math.PI * r;
  if (done) {
    return (
      <span className="ring done" style={{ width: size, height: size }} aria-label="Completed">
        <UiIcon name="check" size={size - 6} />
      </span>
    );
  }
  return (
    <svg className="ring" width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-label={ratio > 0 ? 'In progress' : 'Not started'}>
      <circle className="ring-track" cx={size / 2} cy={size / 2} r={r} />
      {ratio > 0 && (
        <circle
          className="ring-fill"
          cx={size / 2}
          cy={size / 2}
          r={r}
          strokeDasharray={`${c * ratio} ${c}`}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      )}
    </svg>
  );
}

export function useReducedMotion() {
  const q = '(prefers-reduced-motion: reduce)';
  const [reduced, setReduced] = useState(() => typeof matchMedia !== 'undefined' && matchMedia(q).matches);
  useEffect(() => {
    const m = matchMedia(q);
    const on = () => setReduced(m.matches);
    m.addEventListener('change', on);
    return () => m.removeEventListener('change', on);
  }, []);
  return reduced;
}

export function ThemeToggle() {
  const [theme, setTheme] = useState(() => document.documentElement.dataset.theme ?? 'light');
  useEffect(() => {
    const on = () => setTheme(document.documentElement.dataset.theme ?? 'light');
    window.addEventListener('groundwork:theme', on);
    return () => window.removeEventListener('groundwork:theme', on);
  }, []);
  const flip = () => {
    const next = theme === 'dark' ? 'light' : 'dark';
    document.documentElement.dataset.theme = next;
    try {
      localStorage.setItem('groundwork:theme', next);
    } catch {
      /* ignore */
    }
    setTheme(next);
    window.dispatchEvent(new Event('groundwork:theme'));
  };
  return (
    <button type="button" className="icon-btn" onClick={flip} aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`} title="Toggle dark mode">
      <UiIcon name={theme === 'dark' ? 'sun' : 'moon'} />
    </button>
  );
}

export const CHAPTER_LABEL: Record<string, string> = {
  problem: 'The problem',
  idea: 'The idea',
  how: 'How it works',
  example: 'Example',
  'watch-out': 'Watch out',
  recap: 'Recap',
};

export const LEVEL_LABEL: Record<string, string> = {
  beginner: 'Beginner',
  intermediate: 'Intermediate',
  advanced: 'Advanced',
};
