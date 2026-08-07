import assert from 'node:assert/strict';
import { readFileSync, existsSync, statSync } from 'node:fs';
import { getVariant } from './assets/js/core.js';

const read = (path) => readFileSync(new URL(path, import.meta.url), 'utf8');
const config = JSON.parse(read('./config.json'));

/* ------------------------------------------------------------------ config */

assert.equal(config.schemaVersion, 2, 'config schemaVersion must be 2');
assert.equal(config.global.loadingDurationMs, 1500, 'interactive loading delay must be exactly 1.5 seconds');
assert.ok(config.global.brandShort, 'brandShort must be config-driven');
assert.ok(config.demoNotice?.title && config.demoNotice?.body, 'portfolio demo notice must be config-driven');

const sportsUiKeys = [
  'loading', 'stepAimKicker', 'stepShootKicker', 'stepAim', 'aimHint', 'tapHint', 'skipShot',
  'startOver', 'floorLabel', 'boostedLabel', 'fixtureSeparator', 'upToLabel', 'floorMarkerLabel',
  'maxMarkerLabel', 'errorTitle', 'errorBody', 'errorRetry', 'timingAriaLabel', 'handoffCopy',
  'outcomeAnnouncement',
];

const casinoUiKeys = [
  'loading', 'stepChooseKicker', 'stepSpinKicker', 'stepChoose', 'chooseHint', 'selectedLabel',
  'stepSpin', 'stepSpinning', 'spinHint', 'floorNote', 'changeChoice', 'guaranteeNote', 'spinButton',
  'spinAriaLabel', 'startOver', 'errorTitle', 'errorBody', 'errorRetry', 'preferenceAnnouncement',
  'spinningAnnouncement', 'outcomeAnnouncement', 'rewardEyebrow', 'matchedLabel', 'handoffCopy',
];

assert.ok(
  Array.isArray(config.casino.ui.steps) && config.casino.ui.steps.length >= 2,
  'the step rail must be a configured list of at least two steps'
);

// The floor must be promised before the spin, not revealed after it.
assert.match(config.casino.ui.spinHint, /\{floor\}/, 'the spin hint must state the guaranteed floor');
assert.match(config.casino.ui.floorNote, /\{floor\}/, 'the floor note must state the guaranteed floor');

for (const key of sportsUiKeys) assert.ok(config.sports.ui[key], `sports.ui.${key} is required`);
for (const key of casinoUiKeys) assert.ok(config.casino.ui[key], `casino.ui.${key} is required`);

/* ------------------------------------------------------- sports offer/grid */

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

// The tolerance band must actually fit inside the goal at its configured
// position, otherwise part of the sweet zone is unreachable by the sweep.
for (const zone of config.sports.zones) {
  const targetX = ((zone.col - 0.5) / cols) * 100;
  const half = zone.sweetZonePercent / 2;
  assert.ok(targetX - half >= 0 && targetX + half <= 100, `${zone.id} sweet band must fit within the goal`);
}

/* --------------------------------------------------- team colour contrast */

// The real brand colours fail AA on this palette (Arsenal 3.50:1, Chelsea 1.73:1),
// so every team must supply an accessible tint for text. Enforced here rather
// than checked once by hand, because a new fixture would silently reintroduce
// the failure.
const srgb = (hex) => hex.replace('#', '').match(/../g).map((pair) => parseInt(pair, 16));
const channel = (value) => {
  const c = value / 255;
  return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
};
const luminance = (hex) => {
  const [r, g, b] = srgb(hex);
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
};
const contrast = (a, b) => {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
};

const SPORTS_SURFACE = '#182338'; // --surface, the lightest sports background text sits on
for (const side of ['home', 'away']) {
  const team = config.sports.fixture[side];
  assert.ok(team.onDark, `${side} team must supply an accessible onDark text colour`);
  const ratio = contrast(team.onDark, SPORTS_SURFACE);
  assert.ok(ratio >= 4.5, `${side} onDark ${team.onDark} is ${ratio.toFixed(2)}:1 on --surface, needs >= 4.5:1`);
}

