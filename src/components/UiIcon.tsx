import { ICONS } from '../../shared/schema.js';
import { UI_ICONS } from '../uiIcons';

/** Interface icon (Lucide artwork). Falls back to the scene icon set, so module icons work too. */
export function UiIcon({ name, size = 18, className, strokeWidth = 1.9 }: { name: string; size?: number; className?: string; strokeWidth?: number }) {
  const markup = UI_ICONS[name] ?? ICONS[name] ?? '';
  return (
    <svg
      className={`ui-icon${className ? ` ${className}` : ''}`}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      dangerouslySetInnerHTML={{ __html: markup }}
    />
  );
}
