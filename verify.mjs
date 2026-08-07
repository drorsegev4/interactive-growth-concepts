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
  'loading', 'stepSpin', 'spinHint', 'floorNote', 'stepSpinning',
  'spinButton', 'spinAriaLabel', 'startOver', 'errorTitle', 'errorBody', 'errorRetry',
  'spinningAnnouncement', 'wonLabel', 'unitSuffix', 'claimTitle', 'claimHint', 'outcomeAnnouncement',
  'formatAnnouncement', 'chooseToClaim', 'rewardEyebrow', 'handoffCopy',
];

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

assert.ok(config.casino.wheel.hubLabel, 'wheel hub label must be config-driven');
assert.ok(config.casino.wheel.unitLabel, 'the neutral prize unit must be config-driven');
assert.ok(config.casino.wheel.spinDurationMs >= 1000, 'casino spin must provide a legible reveal moment');
assert.ok(Number.isInteger(config.casino.wheel.turns) && config.casino.wheel.turns >= 3, 'casino wheel turns must be a positive configured integer');
assert.equal(config.casino.wheel.segments, undefined, 'the flat cross-type segment list must be gone');
assert.equal(config.casino.bonusTypes, undefined, 'the choose-then-spin bonus types must be gone');

// The spin comes first and must carry real information. A wheel whose result is
// already determined by an earlier choice is animation over a foregone
// conclusion, and users read that within one spin.
const prizes = config.casino.wheel.prizes;
assert.ok(Array.isArray(prizes) && prizes.length >= 4, 'the wheel needs at least four prizes to read as a wheel');

const prizeIds = new Set();
for (const prize of prizes) {
  assert.ok(prize.id && prize.label && prize.color, 'each prize must be fully configured');
  assert.ok(!prizeIds.has(prize.id), `prize ${prize.id} must be unique`);
  assert.ok(Number.isFinite(prize.value) && prize.value > 0, `${prize.id} must have a positive value`);
  assert.ok(Number.isFinite(prize.weight) && prize.weight > 0, `${prize.id} must be reachable`);
  prizeIds.add(prize.id);
}

const prizeTotal = prizes.reduce((sum, prize) => sum + prize.weight, 0);
const probabilities = prizes.map((prize) => prize.weight / prizeTotal);
const entropy = -probabilities.reduce((sum, p) => sum + (p > 0 ? p * Math.log2(p) : 0), 0);
// A fair coin carries 1 bit. Below that the spin is barely deciding anything.
assert.ok(entropy >= 1.5, `the spin carries only ${entropy.toFixed(2)} bits; it must be genuinely uncertain`);

const prizeValues = prizes.map((prize) => prize.value);
const prizeFloor = Math.min(...prizeValues);
const prizeCeiling = Math.max(...prizeValues);
assert.ok(prizeCeiling >= prizeFloor * 2, `prize spread ${prizeFloor}..${prizeCeiling} is too flat to justify a spin`);

// The floor must be the most likely outcome, so the guarantee describes where
// most people actually land rather than being a technicality.
const mostLikely = [...prizes].sort((a, b) => b.weight - a.weight)[0];
assert.equal(mostLikely.value, prizeFloor, 'the guaranteed floor must be the most likely prize');

// And the top prize must not be dressed up as likely.
const topChance = prizes.find((prize) => prize.value === prizeCeiling).weight / prizeTotal;
assert.ok(topChance <= 0.25, `top prize at ${(topChance * 100).toFixed(0)}% would overstate the upside`);

// The floor is promised before the spin, not revealed after it.
assert.match(config.casino.ui.spinHint, /\{floor\}/, 'the spin hint must state the guaranteed floor');
assert.match(config.casino.ui.floorNote, /\{floor\}/, 'the floor note must state the guaranteed floor');

// One win, three shapes. Converting the same amount into every format is what
// makes the options comparable as concrete numbers rather than as jargon.
assert.ok(Array.isArray(config.casino.formats) && config.casino.formats.length >= 3, 'at least three claim formats are required');
const formatIds = new Set();
for (const format of config.casino.formats) {
  assert.ok(format.id && format.label && format.mark && format.blurb && format.color, 'each format must be fully configured');
  assert.ok(!formatIds.has(format.id), `format ${format.id} must be unique`);
  assert.ok(Number.isFinite(format.perUnit) && format.perUnit > 0, `${format.id} needs a positive conversion rate`);
  assert.ok(typeof format.suffix === 'string' && format.suffix.length, `${format.id} needs a unit suffix`);
  // Every format must still be worth something at the smallest win, or the
  // floor reads as worthless in that shape.
  const atFloor = Math.round(prizeFloor * format.perUnit);
  assert.ok(atFloor >= 5, `${format.id} yields only ${atFloor} at the floor prize`);
  formatIds.add(format.id);
}

// Naming the chosen format in the CTA is what makes the choice a payload for the
// handoff rather than decoration.
assert.match(config.casino.cta.label, /\{format\}/, 'the claim CTA must name the chosen format');

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
assert.match(casinoJs, /data-action="spin-wheel"/, 'casino must expose an explicit spin action');
assert.match(casinoJs, /withLock\(duration, spinWheel\)/, 'casino spin must remain protected by the interaction lock');
assert.match(casinoJs, /STORAGE_VERSION = 4/, 'casino persistence must reject outcomes from the previous reward shape');
assert.doesNotMatch(casinoJs, /data-action="(add|remove)-token"/, 'legacy token allocation controls must be removed');
assert.match(casinoJs, /data-flip=/, 'wheel labels must declare whether they need flipping');
assert.doesNotMatch(casinoJs, /step-kicker">\s*\d/, 'step kickers must come from config, not literals');

// Spin first, choose second. The wheel must be reachable without any prior
// decision, and nothing may narrow the prize set before it turns.
assert.match(casinoJs, /function pickPrize/, 'the prize must be drawn from the whole wheel');
assert.match(casinoJs, /function renderSpin\b/, 'the spin must be the opening frame');
assert.match(casinoJs, /function renderClaim/, 'the claim screen must be its own frame');
assert.doesNotMatch(casinoJs, /function renderChoose/, 'the choose-first frame must be gone');
assert.doesNotMatch(casinoJs, /data-action="choose-preference"/, 'no preference may be collected before the spin');
assert.doesNotMatch(casinoJs, /function pickTier|function preferredSegment/, 'per-category selection must be gone');
assert.match(casinoJs, /prize\.weight/, 'prize selection must honour configured weights');
assert.match(casinoJs, /floorPrize\(\)/, 'the guaranteed floor must come from the prize set');

// The format is chosen after the win, on the claim screen, and only there.
assert.match(casinoJs, /data-action="choose-format"/, 'the format must be chosen on the claim screen');
assert.match(casinoJs, /action === 'choose-format' && state\.step === 'claim'/, 'format choice must only be accepted once a prize is owned');
assert.match(casinoJs, /function formatReward/, 'one win must convert into every offered format');

// The chosen format has to reach the handoff, otherwise the extra tap buys
// nothing and cost per FTD cannot be split by format.
assert.match(casinoJs, /format_id: state\.formatId/, 'the chosen format must be carried into the CTA event');

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