/* --------------------------------------------------------- casino / wheel */

assert.ok(config.casino.bonusTypes.length >= 3, 'casino must offer at least three preference types');
assert.ok(config.casino.wheel.hubLabel, 'wheel hub label must be config-driven');
assert.ok(config.casino.wheel.spinDurationMs >= 1000, 'casino spin must provide a legible reveal moment');
assert.ok(Number.isInteger(config.casino.wheel.turns) && config.casino.wheel.turns >= 3, 'casino wheel turns must be a positive configured integer');
assert.equal(config.casino.wheel.segments, undefined, 'the flat cross-type segment list must be gone');

// Category is the user's choice; magnitude is what the spin resolves. Each bonus
// type therefore owns a tier ladder, and choosing rebuilds the wheel from it.
const bonusTypeIds = new Set();
const allTierIds = new Set();
for (const type of config.casino.bonusTypes) {
  assert.ok(type.id && type.label && type.mark && type.blurb && type.color, 'each casino preference must be fully configured');
  assert.ok(!bonusTypeIds.has(type.id), `casino preference ${type.id} must be unique`);
  bonusTypeIds.add(type.id);

  assert.ok(Array.isArray(type.tiers) && type.tiers.length >= 3, `${type.id} needs a ladder of at least three tiers`);

  // The card must state what the bonus is worth, so the choice is informed
  // rather than blind. The range is templated off the tier values, so the
  // numbers are never written down twice.
  assert.ok(type.rangeTemplate, `${type.id} must supply a range template for its card`);
  assert.match(type.rangeTemplate, /\{floor\}/, `${type.id} range must interpolate its floor`);
  assert.match(type.rangeTemplate, /\{ceiling\}/, `${type.id} range must interpolate its ceiling`);
  assert.doesNotMatch(
    type.rangeTemplate,
    new RegExp(`\\b(${type.tiers.map((tier) => tier.value).join('|')})\\b`),
    `${type.id} range template must derive its numbers, not hardcode them`
  );

  for (const tier of type.tiers) {
    assert.ok(tier.id && tier.label && tier.color, `each ${type.id} tier must be fully configured`);
    assert.ok(!allTierIds.has(tier.id), `tier ${tier.id} must be unique across the config`);
    assert.ok(Number.isFinite(tier.value) && tier.value > 0, `${tier.id} must have a positive value`);
    // Every tier must be reachable. The earlier build always awarded the highest
    // value per type, leaving half the wheel as dead config while still animating
    // a spin over it.
    assert.ok(Number.isFinite(tier.weight) && tier.weight > 0, `${tier.id} must carry a positive selection weight`);
    allTierIds.add(tier.id);
  }

  const values = type.tiers.map((tier) => tier.value);
  const floor = Math.min(...values);
  const ceiling = Math.max(...values);
  // A ladder only creates tension if the top is meaningfully above the floor.
  // The previous 50-vs-75 spread was too tight to be worth a spin.
  assert.ok(ceiling >= floor * 2, `${type.id} ladder is too flat (${floor} to ${ceiling}) to justify a spin`);

  // The floor must be the most likely outcome, so the promise is not just
  // technically true but actually where most users land.
  const byWeight = [...type.tiers].sort((a, b) => b.weight - a.weight);
  assert.equal(byWeight[0].value, floor, `${type.id} must make its guaranteed floor the most likely tier`);

  // And the top rung must not be dressed up as likely.
  const total = type.tiers.reduce((sum, tier) => sum + tier.weight, 0);
  const topChance = type.tiers.find((tier) => tier.value === ceiling).weight / total;
  assert.ok(topChance <= 0.25, `${type.id} top tier at ${(topChance * 100).toFixed(0)}% would overstate the upside`);
}

/* --------------------------------------------------------------- stylesheets */

