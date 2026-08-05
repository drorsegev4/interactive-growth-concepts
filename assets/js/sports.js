import { loadConfig, resetConfig, readyAfterLatency, lock, track, interpolate, getVariant } from './core.js';

const STORAGE_KEY = 'outcome_sports';
const els = {};
let cfg = null;
let sports = null;
let state = { step: 'loading', teamId: null, zoneId: null };
let sweep = null;
let landingStartedAt = 0;
const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

function $(id) {
  return document.getElementById(id);
}

function cacheEls() {
  els.brand = $('brand');
  els.ageBadge = $('age-badge');
  els.eyebrow = $('eyebrow');
  els.headline = $('headline');
  els.subheadline = $('subheadline');
  els.loadingLabel = $('loading-label');
  els.backLink = document.querySelector('.back-link');
  els.module = $('module');
  els.spinnerLayer = $('spinner-layer');
  els.builder = $('builder');
  els.liveRegion = $('live-region');
  els.rgFooter = $('rg-footer');
}

function maxMultiplier() {
  return Math.max(...sports.zones.map((zone) => zone.multiplier));
}

function selectedTeam() {
  return sports.featuredTeamId === 'away' ? sports.fixture.away : sports.fixture.home;
}

function selectedOdds() {
  return sports.featuredTeamId === 'away' ? sports.market.awayOdds : sports.market.homeOdds;
}

function selectedZone() {
  return sports.zones.find((zone) => zone.id === sports.featuredZoneId);
}

function renderShell() {
  els.brand.textContent = cfg.global.brand;
  els.ageBadge.textContent = cfg.compliance.ageRating;
  els.backLink.textContent = `\u2190 ${cfg.global.backLabel}`;
  els.loadingLabel.textContent = sports.ui.loading;
  els.eyebrow.textContent = interpolate(sports.ui.competitionLabel, { competition: sports.fixture.competition });
}

function renderHero(meta) {
  const copy = sports.headlines[meta.variant] || sports.headlines.A;
  els.headline.textContent = interpolate(copy.headline, { maxMultiplier: maxMultiplier() });
  els.subheadline.textContent = copy.subheadline;
}

function renderRgFooter() {
  const compliance = cfg.compliance;
  els.rgFooter.innerHTML = `
    <p>${compliance.termsShort}</p>
    <p>${compliance.rgMessage} <a href="${compliance.rgUrl}" rel="noopener noreferrer" target="_blank">${compliance.rgLabel}</a></p>
  `;
}

function demoNoticeHtml() {
  const notice = cfg.demoNotice;
  return `<p class="demo-notice" id="demo-complete"><strong>${notice.title}.</strong> ${notice.body}</p>`;
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
    lock.release();
    const focusTarget = els.builder.querySelector('[data-focus-on-unlock]');
    if (focusTarget) focusTarget.focus();
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
    el.textContent = (from + (to - from) * easeOutExpo(t)).toFixed(2);
    if (t < 1) requestAnimationFrame(frame);
    else el.textContent = to.toFixed(2);
  }
  requestAnimationFrame(frame);
}

