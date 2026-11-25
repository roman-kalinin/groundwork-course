import { useEffect, useMemo, useState } from 'react';
import { allLessons, modules, moduleNumber, type LessonMeta } from '../content';
import { lessonRatio, useProgress } from '../progress';
import { href, type Route } from '../router';
import { UiIcon } from './UiIcon';
import { BrandMark, IsoBadge, ProgressRing, ThemeToggle } from './bits';

export function Sidebar({ route, open, onClose, onCollapse }: { route: Route; open: boolean; onClose: () => void; onCollapse?: () => void }) {
  const progress = useProgress();
  const [query, setQuery] = useState('');
  const currentModule = route.name === 'module' || route.name === 'lesson' ? route.moduleId : undefined;
  const currentLesson = route.name === 'lesson' ? `${route.moduleId}/${route.lessonId}` : undefined;
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set(currentModule ? [currentModule] : []));

  useEffect(() => {
    if (currentModule) setExpanded((s) => (s.has(currentModule) ? s : new Set([...s, currentModule])));
  }, [currentModule]);

  const done = allLessons.filter((l) => progress.lessons[l.key]?.completed).length;
  const total = allLessons.length;

  const q = query.trim().toLowerCase();
  const matches = useMemo(() => {
    if (!q) return null;
    return new Set(allLessons.filter((l) => `${l.title} ${l.summary}`.toLowerCase().includes(q)).map((l) => l.key));
  }, [q]);

  const toggle = (id: string) =>
    setExpanded((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });

  const status = (l: LessonMeta) => {
    const p = progress.lessons[l.key];
    if (p?.completed) return 'done';
    if (p) return 'started';
    return 'new';
  };

  return (
    <>
      <div className={`scrim${open ? ' show' : ''}`} onClick={onClose} aria-hidden="true" />
      <aside className={`sidebar${open ? ' open' : ''}`} aria-label="Course navigation">
        <div className="side-head">
          <a className="brand" href={href.home()} onClick={onClose}>
            <BrandMark />
            <span className="brand-text">
              <span className="brand-name">Groundwork</span>
              <span className="brand-sub">designer → AI engineer</span>
            </span>
          </a>
          <span className="theme-in-side">
            <ThemeToggle />
            {onCollapse && (
              <button type="button" className="icon-btn" onClick={onCollapse} aria-label="Hide sidebar (focus mode)" title="Hide sidebar">
                <UiIcon name="sidebar" />
              </button>
            )}
          </span>
          <button type="button" className="icon-btn side-close" onClick={onClose} aria-label="Close menu">
            <UiIcon name="x" />
          </button>
        </div>

        <div className="side-progress">
          <div className="side-progress-row">
            <span>Course progress</span>
            <span className="num">
              {done}/{total}
            </span>
          </div>
          <div className="bar" role="progressbar" aria-valuemin={0} aria-valuemax={total} aria-valuenow={done} aria-label="Lessons completed">
            <span style={{ width: `${total ? (done / total) * 100 : 0}%` }} />
          </div>
        </div>

        <label className="search">
          <UiIcon name="search" size={16} />
          <input
            type="search"
            placeholder="Search lessons"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            aria-label="Search lessons"
          />
          {!query && <kbd>/</kbd>}
        </label>

        <nav className="side-nav">
          {matches && matches.size === 0 && <p className="side-empty">No lessons match “{query}”.</p>}
          {modules.map((m) => {
            const lessons = matches ? m.lessons.filter((l) => matches.has(l.key)) : m.lessons;
            if (matches && !lessons.length) return null;
            const isOpen = !!matches || expanded.has(m.id);
            const doneHere = m.lessons.filter((l) => progress.lessons[l.key]?.completed).length;
            const empty = m.lessons.length === 0;
            return (
              <div key={m.id} className={`side-module${currentModule === m.id ? ' current' : ''}`} data-color={m.color}>
                <div className="side-module-row">
                  <a className="side-module-link" href={href.module(m.id)} onClick={onClose}>
                    <IsoBadge icon={m.icon} size={30} className="side-badge" />
                    <span className="side-module-text">
                      <span className="side-num">Module {moduleNumber(m)}</span>
                      <span className="side-module-title">{m.title}</span>
                    </span>
                  </a>
                  {empty ? (
                    <span className="soon">Soon</span>
                  ) : (
                    <button
                      type="button"
                      className={`icon-btn tiny chev${isOpen ? ' open' : ''}`}
                      onClick={() => toggle(m.id)}
                      aria-expanded={isOpen}
                      aria-label={`${isOpen ? 'Collapse' : 'Expand'} ${m.title}`}
                    >
                      <span className="side-count">
                        {doneHere}/{m.lessons.length}
                      </span>
                      <UiIcon name="chevron-down" size={14} />
                    </button>
                  )}
                </div>
                {isOpen && !empty && (
                  <ul className="side-lessons">
                    {lessons.map((l) => {
                      const s = status(l);
                      const ratio = lessonRatio(progress.lessons[l.key], l.stepCount);
                      return (
                        <li key={l.key}>
                          <a
                            href={href.lesson(m.id, l.id)}
                            className={`side-lesson${currentLesson === l.key ? ' active' : ''}`}
                            aria-current={currentLesson === l.key ? 'page' : undefined}
                            onClick={onClose}
                          >
                            <ProgressRing ratio={ratio} done={s === 'done'} />
                            <span className="side-lesson-title">{l.title}</span>
                          </a>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
            );
          })}
        </nav>
      </aside>
    </>
  );
}
