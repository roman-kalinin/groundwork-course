import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { resolveLessonScenes } from '../../shared/schema.js';
import type { Lesson, Step } from '../../shared/schema.js';
import { findLesson, findModule, loadLesson, moduleNumber, nextLesson, type LessonMeta } from '../content';
import { getLessonProgress, resetLesson, updateLesson, useProgress } from '../progress';
import { href, navigate } from '../router';
import { CHAPTER_LABEL, IsoBadge, LEVEL_LABEL, useReducedMotion } from './bits';
import { CodeBlock } from './CodeBlock';
import { GlossaryProvider, Rich } from './Rich';
import { SceneView, sceneBounds } from './SceneView';
import { UiIcon } from './UiIcon';
import { NotFound } from './Home';

export function LessonPage({ moduleId, lessonId, at }: { moduleId: string; lessonId: string; at?: string }) {
  const meta = findLesson(moduleId, lessonId);
  const [lesson, setLesson] = useState<Lesson | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!meta) return;
    let alive = true;
    setLesson(null);
    setError(null);
    loadLesson(meta.key)
      .then((l) => alive && setLesson(l))
      .catch((e) => alive && setError(String(e)));
    return () => {
      alive = false;
    };
  }, [meta]);

  if (!meta) return <NotFound what="lesson" />;
  if (error) return <div className="page"><p className="muted">Could not load this lesson: {error}</p></div>;
  if (!lesson) return <div className="page lesson-loading" aria-busy="true" />;
  return <LessonPlayer key={meta.key} meta={meta} lesson={lesson} at={at} />;
}

function parseAt(at: string | undefined, n: number): number | 'intro' {
  if (at === undefined) return 'intro';
  if (at === 'quiz') return n;
  if (at === 'recap') return n + 1;
  const k = Number(at);
  if (Number.isInteger(k) && k >= 1 && k <= n) return k - 1;
  return 'intro';
}
const atFor = (pos: number, n: number) => (pos < n ? String(pos + 1) : pos === n ? 'quiz' : 'recap');

