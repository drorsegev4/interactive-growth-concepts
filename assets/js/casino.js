import { loadConfig, resetConfig, readyAfterLatency, lock, track, interpolate, getVariant } from './core.js';

const STORAGE_KEY = 'outcome_casino';
// Bumped because the reward shape changed from a flat cross-type segment list to
// a per-type tier ladder; outcomes stored by the previous mechanic are not valid.
const STORAGE_VERSION = 3;
const els = {};
const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

let cfg = null;
let casino = null;
let state = { step: 'choose', preferenceId: null, tierId: null };
let landingStartedAt = 0;

function $(id) {
  return document.getElementById(id);
}

function cacheEls() {
  els.headline = $('headline');
  els.brand = $('brand');
  els.ageBadge = $('age-badge');
  els.eyebrow = $('eyebrow');
  els.loadingLabel = $('loading-label');
  els.backLink = document.querySelector('.back-link');
  els.subheadline = $('subheadline');
  els.module = $('module');
  els.spinnerLayer = $('spinner-layer');
  els.builder = $('builder');
  els.liveRegion = $('live-region');
  els.rgFooter = $('rg-footer');
}

function renderShell() {
  els.brand.textContent = cfg.global.brand;
  els.ageBadge.textContent = cfg.compliance.ageRating;
  els.backLink.textContent = `← ${cfg.global.backLabel}`;
  els.loadingLabel.textContent = casino.ui.loading;
  els.eyebrow.textContent = casino.ui.experienceLabel;
}

function renderHero(meta) {
  const copy = casino.headlines[meta.variant] || casino.headlines.A;
  els.headline.textContent = copy.headline;
  els.subheadline.textContent = copy.subheadline;
}

function renderRgFooter() {
  const c = cfg.compliance;
  els.rgFooter.innerHTML = `
    <p>${c.termsShort}</p>
    <p>${c.rgMessage} <a href="${c.rgUrl}" rel="noopener noreferrer" target="_blank">${c.rgLabel}</a></p>
  `;
}

function demoNoticeHtml() {
  const n = cfg.demoNotice;
  return `<p class="demo-notice" id="demo-complete"><strong>${n.title}.</strong> ${n.body}</p>`;
}

function announce(message) {
  els.liveRegion.textContent = message;
}

function withLock(durationMs, fn) {
  if (!lock.acquire()) {
    track('interaction_blocked', { during_state: state.step });
    return false;
  }
  els.builder.setAttribute('inert', '');
  fn();
  setTimeout(() => {
    els.builder.removeAttribute('inert');
    const focusTarget = els.builder.querySelector('[data-focus-on-unlock]');
    if (focusTarget) focusTarget.focus();
    lock.release();
  }, durationMs);
  return true;
}

/* --------------------------------------------------------------- reward model
 *
 * Category and magnitude are deliberately separated.
 *
 * Category (spins / match / cashback) is *relevance* — nobody is thrilled to be
 * handed cashback when they wanted spins, so the user owns that decision.
 * Magnitude is the only variable that actually carries emotion, so that is what
 * the spin resolves.
 *
 * Choosing therefore rebuilds the wheel out of that bonus's own tier ladder
 * instead of greying out the segments that no longer apply. Every segment on
 * screen is live, and the lowest tier is a guaranteed floor that is stated
 * before the spin rather than discovered after it.
 */

function getType(typeId) {
  return casino.bonusTypes.find((type) => type.id === typeId) || null;
}

function tiersFor(typeId) {
  const type = getType(typeId);
  return type ? type.tiers : [];
}

function floorTier(typeId) {
  return tiersFor(typeId).reduce((low, tier) => (tier.value < low.value ? tier : low));
}

function ceilingTier(typeId) {
  return tiersFor(typeId).reduce((high, tier) => (tier.value > high.value ? tier : high));
}

function findTier(typeId, tierId) {
  return tiersFor(typeId).find((tier) => tier.id === tierId) || null;
}

// Weighted across the whole ladder, so every tier is reachable and the floor is
// the most likely outcome. Weights live in config rather than in code so the
// distribution is inspectable instead of hidden.
function pickTier(typeId) {
  const tiers = tiersFor(typeId);
  if (!tiers.length) return null;
  const total = tiers.reduce((sum, tier) => sum + tier.weight, 0);
  let roll = Math.random() * total;
  for (const tier of tiers) {
    roll -= tier.weight;
    if (roll <= 0) return tier;
  }
  return tiers[tiers.length - 1];
}

// The wheel only ever exists for a chosen bonus. There is no generic "all
// bonuses" wheel, because the flow never shows one.
function activeSegments() {
  return tiersFor(state.preferenceId);
}

/* ------------------------------------------------------------------- rendering */

