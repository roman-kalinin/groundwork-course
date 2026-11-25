import { useEffect, useMemo, useState } from 'react';
import { resolveLessonScenes } from '../../shared/schema.js';
import { polyBox, sceneLayout } from '../../shared/iso.js';
import type { ResolvedScene } from '../../shared/schema.js';
import { allLessons, findModule, loadLesson, modules, moduleNumber } from '../content';
import { lessonRatio, useProgress } from '../progress';
import { href } from '../router';
import { IsoBadge, LEVEL_LABEL, ProgressRing, useReducedMotion } from './bits';
import { SceneView, sceneBounds } from './SceneView';
import { UiIcon } from './UiIcon';

// The home page hero diagram: the stack every lesson builds on.
const HERO: ResolvedScene = {
  nodes: [
    { id: 'you', x: 1.3, y: 3.5, label: 'You', sublabel: 'designer who ships', kind: 'person', icon: 'user' },
    { id: 'app', x: 3.6, y: 3.5, label: 'Your app', icon: 'browser', kind: 'client' },
    { id: 'api', x: 6.2, y: 3.5, label: 'API', icon: 'function', kind: 'server', status: 'active' },
    { id: 'llm', x: 6.2, y: 1.2, label: 'Claude', icon: 'sparkle', kind: 'ai' },
    { id: 'db', x: 6.2, y: 6.3, label: 'Postgres', icon: 'database', kind: 'data' },
  ],
  edges: [
    { id: 'you>app', from: 'you', to: 'app', packet: { speed: 'slow' } },
    { id: 'app>api', from: 'app', to: 'api', packet: { label: 'POST', status: 'active' } },
    { id: 'api>db', from: 'api', to: 'db', packet: { status: 'ok', direction: 'both', speed: 'slow' } },
    { id: 'api>llm', from: 'api', to: 'llm', style: 'dashed', packet: { status: 'normal' } },
  ],
  zones: [
    { id: 'client', x: 0.3, y: 2.5, w: 4.4, h: 2.0, label: 'Your side' },
    { id: 'server', x: 5.1, y: 0.2, w: 2.2, h: 7.2, label: 'Server', status: 'active' },
  ],
  notes: [],
};

export function Home() {
  const progress = useProgress();
  const reduced = useReducedMotion();
  const heroBounds = useMemo(() => sceneBounds([HERO]), []);
  const done = allLessons.filter((l) => progress.lessons[l.key]?.completed).length;
  const minutes = allLessons.reduce((a, l) => a + (l.minutes || 0), 0);
  const lastKey = progress.last;
  const last = lastKey ? allLessons.find((l) => l.key === lastKey) : undefined;
  const lastP = lastKey ? progress.lessons[lastKey] : undefined;
  const firstOpen = allLessons.find((l) => !progress.lessons[l.key]?.completed);
  const resume = last && !lastP?.completed ? last : firstOpen;
  const resumeModule = resume ? findModule(resume.moduleId) : undefined;
  const hours = Math.round(minutes / 6) / 10;

  return (
    <div className="page home">
      <header className="hero">
        <div className="hero-text">
          <p className="eyebrow">
            <span className="eyebrow-dot" aria-hidden="true" />
            For designers who build with Claude Code
          </p>
          <h1>
            Lay the <em>groundwork</em> under everything you ship.
          </h1>
          <p className="lead">
            Data, security, debugging, production, AI engineering and client delivery, explained plainly and one idea at a time. Every lesson is a short,
            animated whiteboard story you click through, with a quiz at the end.
          </p>
          <ul className="hero-stats" aria-label="Course at a glance">
            <li>
              <b>{modules.length}</b> modules
            </li>
            <li>
              <b>{allLessons.length}</b> lessons
            </li>
            <li>
              <b>{hours >= 1 ? `${hours} h` : `${minutes} min`}</b> in total
            </li>
            <li>
              <b>
                {done}/{allLessons.length}
              </b>{' '}
              done
            </li>
          </ul>
          {resume && resumeModule && (
            <a className="resume" href={href.lesson(resume.moduleId, resume.id)} data-color={resumeModule.color}>
              <IsoBadge icon={resumeModule.icon} size={44} className="resume-badge" />
              <span className="resume-main">
                <span className="resume-label">{lastP && last === resume ? 'Continue where you left off' : done ? 'Up next' : 'Start here'}</span>
                <span className="resume-title">{resume.title}</span>
                <span className="resume-meta">
                  {resumeModule.title} · {resume.minutes} min
                </span>
              </span>
              <span className="resume-go" aria-hidden="true">
                <UiIcon name="arrow-right" size={20} />
              </span>
            </a>
          )}
        </div>
        {heroBounds && (
          <div className="hero-art" aria-hidden="true">
            <SceneView scene={HERO} bounds={heroBounds} reduced={reduced} stepKey={0} legend={false} frame="content" />
          </div>
        )}
      </header>

      <section aria-labelledby="modules-h">
        <div className="section-head">
          <h2 id="modules-h" className="section-title">
            The course
          </h2>
          <p className="muted">Seven modules. Take them in order, or jump to what your current project needs.</p>
        </div>
        <ol className="module-grid">
          {modules.map((m) => {
            const total = m.lessons.length;
            const doneHere = m.lessons.filter((l) => progress.lessons[l.key]?.completed).length;
            const mins = m.lessons.reduce((a, l) => a + (l.minutes || 0), 0);
            return (
              <li key={m.id}>
                <a className={`module-card${total ? '' : ' empty'}`} href={href.module(m.id)} data-color={m.color}>
                  <span className="module-card-top">
                    <IsoBadge icon={m.icon} size={58} className="module-badge" />
                    <span className="module-num">{moduleNumber(m)}</span>
                  </span>
                  <span className="module-title">{m.title}</span>
                  <span className="module-summary">{m.summary}</span>
                  <span className="module-foot">
                    {total ? (
                      <>
                        <span className="module-meta">
                          {total} lessons · {mins} min
                        </span>
                        <span className="module-progress">
                          <span className="bar small" aria-label={`${doneHere} of ${total} done`}>
                            <span style={{ width: `${(doneHere / total) * 100}%` }} />
                          </span>
                          <span className="num">
                            {doneHere}/{total}
                          </span>
                        </span>
                      </>
                    ) : (
                      <span className="soon">Coming soon</span>
                    )}
                  </span>
                </a>
              </li>
            );
          })}
        </ol>
      </section>
    </div>
  );
}

