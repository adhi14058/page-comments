// A tiny JavaScript tokenizer for the install page: it strips comments from server.js and colours it.
// shortcut: it knows only what server.js uses (no template literals with nested backticks, no JSX);
// switch to a real highlighter if the shown code grows beyond that.
const RULES = [
  ['comment', /\/\/[^\n]*/y],
  ['string', /'(?:\\.|[^'\\\n])*'|"(?:\\.|[^"\\\n])*"|`(?:\\.|[^`\\])*`/y],
  ['regex', /\/(?:\\.|\[(?:\\.|[^\]\\\n])*\]|[^/\\\n])+\/[a-z]*/y],
  ['number', /\d[\w.]*/y],
  ['word', /[A-Za-z_$][\w$]*/y],
  ['space', /\s+/y],
  ['punct', /[^]/y],
];
const KEYWORDS = new Set(['const', 'let', 'var', 'if', 'else', 'return', 'function', 'new', 'typeof', 'true', 'false', 'null', 'undefined', 'for', 'of', 'in', 'while']);
const BUILTINS = new Set(['require', 'module', 'process', 'console', 'Object', 'JSON']);

// A `/` starts a regex at the start, after an operator or `(` `,` `[` `{`, or after `return`; after a value it divides.
const regexMayStart = (prev) => prev === '' || prev === 'return' || prev === 'typeof' || (prev.length === 1 && !/[\w$)\]}]/.test(prev));

function tokens(src) {
  const list = [];
  let i = 0, prev = '';
  while (i < src.length) {
    for (const [type, re] of RULES) {
      if (type === 'regex' && !regexMayStart(prev)) continue;
      re.lastIndex = i;
      const m = re.exec(src);
      if (!m) continue;
      list.push({ type, text: m[0] });
      i += m[0].length;
      if (type !== 'space' && type !== 'comment') prev = m[0];
      break;
    }
  }
  return list;
}

// Drops comments; a line that held only a comment disappears entirely, blank lines stay.
function stripComments(src) {
  let out = '', dropLine = false;
  for (const { type, text } of tokens(src)) {
    if (type === 'comment') {
      out = out.replace(/[ \t]*$/, '');
      dropLine = out === '' || out.endsWith('\n');
      continue;
    }
    out += dropLine && type === 'space' ? text.replace('\n', '') : text;
    dropLine = false;
  }
  return out;
}

const escapeHtml = (t) => t.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

// HTML with <span class="k|s|r|n|f|b|p"> around keywords, strings, regexes, numbers, calls, builtins and properties.
function highlight(src) {
  const list = tokens(src);
  return list.map((t, i) => {
    let cls = { string: 's', regex: 'r', number: 'n' }[t.type] || '';
    if (t.type === 'word') {
      const next = list.slice(i + 1).find((x) => x.type !== 'space'), before = list[i - 1];
      cls = KEYWORDS.has(t.text) ? 'k' : BUILTINS.has(t.text) ? 'b' : next?.text === '(' ? 'f' : before?.text === '.' ? 'p' : '';
    }
    return cls ? `<span class="${cls}">${escapeHtml(t.text)}</span>` : escapeHtml(t.text);
  }).join('');
}

module.exports = { stripComments, highlight, escapeHtml };
