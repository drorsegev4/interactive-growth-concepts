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

export function getVariant(headlines, experimentId) {
  const catalog = headlines || {};
  const variants = Object.keys(catalog);
  const fallback = variants[0] || 'A';
  const storageKey = 'exp_headline_' + experimentId;
  const params = new URLSearchParams(window.location.search);
  const fromUrl = params.get('variant')?.toUpperCase();
  const isConfigured = (candidate) => Boolean(candidate && Object.hasOwn(catalog, candidate));
  const readStored = () => {
    try {
      return window.localStorage.getItem(storageKey);
    } catch {
      return null;
    }
  };
  const store = (value) => {
    try {
      window.localStorage.setItem(storageKey, value);
    } catch {
      // Experiment assignment still works when storage is unavailable.
    }
  };
  let variant;
  let source;

  if (isConfigured(fromUrl)) {
    variant = fromUrl;
    source = 'url';
    store(variant);
  } else if (fromUrl) {
    variant = fallback;
    source = 'fallback';
  } else {
    const stored = readStored();
    if (isConfigured(stored)) {
      variant = stored;
      source = 'storage';
    } else {
      variant = variants[Math.floor(Math.random() * variants.length)] || fallback;
      source = 'random';
      store(variant);
    }
  }

  document.documentElement.dataset.variant = variant;
  const meta = { variant, source };
  window.__entainVariantMeta = meta;
  return meta;
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