function LessonPlayer({ meta, lesson, at }: { meta: LessonMeta; lesson: Lesson; at?: string }) {
  const mod = findModule(meta.moduleId)!;
  const n = lesson.steps.length;
  const pos = parseAt(at, n);
  const reduced = useReducedMotion();
  const progress = useProgress();
  const lp = progress.lessons[meta.key];

  const scenes = useMemo(() => resolveLessonScenes(lesson.steps), [lesson]);
  const bounds = useMemo(() => sceneBounds(scenes), [scenes]);
  const firstScene = scenes.find(Boolean);
  const previewBounds = useMemo(() => (firstScene ? sceneBounds([firstScene]) : null), [firstScene]);

  const go = (p: number | 'intro', replace = false) =>
    navigate(p === 'intro' ? href.lesson(meta.moduleId, meta.id) : href.lesson(meta.moduleId, meta.id, atFor(p, n)), replace);

  useEffect(() => {
    if (pos === 'intro') return;
    updateLesson(meta.key, { pos, total: n });
  }, [pos, meta.key, n]);

  // keyboard: arrows step through
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.altKey || e.ctrlKey || e.metaKey || e.shiftKey) return;
      const t = e.target as HTMLElement;
      if (t.closest('input, textarea, select, [contenteditable="true"]')) return;
      if (e.key === 'ArrowRight') {
        e.preventDefault();
        if (pos === 'intro') go(Math.min(getLessonProgress(meta.key)?.pos ?? 0, n + 1));
        else if (pos < n + 1) go(pos + 1);
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        if (pos !== 'intro') go(pos === 0 ? 'intro' : pos - 1);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  // move focus to the new step heading for screen readers, scroll to top on small screens
  const textRef = useRef<HTMLDivElement>(null);
  const first = useRef(true);
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    const h = textRef.current?.querySelector<HTMLElement>('[data-step-heading]');
    h?.focus({ preventScroll: true });
    if (window.innerWidth < 900) document.querySelector('.main')?.scrollTo({ top: 0, behavior: reduced ? 'auto' : 'smooth' });
    textRef.current?.scrollTo({ top: 0 });
  }, [pos, reduced]);

  const stepNo = pos === 'intro' ? 0 : pos;

  return (
    <GlossaryProvider glossary={lesson.glossary}>
      <div className={`lesson${pos === 'intro' ? ' is-intro' : ''}`} data-color={mod.color}>
        <header className="lesson-head">
          <a className="lesson-badge-link" href={href.module(mod.id)} aria-label={`Module ${moduleNumber(mod)}: ${mod.title}`}>
            <IsoBadge icon={mod.icon} size={40} />
          </a>
          <div className="lesson-head-text">
            <div className="crumbs">
              <a href={href.module(mod.id)}>
                <span className="crumb-num">{moduleNumber(mod)}</span> <span className="crumb-text">{mod.title}</span>
              </a>
              <UiIcon name="chevron-right" size={13} />
              <span className="crumb-lesson">Lesson {String(meta.nn).padStart(2, '0')}</span>
            </div>
            <p className="lesson-head-title" aria-current="page">
              {lesson.title}
            </p>
          </div>
          <ul className="chips lesson-chips" aria-label="About this lesson">
            <li className="chip">
              <UiIcon name="timer" size={14} /> {lesson.minutes} min
            </li>
            <li className="chip">
              <UiIcon name="level" size={14} /> {LEVEL_LABEL[lesson.level] ?? lesson.level}
            </li>
            <li className="chip">
              <UiIcon name="steps" size={14} /> {n} steps
            </li>
          </ul>
          {pos !== 'intro' && (
            <div className="lesson-bar" aria-hidden="true">
              <span style={{ width: `${((stepNo + 1) / (n + 2)) * 100}%` }} />
            </div>
          )}
        </header>

        {pos === 'intro' ? (
          <Intro
            lesson={lesson}
            meta={meta}
            resumeAt={lp && !lp.completed ? lp.pos : undefined}
            completed={!!lp?.completed}
            onStart={(p) => go(p)}
            preview={previewBounds ? <SceneView scene={firstScene} bounds={previewBounds} reduced={reduced} stepKey={-1} legend={false} /> : null}
          />
        ) : pos < n ? (
          <div className={`stage${bounds ? ' has-scene' : ''}`}>
            {bounds && (
              <div className="stage-scene">
                <SceneView scene={scenes[pos]} prevScene={pos > 0 ? scenes[pos - 1] : undefined} bounds={bounds} reduced={reduced} stepKey={pos} frame="fill" controls />
              </div>
            )}
            <div className="stage-text" ref={textRef}>
              <StepText key={pos} step={lesson.steps[pos]} index={pos} total={n} />
            </div>
          </div>
        ) : pos === n ? (
          <div className="end-wrap" ref={textRef}>
            <Quiz lesson={lesson} lessonKey={meta.key} total={n} />
          </div>
        ) : (
          <div className="end-wrap" ref={textRef}>
            <Recap lesson={lesson} meta={meta} />
          </div>
        )}

        {pos !== 'intro' && <Controls pos={pos} steps={lesson.steps} furthest={lp?.furthest ?? 0} onGo={go} />}
      </div>
    </GlossaryProvider>
  );
}

