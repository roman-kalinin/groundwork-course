import { useEffect, useState } from 'react';

export type Route =
  | { name: 'home' }
  | { name: 'module'; moduleId: string }
  | { name: 'lesson'; moduleId: string; lessonId: string; at?: string };

export function parseHash(hash: string): Route {
  const parts = hash.replace(/^#\/?/, '').split('/').filter(Boolean).map(decodeURIComponent);
  if (parts[0] === 'm' && parts[1]) return { name: 'module', moduleId: parts[1] };
  if (parts[0] === 'l' && parts[1] && parts[2]) return { name: 'lesson', moduleId: parts[1], lessonId: parts[2], at: parts[3] };
  return { name: 'home' };
}

export const href = {
  home: () => '#/',
  module: (m: string) => `#/m/${m}`,
  lesson: (m: string, l: string, at?: string | number) => `#/l/${m}/${l}${at !== undefined ? `/${at}` : ''}`,
};

export function navigate(to: string, replace = false) {
  if (replace) history.replaceState(null, '', to);
  else history.pushState(null, '', to);
  window.dispatchEvent(new HashChangeEvent('hashchange'));
}

export function useRoute(): Route {
  const [route, setRoute] = useState(() => parseHash(location.hash));
  useEffect(() => {
    const on = () => setRoute(parseHash(location.hash));
    window.addEventListener('hashchange', on);
    window.addEventListener('popstate', on);
    return () => {
      window.removeEventListener('hashchange', on);
      window.removeEventListener('popstate', on);
    };
  }, []);
  return route;
}
