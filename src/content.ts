import type { Lesson, ModuleMeta } from '../shared/schema.js';

// Content is discovered automatically: drop a folder with module.json and
// NN-slug.json lesson files into src/content and it shows up in the app.

export interface LessonMeta {
  id: string;
  moduleId: string;
  nn: number;
  title: string;
  summary: string;
  minutes: number;
  level: string;
  stepCount: number;
  broken?: boolean;
  key: string; // `${moduleId}/${id}`
}
export interface ModuleEntry extends ModuleMeta {
  lessons: LessonMeta[];
}

const moduleFiles = import.meta.glob<ModuleMeta>('./content/*/module.json', { eager: true, import: 'default' });
const metaFiles = import.meta.glob<Omit<LessonMeta, 'moduleId' | 'nn' | 'key'>>('./content/*/[0-9][0-9]-*.json', {
  eager: true,
  query: '?meta',
  import: 'default',
});
const lessonLoaders = import.meta.glob<Lesson>('./content/*/[0-9][0-9]-*.json', { import: 'default' });

const pathParts = (path: string) => {
  const m = /\.\/content\/([^/]+)\/(\d{2})-([^/]+)\.json$/.exec(path);
  return m ? { moduleId: m[1], nn: Number(m[2]), slug: m[3] } : null;
};

const loaderByKey = new Map<string, () => Promise<Lesson>>();

export const modules: ModuleEntry[] = Object.entries(moduleFiles)
  .map(([path, m]) => {
    const folder = path.split('/')[2];
    return { ...m, id: m.id ?? folder, lessons: [] as LessonMeta[] };
  })
  .sort((a, b) => a.order - b.order);

for (const [path, meta] of Object.entries(metaFiles)) {
  const p = pathParts(path);
  if (!p) continue;
  const mod = modules.find((m) => m.id === p.moduleId);
  if (!mod) continue;
  const id = meta.id || p.slug;
  const key = `${p.moduleId}/${id}`;
  mod.lessons.push({ ...meta, id, moduleId: p.moduleId, nn: p.nn, key });
  const loader = lessonLoaders[path];
  if (loader) loaderByKey.set(key, loader);
}
for (const m of modules) m.lessons.sort((a, b) => a.nn - b.nn);

export const allLessons: LessonMeta[] = modules.flatMap((m) => m.lessons);

export const findModule = (id: string) => modules.find((m) => m.id === id);
export const findLesson = (moduleId: string, lessonId: string) =>
  findModule(moduleId)?.lessons.find((l) => l.id === lessonId);

export function loadLesson(key: string): Promise<Lesson> {
  const loader = loaderByKey.get(key);
  if (!loader) return Promise.reject(new Error(`Lesson ${key} not found`));
  return loader();
}

export function nextLesson(key: string): LessonMeta | undefined {
  const i = allLessons.findIndex((l) => l.key === key);
  return i >= 0 ? allLessons[i + 1] : undefined;
}

export function moduleNumber(m: ModuleMeta) {
  return String(m.order).padStart(2, '0');
}
