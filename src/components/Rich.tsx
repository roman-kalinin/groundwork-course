import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { sanitizeInline } from '../../shared/schema.js';

type Glossary = Record<string, string>;
const GlossaryCtx = createContext<Glossary>({});

/** Renders author inline HTML (b, em, code, term spans) safely. */
export function Rich({ html, as: Tag = 'span', className }: { html: string; as?: 'span' | 'p' | 'div' | 'li'; className?: string }) {
  const safe = useMemo(() => sanitizeInline(html), [html]);
  return <Tag className={className} dangerouslySetInnerHTML={{ __html: safe }} />;
}

interface Tip {
  key: string;
  term: string;
  text: string;
  rect: DOMRect;
  pinned: boolean;
}

/**
 * Provides glossary tooltips for every `.term` button inside it.
 * Hover or focus shows the definition; click/tap pins it; Escape closes.
 */
export function GlossaryProvider({ glossary, children }: { glossary: Glossary; children: ReactNode }) {
  const lower = useMemo(() => {
    const m: Glossary = {};
    for (const [k, v] of Object.entries(glossary)) m[k.toLowerCase()] = v;
    return m;
  }, [glossary]);
  const [tip, setTip] = useState<Tip | null>(null);
  const root = useRef<HTMLDivElement>(null);
  const tipRef = useRef<Tip | null>(null);
  tipRef.current = tip;

  const termFor = useCallback(
    (el: HTMLElement) => {
      const key = (el.dataset.term ?? el.textContent ?? '').trim();
      const text = lower[key.toLowerCase()];
      return text ? { key, text, term: el.dataset.term ?? el.textContent ?? key } : null;
    },
    [lower],
  );

  useEffect(() => {
    const el = root.current;
    if (!el) return;
    const find = (t: EventTarget | null) => (t instanceof HTMLElement ? (t.closest('.term') as HTMLElement | null) : null);
    const show = (target: HTMLElement, pinned: boolean) => {
      const info = termFor(target);
      if (!info) return;
      setTip({ ...info, rect: target.getBoundingClientRect(), pinned });
    };
    const over = (e: Event) => {
      const t = find(e.target);
      if (t && !tipRef.current?.pinned) show(t, false);
    };
    const out = (e: Event) => {
      const t = find(e.target);
      if (t && tipRef.current && !tipRef.current.pinned) setTip(null);
    };
    const click = (e: Event) => {
      const t = find(e.target);
      if (!t) return;
      e.preventDefault();
      show(t, true);
    };
    el.addEventListener('mouseover', over);
    el.addEventListener('mouseout', out);
    el.addEventListener('focusin', over);
    el.addEventListener('focusout', out);
    el.addEventListener('click', click);
    return () => {
      el.removeEventListener('mouseover', over);
      el.removeEventListener('mouseout', out);
      el.removeEventListener('focusin', over);
      el.removeEventListener('focusout', out);
      el.removeEventListener('click', click);
    };
  }, [termFor]);

  useEffect(() => {
    if (!tip) return;
    const close = () => setTip(null);
    const key = (e: KeyboardEvent) => e.key === 'Escape' && close();
    const down = (e: PointerEvent) => {
      if (!(e.target instanceof HTMLElement) || !e.target.closest('.term, .term-tip')) close();
    };
    window.addEventListener('keydown', key);
    window.addEventListener('pointerdown', down);
    window.addEventListener('scroll', close, true);
    window.addEventListener('resize', close);
    return () => {
      window.removeEventListener('keydown', key);
      window.removeEventListener('pointerdown', down);
      window.removeEventListener('scroll', close, true);
      window.removeEventListener('resize', close);
    };
  }, [tip]);

  return (
    <GlossaryCtx.Provider value={glossary}>
      <div ref={root} className="glossary-root">
        {children}
      </div>
      {tip && <TermTip tip={tip} />}
    </GlossaryCtx.Provider>
  );
}

function TermTip({ tip }: { tip: Tip }) {
  const ref = useRef<HTMLDivElement>(null);
  const [style, setStyle] = useState<React.CSSProperties>({ visibility: 'hidden' });
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const w = el.offsetWidth;
    const h = el.offsetHeight;
    const r = tip.rect;
    const vw = window.innerWidth;
    let left = r.left + r.width / 2 - w / 2;
    left = Math.max(12, Math.min(vw - w - 12, left));
    const above = r.top - h - 10;
    const top = above > 12 ? above : r.bottom + 10;
    setStyle({ left, top });
  }, [tip]);
  return (
    <div ref={ref} className="term-tip" role="tooltip" style={style}>
      <div className="term-tip-term">{tip.term}</div>
      <Rich html={tip.text} as="div" />
    </div>
  );
}

export function useGlossary() {
  return useContext(GlossaryCtx);
}
