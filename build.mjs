// Compiles SCSS to minified CSS, writes it to assets/css, and inlines it into each
// page's <head> as a <style> block so no render-blocking stylesheet ships.

import { compile } from 'sass';
import { cpSync, readFileSync, writeFileSync, mkdirSync, rmSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = path.dirname(fileURLToPath(import.meta.url));
const cssDir = path.join(root, 'assets', 'css');
mkdirSync(cssDir, { recursive: true });

const pages = [
  { name: 'sports', scss: 'assets/scss/sports.scss', html: 'sports/index.html' },
  { name: 'casino', scss: 'assets/scss/casino.scss', html: 'casino/index.html' },
];

for (const page of pages) {
  const scssPath = path.join(root, page.scss);
  const result = compile(scssPath, { style: 'compressed', loadPaths: [path.join(root, 'assets', 'scss')] });
  const cssOutPath = path.join(cssDir, `${page.name}.css`);
  writeFileSync(cssOutPath, result.css, 'utf8');
  console.log(`compiled ${page.scss} -> assets/css/${page.name}.css (${result.css.length} bytes)`);

  const htmlPath = path.join(root, page.html);
  let html = readFileSync(htmlPath, 'utf8');

  const styleBlock = `<style>${result.css}</style>`;
  if (/<style id="critical-css">[\s\S]*?<\/style>/.test(html)) {
    html = html.replace(/<style id="critical-css">[\s\S]*?<\/style>/, `<style id="critical-css">${result.css}</style>`);
  } else {
    html = html.replace('</head>', `${styleBlock.replace('<style>', '<style id="critical-css">')}\n</head>`);
  }

  writeFileSync(htmlPath, html, 'utf8');
  console.log(`inlined CSS into ${page.html}`);
}

const dist = path.join(root, 'dist');
const client = path.join(dist, 'client');
rmSync(dist, { recursive: true, force: true });
mkdirSync(path.join(client, 'assets'), { recursive: true });
mkdirSync(path.join(dist, 'server'), { recursive: true });

for (const file of ['index.html', 'config.json']) {
  cpSync(path.join(root, file), path.join(client, file));
}
for (const directory of ['sports', 'casino']) {
  cpSync(path.join(root, directory), path.join(client, directory), { recursive: true });
}
for (const directory of ['css', 'js']) {
  cpSync(path.join(root, 'assets', directory), path.join(client, 'assets', directory), { recursive: true });
}
cpSync(path.join(root, 'assets', 'og.png'), path.join(client, 'assets', 'og.png'));

writeFileSync(
  path.join(dist, 'server', 'index.js'),
  "export default { fetch(request, env) { return env.ASSETS.fetch(request); } };\n",
  'utf8'
);

console.log('assembled static deployment in dist/');