// Custom properties written by JS at runtime, so they legitimately appear as
// var() references without a declaration in the stylesheet.
const RUNTIME_VARS = new Set([
  'segment-angle', 'segment-slice', 'wheel-rotation', 'spin-duration', 'choice-color',
  'reticle-x', 'zone-left', 'zone-top', 'zone-w', 'zone-h', 'sweet-left', 'sweet-w', 'target-y',
]);

for (const page of ['sports', 'casino']) {
  const css = read(`./assets/css/${page}.css`);

  assert.match(css, /\.spinner-layer\[hidden\]\{display:none\}/, `${page}.css must dismiss the loading overlay`);
  assert.doesNotMatch(css, /\.spinner \.spinner-layer\[hidden\]/, `${page}.css hidden rule must not be nested under the spinner`);
  assert.match(css, /@font-face/, `${page}.css must self-host the typeface`);
  assert.match(css, /manrope-latin-var\.woff2/, `${page}.css must reference the local font file`);
  assert.match(css, /size-adjust/, `${page}.css must metric-match the fallback so the swap costs no layout shift`);

  // Guards the class of bug that left --surface-bright referenced but never
  // declared, silently killing the casino hover state.
  const declared = new Set([...css.matchAll(/--([\w-]+)\s*:/g)].map((match) => match[1]));
  const referenced = new Set([...css.matchAll(/var\(\s*--([\w-]+)/g)].map((match) => match[1]));
  for (const name of referenced) {
    assert.ok(
      declared.has(name) || RUNTIME_VARS.has(name),
      `${page}.css references --${name} but nothing declares it`
    );
  }
}

// Both skins must define the same token surface, so a component styled against
// one vertical cannot break in the other.
const tokens = read('./assets/scss/_tokens.scss');
const skinTokens = (skin) => {
  const block = tokens.match(new RegExp(`\\[data-page='${skin}'\\]\\s*\\{([\\s\\S]*?)\\n\\}`));
  assert.ok(block, `${skin} skin block must exist in _tokens.scss`);
  return new Set([...block[1].matchAll(/--([\w-]+)\s*:/g)].map((match) => match[1]));
};
const sportsTokens = skinTokens('sports');
const casinoTokens = skinTokens('casino');
const SPORTS_ONLY = new Set(['team', 'team-on-dark', 'target', 'target-soft']);
for (const name of casinoTokens) {
  assert.ok(sportsTokens.has(name), `--${name} is declared for casino but missing from sports`);
}
for (const name of sportsTokens) {
  assert.ok(casinoTokens.has(name) || SPORTS_ONLY.has(name), `--${name} is declared for sports but missing from casino`);
}

/* --------------------------------------------------------------- font asset */

const fontUrl = new URL('./assets/fonts/manrope-latin-var.woff2', import.meta.url);
assert.ok(existsSync(fontUrl), 'the self-hosted font must be committed');
const fontBytes = statSync(fontUrl).size;
assert.ok(fontBytes > 0 && fontBytes < 40_000, `font must stay lean for mobile (is ${fontBytes} bytes)`);
assert.equal(readFileSync(fontUrl).subarray(0, 4).toString('latin1'), 'wOF2', 'font must be woff2');

for (const page of ['sports/index.html', 'casino/index.html', 'index.html']) {
  const html = read(`./${page}`);
  assert.match(html, /rel="preload"[^>]*manrope-latin-var\.woff2/, `${page} must preload the font`);
  assert.match(html, /as="font"/, `${page} font preload must declare as="font"`);
  assert.match(html, /crossorigin/, `${page} font preload must be crossorigin`);
}

/* ---------------------------------------------------------------- behaviour */

const sportsJs = read('./assets/js/sports.js');
const casinoJs = read('./assets/js/casino.js');

assert.match(sportsJs, /sports\.nearThresholdMultiple/, 'grading must consume nearThresholdMultiple');
assert.match(sportsJs, /sports\.grid\.cols|const \{ cols, rows \} = sports\.grid/, 'sports geometry must consume the config grid');
assert.doesNotMatch(sportsJs, /data-action="pick-(team|zone)"/, 'sports must remain a one-action game');
assert.match(sportsJs, /renderAiming\(\)/, 'sports must open directly on the timing mechanic');
// The sweet spot is derived from the zone, not pinned to the midpoint, so the
// band being timed is the same place the ball is aimed at.
assert.match(sportsJs, /zoneGeometry/, 'sports must derive its target from the configured zone');
assert.doesNotMatch(sportsJs, /Math\.abs\(position - 50\)/, 'sports must not hardcode a midpoint target');
assert.match(sportsJs, /--team-on-dark/, 'sports must use the accessible team tint for text');
assert.doesNotMatch(sportsJs, /setProperty\('--accent'/, 'the team colour must not overwrite the action colour');

assert.match(casinoJs, /casino\.wheel\.spinDurationMs/, 'casino spin duration must come from config');
assert.match(casinoJs, /casino\.wheel\.hubLabel/, 'wheel hub label must come from config');
assert.match(casinoJs, /data-action="choose-preference"/, 'casino must collect a preference before spinning');
assert.match(casinoJs, /data-action="spin-wheel"/, 'casino must expose an explicit spin action');
assert.match(casinoJs, /withLock\(duration, spinWheel\)/, 'casino spin must remain protected by the interaction lock');
assert.match(casinoJs, /STORAGE_VERSION = 3/, 'casino persistence must reject outcomes from the previous reward shape');
assert.doesNotMatch(casinoJs, /data-action="(add|remove)-token"/, 'legacy token allocation controls must be removed');
assert.match(casinoJs, /data-flip=/, 'wheel labels must declare whether they need flipping');
assert.doesNotMatch(casinoJs, /step-kicker">\s*\d/, 'step kickers must come from config, not literals');

// Choosing must rebuild the wheel from the chosen type's ladder rather than
// greying out segments that no longer apply.
assert.match(casinoJs, /function pickTier/, 'casino must resolve magnitude by weighted tier');
assert.match(casinoJs, /function floorTier/, 'casino must expose a guaranteed floor');
assert.match(casinoJs, /function activeSegments/, 'the wheel must rebuild around the chosen bonus');
assert.doesNotMatch(casinoJs, /function preferredSegment/, 'the always-highest-value selector must be gone');
assert.doesNotMatch(casinoJs, /data-dim=/, 'the wheel must rebuild rather than dim inapplicable segments');
assert.match(casinoJs, /tier\.weight/, 'tier selection must honour configured weights');
assert.match(casinoJs, /floor: floorTier\(/, 'the floor must be interpolated into the pre-spin copy');

// The flow is two frames, each owning one decision. On a single screen the wheel
// and the Spin CTA fell below the fold on a typical handset.
assert.match(casinoJs, /function renderChoose/, 'the choice must be its own frame');
assert.match(casinoJs, /function rangeLabel/, 'cards must show what each bonus is worth');
assert.match(casinoJs, /guaranteeNote/, 'the guarantee must appear on the frame where the choice is made');
assert.match(casinoJs, /function stepRailHtml/, 'the flow length must be visible up front');
assert.match(casinoJs, /function renderWheel/, 'the wheel must be its own frame');
assert.doesNotMatch(casinoJs, /function renderReady/, 'the combined single-screen render must be gone');
assert.match(casinoJs, /data-action="change-choice"/, 'the wheel frame must offer a way back to the choice');
assert.match(casinoJs, /withLock\(280, changeChoice\)/, 'stepping back must be guarded like every other transition');
// Choosing may only be accepted from the choose frame, so a stale control cannot
// re-trigger it after the flow has advanced.
assert.match(casinoJs, /action === 'choose-preference' && state\.step === 'choose'/, 'choice must only be accepted on its own frame');

/* ------------------------------------------------------------- experiments */

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

console.log('Verified config schema, offer contracts, goal geometry, team contrast, wheel reachability, token parity, font delivery, and A/B routing.');
