import { loadConfig, resetConfig, readyAfterLatency, lock, track, interpolate } from './core.js';

const STORAGE_KEY = 'outcome_sports';
const els = {};
let cfg = null;
let sports = null;
let state = { step: 'team', teamId: null, zoneId: null };
let sweep = null; // { rafId, sweepStartedAt, totalPausedMs, pausedAt, sweetZonePercent, trackEl, markerEl, sweetEl }
let landingStartedAt = 0;
let teamOfferedAt = 0;
let prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

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

function maxMultiplier() {
  return Math.max(...sports.zones.map((z) => z.multiplier));
}

function renderShell() {
  els.brand.textContent = cfg.global.brand;
  els.ageBadge.textContent = cfg.compliance.ageRating;
  els.backLink.textContent = `\u2190 ${cfg.global.backLabel}`;
  els.loadingLabel.textContent = sports.ui.loading;
  els.eyebrow.textContent = interpolate(sports.ui.competitionLabel, { competition: sports.fixture.competition });
}
function renderHero() {
  const meta = window.__entainVariantMeta || { variant: 'A', source: 'random' };

  const copy = sports.headlines[meta.variant] || sports.headlines.A;
  els.headline.textContent = interpolate(copy.headline, { maxMultiplier: maxMultiplier() });
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

function countUp(el, from, to, duration = 500) {
  const start = performance.now();
  function frame(now) {
    const t = Math.min((now - start) / duration, 1);
    const value = from + (to - from) * easeOutExpo(t);
    el.textContent = value.toFixed(2);
    if (t < 1) requestAnimationFrame(frame);
    else el.textContent = to.toFixed(2);
  }
  requestAnimationFrame(frame);
}

function teamOf(id) {
  return id === 'home' ? sports.fixture.home : sports.fixture.away;
}

function oddsOf(id) {
  return id === 'home' ? sports.market.homeOdds : sports.market.awayOdds;
}

function shieldSvg(colour, onColour) {
  return `
    <svg class="crest-btn__shield" viewBox="0 0 48 56" aria-hidden="true">
      <path d="M24 2 L44 10 V28 C44 42 34 50 24 54 C14 50 4 42 4 28 V10 Z" fill="${colour}" stroke="${onColour}" stroke-width="1.5" opacity="0.9"></path>
    </svg>`;
}

// ---- Step: team select ----
function renderTeamSelect() {
  state.step = 'team';
  teamOfferedAt = performance.now();
  document.documentElement.style.removeProperty('--accent');

  const home = sports.fixture.home;
  const away = sports.fixture.away;
  const ui = sports.ui;

  els.builder.innerHTML = `
    <h2 class="builder__title">${ui.stepTeam}</h2>
    <div class="crests">
      <button class="crest-btn" type="button" data-action="pick-team" data-team-id="home" style="border-color:${home.colour}">
        ${shieldSvg(home.colour, home.onColour)}
        <span class="crest-btn__name">${home.name}</span>
      </button>
      <button class="crest-btn" type="button" data-action="pick-team" data-team-id="away" style="border-color:${away.colour}">
        ${shieldSvg(away.colour, away.onColour)}
        <span class="crest-btn__name">${away.name}</span>
      </button>
    </div>
  `;
}

// ---- Step: zone select ----
function renderZoneSelect() {
  state.step = 'zone';
  const team = teamOf(state.teamId);
  const ui = sports.ui;
  document.documentElement.style.setProperty('--accent', team.colour);
  document.documentElement.style.setProperty('--accent-contrast', team.onColour);

  const zonesHtml = sports.zones
    .map(
      (zone) => `
      <button class="zone" type="button" data-action="pick-zone" data-zone-id="${zone.id}"
        style="grid-column:${zone.col};grid-row:${zone.row}"
        aria-pressed="${zone.id === state.zoneId}">
        ${zone.label}<span class="zone__multiplier">×${zone.multiplier}</span>
      </button>`
    )
    .join('');

  els.builder.innerHTML = `
    <h2 class="builder__title">${ui.stepZone}</h2>
    <div class="goal" role="group" aria-label="${ui.goalAriaLabel}" style="--cols:${sports.grid.cols};--rows:${sports.grid.rows}">${zonesHtml}</div>
    <button class="cta zone-confirm" type="button" data-action="confirm-zone" ${state.zoneId ? '' : 'disabled aria-disabled="true"'}>${ui.takeShot}</button>
  `;

  announce(interpolate(ui.teamSelectedAnnouncement, { team: team.name }));
}

function handleZonePick(btn) {
  const newZoneId = btn.dataset.zoneId;
  const previousZoneId = state.zoneId;
  state.zoneId = newZoneId;

  els.builder.querySelectorAll('.zone').forEach((z) => z.setAttribute('aria-pressed', String(z.dataset.zoneId === newZoneId)));
  const confirmBtn = els.builder.querySelector('[data-action="confirm-zone"]');
  confirmBtn.removeAttribute('disabled');
  confirmBtn.removeAttribute('aria-disabled');

  if (previousZoneId && previousZoneId !== newZoneId) {
    track('zone_changed', { from: previousZoneId, to: newZoneId });
  }
}

// ---- Step: aiming ----
function renderAiming() {
  state.step = 'aim';
  const zone = sports.zones.find((z) => z.id === state.zoneId);
  const ui = sports.ui;
  track('zone_selected', { zone_id: zone.id, multiplier: zone.multiplier, risk: zone.risk });

  const half = zone.sweetZonePercent / 2;
  const sweetLeft = 50 - half;

  els.builder.innerHTML = `
    <h2 class="builder__title">${ui.stepAim}</h2>
    <p class="reveal__line">${ui.aimHint}</p>
    <div class="sweep-wrap">
      <div class="sweep-track" data-action="stop-sweep" role="button" tabindex="0" aria-label="${ui.timingAriaLabel}">
        <div class="sweep-track__sweet" style="left:${sweetLeft}%;width:${zone.sweetZonePercent}%"></div>
        <div class="sweep-track__marker" id="marker"></div>
      </div>
    </div>
    <button class="skip-link" type="button" data-action="skip-shot">${ui.skipShot}</button>
  `;

  const period = prefersReducedMotion ? sports.sweepPeriodMs * 1.3 : sports.sweepPeriodMs;

  sweep = {
    sweepStartedAt: performance.now(),
    totalPausedMs: 0,
    pausedAt: null,
    sweetZonePercent: zone.sweetZonePercent,
    period,
    rafId: null,
    markerEl: $('marker'),
  };

  function tick(now) {
    if (sweep.pausedAt !== null) return;
    const elapsed = now - sweep.sweepStartedAt - sweep.totalPausedMs;
    const phase = (elapsed % sweep.period) / sweep.period;
    const position = phase < 0.5 ? phase * 200 : (1 - phase) * 200;
    if (sweep.markerEl) {
      sweep.markerEl.style.transform = `translate(0, -50%)`;
      sweep.markerEl.style.left = `${position}%`;
    }
    sweep.rafId = requestAnimationFrame(tick);
  }
  sweep.rafId = requestAnimationFrame(tick);
}

function pauseSweep() {
  if (!sweep || sweep.pausedAt !== null) return;
  sweep.pausedAt = performance.now();
  if (sweep.rafId) cancelAnimationFrame(sweep.rafId);
}

function resumeSweep() {
  if (!sweep || sweep.pausedAt === null) return;
  sweep.totalPausedMs += performance.now() - sweep.pausedAt;
  sweep.pausedAt = null;
  function tick(now) {
    if (!sweep || sweep.pausedAt !== null) return;
    const elapsed = now - sweep.sweepStartedAt - sweep.totalPausedMs;
    const phase = (elapsed % sweep.period) / sweep.period;
    const position = phase < 0.5 ? phase * 200 : (1 - phase) * 200;
    if (sweep.markerEl) sweep.markerEl.style.left = `${position}%`;
    sweep.rafId = requestAnimationFrame(tick);
  }
  sweep.rafId = requestAnimationFrame(tick);
}

function computeGrade(zone) {
  const now = performance.now();
  const elapsed = now - sweep.sweepStartedAt - sweep.totalPausedMs;
  const phase = (elapsed % sweep.period) / sweep.period;
  const position = phase < 0.5 ? phase * 200 : (1 - phase) * 200;

  const half = zone.sweetZonePercent / 2;
  const delta = Math.abs(position - 50);
  const floor = sports.floorMultiplier;
  const nearThreshold = half * sports.nearThresholdMultiple;

  let tier, multiplier;
  if (delta <= half) {
    tier = 'sweet';
    multiplier = zone.multiplier;
  } else if (delta <= nearThreshold) {
    tier = 'near';
    const t = 1 - (delta - half) / (nearThreshold - half);
    multiplier = floor + (zone.multiplier - floor) * t;
  } else {
    tier = 'floor';
    multiplier = floor;
  }

  multiplier = Math.round(multiplier * 100) / 100;
  return { tier, multiplier, delta, position };
}

function stopSweep() {
  if (!sweep) return;
  if (sweep.rafId) cancelAnimationFrame(sweep.rafId);
  const zone = sports.zones.find((z) => z.id === state.zoneId);
  const grade = computeGrade(zone);
  sweep = null;

  track('shot_taken', { zone_id: zone.id, accuracy_delta: Math.round(grade.delta * 100) / 100, outcome_tier: grade.tier });

  renderShooting(zone, grade);
}

// ---- Step: shooting ----
function renderShooting(zone, grade) {
  state.step = 'shoot';

  const cols = sports.grid.cols;
  const rows = sports.grid.rows;
  const jitter = (grade.position - 50) * 0.15;
  const landX = ((zone.col - 0.5) / cols) * 100 + jitter;
  const landY = ((zone.row - 0.5) / rows) * 100;

  els.builder.innerHTML = `
    <div class="shot-stage" aria-hidden="true">
      <div class="shot-stage__ball" id="ball"></div>
    </div>
  `;

  const ball = $('ball');
  const duration = prefersReducedMotion ? 50 : 700;

  requestAnimationFrame(() => {
    const stage = ball.parentElement.getBoundingClientRect();
    const startX = stage.width / 2;
    const startY = stage.height * 0.94 - ball.offsetHeight / 2;
    const deltaX = (landX / 100) * stage.width - startX;
    const deltaY = (landY / 100) * stage.height - startY;
    ball.style.transition = `transform ${duration}ms var(--ease-out-expo)`;
    ball.style.transform = `translate(calc(-50% + ${deltaX}px), ${deltaY}px)`;
  });

  setTimeout(() => renderReveal(zone, grade), duration + 150);
}

// ---- Step: reveal ----
function renderReveal(zone, grade, restored = false) {
  state.step = 'reveal';
  const team = teamOf(state.teamId);
  const ui = sports.ui;
  document.documentElement.style.setProperty('--accent', team.colour);
  const baseOdds = oddsOf(state.teamId);
  const boostedOdds = Math.round(baseOdds * grade.multiplier * 100) / 100;
  const marketLabel = interpolate(sports.market.label, { team: team.name });
  document.documentElement.style.setProperty('--accent-contrast', team.onColour);
  const copy = sports.outcomeCopy[grade.tier] || '';
  const upliftOverFloor = Math.round((grade.multiplier - sports.floorMultiplier) * 100) / 100;
  const oddsLabel = grade.tier === 'floor' ? ui.floorLabel : ui.boostedLabel;

  els.builder.innerHTML = `
    <div class="reveal">
      <span class="reveal__tier">${copy}</span>
      <p class="reveal__line">${marketLabel}, ${baseOdds.toFixed(2)} &rarr;</p>
      <p class="reveal__odds-label">${oddsLabel}</p>
      <div class="reveal__odds" id="reveal-odds">${baseOdds.toFixed(2)}</div>
      <a class="cta" id="cta" href="${sports.cta.target}">${sports.cta.label}</a>
      <button class="secondary-btn start-over" type="button" data-action="start-over">${ui.startOver}</button>
      ${demoNoticeHtml()}
    </div>
  `;

  countUp($('reveal-odds'), baseOdds, boostedOdds, restored ? 0 : 600);
  announce(interpolate(ui.outcomeAnnouncement, { outcome: copy, odds: boostedOdds.toFixed(2) }));

  if (!restored) {
    track('outcome_revealed', { final_multiplier: grade.multiplier, uplift_over_floor: upliftOverFloor, boosted_odds: boostedOdds });
  }

  $('cta').addEventListener('click', () => {
    track('cta_clicked', { final_multiplier: grade.multiplier, total_time_ms: Math.round(performance.now() - landingStartedAt) });
  });

  persist({ teamId: state.teamId, zoneId: zone.id, grade, revealedAt: Date.now() });

  const revealEl = els.builder.querySelector('.reveal');
  revealEl.setAttribute('tabindex', '-1'); revealEl.setAttribute('data-focus-on-unlock', '');
}

function skipShot() {
  const zone = sports.zones.find((z) => z.id === state.zoneId);
  const grade = { tier: 'floor', multiplier: sports.floorMultiplier, delta: 999, position: 0 };
  track('shot_taken', { zone_id: zone.id, accuracy_delta: null, outcome_tier: 'skipped' });
  renderReveal(zone, grade);
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
  state = { step: 'team', teamId: null, zoneId: null };
  track('flow_restarted', {});
  renderTeamSelect();
}

function renderError(reason) {
  state.step = 'error';
  track('config_error', { reason });
  const ui = (sports && sports.ui) || {
    errorTitle: "Couldn't load this page",
    errorBody: 'Give it another go.',
    errorRetry: 'Retry',
  };
  els.builder.innerHTML = `
    <div class="reveal">
      <p class="reveal__line"><strong>${ui.errorTitle}.</strong> ${ui.errorBody}</p>
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

  if (action === 'pick-team') {
    if (state.step !== 'team') return;
    withLock(250, () => {
      state.teamId = btn.dataset.teamId;
      track('team_selected', { team_id: state.teamId, time_to_select_ms: Math.round(performance.now() - teamOfferedAt) });
      renderZoneSelect();
    });
    return;
  }

  if (action === 'pick-zone') {
    if (state.step !== 'zone') return;
    handleZonePick(btn);
    return;
  }

  if (action === 'confirm-zone') {
    if (state.step !== 'zone' || !state.zoneId) return;
    withLock(250, renderAiming);
    return;
  }

  if (action === 'stop-sweep') {
    if (state.step !== 'aim') return;
    withLock(700 + 150 + 600, stopSweep);
    return;
  }

  if (action === 'skip-shot') {
    if (state.step !== 'aim') return;
    if (sweep && sweep.rafId) cancelAnimationFrame(sweep.rafId);
    sweep = null;
    withLock(300, skipShot);
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

function onBuilderKeydown(event) {
  if (event.key !== 'Enter' && event.key !== ' ') return;
  const target = event.target.closest('[data-action="stop-sweep"]');
  if (!target) return;
  event.preventDefault();
  if (state.step !== 'aim') return;
  withLock(700 + 150 + 600, stopSweep);
}

document.addEventListener('visibilitychange', () => {
  if (state.step !== 'aim') return;
  if (document.hidden) pauseSweep();
  else resumeSweep();
});

window.addEventListener('beforeunload', () => {
  if (state.step !== 'reveal' && state.step !== 'team') {
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
  sports = cfg.sports;

  renderHero();
  renderRgFooter();
  renderShell();

  await latencyPromise;

  let restored = restoreOutcome();
  const restoredZone = restored && sports.zones.find((z) => z.id === restored.zoneId);
  if (restored && (!restoredZone || !restored.grade || !restored.teamId)) {
    sessionStorage.removeItem(STORAGE_KEY);
    restored = null;
  }
  els.builder.hidden = false;

  if (restored) {
    state = { step: 'reveal', teamId: restored.teamId, zoneId: restored.zoneId };
    renderReveal(restoredZone, restored.grade, true);
    track('interaction_blocked', { during_state: 'reveal-restore' });
  } else {
    renderTeamSelect();
  }

  els.spinnerLayer.hidden = true;
  els.module.removeAttribute('aria-busy');
  track('landing_viewed', { concept: 'sports', variant: (window.__entainVariantMeta || {}).variant, floor_multiplier: sports.floorMultiplier });
}

function init() {
  cacheEls();
  landingStartedAt = performance.now();
  els.builder.addEventListener('click', onBuilderClick);
  els.builder.addEventListener('keydown', onBuilderKeydown);
  boot();
}

init();