export function ModulePage({ moduleId }: { moduleId: string }) {
  const progress = useProgress();
  const m = findModule(moduleId);
  if (!m) return <NotFound what="module" />;
  const doneHere = m.lessons.filter((l) => progress.lessons[l.key]?.completed).length;
  const mins = m.lessons.reduce((a, l) => a + (l.minutes || 0), 0);
  return (
    <div className="page module-page" data-color={m.color}>
      <a className="back-link" href={href.home()}>
        <UiIcon name="arrow-left" size={16} /> All modules
      </a>
      <header className="module-head">
        <IsoBadge icon={m.icon} size={76} className="module-head-badge" />
        <div>
          <span className="module-kicker">Module {moduleNumber(m)}</span>
          <h1>{m.title}</h1>
          <p className="lead">{m.summary}</p>
          {m.lessons.length > 0 && (
            <ul className="chips">
              <li className="chip">
                <UiIcon name="layers" size={14} /> {m.lessons.length} lessons
              </li>
              <li className="chip">
                <UiIcon name="timer" size={14} /> {mins} min
              </li>
              <li className="chip">
                <UiIcon name="circle-check" size={14} /> {doneHere} done
              </li>
            </ul>
          )}
        </div>
      </header>
      {m.lessons.length === 0 ? (
        <div className="empty-state">
          <UiIcon name="clock" size={22} />
          <div>
            <p className="empty-title">Lessons are on the way</p>
            <p className="muted">This module is being written. Check back soon, or continue with another module.</p>
          </div>
        </div>
      ) : (
        <ol className="lesson-list">
          {m.lessons.map((l) => {
            const p = progress.lessons[l.key];
            return (
              <li key={l.key}>
                <a className="lesson-row" href={href.lesson(m.id, l.id)}>
                  <span className="lesson-row-num">{String(l.nn).padStart(2, '0')}</span>
                  <span className="lesson-row-main">
                    <span className="lesson-row-title">{l.title}</span>
                    <span className="lesson-row-summary">{l.summary}</span>
                    <span className="lesson-row-meta">
                      <span>{l.minutes} min</span>
                      <span>{LEVEL_LABEL[l.level] ?? l.level}</span>
                      <span>{l.stepCount} steps</span>
                    </span>
                  </span>
                  <LessonThumb lessonKey={l.key} />
                  <ProgressRing ratio={lessonRatio(p, l.stepCount)} done={p?.completed} size={26} />
                </a>
              </li>
            );
          })}
        </ol>
      )}
    </div>
  );
}

/** Bounds of the blocks and plates only (thumbnails leave the text out). */
function blockBounds(scene: ResolvedScene) {
  const L = sceneLayout(scene);
  const boxes = [...[...L.nodes.values()].map((n) => polyBox(n.sil)), ...L.zones.map((z) => polyBox(z.poly))];
  if (!boxes.length) return null;
  const x0 = Math.min(...boxes.map((b) => b.x)), y0 = Math.min(...boxes.map((b) => b.y));
  const x1 = Math.max(...boxes.map((b) => b.x + b.w)), y1 = Math.max(...boxes.map((b) => b.y + b.h));
  const pad = 30;
  let w = x1 - x0 + pad * 2, h = y1 - y0 + pad * 2;
  // a fixed 16:10 frame, centred
  const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2;
  if (w / h > 1.6) h = w / 1.6; else w = h * 1.6;
  return { x: cx - w / 2, y: cy - h / 2, w, h };
}

/** A small, still picture of a lesson's first diagram (blocks only). */
function LessonThumb({ lessonKey }: { lessonKey: string }) {
  const [scene, setScene] = useState<ResolvedScene | null>(null);
  useEffect(() => {
    let alive = true;
    loadLesson(lessonKey)
      .then((l) => {
        const first = resolveLessonScenes(l.steps).find(Boolean);
        if (alive && first) setScene(first);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [lessonKey]);
  const bounds = useMemo(() => (scene ? blockBounds(scene) : null), [scene]);
  return (
    <span className="lesson-thumb" aria-hidden="true">
      {scene && bounds && <SceneView scene={scene} bounds={bounds} reduced stepKey={0} legend={false} compact />}
    </span>
  );
}

export function NotFound({ what }: { what: string }) {
  return (
    <div className="page">
      <div className="empty-state">
        <UiIcon name="search" size={22} />
        <div>
          <p className="empty-title">That {what} does not exist</p>
          <p className="muted">
            It may have been renamed. <a href={href.home()}>Go to the course home</a>.
          </p>
        </div>
      </div>
    </div>
  );
}
