import { loadConfig, resetConfig, readyAfterLatency, lock, track, interpolate, getVariant } from './core.js';

const STORAGE_KEY = 'outcome_casino';
// Bumped because the flow reversed: the wheel now wins a neutral amount and the
// format is chosen afterwards, so outcomes stored by any earlier shape are void.
const STORAGE_VERSION = 4;
const els = {};
const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

let cfg = null;
let casino = null;
let state = { step: 'spin', prizeId: null, formatId: null };
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
 * Spin first, choose second.
 *
 * The wheel wins a neutral amount of credits — genuinely uncertain across the
 * whole prize set, so the spin carries real information rather than animating
 * over a foregone conclusion. The format is chosen afterwards, on the claim
 * screen, where the user already owns the win: picking how to take something you
 * have won reads as spending winnings, where the same three options asked up
 * front are operator jargon aimed at a stranger with no basis to prefer any.
 *
 * The choice also stops being decoration. It is the payload that carries into
 * the handoff, which is the only version of it worth an extra tap.
 */

function prizes() {
  return casino.wheel.prizes;
}

function getPrize(prizeId) {
  return prizes().find((prize) => prize.id === prizeId) || null;
}

function getFormat(formatId) {
  return casino.formats.find((format) => format.id === formatId) || null;
}

function floorPrize() {
  return prizes().reduce((low, prize) => (prize.value < low.value ? prize : low));
}

// Weighted across the whole prize set. Weights live in config so the
// distribution is inspectable rather than hidden in code.
function pickPrize() {
  const total = prizes().reduce((sum, prize) => sum + prize.weight, 0);
  let roll = Math.random() * total;
  for (const prize of prizes()) {
    roll -= prize.weight;
    if (roll <= 0) return prize;
  }
  return prizes()[prizes().length - 1];
}

// One win, three shapes. Converting the same amount into every format is what
// makes the options comparable: the user reads three concrete numbers instead of
// weighing "Deposit Match" against "Cashback" in the abstract.
function formatReward(prize, format) {
  const amount = Math.round(prize.value * format.perUnit);
  return `${amount}${format.suffix}`;
}

/* ------------------------------------------------------------------- rendering */

function wheelGradient() {
  const slice = 360 / prizes().length;
  return `conic-gradient(${prizes()
    .map((prize, index) => `${prize.color} ${index * slice}deg ${(index + 1) * slice}deg`)
    .join(', ')})`;
}

function wheelHtml({ rotation = 0, spinning = false } = {}) {
  const slice = 360 / prizes().length;
  const labels = prizes()
    .map((prize, index) => {
      const angle = (index + 0.5) * slice;
      // Past the halfway point a radial label would read upside-down; the CSS
      // flips the inner span so the glyphs invert without leaving the slot.
      return `
      <span class="wheel__label" data-flip="${angle > 180}" style="--segment-angle:${angle}deg">
        <span>${prize.label}</span>
      </span>`;
    })
    .join('');

  return `
    <div class="wheel-stage${spinning ? ' is-spinning' : ''}"
      style="--spin-duration:${casino.wheel.spinDurationMs}ms">
      <span class="wheel-pointer" aria-hidden="true"></span>
      <div class="wheel" role="img" aria-label="${casino.ui.spinAriaLabel}">
        <div class="wheel__disc" style="--wheel-rotation:${rotation}deg;--segment-slice:${slice}deg;background:${wheelGradient()}">
          ${labels}
        </div>
        <div class="wheel__hub" aria-hidden="true"><span>${casino.wheel.hubLabel}</span></div>
      </div>
    </div>
  `;
}

function stepRailHtml(activeIndex) {
  return `
    <ol class="step-rail">
      ${casino.ui.steps
        .map(
          (label, index) =>
            `<li class="step-rail__item${index === activeIndex ? ' is-active' : ''}"><span>${index + 1}</span>${label}</li>`
        )
        .join('')}
    </ol>
  `;
}

function renderSpin() {
  state.step = 'spin';
  const ui = casino.ui;
  const unit = casino.wheel.unitLabel;

  els.builder.innerHTML = `
    <div class="frame">
      <div class="wheel-flow__intro">
        <p class="step-kicker">${ui.stepSpinKicker}</p>
        <h2 class="builder__title">${ui.stepSpin}</h2>
      </div>
      <p class="wheel-flow__floor">${interpolate(ui.spinHint, { floor: floorPrize().value, unit })}</p>
      ${wheelHtml()}
      <button class="cta spin-cta" type="button" data-action="spin-wheel"
        data-focus-on-unlock>${ui.spinButton}</button>
      ${stepRailHtml(0)}
    </div>
  `;
}

