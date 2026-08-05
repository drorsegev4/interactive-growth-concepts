import { loadConfig, resetConfig, readyAfterLatency, lock, track, interpolate } from './core.js';

const STORAGE_KEY = 'outcome_casino';
const els = {};
let cfg = null;
let casino = null;
let state = { step: 'allocate', allocation: {} };
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
function renderHero() {
  const meta = window.__entainVariantMeta || { variant: 'A', source: 'random' };

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

function easeOutExpo(t) {
  return t === 1 ? 1 : 1 - Math.pow(2, -10 * t);
}

function countUp(el, from, to, duration = 400) {
  const start = performance.now();
  function frame(now) {
    const t = Math.min((now - start) / duration, 1);
    const value = from + (to - from) * easeOutExpo(t);
    el.textContent = Math.round(value);
    if (t < 1) requestAnimationFrame(frame);
    else el.textContent = Math.round(to);
  }
  requestAnimationFrame(frame);
}

function totalPlaced(allocation) {
  return Object.values(allocation).reduce((sum, n) => sum + n, 0);
}

function formatValue(type, count) {
  const value = type.perToken * count;
  return type.unit === '%' ? `${value}%` : `${value} ${type.unit}`;
}

function packageRowsHtml(allocation, bonusCategoryId) {
  const rows = casino.bonusTypes
    .filter((type) => allocation[type.id] > 0)
    .map((type) => {
      const isBonus = type.id === bonusCategoryId;
      return `<div class="package__row${isBonus ? ' package__row--bonus' : ''}">
        <span>${type.label}${isBonus ? ` +${casino.ui.bonusSuffix}` : ''}</span>
        <span data-value-for="${type.id}">${formatValue(type, allocation[type.id])}</span>
      </div>`;
    })
    .join('');
  return rows || `<p class="package__empty">${casino.ui.packageEmpty}</p>`;
}

// ---- Step: allocate ----
function renderAllocate() {
  state.step = 'allocate';
  document.documentElement.style.removeProperty('--accent');

  const ui = casino.ui;
  const remaining = casino.tokenCount - totalPlaced(state.allocation);
  const tokensLeftLabel = remaining === 1 ? ui.tokensLeftSingular : ui.tokensLeftPlural;

  const categoriesHtml = casino.bonusTypes
    .map((type) => {
      const count = state.allocation[type.id] || 0;
      const pips = Array.from({ length: count })
        .map(() => `<button class="pip is-filled" type="button" data-action="remove-token" data-type-id="${type.id}" aria-label="${interpolate(ui.removeTokenLabel, { type: type.label })}"></button>`)
        .join('');
      const atCategoryMax = count >= casino.maxTokensPerType;
      const disabled = remaining <= 0 || atCategoryMax;
      return `
      <div class="category-row">
        <button class="category" type="button" data-action="add-token" data-type-id="${type.id}" ${disabled ? 'disabled aria-disabled="true"' : ''}>
          <span class="category__info">
            <span class="category__label">${type.label}</span>
            <span class="category__blurb">${type.blurb}</span>
          </span>
          <span class="category__count">${count}/${casino.maxTokensPerType}</span>
        </button>
        ${count > 0 ? `<div class="category__pips">${pips}</div>` : ''}
      </div>`;
    })
    .join('');

  els.builder.innerHTML = `
    <h2 class="builder__title">${ui.stepAllocate}</h2>
    <p class="token-bank">${remaining} ${tokensLeftLabel}</p>
    <div class="categories">${categoriesHtml}</div>
    <div class="package">
      <p class="package__title">${ui.yourPackage}</p>
      <div id="package-rows">${packageRowsHtml(state.allocation)}</div>
    </div>
    <button class="cta lock-in" type="button" data-action="lock-in" ${remaining > 0 ? 'disabled aria-disabled="true"' : ''}>${ui.lockIn}</button>
  `;
}

function handleAddToken(typeId) {
  const remaining = casino.tokenCount - totalPlaced(state.allocation);
  const current = state.allocation[typeId] || 0;
  if (remaining <= 0 || current >= casino.maxTokensPerType) return;
  state.allocation[typeId] = current + 1;
  track('token_placed', { bonus_type_id: typeId, count_in_category: state.allocation[typeId] });
  renderAllocate();
  const type = casino.bonusTypes.find((item) => item.id === typeId);
  announce(interpolate(casino.ui.tokenPlacedAnnouncement, { type: type.label }));
}

function handleRemoveToken(typeId) {
  if (!state.allocation[typeId]) return;
  state.allocation[typeId] -= 1;
  if (state.allocation[typeId] <= 0) delete state.allocation[typeId];
  track('token_removed', { bonus_type_id: typeId });
  renderAllocate();
}

function pickBonusCategory(allocation) {
  let bestId = null;
  let bestCount = -1;
  for (const type of casino.bonusTypes) {
    const count = allocation[type.id] || 0;
    if (count > bestCount) {
      bestCount = count;
      bestId = type.id;
    }
  }
  return bestId;
}

// ---- Lock in / reveal ----
function lockIn() {
  const remaining = casino.tokenCount - totalPlaced(state.allocation);
  if (remaining > 0) return;

  const bonusCategoryId = pickBonusCategory(state.allocation);
  track('package_locked', { allocation: { ...state.allocation }, bonus_category: bonusCategoryId });

  const finalAllocation = { ...state.allocation };
  finalAllocation[bonusCategoryId] = (finalAllocation[bonusCategoryId] || 0) + casino.bonusToken.count;

  renderReveal(finalAllocation, bonusCategoryId);
}

function renderReveal(finalAllocation, bonusCategoryId, restored = false) {
  state.step = 'reveal';
  const ui = casino.ui;

  els.builder.innerHTML = `
    <div class="reveal">
      <span class="reveal__tag">${casino.bonusToken.label}</span>
      <p class="reveal__reveal-copy">${casino.bonusToken.revealCopy}</p>
      <div class="package is-boosted" id="package-card">
        <p class="package__title">${ui.yourPackage}</p>
        <div id="package-rows">${packageRowsHtml(finalAllocation, bonusCategoryId)}</div>
      </div>
      <a class="cta" id="cta" href="${casino.cta.target}">${casino.cta.label}</a>
      <button class="secondary-btn start-over" type="button" data-action="start-over">${ui.startOver}</button>
      ${demoNoticeHtml()}
    </div>
  `;

  announce(interpolate(ui.packageLockedAnnouncement, { bonus: casino.bonusToken.label }));

  if (!restored) {
    track('outcome_revealed', { final_allocation: finalAllocation, bonus_category: bonusCategoryId });
  }

  $('cta').addEventListener('click', () => {
    track('cta_clicked', { total_time_ms: Math.round(performance.now() - landingStartedAt) });
  });

  persist({ allocation: state.allocation, finalAllocation, bonusCategoryId, revealedAt: Date.now() });

  const revealEl = els.builder.querySelector('.reveal');
  revealEl.setAttribute('tabindex', '-1'); revealEl.setAttribute('data-focus-on-unlock', '');
}

function persist(outcome) {
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(outcome));
  } catch (e) {
    // storage unavailable — non-fatal, replay guard simply won't persist across reload
  }
}