function readToken(name, fallback) {
  const value = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return value || fallback;
}

function toRgb(hex) {
  const value = hex.replace('#', '').trim();
  const full = value.length === 3 ? value.split('').map((c) => c + c).join('') : value;
  return [full.slice(0, 2), full.slice(2, 4), full.slice(4, 6)].map((pair) => parseInt(pair, 16));
}

// Blended in JS rather than with CSS color-mix() because the result is
// interpolated into a conic-gradient inside an inline style attribute, and
// color-mix() nested that deep proved unreliable to rasterise.
function mixHex(from, to, amountOfTo) {
  const a = toRgb(from);
  const b = toRgb(to);
  return `#${[0, 1, 2]
    .map((i) => Math.round(a[i] + (b[i] - a[i]) * amountOfTo).toString(16).padStart(2, '0'))
    .join('')}`;
}

function wheelGradient(segments) {
  const slice = 360 / segments.length;
  return `conic-gradient(${segments
    .map((segment, index) => `${segment.color} ${index * slice}deg ${(index + 1) * slice}deg`)
    .join(', ')})`;
}

function wheelHtml({ rotation = 0, spinning = false } = {}) {
  const segments = activeSegments();
  const slice = 360 / segments.length;
  const labels = segments
    .map((segment, index) => {
      const angle = (index + 0.5) * slice;
      // Past the halfway point a radial label would read upside-down; the CSS
      // flips the inner span so the glyphs invert without leaving the slot.
      return `
      <span class="wheel__label" data-flip="${angle > 180}" style="--segment-angle:${angle}deg">
        <span>${segment.label}</span>
      </span>`;
    })
    .join('');

  return `
    <div class="wheel-stage${spinning ? ' is-spinning' : ''}"
      style="--spin-duration:${casino.wheel.spinDurationMs}ms">
      <span class="wheel-pointer" aria-hidden="true"></span>
      <div class="wheel" role="img" aria-label="${casino.ui.spinAriaLabel}">
        <div class="wheel__disc" style="--wheel-rotation:${rotation}deg;--segment-slice:${slice}deg;background:${wheelGradient(segments)}">
          ${labels}
        </div>
        <div class="wheel__hub" aria-hidden="true"><span>${casino.wheel.hubLabel}</span></div>
      </div>
    </div>
  `;
}

// The ladder is what each bonus is actually worth, so it belongs on the card
// rather than only appearing after the choice is made. Ranges are derived from
// the same tier values the wheel is built from — the numbers exist once.
function rangeLabel(type) {
  return interpolate(type.rangeTemplate, {
    floor: floorTier(type.id).value,
    ceiling: ceilingTier(type.id).value,
  });
}

function preferenceButtonsHtml() {
  return casino.bonusTypes
    .map((type) => {
      const selected = type.id === state.preferenceId;
      return `
        <button class="preference${selected ? ' is-selected' : ''}" type="button"
          data-action="choose-preference" data-type-id="${type.id}"
          aria-pressed="${selected}" style="--choice-color:${type.color || 'var(--accent)'}">
          <span class="preference__mark" aria-hidden="true">${type.mark}</span>
          <span class="preference__copy">
            <strong>${type.label}</strong>
            <small>${type.blurb}</small>
          </span>
          <span class="preference__range">${rangeLabel(type)}</span>
        </button>
      `;
    })
    .join('');
}

function stepRailHtml() {
  return `
    <ol class="step-rail">
      ${casino.ui.steps
        .map((label, index) => `<li class="step-rail__item"><span>${index + 1}</span>${label}</li>`)
        .join('')}
    </ol>
  `;
}

/* ------------------------------------------------------------------- frames
 *
 * The flow is two frames rather than one tall screen: choose, then spin.
 *
 * Stacked on a single screen the wheel began roughly 590px down the page, so on
 * a typical handset the rebuild animation and the Spin CTA both sat below the
 * fold — the payoff for choosing was invisible and the primary action was out of
 * reach. Splitting costs no extra taps (choose, spin, CTA either way) and gives
 * each frame one decision.
 */

function renderChoose({ back = false } = {}) {
  state.step = 'choose';
  const ui = casino.ui;

  els.builder.innerHTML = `
    <div class="frame${back ? ' frame--back' : ''}">
      <div class="wheel-flow__intro">
        <p class="step-kicker">${ui.stepChooseKicker}</p>
        <h2 class="builder__title">${ui.stepChoose}</h2>
        <p class="builder__hint">${ui.chooseHint}</p>
      </div>
      <div class="preferences" aria-label="${ui.stepChoose}">
        ${preferenceButtonsHtml()}
      </div>
      <p class="guarantee-note">${ui.guaranteeNote}</p>
      ${stepRailHtml()}
    </div>
  `;
}

