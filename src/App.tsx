import { useEffect, useState } from 'react';
import { findModule, findLesson } from './content';
import { href, useRoute } from './router';
import { Sidebar } from './components/Sidebar';
import { Home, ModulePage } from './components/Home';
import { LessonPage } from './components/LessonPage';
import { BrandMark, ThemeToggle } from './components/bits';
import { UiIcon } from './components/UiIcon';

export function App() {
  const route = useRoute();
  const [menu, setMenu] = useState(false);
  // Desktop: lessons open in focus mode (sidebar tucked away) unless the learner pinned it open.
  const [lessonSide, setLessonSide] = useState(() => {
    try {
      return localStorage.getItem('groundwork:lesson-sidebar') === 'open';
    } catch {
      return false;
    }
  });
  const inLesson = route.name === 'lesson';
  const sideHidden = inLesson && !lessonSide;
  const toggleSide = () => {
    const next = !lessonSide;
    setLessonSide(next);
    try {
      localStorage.setItem('groundwork:lesson-sidebar', next ? 'open' : 'closed');
    } catch {
      /* ignore */
    }
  };

  useEffect(() => {
    const parts = ['Groundwork'];
    if (route.name === 'module') parts.unshift(findModule(route.moduleId)?.title ?? 'Module');
    if (route.name === 'lesson') parts.unshift(findLesson(route.moduleId, route.lessonId)?.title ?? 'Lesson');
    document.title = parts.join(' · ');
  }, [route]);

  // reset scroll when changing page (not when changing step)
  const pageKey = route.name === 'lesson' ? `l/${route.moduleId}/${route.lessonId}` : route.name === 'module' ? `m/${route.moduleId}` : 'home';
  useEffect(() => {
    document.querySelector('.main')?.scrollTo({ top: 0 });
    setMenu(false);
  }, [pageKey]);

  // "/" focuses search
  useEffect(() => {
    const on = (e: KeyboardEvent) => {
      if (e.key !== '/' || (e.target as HTMLElement).closest('input, textarea')) return;
      e.preventDefault();
      setMenu(true);
      if (sideHidden) toggleSide();
      setTimeout(() => document.querySelector<HTMLInputElement>('.search input')?.focus(), 30);
    };
    window.addEventListener('keydown', on);
    return () => window.removeEventListener('keydown', on);
  });

  return (
    <div className={`app${sideHidden ? ' side-hidden' : ''}${inLesson ? ' in-lesson' : ''}`}>
      <a className="skip" href="#main">
        Skip to content
      </a>
      <Sidebar route={route} open={menu} onClose={() => setMenu(false)} onCollapse={inLesson ? toggleSide : undefined} />
      <div className="main" id="main">
        {sideHidden && (
          <button type="button" className="icon-btn side-open-btn" onClick={toggleSide} aria-label="Show course sidebar" title="Show sidebar">
            <UiIcon name="sidebar" />
          </button>
        )}
        <div className="topbar">
          <button type="button" className="icon-btn menu-btn" onClick={() => setMenu(true)} aria-label="Open course menu">
            <UiIcon name="menu" />
          </button>
          <a className="topbar-brand" href={href.home()}>
            <BrandMark size={26} />
            Groundwork
          </a>
          <div className="topbar-right">
            <ThemeToggle />
          </div>
        </div>
        {route.name === 'home' && <Home />}
        {route.name === 'module' && <ModulePage moduleId={route.moduleId} />}
        {route.name === 'lesson' && <LessonPage moduleId={route.moduleId} lessonId={route.lessonId} at={route.at} />}
      </div>
    </div>
  );
}