function restoreOutcome() {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch (e) {
    return null;
  }
}

function startOver() {
  sessionStorage.removeItem(STORAGE_KEY);
  state = { step: 'allocate', allocation: {} };
  track('flow_restarted', {});
  renderAllocate();
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
    <div class="reveal">
      <p class="package__empty"><strong>${ui.errorTitle}.</strong> ${ui.errorBody}</p>
      <button class="cta retry-btn" type="button" data-action="retry">${ui.errorRetry}</button>
    </div>
  `;
  els.spinnerLayer.hidden = true;
  els.builder.hidden = false;
  els.module.removeAttribute('aria-busy');
}

function onBuilderClick(event) {
  if (!event.isTrusted) return;
  const btn = event.target.closest('[data-action]');
  if (!btn || btn.disabled) return;

  const action = btn.dataset.action;

  if (action === 'add-token') {
    if (state.step !== 'allocate') return;
    handleAddToken(btn.dataset.typeId);
    return;
  }

  if (action === 'remove-token') {
    if (state.step !== 'allocate') return;
    handleRemoveToken(btn.dataset.typeId);
    return;
  }

  if (action === 'lock-in') {
    if (state.step !== 'allocate') return;
    withLock(900 + 200, lockIn);
    return;
  }

  if (action === 'start-over') {
    withLock(300, startOver);
    return;
  }

  if (action === 'retry') {
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

  const latencyPromise = readyAfterLatency(cfg && cfg.global ? cfg.global.loadingDurationMs : 1500);

  try {
    cfg = await loadConfig();
  } catch (err) {
    await latencyPromise;
    renderError(err.message);
    return;
  }
  casino = cfg.casino;

  renderHero();
  renderRgFooter();

  renderShell();
  await latencyPromise;

  let restored = restoreOutcome();
  const validRestore = restored && restored.finalAllocation && restored.bonusCategoryId;
  if (restored && !validRestore) {
    sessionStorage.removeItem(STORAGE_KEY);
    restored = null;
  }
  els.builder.hidden = false;

  if (restored) {
    state = { step: 'reveal', allocation: restored.allocation || {} };
    renderReveal(restored.finalAllocation, restored.bonusCategoryId, true);
    track('interaction_blocked', { during_state: 'reveal-restore' });
  } else {
    renderAllocate();
  }

  els.spinnerLayer.hidden = true;
  els.module.removeAttribute('aria-busy');
  track('landing_viewed', { concept: 'casino', variant: (window.__entainVariantMeta || {}).variant, floor_multiplier: null });
}

function init() {
  cacheEls();
  landingStartedAt = performance.now();
  els.builder.addEventListener('click', onBuilderClick);
  boot();
}

init();
