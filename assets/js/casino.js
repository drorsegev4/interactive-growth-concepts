import { loadConfig, resetConfig, readyAfterLatency, lock, track, interpolate, getVariant } from './core.js';

const STORAGE_KEY = 'outcome_casino';
const STORAGE_VERSION = 2;
const els = {};
const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

let cfg = null;
let casino = null;
let state = { step: 'choose', preferenceId: null, segmentId: null };
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
  els.backLink.textContent = `\u2190 ${cfg.global.backLabel}`;
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

function getType(typeId) {
  return casino.bonusTypes.find((type) => type.id === typeId) || null;
}

function getSegment(segmentId) {
  return casino.wheel.segments.find((segment) => segment.id === segmentId) || null;
}

function preferredSegment(typeId) {
  return casino.wheel.segments
    .filter((segment) => segment.typeId === typeId)
    .sort((a, b) => b.value - a.value)[0] || null;
}

function wheelGradient() {
  const segments = casino.wheel.segments;
  const slice = 360 / segments.length;
  return `conic-gradient(${segments
    .map((segment, index) => `${segment.color} ${index * slice}deg ${(index + 1) * slice}deg`)
    .join(', ')})`;
}

function wheelHtml({ rotation = 0, spinning = false } = {}) {
  const segments = casino.wheel.segments;
  const slice = 360 / segments.length;
  const labels = segments
    .map((segment, index) => `
      <span class="wheel__label" style="--segment-angle:${(index + 0.5) * slice}deg">
        <span>${segment.label}</span>
      </span>`)
    .join('');

  return `
    <div class="wheel-stage${spinning ? ' is-spinning' : ''}" style="--spin-duration:${casino.wheel.spinDurationMs}ms">
      <span class="wheel-pointer" aria-hidden="true"></span>
      <div class="wheel" role="img" aria-label="${casino.ui.spinAriaLabel}">
        <div class="wheel__disc" style="--wheel-rotation:${rotation}deg;background:${wheelGradient()}">
          ${labels}
        </div>
        <div class="wheel__hub" aria-hidden="true"><span>365</span></div>
      </div>
    </div>
  `;
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
        </button>
      `;
    })
    .join('');
}

function renderReady() {
  state.step = state.preferenceId ? 'ready' : 'choose';
  const ui = casino.ui;
  const selectedType = getType(state.preferenceId);
  const helper = selectedType
    ? interpolate(ui.selectedLabel, { type: selectedType.label })
    : ui.chooseHint;

  els.builder.innerHTML = `
    <div class="wheel-flow">
      <div class="wheel-flow__intro">
        <h2 class="builder__title">${ui.stepChoose}</h2>
        <p class="builder__hint">${helper}</p>
      </div>
      <div class="preferences" aria-label="${ui.stepChoose}">
        ${preferenceButtonsHtml()}
      </div>
      <div class="wheel-flow__spin">
        ${wheelHtml()}
        <button class="cta spin-cta" type="button" data-action="spin-wheel"
          ${selectedType ? '' : 'disabled aria-disabled="true"'}>${ui.spinButton}</button>
      </div>
    </div>
  `;
}

function choosePreference(typeId) {
  const type = getType(typeId);
  if (!type) return;
  state.preferenceId = type.id;
  state.segmentId = null;
  track('preference_selected', { bonus_type_id: type.id });
  renderReady();
  els.builder.querySelector('[data-action="spin-wheel"]')?.focus();
  announce(interpolate(casino.ui.preferenceAnnouncement, { type: type.label }));
}

function renderSpinning(rotation, type) {
  state.step = 'spin';
  const ui = casino.ui;
  els.builder.innerHTML = `
    <div class="wheel-flow wheel-flow--spinning">
      <div class="wheel-flow__intro">
        <p class="step-kicker">${interpolate(ui.selectedLabel, { type: type.label })}</p>
        <h2 class="builder__title">${ui.stepSpinning}</h2>
        <p class="builder__hint">${interpolate(ui.spinHint, { type: type.label })}</p>
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
  const segment = type && preferredSegment(type.id);
  if (!type || !segment) return;

  const segmentIndex = casino.wheel.segments.findIndex((item) => item.id === segment.id);
  const slice = 360 / casino.wheel.segments.length;
  const rotation = (prefersReducedMotion ? 0 : casino.wheel.turns * 360) - (segmentIndex + 0.5) * slice;
  const duration = prefersReducedMotion ? 80 : casino.wheel.spinDurationMs;

  state.segmentId = segment.id;
  track('wheel_spun', { bonus_type_id: type.id, segment_id: segment.id });
  renderSpinning(rotation, type);
  announce(casino.ui.spinningAnnouncement);

  const revealDelay = prefersReducedMotion ? duration : duration + 80;
  setTimeout(() => renderReveal(type, segment), revealDelay);
}

function renderReveal(type, segment, restored = false) {
  state = { step: 'reveal', preferenceId: type.id, segmentId: segment.id };
  const ui = casino.ui;

  els.builder.innerHTML = `
    <div class="reveal reward-reveal">
      <div class="reward-orbit" aria-hidden="true">
        <span class="reward-orbit__ring"></span>
        <span class="reward-orbit__mark">${type.mark}</span>
      </div>
      <span class="reveal__tag">${ui.matchedLabel}</span>
      <p class="reward-reveal__value">${segment.label}</p>
      <p class="reward-reveal__type">${type.label}</p>
      <p class="reveal__handoff">${ui.handoffCopy}</p>
      <a class="cta" id="cta" href="${casino.cta.target}">${casino.cta.label}</a>
      <button class="secondary-btn start-over" type="button" data-action="start-over">${ui.startOver}</button>
      ${demoNoticeHtml()}
    </div>
  `;

  announce(interpolate(ui.outcomeAnnouncement, { reward: segment.label }));

  if (!restored) {
    track('outcome_revealed', {
      bonus_type_id: type.id,
      segment_id: segment.id,
      reward_value: segment.value,
    });
  }

  $('cta').addEventListener('click', () => {
    track('cta_clicked', {
      bonus_type_id: type.id,
      segment_id: segment.id,
      total_time_ms: Math.round(performance.now() - landingStartedAt),
    });
  });

  persist({
    version: STORAGE_VERSION,
    preferenceId: type.id,
    segmentId: segment.id,
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
  state = { step: 'choose', preferenceId: null, segmentId: null };
  track('flow_restarted', {});
  renderReady();
  els.builder.querySelector('[data-action="choose-preference"]')?.setAttribute('data-focus-on-unlock', '');
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
  if (action === 'choose-preference' && ['choose', 'ready'].includes(state.step)) {
    choosePreference(control.dataset.typeId);
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
  const restoredSegment = restored && getSegment(restored.segmentId);
  const validRestore = restored?.version === STORAGE_VERSION
    && restoredType
    && restoredSegment
    && restoredSegment.typeId === restoredType.id;

  els.builder.hidden = false;
  if (validRestore) {
    renderReveal(restoredType, restoredSegment, true);
    track('interaction_blocked', { during_state: 'reveal-restore' });
  } else {
    if (restored) sessionStorage.removeItem(STORAGE_KEY);
    state = { step: 'choose', preferenceId: null, segmentId: null };
    renderReady();
  }

  els.spinnerLayer.hidden = true;
  els.module.removeAttribute('aria-busy');
  track('landing_viewed', { concept: 'casino', variant: variantMeta.variant, floor_multiplier: null });
}

function init() {
  cacheEls();
  landingStartedAt = performance.now();
  els.builder.addEventListener('click', onBuilderClick);
  boot();
}

init();
