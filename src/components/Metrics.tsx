import { useEffect, useRef, useState } from 'react';
import type { MetricDef, Tone } from '../../shared/schema.js';
import { parseChange } from '../../shared/schema.js';
import { UiIcon } from './UiIcon';
import { Rich } from './Rich';

export type MetricState = { def: MetricDef; value: number | string | null; tone: Tone; changed: boolean };

const decimals = (v: number) => {
  const s = String(v);
  const i = s.indexOf('.');
  return i < 0 ? 0 : Math.min(3, s.length - i - 1);
};
const fmt = (v: number, d: number) => v.toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d });

/** A number that glides from its previous value to the new one. */
function useCountUp(target: number | string | null, reduced: boolean) {
  const [shown, setShown] = useState(target);
  const last = useRef(target);
  useEffect(() => {
    const from = last.current;
    last.current = target;
    if (reduced || typeof target !== 'number' || typeof from !== 'number' || from === target) {
      setShown(target);
      return;
    }
    let raf = 0;
    const t0 = performance.now();
    const tick = (now: number) => {
      const k = Math.min(1, (now - t0) / 700);
      const e = 1 - Math.pow(1 - k, 3);
      setShown(from + (target - from) * e);
      if (k < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, reduced]);
  return shown;
}

function Tile({ m, reduced, stepKey }: { m: MetricState; reduced: boolean; stepKey: number }) {
  const shown = useCountUp(m.value, reduced);
  const d = typeof m.value === 'number' ? decimals(m.value) : 0;
  const text = shown === null ? '–' : typeof shown === 'number' ? fmt(shown, d) : shown;
  const unit = m.def.unit;
  const finalText = m.value === null ? 'not measured yet' : `${typeof m.value === 'number' ? fmt(m.value, d) : m.value}${unit ? ` ${unit}` : ''}`;
  return (
    <li className={`metric tone-${m.value === null ? 'none' : m.tone}${m.changed ? ' changed' : ''}`} key={m.changed ? `c${stepKey}` : 'same'} aria-label={`${m.def.label}: ${finalText}`}>
      <span className="metric-label" aria-hidden="true">
        {m.def.icon && <UiIcon name={m.def.icon} size={13} strokeWidth={2.2} />}
        {m.def.label}
      </span>
      <span className="metric-value" aria-hidden="true">
        {text}
        {unit && m.value !== null && <span className="metric-unit">{unit}</span>}
      </span>
    </li>
  );
}

/** The row of number tiles above the diagram: the numbers leave the diagram. */
export function MetricTiles({ metrics, reduced, stepKey }: { metrics: MetricState[]; reduced: boolean; stepKey: number }) {
  if (!metrics.length) return null;
  return (
    <ul className="metric-row" aria-label="Numbers in this step" style={{ ['--n' as string]: metrics.length }}>
      {metrics.map((m) => (
        <Tile key={m.def.id} m={m} reduced={reduced} stepKey={stepKey} />
      ))}
    </ul>
  );
}

const OP_LABEL = { '+': 'Added', '~': 'Changed', '-': 'Removed' } as const;

/** "What changed" since the previous step: + added, ~ changed, − removed. */
export function ChangeList({ changes }: { changes?: string[] }) {
  if (!changes?.length) return null;
  return (
    <section className="changes" aria-label="What changed since the previous step">
      <p className="changes-title">What changed</p>
      <ul>
        {changes.map((c, i) => {
          const p = parseChange(c) ?? { op: '~' as const, text: c };
          return (
            <li key={i} className={`chg op-${p.op === '+' ? 'add' : p.op === '~' ? 'mod' : 'del'}`}>
              <span className="chg-op" aria-label={OP_LABEL[p.op]}>
                {p.op === '-' ? '−' : p.op}
              </span>
              <Rich html={p.text} />
            </li>
          );
        })}
      </ul>
    </section>
  );
}
