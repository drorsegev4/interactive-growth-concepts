import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const read = (path) => readFileSync(new URL(path, import.meta.url), 'utf8');
const config = JSON.parse(read('./config.json'));

assert.equal(config.schemaVersion, 1, 'config schemaVersion must be 1');
assert.equal(config.global.loadingDurationMs, 1500, 'interactive loading delay must be exactly 1.5 seconds');
assert.ok(config.demoNotice?.title && config.demoNotice?.body, 'portfolio demo notice must be config-driven');

const sportsUiKeys = [
  'loading',
  'stepTeam',
  'stepZone',
  'stepAim',
  'aimHint',
  'skipShot',
  'startOver',
  'takeShot',
  'floorLabel',
  'boostedLabel',
  'errorTitle',
  'errorBody',
  'errorRetry',
  'goalAriaLabel',
  'timingAriaLabel',
];

const casinoUiKeys = [
  'loading',
  'stepAllocate',
  'tokensLeftSingular',
  'tokensLeftPlural',
  'yourPackage',
  'packageEmpty',
  'lockIn',
  'startOver',
  'errorTitle',
  'errorBody',
  'errorRetry',
  'removeTokenLabel',
];

for (const key of sportsUiKeys) assert.ok(config.sports.ui[key], `sports.ui.${key} is required`);
for (const key of casinoUiKeys) assert.ok(config.casino.ui[key], `casino.ui.${key} is required`);

assert.match(config.sports.headlines.A.headline, /\{maxMultiplier\}/, 'headline A must derive its maximum from zones');
assert.equal(config.sports.floorMultiplier, 1.2, 'sports floor must remain 1.2');
assert.ok(
  config.sports.zones.every((zone) => zone.multiplier > config.sports.floorMultiplier),
  'every selectable zone must beat the guaranteed floor'
);
assert.ok(config.sports.nearThresholdMultiple > 1, 'near threshold must be a configurable multiplier');

const { cols, rows } = config.sports.grid;
assert.ok(Number.isInteger(cols) && cols > 0 && Number.isInteger(rows) && rows > 0, 'grid dimensions must be positive integers');
const occupied = new Set();
for (const zone of config.sports.zones) {
  assert.ok(zone.col >= 1 && zone.col <= cols && zone.row >= 1 && zone.row <= rows, `${zone.id} must fit the configured grid`);
  const cell = `${zone.col}:${zone.row}`;
  assert.ok(!occupied.has(cell), `grid cell ${cell} is duplicated`);
  occupied.add(cell);
}

assert.equal(config.casino.maxTokensPerType, 3, 'casino per-category cap must be explicit');
assert.ok(config.casino.bonusToken?.label && config.casino.bonusToken?.count && config.casino.bonusToken?.revealCopy, 'surprise token must be fully configured');

const sportsJs = read('./assets/js/sports.js');
assert.match(sportsJs, /sports\.nearThresholdMultiple/, 'grading must consume nearThresholdMultiple');
assert.match(sportsJs, /sports\.grid\.cols/, 'sports rendering must consume config grid columns');
assert.match(sportsJs, /sports\.grid\.rows/, 'sports rendering must consume config grid rows');

function evaluateVariant(htmlPath, query, stored) {
  const html = read(htmlPath);
  const source = html.match(/<script>\s*([\s\S]*?)<\/script>/)?.[1];
  assert.ok(source, `${htmlPath} must contain the early variant assignment`);
  const values = new Map(stored ? [['exp_headline', stored]] : []);
  const sandbox = {
    location: { search: query },
    localStorage: {
      getItem: (key) => values.get(key) ?? null,
      setItem: (key, value) => values.set(key, value),
    },
    document: { documentElement: { dataset: {} } },
    window: {},
    URLSearchParams,
    Math,
  };
  vm.runInNewContext(source, sandbox);
  return sandbox.window.__entainVariantMeta;
}

for (const page of ['./sports/index.html', './casino/index.html']) {
  assert.deepEqual({ ...evaluateVariant(page, '?variant=A') }, { variant: 'A', source: 'url' });
  assert.deepEqual({ ...evaluateVariant(page, '?variant=b') }, { variant: 'B', source: 'url' });
  assert.deepEqual({ ...evaluateVariant(page, '?variant=C') }, { variant: 'A', source: 'fallback' });
  assert.deepEqual({ ...evaluateVariant(page, '', 'B') }, { variant: 'B', source: 'storage' });
}

console.log('Verified config schema, offer ladder, dynamic geometry, UI copy, and A/B routing.');
