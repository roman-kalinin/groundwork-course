import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import { readFileSync } from 'node:fs';

/**
 * `import.meta.glob('...json', { query: '?meta' })` loads only the small
 * metadata of a lesson (for the sidebar / home page). The full lesson JSON is
 * loaded lazily when the lesson is opened, so the first page stays light.
 */
function lessonMeta(): Plugin {
  return {
    name: 'lesson-meta',
    enforce: 'pre',
    load(id) {
      const [file, query] = id.split('?');
      if (query !== 'meta' || !file.endsWith('.json')) return null;
      this.addWatchFile(file);
      try {
        const l = JSON.parse(readFileSync(file, 'utf8'));
        return 'export default ' + JSON.stringify({
          id: l.id,
          title: l.title,
          summary: l.summary,
          minutes: l.minutes,
          level: l.level,
          stepCount: Array.isArray(l.steps) ? l.steps.length : 0,
        });
      } catch (e) {
        return 'export default ' + JSON.stringify({ id: 'broken', title: 'Broken lesson file', summary: String(e), minutes: 0, level: 'beginner', stepCount: 0, broken: true });
      }
    },
  };
}

export default defineConfig({
  base: './',
  plugins: [lessonMeta(), react()],
  build: { target: 'es2022', chunkSizeWarningLimit: 800 },
});
