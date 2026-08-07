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
  'stepChoose',
  'chooseHint',
  'selectedLabel',
  'stepSpin',
  'stepSpinning',
  'spinHint',
  'spinButton',
  'spinAriaLabel',
  'startOver',
  'errorTitle',
  'errorBody',
  'errorRetry',
  'preferenceAnnouncement',
  'spinningAnnouncement',
  'outcomeAnnouncement',
  'rewardEyebrow',
  'matchedLabel',
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

assert.ok(config.casino.bonusTypes.length >= 3, 'casino must offer at least three preference types');
const bonusTypeIds = new Set();
for (const type of config.casino.bonusTypes) {
  assert.ok(type.id && type.label && type.mark && type.blurb && type.color, 'each casino preference must be fully configured');
  assert.ok(!bonusTypeIds.has(type.id), `casino preference ${type.id} must be unique`);
  bonusTypeIds.add(type.id);
}

assert.ok(config.casino.wheel.spinDurationMs >= 1000, 'casino spin must provide a legible reveal moment');
assert.ok(Number.isInteger(config.casino.wheel.turns) && config.casino.wheel.turns >= 3, 'casino wheel turns must be a positive configured integer');
assert.ok(config.casino.wheel.segments.length >= bonusTypeIds.size * 2, 'casino wheel must show multiple outcomes per preference');
const segmentIds = new Set();
const segmentsByType = new Map([...bonusTypeIds].map((id) => [id, 0]));
for (const segment of config.casino.wheel.segments) {
  assert.ok(segment.id && segment.label && segment.color, 'each casino wheel segment must be fully configured');
  assert.ok(!segmentIds.has(segment.id), `casino wheel segment ${segment.id} must be unique`);
  assert.ok(bonusTypeIds.has(segment.typeId), `${segment.id} must reference a configured preference`);
  assert.ok(Number.isFinite(segment.value) && segment.value > 0, `${segment.id} must have a positive value`);
  segmentIds.add(segment.id);
  segmentsByType.set(segment.typeId, segmentsByType.get(segment.typeId) + 1);
}
for (const [typeId, count] of segmentsByType) {
  assert.ok(count >= 2, `${typeId} must have at least two visible wheel outcomes`);
}

for (const cssPath of ['./assets/css/sports.css', './assets/css/casino.css']) {
  const css = read(cssPath);
  assert.match(css, /\.spinner-layer\[hidden\]\{display:none\}/, `${cssPath} must dismiss the loading overlay`);
  assert.doesNotMatch(css, /\.spinner \.spinner-layer\[hidden\]/, `${cssPath} hidden rule must not be nested under the spinner`);
}

const sportsJs = read('./assets/js/sports.js');
const casinoJs = read('./assets/js/casino.js');
assert.match(sportsJs, /sports\.nearThresholdMultiple/, 'grading must consume nearThresholdMultiple');
assert.match(sportsJs, /sports\.grid\.cols/, 'sports rendering must consume config grid columns');
assert.match(sportsJs, /sports\.grid\.rows/, 'sports rendering must consume config grid rows');

assert.doesNotMatch(sportsJs, /data-action="pick-(team|zone)"/, 'sports must remain a one-action game');
assert.match(sportsJs, /renderAiming\(\)/, 'sports must open directly on the timing mechanic');
assert.match(casinoJs, /casino\.wheel\.segments/, 'casino wheel must consume configured segments');
assert.match(casinoJs, /casino\.wheel\.spinDurationMs/, 'casino spin duration must come from config');
assert.match(casinoJs, /data-action="choose-preference"/, 'casino must collect a preference before spinning');
assert.match(casinoJs, /data-action="spin-wheel"/, 'casino must expose an explicit spin action');
assert.match(casinoJs, /withLock\(duration, spinWheel\)/, 'casino spin must remain protected by the interaction lock');
assert.match(casinoJs, /STORAGE_VERSION = 2/, 'casino persistence must reject outcomes from the previous mechanic');
assert.doesNotMatch(casinoJs, /data-action="(add|remove)-token"/, 'legacy token allocation controls must be removed');
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
console.log('Verified config schema, offer contracts, dynamic geometry, wheel state, UI copy, and A/B routing.');