function renderWheel({ rebuilt = false } = {}) {
  state.step = 'ready';
  const ui = casino.ui;
  const type = getType(state.preferenceId);

  els.builder.innerHTML = `
    <div class="frame">
      <button class="frame__back" type="button" data-action="change-choice">${ui.changeChoice}</button>
      <div class="wheel-flow__intro">
        <p class="step-kicker">${ui.stepSpinKicker}</p>
        <h2 class="builder__title">${interpolate(ui.selectedLabel, { type: type.label })}</h2>
      </div>
      <p class="wheel-flow__floor">${interpolate(ui.spinHint, { floor: floorTier(type.id).label })}</p>
      ${wheelHtml()}
      <button class="cta spin-cta" type="button" data-action="spin-wheel"
        data-focus-on-unlock>${ui.spinButton}</button>
    </div>
  `;

  // The wheel being rebuilt from the chosen bonus is the reward for choosing, so
  // it gets a beat of its own instead of simply appearing.
  if (rebuilt && !prefersReducedMotion) {
    els.builder.querySelector('.wheel-stage')?.classList.add('is-rebuilding');
  }
}

function choosePreference(typeId) {
  const type = getType(typeId);
  if (!type) return;
  state.preferenceId = type.id;
  state.tierId = null;
  track('preference_selected', {
    bonus_type_id: type.id,
    floor_value: floorTier(type.id).value,
    ceiling_value: ceilingTier(type.id).value,
  });
  renderWheel({ rebuilt: true });
  els.builder.querySelector('[data-action="spin-wheel"]')?.focus();
  announce(
    interpolate(casino.ui.preferenceAnnouncement, {
      type: type.label,
      floor: floorTier(type.id).label,
      ceiling: ceilingTier(type.id).label,
    })
  );
}

function renderSpinning(rotation, type) {
  state.step = 'spin';
  const ui = casino.ui;
  els.builder.innerHTML = `
    <div class="frame frame--spinning">
      <div class="wheel-flow__intro">
        <p class="step-kicker">${interpolate(ui.selectedLabel, { type: type.label })}</p>
        <h2 class="builder__title">${ui.stepSpinning}</h2>
        <p class="builder__hint">${interpolate(ui.floorNote, { floor: floorTier(type.id).label })}</p>
      </div>
      ${wheelHtml({ rotation })}
    </div>
  `;

  const stage = els.builder.querySelector('.wheel-stage');
  requestAnimationFrame(() => {
    requestAnimationFrame(() => stage?.classList.add('is-spinning'));
  });
}

function spinWheel() {
  const type = getType(state.preferenceId);
  const tier = type && pickTier(type.id);
  if (!type || !tier) return;

  const tiers = tiersFor(type.id);
  const tierIndex = tiers.findIndex((item) => item.id === tier.id);
  const slice = 360 / tiers.length;
  const rotation = (prefersReducedMotion ? 0 : casino.wheel.turns * 360) - (tierIndex + 0.5) * slice;
  const duration = prefersReducedMotion ? 80 : casino.wheel.spinDurationMs;

  state.tierId = tier.id;
  track('wheel_spun', { bonus_type_id: type.id, tier_id: tier.id, tier_value: tier.value });
  renderSpinning(rotation, type);
  announce(casino.ui.spinningAnnouncement);

  const revealDelay = prefersReducedMotion ? duration : duration + 80;
  setTimeout(() => renderReveal(type, tier), revealDelay);
}

function renderReveal(type, tier, restored = false) {
  state = { step: 'reveal', preferenceId: type.id, tierId: tier.id };
  const ui = casino.ui;

  els.builder.innerHTML = `
    <div class="reveal reward-reveal">
      <p class="step-kicker">${ui.rewardEyebrow}</p>
      <div class="reward-orbit" aria-hidden="true">
        <span class="reward-orbit__ring"></span>
        <span class="reward-orbit__mark">${type.mark}</span>
      </div>
      <span class="reveal__tag">${ui.matchedLabel}</span>
      <p class="reveal__value">${tier.label}</p>
      <p class="reward-reveal__type">${type.label}</p>
      <p class="reveal__handoff">${ui.handoffCopy}</p>
      <a class="cta" id="cta" href="${casino.cta.target}">${casino.cta.label}</a>
      <button class="secondary-btn start-over" type="button" data-action="start-over">${ui.startOver}</button>
      ${demoNoticeHtml()}
    </div>
  `;

  announce(interpolate(ui.outcomeAnnouncement, { reward: tier.label }));

  if (!restored) {
    track('outcome_revealed', {
      bonus_type_id: type.id,
      tier_id: tier.id,
      reward_value: tier.value,
      uplift_over_floor: tier.value - floorTier(type.id).value,
    });
  }

  $('cta').addEventListener('click', () => {
    track('cta_clicked', {
      bonus_type_id: type.id,
      tier_id: tier.id,
      total_time_ms: Math.round(performance.now() - landingStartedAt),
    });
  });

  persist({
    version: STORAGE_VERSION,
    preferenceId: type.id,
    tierId: tier.id,
    revealedAt: Date.now(),
  });

  const revealEl = els.builder.querySelector('.reveal');
  revealEl.setAttribute('tabindex', '-1');
  revealEl.setAttribute('data-focus-on-unlock', '');
}