function renderSpinning(rotation) {
  state.step = 'spinning';
  const ui = casino.ui;
  const unit = casino.wheel.unitLabel;

  els.builder.innerHTML = `
    <div class="frame frame--spinning">
      <div class="wheel-flow__intro">
        <h2 class="builder__title">${ui.stepSpinning}</h2>
        <p class="builder__hint">${interpolate(ui.floorNote, { floor: floorPrize().value, unit })}</p>
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
  const prize = pickPrize();
  const index = prizes().findIndex((item) => item.id === prize.id);
  const slice = 360 / prizes().length;
  const rotation = (prefersReducedMotion ? 0 : casino.wheel.turns * 360) - (index + 0.5) * slice;
  const duration = prefersReducedMotion ? 80 : casino.wheel.spinDurationMs;

  state.prizeId = prize.id;
  track('wheel_spun', { prize_id: prize.id, prize_value: prize.value });
  renderSpinning(rotation);
  announce(casino.ui.spinningAnnouncement);

  const revealDelay = prefersReducedMotion ? duration : duration + 80;
  setTimeout(() => renderClaim(prize), revealDelay);
}

function formatCardsHtml(prize) {
  return casino.formats
    .map((format) => {
      const selected = format.id === state.formatId;
      return `
        <button class="preference${selected ? ' is-selected' : ''}" type="button"
          data-action="choose-format" data-format-id="${format.id}"
          aria-pressed="${selected}" style="--choice-color:${format.color}">
          <span class="preference__mark" aria-hidden="true">${format.mark}</span>
          <span class="preference__copy">
            <strong>${format.label}</strong>
            <small>${format.blurb}</small>
          </span>
          <span class="preference__range">${formatReward(prize, format)}</span>
        </button>
      `;
    })
    .join('');
}

// The claim screen is the reveal and the CTA in one. The user owns the win
// before being asked anything, so the choice is a way of collecting rather than
// a gate in front of the offer.
function renderClaim(prize, restored = false) {
  state = { step: 'claim', prizeId: prize.id, formatId: state.formatId };
  const ui = casino.ui;
  const unit = casino.wheel.unitLabel;
  const format = getFormat(state.formatId);

  els.builder.innerHTML = `
    <div class="frame reveal">
      <p class="step-kicker">${ui.stepClaimKicker}</p>
      <p class="reveal__label">${ui.wonLabel}</p>
      <p class="reveal__value">${interpolate(ui.unitSuffix, { value: prize.value, unit })}</p>
      <h2 class="builder__title claim__title">${ui.claimTitle}</h2>
      <p class="builder__hint">${ui.claimHint}</p>
      <div class="preferences" aria-label="${ui.claimTitle}">
        ${formatCardsHtml(prize)}
      </div>
      <p class="reveal__handoff">${
        format
          ? interpolate(ui.handoffCopy, { reward: formatReward(prize, format) })
          : ui.chooseToClaim
      }</p>
      <a class="cta" id="cta" href="${casino.cta.target}"
        ${format ? '' : 'aria-disabled="true" tabindex="-1"'}>${
          format ? interpolate(casino.cta.label, { format: format.label }) : ui.chooseToClaim
        }</a>
      <button class="secondary-btn start-over" type="button" data-action="start-over">${ui.startOver}</button>
      ${stepRailHtml(format ? 2 : 1)}
      ${demoNoticeHtml()}
    </div>
  `;

  if (!restored) {
    announce(interpolate(ui.outcomeAnnouncement, { value: prize.value, unit }));
    track('outcome_revealed', { prize_id: prize.id, prize_value: prize.value });
  }

  $('cta').addEventListener('click', (event) => {
    if (!state.formatId) {
      event.preventDefault();
      return;
    }
    track('cta_clicked', {
      prize_id: prize.id,
      prize_value: prize.value,
      // The chosen format is the payload. Without it carrying into the handoff
      // the choice is decoration, and cost per FTD cannot be split by format.
      format_id: state.formatId,
      reward: formatReward(prize, getFormat(state.formatId)),
      total_time_ms: Math.round(performance.now() - landingStartedAt),
    });
  });

  persist({
    version: STORAGE_VERSION,
    prizeId: prize.id,
    formatId: state.formatId,
    revealedAt: Date.now(),
  });

  const revealEl = els.builder.querySelector('.reveal');
  revealEl.setAttribute('tabindex', '-1');
  if (!restored) revealEl.setAttribute('data-focus-on-unlock', '');
}

function chooseFormat(formatId) {
  const format = getFormat(formatId);
  const prize = getPrize(state.prizeId);
  if (!format || !prize) return;
  state.formatId = format.id;
  track('format_selected', {
    prize_id: prize.id,
    format_id: format.id,
    reward: formatReward(prize, format),
  });
  renderClaim(prize, true);
  els.builder.querySelector('#cta')?.focus();
  announce(
    interpolate(casino.ui.formatAnnouncement, {
      format: format.label,
      reward: formatReward(prize, format),
    })
  );
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
  state = { step: 'spin', prizeId: null, formatId: null };
  track('flow_restarted', {});
  renderSpin();
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

  if (action === 'spin-wheel' && state.step === 'spin') {
    const duration = prefersReducedMotion ? 280 : casino.wheel.spinDurationMs + 250;
    withLock(duration, spinWheel);
    return;
  }

  // Re-picking a format is cheap and reversible, so it is not rate-limited the
  // way an outcome-producing action is — but it still cannot fire off-frame.
  if (action === 'choose-format' && state.step === 'claim') {
    chooseFormat(control.dataset.formatId);
    return;
  }

  if (action === 'start-over' && state.step === 'claim') {
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
  if (state.step !== 'claim') {
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
  const restoredPrize = restored && getPrize(restored.prizeId);
  const validRestore = restored?.version === STORAGE_VERSION && restoredPrize;

  els.builder.hidden = false;
  if (validRestore) {
    state.formatId = restored.formatId && getFormat(restored.formatId) ? restored.formatId : null;
    renderClaim(restoredPrize, true);
    track('interaction_blocked', { during_state: 'claim-restore' });
  } else {
    if (restored) sessionStorage.removeItem(STORAGE_KEY);
    state = { step: 'spin', prizeId: null, formatId: null };
    renderSpin();
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
