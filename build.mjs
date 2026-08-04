// Compiles SCSS to minified CSS, writes it to assets/css, and inlines it into each
// page's <head> as a <style> block so no render-blocking stylesheet ships.

import { compile } from 'sass';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
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