function Intro({ lesson, meta, resumeAt, completed, onStart, preview }: { lesson: Lesson; meta: LessonMeta; resumeAt?: number; completed: boolean; onStart: (p: number) => void; preview: ReactNode }) {
  const n = lesson.steps.length;
  const resuming = resumeAt !== undefined && resumeAt > 0;
  return (
    <div className={`intro${preview ? ' has-preview' : ''}`}>
      <div className="intro-text">
      <p className="eyebrow">
        Lesson {String(meta.nn).padStart(2, '0')}
        {completed && <span className="pill ok">Completed</span>}
      </p>
      <h1 tabIndex={-1} data-step-heading>
        {lesson.title}
      </h1>
      <p className="lead">{lesson.summary}</p>
      <ul className="chips intro-meta">
        <li className="chip">
          <UiIcon name="timer" size={14} /> {lesson.minutes} min
        </li>
        <li className="chip">
          <UiIcon name="steps" size={14} /> {n} steps + quiz
        </li>
        <li className="chip">
          <UiIcon name="level" size={14} /> {LEVEL_LABEL[lesson.level] ?? lesson.level}
        </li>
      </ul>
      <div className="learn">
        <h2>You will learn</h2>
        <ul>
          {lesson.youWillLearn.map((t, i) => (
            <li key={i}>
              <UiIcon name="check" size={16} />
              <Rich html={t} />
            </li>
          ))}
        </ul>
      </div>
      <div className="intro-actions">
        <button type="button" className="btn primary" onClick={() => onStart(resuming ? resumeAt! : 0)}>
          {resuming ? `Resume at ${resumeAt! < n ? `step ${resumeAt! + 1}` : resumeAt === n ? 'the quiz' : 'the recap'}` : completed ? 'Review lesson' : 'Start lesson'}
          <UiIcon name="arrow-right" size={16} />
        </button>
        {resuming && (
          <button
            type="button"
            className="btn ghost"
            onClick={() => {
              resetLesson(meta.key);
              onStart(0);
            }}
          >
            Start over
          </button>
        )}
      </div>
      <p className="hint">
        Tip: use <kbd>←</kbd> <kbd>→</kbd> to move between steps. Underlined words show a definition.
      </p>
      </div>
      {preview && <div className="intro-preview">{preview}</div>}
    </div>
  );
}

function StepText({ step, index, total }: { step: Step; index: number; total: number }) {
  return (
    <article className="step">
      <p className="step-eyebrow">
        <span className={`chapter ch-${step.chapter}`}>{CHAPTER_LABEL[step.chapter] ?? step.chapter}</span>
        <span className="step-count">
          Step {index + 1} <span className="of">of {total}</span>
        </span>
      </p>
      <h2 className="step-title" tabIndex={-1} data-step-heading>
        {step.title}
      </h2>
      <div className="step-body">
        {step.body.map((p, i) => (
          <Rich key={i} html={p} as="p" />
        ))}
      </div>
      {step.callout && (
        <aside className={`callout c-${step.callout.type}`}>
          <span className="callout-icon" aria-hidden="true">
            <UiIcon name={CALLOUT_ICON[step.callout.type]} size={17} strokeWidth={2.1} />
          </span>
          <div className="callout-body">
            <p className="callout-title">{step.callout.title ?? CALLOUT_TITLE[step.callout.type]}</p>
            <Rich html={step.callout.text} as="p" />
          </div>
        </aside>
      )}
      {step.code && <CodeBlock snippet={step.code} />}
    </article>
  );
}

const CALLOUT_ICON: Record<string, string> = { tip: 'sparkles', warn: 'octagon-alert', analogy: 'bulb', 'claude-code': 'terminal' };
const CALLOUT_TITLE: Record<string, string> = {
  tip: 'Tip',
  warn: 'Watch out',
  analogy: 'Think of it like this',
  'claude-code': 'When Claude Code does this for you, check',
};