function persist(outcome) {
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(outcome));
  } catch {
    // Storage unavailable is non-fatal; the replay guard simply cannot persist.
  }
}

function restoreOutcome() {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function startOver() {
  sessionStorage.removeItem(STORAGE_KEY);
  state = { step: 'choose', preferenceId: null, tierId: null };
  track('flow_restarted', {});
  renderChoose();
  els.builder.querySelector('[data-action="choose-preference"]')?.setAttribute('data-focus-on-unlock', '');
}

// Returning to the choice keeps the previous pick highlighted, so stepping back
// reads as reversible rather than as losing your place.
function changeChoice() {
  track('choice_reopened', { bonus_type_id: state.preferenceId });
  renderChoose({ back: true });
  els.builder.querySelector('.preference.is-selected')?.setAttribute('data-focus-on-unlock', '');
}

function renderError(reason) {
  state.step = 'error';
  track('config_error', { reason });
  const ui = (casino && casino.ui) || {
    errorTitle: "Couldn't load this page",
    errorBody: 'Give it another go.',
    errorRetry: 'Retry',
  };
  els.builder.innerHTML = `
    <div class="reveal error-state">
      <p><strong>${ui.errorTitle}.</strong> ${ui.errorBody}</p>
      <button class="cta retry-btn" type="button" data-action="retry">${ui.errorRetry}</button>
    </div>
  `;
  els.spinnerLayer.hidden = true;
  els.builder.hidden = false;
  els.module.removeAttribute('aria-busy');
}

function onBuilderClick(event) {
  if (!event.isTrusted) return;
  const control = event.target.closest('[data-action]');
  if (!control || control.disabled) return;

  const action = control.dataset.action;
  if (action === 'choose-preference' && state.step === 'choose') {
    choosePreference(control.dataset.typeId);
    return;
  }

  if (action === 'change-choice' && state.step === 'ready') {
    withLock(280, changeChoice);
    return;
  }

  if (action === 'spin-wheel' && state.step === 'ready') {
    const duration = prefersReducedMotion ? 280 : casino.wheel.spinDurationMs + 250;
    withLock(duration, spinWheel);
    return;
  }

  if (action === 'start-over' && state.step === 'reveal') {
    withLock(300, startOver);
    return;
  }

  if (action === 'retry' && state.step === 'error') {
    withLock(300, () => {
      resetConfig();
      boot();
    });
  }
}

window.addEventListener('beforeunload', () => {
  if (state.step !== 'reveal') {
    track('flow_abandoned', { last_state: state.step });
  }
});

async function boot() {
  els.module.setAttribute('aria-busy', 'true');
  els.spinnerLayer.hidden = false;
  els.builder.hidden = true;

  const latencyPromise = readyAfterLatency(cfg?.global?.loadingDurationMs || 1500);

  try {
    cfg = await loadConfig();
  } catch (err) {
    await latencyPromise;
    renderError(err.message);
    return;
  }

  casino = cfg.casino;
  const variantMeta = getVariant(casino.headlines, 'casino');
  renderHero(variantMeta);
  renderRgFooter();
  renderShell();
  await latencyPromise;

  const restored = restoreOutcome();
  const restoredType = restored && getType(restored.preferenceId);
  const restoredTier = restoredType && findTier(restoredType.id, restored.tierId);
  const validRestore = restored?.version === STORAGE_VERSION && restoredType && restoredTier;

  els.builder.hidden = false;
  if (validRestore) {
    renderReveal(restoredType, restoredTier, true);
    track('interaction_blocked', { during_state: 'reveal-restore' });
  } else {
    if (restored) sessionStorage.removeItem(STORAGE_KEY);
    state = { step: 'choose', preferenceId: null, tierId: null };
    renderChoose();
  }

  els.spinnerLayer.hidden = true;
  els.module.removeAttribute('aria-busy');
  track('landing_viewed', { concept: 'casino', variant: variantMeta.variant });
}

function init() {
  cacheEls();
  landingStartedAt = performance.now();
  els.builder.addEventListener('click', onBuilderClick);
  boot();
}

init();
