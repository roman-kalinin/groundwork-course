import { useEffect, useState } from 'react';
import { UiIcon } from './UiIcon';
import { ICONS } from '../../shared/schema.js';
import { UI_ICONS } from '../uiIcons';

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

/**
 * A tiny isometric block in the module colour with the module icon painted on
 * top: the course's identity mark (sidebar, home cards, lesson header).
 */
export function IsoBadge({ icon, size = 32, className }: { icon?: string; size?: number; className?: string }) {
  // drawn in a 48 x 48 box: top diamond + two side faces
  const markup = icon ? (UI_ICONS[icon] ?? ICONS[icon] ?? '') : '';
  const k = 0.62; // icon scale on the top face
  const m = `matrix(${k},${k / 2},${-k},${k / 2},${24 - 12 * k + 12 * k},${15 - 12 * (k / 2) - 12 * (k / 2)})`;
  return (
    <svg className={`iso-badge${className ? ` ${className}` : ''}`} width={size} height={size} viewBox="0 0 48 48" aria-hidden="true">
      <polygon className="ib-left" points="5,15 24,25 24,44 5,34" />
      <polygon className="ib-right" points="24,25 43,15 43,34 24,44" />
      <polygon className="ib-top" points="24,5 43,15 24,25 5,15" />
      {markup && <g className="ib-icon" transform={m} dangerouslySetInnerHTML={{ __html: markup }} />}
    </svg>
  );
}

/** Short name for a step, for the timeline ("Sessions: the server keeps the list" -> "Sessions"). */
export function shortTitle(title: string) {
  const plain = title.replace(/<[^>]+>/g, '');
  const parts = plain.split(/:|,|\s[—–-]\s|\?|\(/);
  let t = (parts[0].trim().length >= 5 ? parts[0] : plain).trim();
  if (t.length > 22) {
    const words = t.split(/\s+/);
    let out = '';
    for (const w of words) {
      if ((out + ' ' + w).trim().length > 20) break;
      out = (out + ' ' + w).trim();
    }
    t = `${out || words[0]}…`;
  }
  return t;
}

/** Groundwork logo: a foundation slab with a block set on it. */
export function BrandMark({ size = 34 }: { size?: number }) {
  return (
    <svg className="brand-mark" width={size} height={size} viewBox="0 0 48 48" aria-hidden="true">
      <polygon className="bm-l" points="3,27 24,38 24,44 3,33" />
      <polygon className="bm-r" points="24,38 45,27 45,33 24,44" />
      <polygon className="bm-t" points="24,16 45,27 24,38 3,27" />
      <polygon className="bm-l2" points="13,16 24,22 24,33 13,27" />
      <polygon className="bm-r2" points="24,22 35,16 35,27 24,33" />
      <polygon className="bm-t2" points="24,10 35,16 24,22 13,16" />
    </svg>
  );
}
