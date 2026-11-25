import { allLessons, findModule, modules, moduleNumber } from '../content';
import { lessonRatio, useProgress } from '../progress';
import { href } from '../router';
import { LEVEL_LABEL, ProgressRing } from './bits';
import { UiIcon } from './UiIcon';

export function Home() {
  const progress = useProgress();
  const done = allLessons.filter((l) => progress.lessons[l.key]?.completed).length;
  const minutes = allLessons.reduce((a, l) => a + (l.minutes || 0), 0);
  const lastKey = progress.last;
  const last = lastKey ? allLessons.find((l) => l.key === lastKey) : undefined;
  const lastP = lastKey ? progress.lessons[lastKey] : undefined;
  const firstOpen = allLessons.find((l) => !progress.lessons[l.key]?.completed);
  const resume = last && !lastP?.completed ? last : firstOpen;
  const resumeModule = resume ? findModule(resume.moduleId) : undefined;

  return (
    <div className="page home">
      <header className="hero">
        <p className="eyebrow">For designers who build with Claude Code</p>
        <h1>
          The groundwork beyond system design.
        </h1>
        <p className="lead">
          Data, security, debugging, production, AI engineering and client delivery, explained plainly and one idea at a time. Each lesson is a short
          whiteboard story you click through, with a quiz at the end.
        </p>
        <dl className="stats">
          <div>
            <dt>Modules</dt>
            <dd>{modules.length}</dd>
          </div>
          <div>
            <dt>Lessons</dt>
            <dd>{allLessons.length}</dd>
          </div>
          <div>
            <dt>Completed</dt>
            <dd>
              {done}
              <span className="muted">/{allLessons.length}</span>
            </dd>
          </div>
          <div>
            <dt>Total time</dt>
            <dd>
              {Math.round(minutes / 6) / 10 >= 1 ? `${Math.round(minutes / 6) / 10} h` : `${minutes} min`}
            </dd>
          </div>
        </dl>
        {resume && resumeModule && (
          <a className="resume" href={href.lesson(resume.moduleId, resume.id)}>
            <span className="resume-label">{lastP && last === resume ? 'Continue where you left off' : done ? 'Up next' : 'Start here'}</span>
            <span className="resume-title">{resume.title}</span>
            <span className="resume-meta">
              {resumeModule.title} · {resume.minutes} min
            </span>
            <UiIcon name="arrow-right" className="resume-arrow" />
          </a>
        )}
      </header>

      <section aria-labelledby="modules-h">
        <h2 id="modules-h" className="section-title">
          Modules
        </h2>
        <ol className="module-grid">
          {modules.map((m) => {
            const total = m.lessons.length;
            const doneHere = m.lessons.filter((l) => progress.lessons[l.key]?.completed).length;
            const mins = m.lessons.reduce((a, l) => a + (l.minutes || 0), 0);
            return (
              <li key={m.id}>
                <a className={`module-card${total ? '' : ' empty'}`} href={href.module(m.id)} data-color={m.color}>
                  <span className="module-num">{moduleNumber(m)}</span>
                  <span className="module-title">{m.title}</span>
                  <span className="module-summary">{m.summary}</span>
                  <span className="module-foot">
                    {total ? (
                      <>
                        <span>
                          {total} {total === 1 ? 'lesson' : 'lessons'} · {mins} min
                        </span>
                        <span className="bar small" aria-label={`${doneHere} of ${total} done`}>
                          <span style={{ width: `${(doneHere / total) * 100}%` }} />
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
  return (
    <div className="page module-page" data-color={m.color}>
      <a className="back-link" href={href.home()}>
        <UiIcon name="arrow-left" size={16} /> All modules
      </a>
      <header className="module-head">
        <span className="module-num big">Module {moduleNumber(m)}</span>
        <h1>{m.title}</h1>
        <p className="lead">{m.summary}</p>
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
                      {l.minutes} min · {LEVEL_LABEL[l.level] ?? l.level} · {l.stepCount} steps
                    </span>
                  </span>
                  <ProgressRing ratio={lessonRatio(p, l.stepCount)} done={p?.completed} size={22} />
                </a>
              </li>
            );
          })}
        </ol>
      )}
    </div>
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

