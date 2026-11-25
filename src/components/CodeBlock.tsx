import { useMemo, useState } from 'react';
import type { CodeSnippet } from '../../shared/schema.js';

// A deliberately tiny highlighter: comments, strings, numbers, keywords,
// JSON keys and HTTP header names. Good enough for teaching snippets.

const KEYWORDS = new Set(
  (
    'const let var function return if else for while do switch case break continue new class extends import export from default ' +
    'async await try catch finally throw typeof instanceof in of true false null undefined this void yield interface type enum implements ' +
    'def lambda pass None True False elif with as is not and or ' +
    'select from where insert into values update set delete create table alter drop index primary key references foreign join left right inner outer on group by order having limit offset returning begin commit rollback policy enable row level security using check grant to not null default unique ' +
    'echo export cd npm npx git curl'
  )
    .split(' ')
    .filter(Boolean),
);

type Tok = { t: string; c?: string };

function tokenize(code: string, lang: string): Tok[] {
  const out: Tok[] = [];
  const hashComments = ['bash', 'python', 'yaml', 'toml', 'env'].includes(lang);
  const sqlComments = lang === 'sql';
  const ci = lang === 'sql';
  if (lang === 'http') {
    return code.split(/(\n)/).flatMap((line): Tok[] => {
      const m = /^([A-Za-z-]+)(:)(.*)$/.exec(line);
      if (m) return [{ t: m[1], c: 'k' }, { t: m[2] }, ...tokenize(m[3], 'text-http')];
      const r = /^(GET|POST|PUT|PATCH|DELETE|HTTP\/[\d.]+)(.*)$/.exec(line);
      if (r) return [{ t: r[1], c: 'kw' }, { t: r[2] }];
      return [{ t: line }];
    });
  }
  if (lang === 'diff') {
    return code.split(/(\n)/).map((line) => ({ t: line, c: line.startsWith('+') ? 'add' : line.startsWith('-') ? 'del' : undefined }));
  }
  const re = /(\/\/[^\n]*|\/\*[\s\S]*?\*\/)|(#[^\n]*)|(--[^\n]*)|("(?:\\.|[^"\\\n])*"|'(?:\\.|[^'\\\n])*'|`(?:\\.|[^`\\])*`)|(\b\d+(?:\.\d+)?\b)|([A-Za-z_$][\w$]*)|(\s+|.)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(code))) {
    const [all, cSlash, cHash, cSql, str, num, word] = m;
    if (cSlash && !hashComments && lang !== 'sql') out.push({ t: all, c: 'cm' });
    else if (cHash && hashComments) out.push({ t: all, c: 'cm' });
    else if (cSql && sqlComments) out.push({ t: all, c: 'cm' });
    else if (cSlash || cHash || cSql) {
      // not a comment in this language: re-scan the first char only
      out.push({ t: all[0] });
      re.lastIndex = m.index + 1;
    } else if (str) {
      const after = code.slice(m.index + all.length).match(/^\s*:/);
      out.push({ t: all, c: lang === 'json' && after ? 'k' : 's' });
    } else if (num) out.push({ t: all, c: 'n' });
    else if (word) out.push({ t: all, c: KEYWORDS.has(ci ? word.toLowerCase() : word) && lang !== 'text' && lang !== 'json' ? 'kw' : undefined });
    else out.push({ t: all });
  }
  return out;
}

export function CodeBlock({ snippet }: { snippet: CodeSnippet }) {
  const toks = useMemo(() => tokenize(snippet.code, snippet.language), [snippet]);
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(snippet.code);
      setCopied(true);
      setTimeout(() => setCopied(false), 1400);
    } catch {
      /* clipboard blocked */
    }
  };
  return (
    <figure className="code">
      <div className="code-head">
        <span className="code-name">{snippet.filename ?? snippet.language.toUpperCase()}</span>
        <button type="button" className="code-copy" onClick={copy} aria-label="Copy code">
          {copied ? 'Copied' : 'Copy'}
        </button>
      </div>
      <pre tabIndex={0}>
        <code>
          {toks.map((t, i) =>
            t.c ? (
              <span key={i} className={`tk-${t.c}`}>
                {t.t}
              </span>
            ) : (
              t.t
            ),
          )}
        </code>
      </pre>
      {snippet.caption && <figcaption>{snippet.caption}</figcaption>}
    </figure>
  );
}