function Controls({ pos, steps, furthest, onGo }: { pos: number; steps: Step[]; furthest: number; onGo: (p: number | 'intro') => void }) {
  const n = steps.length;
  const items = [
    ...steps.map((s, i) => ({ full: `Step ${i + 1}: ${s.title}`, short: s.title.replace(/<[^>]+>/g, ''), kind: 'step', num: String(i + 1) })),
    { full: 'Quiz', short: 'Quiz', kind: 'quiz', num: '' },
    { full: 'Recap', short: 'Recap', kind: 'recap', num: '' },
  ];
  const nextLabel = pos < n - 1 ? 'Next' : pos === n - 1 ? 'Quiz' : pos === n ? 'Recap' : null;
  const railRef = useRef<HTMLOListElement>(null);
  useEffect(() => {
    const rail = railRef.current;
    const el = rail?.querySelector<HTMLElement>('.tl-item.current');
    if (!rail || !el || rail.scrollWidth <= rail.clientWidth) return;
    rail.scrollTo({ left: el.offsetLeft - rail.clientWidth / 2 + el.clientWidth / 2, behavior: 'smooth' });
  }, [pos]);
  const ratio = Math.max(0, Math.min(pos, items.length - 1)) / Math.max(1, items.length - 1);
  return (
    <nav className="controls" aria-label="Lesson steps">
      <button type="button" className="btn ghost ctrl-back" onClick={() => onGo(pos === 0 ? 'intro' : pos - 1)} aria-keyshortcuts="ArrowLeft">
        <UiIcon name="arrow-left" size={16} />
        <span className="ctrl-text">Back</span>
      </button>
      <ol className="timeline" ref={railRef} style={{ ['--done' as string]: ratio, ['--count' as string]: items.length }}>
        {items.map((it, i) => (
          <li key={i} className={`tl-item k-${it.kind}${i === pos ? ' current' : ''}${i < pos ? ' past' : ''}${i <= furthest ? ' seen' : ''}`}>
            <button type="button" className="tl-btn" onClick={() => onGo(i)} aria-label={it.full} aria-current={i === pos ? 'step' : undefined}>
              <span className="tl-dot" aria-hidden="true">
                {it.kind === 'quiz' ? <UiIcon name="quiz" size={13} strokeWidth={2.2} /> : it.kind === 'recap' ? <UiIcon name="flag" size={13} strokeWidth={2.2} /> : it.num}
              </span>
              <span className="tl-label" aria-hidden="true">
                {it.short}
              </span>
            </button>
          </li>
        ))}
      </ol>
      {nextLabel ? (
        <button type="button" className="btn primary ctrl-next" onClick={() => onGo(pos + 1)} aria-keyshortcuts="ArrowRight">
          <span className="ctrl-text">{nextLabel}</span>
          <UiIcon name="arrow-right" size={16} />
        </button>
      ) : (
        <span className="ctrl-spacer" />
      )}
    </nav>
  );
}