function renderAiming() {
  state = { step: 'aim', teamId: sports.featuredTeamId, zoneId: sports.featuredZoneId };
  const team = selectedTeam();
  const zone = selectedZone();
  const ui = sports.ui;
  const baseOdds = selectedOdds();
  const marketLabel = interpolate(sports.market.label, { team: team.name });
  const half = zone.sweetZonePercent / 2;
  const sweetLeft = 50 - half;

  document.documentElement.style.setProperty('--accent', team.colour);
  document.documentElement.style.setProperty('--accent-contrast', team.onColour);

  els.builder.innerHTML = `
    <div class="fixture-card">
      <span class="fixture-card__competition">${sports.fixture.competition}</span>
      <strong class="fixture-card__teams">${sports.fixture.home.short} ${ui.fixtureSeparator} ${sports.fixture.away.short}</strong>
      <span class="fixture-card__market">${marketLabel} · ${baseOdds.toFixed(2)}</span>
      <span class="fixture-card__up-to">${interpolate(ui.upToLabel, { maxMultiplier: maxMultiplier() })}</span>
    </div>
    <h2 class="builder__title">${ui.stepAim}</h2>
    <p class="reveal__line">${ui.aimHint}</p>
    <div class="sweep-wrap">
      <div class="sweep-track" data-action="stop-sweep" role="button" tabindex="0" aria-label="${ui.timingAriaLabel}">
        <div class="sweep-track__sweet" style="left:${sweetLeft}%;width:${zone.sweetZonePercent}%"></div>
        <div class="sweep-track__marker" id="marker"></div>
      </div>
      <div class="sweep-labels" aria-hidden="true">
        <span>${interpolate(ui.floorMarkerLabel, { floorMultiplier: sports.floorMultiplier })}</span>
        <strong>${interpolate(ui.maxMarkerLabel, { maxMultiplier: zone.multiplier })}</strong>
        <span>${interpolate(ui.floorMarkerLabel, { floorMultiplier: sports.floorMultiplier })}</span>
      </div>
    </div>
    <button class="skip-link" type="button" data-action="skip-shot">${ui.skipShot}</button>
  `;

  const period = prefersReducedMotion ? sports.sweepPeriodMs * 1.3 : sports.sweepPeriodMs;
  sweep = {
    sweepStartedAt: performance.now(),
    totalPausedMs: 0,
    pausedAt: null,
    period,
    rafId: null,
    markerEl: $('marker'),
  };

  function tick(now) {
    if (!sweep || sweep.pausedAt !== null) return;
    const elapsed = now - sweep.sweepStartedAt - sweep.totalPausedMs;
    const phase = (elapsed % sweep.period) / sweep.period;
    const position = phase < 0.5 ? phase * 200 : (1 - phase) * 200;
    if (sweep.markerEl) sweep.markerEl.style.left = `${position}%`;
    sweep.rafId = requestAnimationFrame(tick);
  }
  sweep.rafId = requestAnimationFrame(tick);
  announce(ui.aimHint);
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
  const nearThreshold = half * sports.nearThresholdMultiple;
  let tier;
  let multiplier;

  if (delta <= half) {
    tier = 'sweet';
    multiplier = zone.multiplier;
  } else if (delta <= nearThreshold) {
    tier = 'near';
    const proximity = 1 - (delta - half) / (nearThreshold - half);
    multiplier = sports.floorMultiplier + (zone.multiplier - sports.floorMultiplier) * proximity;
  } else {
    tier = 'floor';
    multiplier = sports.floorMultiplier;
  }

  return {
    tier,
    multiplier: Math.round(multiplier * 100) / 100,
    delta,
    position,
  };
}

function stopSweep() {
  if (!sweep) return;
  if (sweep.rafId) cancelAnimationFrame(sweep.rafId);
  const zone = selectedZone();
  const grade = computeGrade(zone);
  sweep = null;
  track('shot_taken', {
    zone_id: zone.id,
    accuracy_delta: Math.round(grade.delta * 100) / 100,
    outcome_tier: grade.tier,
  });
  renderShooting(zone, grade);
}

function renderShooting(zone, grade) {
  state.step = 'shoot';
  const jitter = (grade.position - 50) * 0.15;
  const landX = ((zone.col - 0.5) / sports.grid.cols) * 100 + jitter;
  const landY = ((zone.row - 0.5) / sports.grid.rows) * 100;

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

function renderReveal(zone, grade, restored = false) {
  state.step = 'reveal';
  const team = selectedTeam();
  const ui = sports.ui;
  const baseOdds = selectedOdds();
  const boostedOdds = Math.round(baseOdds * grade.multiplier * 100) / 100;
  const marketLabel = interpolate(sports.market.label, { team: team.name });
  const copy = sports.outcomeCopy[grade.tier] || '';
  const oddsLabel = grade.tier === 'floor' ? ui.floorLabel : ui.boostedLabel;

  els.builder.innerHTML = `
    <div class="reveal">
      <span class="reveal__tier">${copy}</span>
      <p class="reveal__line">${marketLabel}, ${baseOdds.toFixed(2)} &rarr;</p>
      <p class="reveal__odds-label">${oddsLabel}</p>
      <div class="reveal__odds" id="reveal-odds">${baseOdds.toFixed(2)}</div>
      <p class="reveal__handoff">${interpolate(ui.handoffCopy, { boostedOdds: boostedOdds.toFixed(2) })}</p>
      <a class="cta" id="cta" href="${sports.cta.target}">${sports.cta.label}</a>
      <button class="secondary-btn start-over" type="button" data-action="start-over">${ui.startOver}</button>
      ${demoNoticeHtml()}
    </div>
  `;

  countUp($('reveal-odds'), baseOdds, boostedOdds, restored ? 0 : 600);
  announce(interpolate(ui.outcomeAnnouncement, { outcome: copy, odds: boostedOdds.toFixed(2) }));

  if (!restored) {
    track('outcome_revealed', {
      final_multiplier: grade.multiplier,
      uplift_over_floor: Math.round((grade.multiplier - sports.floorMultiplier) * 100) / 100,
      boosted_odds: boostedOdds,
    });
  }

  $('cta').addEventListener('click', () => {
    track('cta_clicked', {
      final_multiplier: grade.multiplier,
      total_time_ms: Math.round(performance.now() - landingStartedAt),
    });
  });

  persist({ teamId: state.teamId, zoneId: zone.id, grade, revealedAt: Date.now() });
  const revealEl = els.builder.querySelector('.reveal');
  revealEl.setAttribute('tabindex', '-1');
  revealEl.setAttribute('data-focus-on-unlock', '');
}

function skipShot() {
  const zone = selectedZone();
  const grade = { tier: 'floor', multiplier: sports.floorMultiplier, delta: 999, position: 0 };
  track('shot_taken', { zone_id: zone.id, accuracy_delta: null, outcome_tier: 'skipped' });
  renderReveal(zone, grade);
}

function persist(outcome) {
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(outcome));
  } catch (error) {
    // Storage is optional; the replay guard simply will not survive a reload.
  }
}

