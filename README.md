# Entain / 365Scores — Growth Product Builder Assignment

Two mobile-first, interactive pre-landers for a first-time paid-acquisition visitor: **Sports** ("Take the Shot") and **Casino** ("Build Your Bonus"). Zero runtime dependencies — pure HTML, SASS-compiled CSS, vanilla ES modules. `sass` is a devDependency build tool only; nothing from `node_modules` reaches the browser.

**Live demo:** _add Vercel/Pages URL here_
**Repo:** _add GitHub URL here_

## Try both variants

The A/B test is a headline swap, offer-led vs. action-led, triggered by `?variant=`:

- Sports A (offer-led): `/sports/?variant=A`
- Sports B (action-led): `/sports/?variant=B`
- Casino A (offer-led): `/casino/?variant=A`
- Casino B (action-led): `/casino/?variant=B`

No param → sticky 50/50 assignment persisted in `localStorage`. `?variant=C` (or anything unsupported) falls back silently to A.

## Running locally

```
npm install
npm run build   # compiles SCSS, inlines critical CSS into both pages
npx serve .      # or any static file server
```

## The core assumption

These are **paid-acquisition pre-landers**, not account dashboards. A first-time mobile visitor arrives from an ad with no context, a few seconds of attention, and one job: understand the value and reach the CTA. Every decision below — three taps, no login, no real operator links, upside-only mechanics — traces back to that constraint.

---

## Strategy & Competitors

**What operators actually ship today** splits into two camps, and neither camp does both things at once:

- **Utility tools with zero acquisition gamification.** bet365's Bet Builder is the category's gold standard — combine markets in one match, odds recalculate live. It's a *retention* tool for logged-in users who already understand markets. It was never designed to teach a first-time visitor anything in six seconds.
- **Acquisition gamification with zero utility.** The spin-the-wheel promo page is everywhere in casino acquisition, and it's the most-copied pattern in the category for a reason — it's cheap to build and it works well enough to keep shipping. But it's also increasingly recognised as the thing it is: a randomiser dressed up as a game, with no skill, no user input before the randomness lands, and a growing "not this again" reaction from an audience that's seen a hundred of them.

Both concepts here sit in the gap between those two camps — acquisition gamification with genuine utility underneath it.

**Sports — "Take the Shot."** Instead of a static "boosted odds!" banner, the visitor times a shot on goal. The floor offer is visible before they play — this is upside-only, there's no losing state, no keeper save, no miss. What's real is the timing: tighter target zones pay more, exactly like longer odds pay more in the market underneath. The visitor isn't reading an explanation of risk/reward, they're *doing* risk/reward with their thumb, and the market line that resolves at the end ("Arsenal to win, 2.10 → 7.35") teaches how a boost actually applies to real odds — something a flat multiplier banner never does. `sweetZonePercent` is the load-bearing config field here: a marketer can retune the entire risk curve — how hard each zone is to hit — without touching a line of JS.

**Casino — "Build Your Bonus."** No wheel, no RNG, no chance at all. The visitor gets three tokens and allocates them across Free Spins, Deposit Match, and Cashback — then a fourth token drops in unannounced as a small reward for finishing. This is deliberately the only concept in its category that isn't chance-based, which makes it compliance-clean by construction (nothing to misrepresent as a "prize") and instantly differentiated from every wheel on the market. It also produces something a spin never can: **effort justification.** People value what they assemble more than what they're handed — and the token distribution itself is a genuinely richer zero-party data signal than a random spin ever was. A visitor who puts all three tokens on Cashback is telling you something a spin's outcome never could: where they sit on the slots-player ↔ bankroll-player ↔ risk-averse spectrum.

**Two metrics earn their place in the analytics taxonomy and are worth calling out specifically:**

- `zone_changed` (sports) — measures hesitation over risk before the shot is taken. That's a real appetite signal no form field or survey would ever capture.
- `uplift_over_floor` (sports) — the one metric that answers whether the game *deserved to exist*. Did users who played end up meaningfully above the guaranteed floor, and does that uplift correlate with CTA clicks? If not, the game is decoration, not product.

**Compliance is a design constraint, not an afterthought.** Neither page links to a real operator — the CTA lands on an in-page "demo complete" card. A public repo shipping live operator offers under a personal GitHub account is unlicensed gambling marketing published under your own name; that's not a risk worth hedging, so it's simply not in scope. Copy throughout uses *unlock / claim / boost*, never *win / guaranteed / risk-free*. Every prize is a bonus offer, never a cash amount. Both pages carry a persistent 18+ badge and a real BeGambleAware.org link in the footer.

---

## Next Steps

With another week, in priority order:

1. **Real A/B instrumentation.** Right now the experiment is wired correctly (sticky assignment, four testable URLs, `variant_assigned` fired with its source) but there's no backend collecting it. Wiring `dataLayer` pushes into an actual analytics endpoint (GA4, Segment, or a lightweight custom collector) is the single highest-leverage next step — without it, the hypotheses in this README are untestable in practice, not just in theory.
2. **The shootout, not the single shot.** Locked decision #1 for this build was one shot, not three, to fit a 12-second attention budget. The three-shot accumulator version — pick three markets, time three shots, watch odds compound — is the natural next iteration and maps directly onto how an actual accumulator bet works. It's more commitment, so it belongs *after* proving the single-shot mechanic converts, not before.
3. **Server-side config + admin surface.** `config.json` is already the single source of truth for every string, price, and probability on both pages — that was deliberate, so a non-engineer can retune the entire experience. The next step is putting a real editing surface in front of it (even a simple CMS-backed JSON editor) so marketing can ship new fixtures, zones, or bonus tiers without a PR.
4. **Session replay on the sweep mechanic specifically.** The timing game is the riskiest part of this build from a UX-legibility standpoint — does a first-time visitor actually understand *why* they got NEAR instead of SWEET? Lightweight replay or a post-shot micro-survey would answer that fast.
5. **Performance: real-device validation.** Lighthouse mobile (simulated throttling, headless Chrome) currently scores Sports 98 / Casino 96 on Performance with Accessibility, Best Practices, and SEO all at 100. The next step is validating on an actual mid-tier Android device over a throttled connection — simulated throttling and real hardware diverge, and this is a mobile-first pre-lander.
6. **Localisation.** `config.json`'s `global.locale` and `global.currency` fields exist for this reason but aren't yet wired to anything. Entain operates in 30+ regulated markets; a pre-lander that can't swap currency and copy per market has a hard ceiling on how far it can be reused.

---

## Technical notes

- **The spinner/LCP trade-off.** The mandated 1.5s loading delay is real, but it never gates the largest contentful paint. The hero headline and subheadline render the moment `config.json` resolves; the 1.5s spinner is scoped to the interactive module only, and the config fetch and the timer both run inside the same `Promise.all` so total wait is 1.5s, not 1.5s-plus-fetch. This is why both pages hit Performance scores in the high 90s despite the artificial latency requirement.
- **Reduced motion.** `prefers-reduced-motion: reduce` slows the sweep by ~30% rather than removing it — the sweep *is* the mechanic, and removing it would break the page rather than make it accessible. Only decorative motion (ball flight duration) is shortened to near-zero.
- **Abuse prevention.** A single module-level lock guards every state transition; handlers no-op if the state doesn't match, `inert` freezes the interactive container mid-animation, and `event.isTrusted` is checked in every handler to reject synthetic events.
