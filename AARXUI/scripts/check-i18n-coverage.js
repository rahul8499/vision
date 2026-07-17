const fs = require('fs');
const path = require('path');

const roots = ['app', 'components', 'orders'];
const ignored = new Set(['nativewind-env.d.ts']);
const catalog = JSON.parse(fs.readFileSync(path.join('locales', 'autoTranslations.json'), 'utf8'));
const catalogHas = text => ['en', 'hi', 'mr'].every(language => typeof catalog[language]?.[text] === 'string' && catalog[language][text].trim());
const patterns = [
  { kind: 'JSX text', regex: /<(?:Text|RNText|Button)\b[^>]*>\s*([^<{\n][^<{]*[A-Za-z][^<{]*)\s*<\//g },
  { kind: 'placeholder', regex: /placeholder=["']([A-Za-z][^"']*)["']/g },
  { kind: 'title prop', regex: /\btitle=["']([A-Za-z][^"']*)["']/g },
  { kind: 'alert', regex: /Alert\.alert\(\s*["']([A-Za-z][^"']*)["']/g },
];
const allow = [/^AARX(?:UI)?$/i, /^v?\d+(?:\.\d+)+/, /^EN$|^HI$|^MR$/];
const findings = [];
function walk(dir) {
  for (const name of fs.readdirSync(dir)) {
    const file = path.join(dir, name);
    const stat = fs.statSync(file);
    if (stat.isDirectory()) walk(file);
    else if (/\.(tsx|ts)$/.test(name) && !ignored.has(name)) scan(file);
  }
}
function scan(file) {
  const source = fs.readFileSync(file, 'utf8');
  const lines = source.split('\n');
  patterns.forEach(({ kind, regex }) => {
    for (const match of source.matchAll(regex)) {
      const text = match[1].trim().replace(/\s+/g, ' ');
      if (!text || allow.some(rule => rule.test(text)) || catalogHas(text)) continue;
      const line = source.slice(0, match.index).split('\n').length;
      if (lines[line - 1]?.trim().startsWith('//')) continue;
      findings.push({ file, line, kind, text });
    }
  });
}
roots.filter(fs.existsSync).forEach(walk);
findings.sort((a,b) => a.file.localeCompare(b.file) || a.line-b.line);
console.log(`i18n audit: ${findings.length} visible strings missing from the EN/HI/MR offline catalog`);
findings.forEach(x => console.log(`${x.file}:${x.line} [${x.kind}] ${x.text}`));
if (findings.length) process.exitCode = 1;