function restoreOutcome() {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch (error) {
    return null;
  }
}

function startOver() {
  sessionStorage.removeItem(STORAGE_KEY);
  track('flow_restarted', {});
  renderAiming();
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
  const target = event.target.closest('[data-action]');
  if (!target || target.disabled) return;

  if (target.dataset.action === 'stop-sweep' && state.step === 'aim') {
    withLock(1450, stopSweep);
  } else if (target.dataset.action === 'skip-shot' && state.step === 'aim') {
    if (sweep && sweep.rafId) cancelAnimationFrame(sweep.rafId);
    sweep = null;
    withLock(300, skipShot);
  } else if (target.dataset.action === 'start-over') {
    withLock(300, startOver);
  } else if (target.dataset.action === 'retry') {
    withLock(300, () => {
      resetConfig();
      boot();
    });
  }
}

function onBuilderKeydown(event) {
  if (event.key !== 'Enter' && event.key !== ' ') return;
  if (!event.target.closest('[data-action="stop-sweep"]')) return;
  event.preventDefault();
  if (state.step === 'aim') withLock(1450, stopSweep);
}

document.addEventListener('visibilitychange', () => {
  if (state.step !== 'aim') return;
  if (document.hidden) pauseSweep();
  else resumeSweep();
});

window.addEventListener('beforeunload', () => {
  if (state.step !== 'reveal' && state.step !== 'loading') {
    track('flow_abandoned', { last_state: state.step });
  }
});

async function boot() {
  state.step = 'loading';
  els.module.setAttribute('aria-busy', 'true');
  els.spinnerLayer.hidden = false;
  els.builder.hidden = true;
  const latencyPromise = readyAfterLatency(cfg && cfg.global ? cfg.global.loadingDurationMs : 1500);

  try {
    cfg = await loadConfig();
  } catch (error) {
    await latencyPromise;
    renderError(error.message);
    return;
  }

  sports = cfg.sports;
  const variantMeta = getVariant(sports.headlines, 'sports');
  renderHero(variantMeta);
  renderRgFooter();
  renderShell();
  await latencyPromise;

  const restored = restoreOutcome();
  const restoredZone = restored && sports.zones.find((zone) => zone.id === restored.zoneId);
  const validRestore = restored && restored.teamId === sports.featuredTeamId && restoredZone && restored.grade;

  els.builder.hidden = false;
  if (validRestore) {
    state = { step: 'reveal', teamId: restored.teamId, zoneId: restored.zoneId };
    renderReveal(restoredZone, restored.grade, true);
  } else {
    if (restored) sessionStorage.removeItem(STORAGE_KEY);
    renderAiming();
  }

  els.spinnerLayer.hidden = true;
  els.module.removeAttribute('aria-busy');
  track('landing_viewed', {
    concept: 'sports',
    variant: variantMeta.variant,
    floor_multiplier: sports.floorMultiplier,
  });
}

function init() {
  cacheEls();
  landingStartedAt = performance.now();
  els.builder.addEventListener('click', onBuilderClick);
  els.builder.addEventListener('keydown', onBuilderKeydown);
  boot();
}

init();
