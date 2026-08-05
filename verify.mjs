import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { getVariant } from './assets/js/core.js';

const read = (path) => readFileSync(new URL(path, import.meta.url), 'utf8');
const config = JSON.parse(read('./config.json'));

assert.equal(config.schemaVersion, 1, 'config schemaVersion must be 1');
assert.equal(config.global.loadingDurationMs, 1500, 'interactive loading delay must be exactly 1.5 seconds');
assert.ok(config.demoNotice?.title && config.demoNotice?.body, 'portfolio demo notice must be config-driven');

const sportsUiKeys = [
  'loading',
  'stepAim',
  'aimHint',
  'skipShot',
  'startOver',
  'floorLabel',
  'boostedLabel',
  'fixtureSeparator',
  'upToLabel',
  'floorMarkerLabel',
  'maxMarkerLabel',
  'errorTitle',
  'errorBody',
  'errorRetry',
  'timingAriaLabel',
  'handoffCopy',
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
  'handoffCopy',
];

for (const key of sportsUiKeys) assert.ok(config.sports.ui[key], `sports.ui.${key} is required`);
for (const key of casinoUiKeys) assert.ok(config.casino.ui[key], `casino.ui.${key} is required`);

assert.match(config.sports.headlines.A.headline, /\{maxMultiplier\}/, 'headline A must derive its maximum from zones');
assert.equal(config.sports.floorMultiplier, 1.2, 'sports floor must remain 1.2');
assert.ok(
  config.sports.zones.every((zone) => zone.multiplier > config.sports.floorMultiplier),
  'every configured zone must beat the guaranteed floor'
);
assert.ok(config.sports.nearThresholdMultiple > 1, 'near threshold must be a configurable multiplier');
assert.ok(['home', 'away'].includes(config.sports.featuredTeamId), 'featured team must reference the configured fixture');
assert.ok(config.sports.zones.some((zone) => zone.id === config.sports.featuredZoneId), 'featured zone must exist');


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

for (const cssPath of ['./assets/css/sports.css', './assets/css/casino.css']) {
  const css = read(cssPath);
  assert.match(css, /\.spinner-layer\[hidden\]\{display:none\}/, `${cssPath} must dismiss the loading overlay`);
  assert.doesNotMatch(css, /\.spinner \.spinner-layer\[hidden\]/, `${cssPath} hidden rule must not be nested under the spinner`);
}

const sportsJs = read('./assets/js/sports.js');
assert.match(sportsJs, /sports\.nearThresholdMultiple/, 'grading must consume nearThresholdMultiple');
assert.match(sportsJs, /sports\.grid\.cols/, 'sports rendering must consume config grid columns');
assert.match(sportsJs, /sports\.grid\.rows/, 'sports rendering must consume config grid rows');

assert.doesNotMatch(sportsJs, /data-action="pick-(team|zone)"/, 'sports must remain a one-action game');
assert.match(sportsJs, /renderAiming\(\)/, 'sports must open directly on the timing mechanic');
function evaluateVariant(headlines, experimentId, query, stored) {
  const storageKey = 'exp_headline_' + experimentId;
  const values = new Map(stored ? [[storageKey, stored]] : []);
  globalThis.window = {
    location: { search: query },
    localStorage: {
      getItem: (key) => values.get(key) ?? null,
      setItem: (key, value) => values.set(key, value),
    },
  };
  globalThis.document = { documentElement: { dataset: {} } };
  return { meta: getVariant(headlines, experimentId), values };
}

for (const [experimentId, headlines] of [['sports', config.sports.headlines], ['casino', config.casino.headlines]]) {
  assert.deepEqual(evaluateVariant(headlines, experimentId, '?variant=A').meta, { variant: 'A', source: 'url' });
  assert.deepEqual(evaluateVariant(headlines, experimentId, '?variant=b').meta, { variant: 'B', source: 'url' });
  assert.deepEqual(evaluateVariant(headlines, experimentId, '?variant=C').meta, { variant: 'A', source: 'fallback' });
  assert.deepEqual(evaluateVariant(headlines, experimentId, '', 'B').meta, { variant: 'B', source: 'storage' });
}

const extensibleHeadlines = { ...config.sports.headlines, C: { headline: 'Question', subheadline: 'Test' } };
assert.deepEqual(evaluateVariant(extensibleHeadlines, 'sports', '?variant=C').meta, { variant: 'C', source: 'url' });
const namespaced = evaluateVariant(config.sports.headlines, 'sports', '?variant=B');
assert.equal(namespaced.values.get('exp_headline_sports'), 'B');
assert.equal(namespaced.values.has('exp_headline_casino'), false);
console.log('Verified config schema, offer ladder, dynamic geometry, UI copy, and A/B routing.');
