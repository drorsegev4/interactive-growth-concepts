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

Research snapshot (reviewed 5 August 2026):

- [bet365 Bet Builder](https://help.bet365.com/s/en/sports/bet-builder) lets users combine markets from one fixture and recalculates the price as selections change. It is strong product utility, but assumes betting literacy and sits deep in the wagering journey.
- [DraftKings Sportsbook](https://sportsbook.draftkings.com/sportsbook) foregrounds Same Game Parlays, Pools, Free-to-Play Pools, and daily Odds Boosts. These are varied participation hooks, though the acquisition page still explains them primarily as cards and copy.
- [BetMGM Casino](https://casino.betmgm.com/en/blog/casino-bonuses-promotions/) currently mixes conventional welcome bundles with chance-led mechanics including a wheel and an arcade claw machine. Its [welcome-bonus guide](https://casino.betmgm.com/en/blog/guides/what-are-casino-welcome-bonuses-and-how-to-use-them/) also shows how deposit match, free spins, and bonus credit are recurring building blocks users must compare.


**What operators actually ship today** splits into two camps, and neither camp does both things at once:

- **Utility-first customisation.** Bet builders and same-game parlays provide meaningful control and immediate price feedback, but they are designed for users who already understand markets.
- **Chance-led acquisition.** Wheels and prize machines create a quick reveal, but the user's input rarely changes the offer in a meaningful or explainable way.

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
5. **Performance: real-device validation.** Add repeatable Lighthouse CI budgets, then validate on a mid-tier Android device over a throttled connection. Simulated throttling and real hardware diverge, and this is a mobile-first pre-lander.
6. **Localisation.** Add locale bundles only when a second market is implemented, including market-specific compliance and number formatting. Unused `currency` and `locale` keys are deliberately omitted from today's schema.

---

## Technical notes

- **Automated acceptance checks.** `npm run check` compiles the production CSS and verifies schema versioning, the 1.5-second delay, config-driven UI copy, the non-dominated zone ladder, dynamic grid geometry, casino token rules, and all four A/B routing cases.
- **The spinner/LCP trade-off.** The mandated 1.5s delay is real, but it never gates the largest contentful paint. The hero renders as soon as `config.json` resolves while the timer and fetch run concurrently; only the interactive module remains behind the spinner.
- **Reduced motion.** `prefers-reduced-motion: reduce` slows the sweep by ~30% rather than removing it — the sweep *is* the mechanic, and removing it would break the page rather than make it accessible. Only decorative motion (ball flight duration) is shortened to near-zero.
- **Abuse prevention.** A single module-level lock guards every state transition; handlers no-op if the state doesn't match, `inert` freezes the interactive container mid-animation, and `event.isTrusted` is checked in every handler to reject synthetic events.
- **Config-driven copy and interpolation.** User-facing copy lives in `config.json`, grouped under each concept's `ui`, offer, compliance, or demo-notice object. Where copy needs a computed value, `core.js` exports a tiny `interpolate(template, vars)` helper that replaces `{token}` placeholders. Available tokens: `{team}`, `{maxMultiplier}`, `{multiplier}`, `{odds}`, `{boostedOdds}`. `sports.headlines.A.headline` uses `{maxMultiplier}` specifically so the copy can never drift out of sync with the zone ladder — change the zones, the headline updates itself.
- **Config-driven zone geometry.** The goal is not a hardcoded 3×2 grid. `sports.grid` (`cols`/`rows`) and each zone's `col`/`row` drive `grid-template-columns`/`grid-template-rows` via CSS custom properties, and the ball's landing position in the shooting animation is computed from the same `col`/`row` values. A four-zone or nine-zone goal works with a config change alone, no code change.
- **Football-specific vocabulary, by design, not by accident.** `sports.outcomeCopy` ("keeper", "post", "top bins") is football vocabulary sitting at the sports-concept level, not genuinely sport-agnostic. `sport: "football"` in the config is a label, not an abstraction — swapping to basketball or tennis would need new `outcomeCopy` (and plausibly a different `grid` shape) alongside it. The architecture supports per-sport config; only football's copy has actually been written.
- **`floorMultiplier` vs. zone multipliers.** Every zone multiplier sits strictly above `floorMultiplier` (1.2), including the lowest-risk "Middle" zone (1.6×). This is deliberate: the mechanic is upside-only, so every zone must be a genuine improvement over doing nothing — a zone whose multiplier equals the floor would be a dominated choice with no reason to ever pick it.