function Quiz({ lesson, lessonKey, total }: { lesson: Lesson; lessonKey: string; total: number }) {
  const progress = useProgress();
  const answers = progress.lessons[lessonKey]?.quiz ?? {};
  const answered = Object.keys(answers).length;
  const score = lesson.quiz.filter((q, i) => answers[i] !== undefined && q.options[answers[i]]?.correct).length;
  const choose = (qi: number, oi: number) => {
    if (answers[qi] !== undefined) return;
    updateLesson(lessonKey, { total, quiz: { ...answers, [qi]: oi } });
  };
  return (
    <section className="quiz" aria-labelledby="quiz-h">
      <p className="eyebrow">Check yourself</p>
      <h2 id="quiz-h" tabIndex={-1} data-step-heading>
        Quick quiz
      </h2>
      <p className="muted">
        {lesson.quiz.length} questions. Pick one answer each; you will see why each option is right or wrong.
      </p>
      {lesson.quiz.map((q, qi) => {
        const picked = answers[qi];
        const done = picked !== undefined;
        return (
          <fieldset key={qi} className={`q${done ? ' answered' : ''}`}>
            <legend>
              <span className="q-num">
                {qi + 1}/{lesson.quiz.length}
              </span>
              <Rich html={q.question} />
            </legend>
            <div className="options">
              {q.options.map((o, oi) => {
                const state = !done ? '' : o.correct ? ' correct' : picked === oi ? ' wrong' : ' other';
                return (
                  <div key={oi} className={`opt${state}${picked === oi ? ' picked' : ''}`}>
                    <button type="button" className="opt-btn" onClick={() => choose(qi, oi)} disabled={done} aria-pressed={picked === oi}>
                      <span className="opt-mark" aria-hidden="true">
                        {done && o.correct ? <UiIcon name="check" size={14} /> : done && picked === oi ? <UiIcon name="x" size={14} /> : String.fromCharCode(65 + oi)}
                      </span>
                      <Rich html={o.text} />
                    </button>
                    {done && (picked === oi || o.correct) && (
                      <p className="why">
                        <b>{o.correct ? (picked === oi ? 'Correct. ' : 'Right answer. ') : 'Not quite. '}</b>
                        <Rich html={o.why} />
                      </p>
                    )}
                    {done && picked !== oi && !o.correct && (
                      <details className="why-more">
                        <summary>Why not this one?</summary>
                        <Rich html={o.why} as="p" />
                      </details>
                    )}
                  </div>
                );
              })}
            </div>
          </fieldset>
        );
      })}
      <div className="quiz-foot" aria-live="polite">
        {answered === lesson.quiz.length ? (
          <>
            <span className="score">
              {score === lesson.quiz.length ? 'All correct.' : `${score} of ${lesson.quiz.length} correct.`}
            </span>
            <button
              type="button"
              className="btn ghost small"
              onClick={() => updateLesson(lessonKey, { total, quiz: {} })}
            >
              <UiIcon name="refresh" size={14} /> Try again
            </button>
          </>
        ) : (
          <span className="muted">
            {answered} of {lesson.quiz.length} answered
          </span>
        )}
      </div>
    </section>
  );
}

function Recap({ lesson, meta }: { lesson: Lesson; meta: LessonMeta }) {
  const progress = useProgress();
  const lp = progress.lessons[meta.key];
  const completed = !!lp?.completed;
  const next = nextLesson(meta.key);
  const quizLeft = lesson.quiz.length - Object.keys(lp?.quiz ?? {}).length;
  return (
    <section className="recap" aria-labelledby="recap-h">
      <p className="eyebrow">Recap</p>
      <h2 id="recap-h" tabIndex={-1} data-step-heading>
        Key takeaways
      </h2>
      <ol className="takeaways">
        {lesson.takeaways.map((t, i) => (
          <li key={i}>
            <span className="tk-num">{i + 1}</span>
            <Rich html={t} />
          </li>
        ))}
      </ol>
      <div className={`complete${completed ? ' is-done' : ''}`}>
        {completed ? (
          <>
            <div className="complete-msg">
              <span className="complete-icon">
                <UiIcon name="check" size={18} />
              </span>
              <div>
                <p className="complete-title">Lesson complete</p>
                <p className="muted">Saved on this device.</p>
              </div>
            </div>
            <div className="complete-actions">
              {next ? (
                <a className="btn primary" href={href.lesson(next.moduleId, next.id)}>
                  Next: {next.title}
                  <UiIcon name="arrow-right" size={16} />
                </a>
              ) : (
                <a className="btn primary" href={href.home()}>
                  Back to all modules
                </a>
              )}
              <button type="button" className="btn ghost small" onClick={() => updateLesson(meta.key, { total: lesson.steps.length, completed: false })}>
                Mark as not done
              </button>
            </div>
          </>
        ) : (
          <>
            <div>
              <p className="complete-title">Done with this lesson?</p>
              <p className="muted">
                {quizLeft > 0 ? `You skipped ${quizLeft} quiz ${quizLeft === 1 ? 'question' : 'questions'}. You can still mark it complete.` : 'Mark it complete to track your progress.'}
              </p>
            </div>
            <button
              type="button"
              className="btn primary"
              onClick={() => updateLesson(meta.key, { total: lesson.steps.length, completed: true, completedAt: new Date().toISOString() })}
            >
              <UiIcon name="check" size={16} /> Mark complete
            </button>
          </>
        )}
      </div>
    </section>
  );
}
