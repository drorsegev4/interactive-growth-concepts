// Shared module: config loading, variant assignment, latency spinner, interaction lock, analytics.

let configPromise = null;

const CONFIG_URL = new URL('../../config.json', import.meta.url);

// Rejects on failure — caller owns the ERROR state (retry UI, config_error tracking).
export function loadConfig() {
  if (!configPromise) {
    configPromise = fetch(CONFIG_URL).then((res) => {
      if (!res.ok) throw new Error(`config.json ${res.status}`);
      return res.json();
    });
  }
  return configPromise;
}

// Allows a retry to re-fetch instead of replaying a cached rejection.
export function resetConfig() {
  configPromise = null;
}

export function getVariant() {
  const params = new URLSearchParams(window.location.search);
  const fromUrl = params.get('variant');
  let variant;
  let source;

  if (fromUrl && /^[ab]$/i.test(fromUrl)) {
    variant = fromUrl.toUpperCase();
    source = 'url';
    localStorage.setItem('exp_headline', variant);
  } else if (fromUrl) {
    // Unsupported value (e.g. ?variant=C) — silent fallback to A, not tracked as an error.
    variant = 'A';
    source = 'fallback';
  } else {
    const stored = localStorage.getItem('exp_headline');
    if (stored === 'A' || stored === 'B') {
      variant = stored;
      source = 'storage';
    } else {
      variant = Math.random() < 0.5 ? 'A' : 'B';
      source = 'random';
      localStorage.setItem('exp_headline', variant);
    }
  }

  document.documentElement.dataset.variant = variant;
  return { variant, source };
}

export function readyAfterLatency(ms = 1500) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export const lock = {
  isLocked: false,
  acquire() {
    if (this.isLocked) return false;
    this.isLocked = true;
    return true;
  },
  release() {
    this.isLocked = false;
  },
};

export function track(eventName, props = {}) {
  window.dataLayer = window.dataLayer || [];
  const event = { event: eventName, ...props, ts: Date.now() };
  window.dataLayer.push(event);
  console.debug(`[track] ${eventName}`, props);
}

// Copy tokens: {team}, {maxMultiplier}, {multiplier}, {odds}, {boostedOdds} — see README.
export function interpolate(template, vars) {
  return template.replace(/\{(\w+)\}/g, (match, key) => (key in vars ? String(vars[key]) : match));
}
