# Interactive Growth Concepts

Two mobile-first interactive pre-landers for paid acquisition — one Sports, one Casino — built with plain HTML, SCSS and vanilla JavaScript.

Portfolio prototype: no real money, no real offer, not affiliated with any operator.

## Live demo

**[interactive-growth-concepts.vercel.app](https://interactive-growth-concepts.vercel.app)**

| Concept | Interaction | Variants |
| --- | --- | --- |
| **Sports — Take the Shot** | Time a shot on goal to boost the odds on a featured market. | [A](https://interactive-growth-concepts.vercel.app/sports?variant=A) · [B](https://interactive-growth-concepts.vercel.app/sports?variant=B) |
| **Casino — Spin, Then Choose** | Spin for a bonus value, then choose the format it pays out in. | [A](https://interactive-growth-concepts.vercel.app/casino?variant=A) · [B](https://interactive-growth-concepts.vercel.app/casino?variant=B) |

## Strategy & Competitors

### What I looked at

Reviewed 5 August 2026, via live product surfaces and Meta Ad Library creatives:

- **bet365 — Bet Builder.** Combine markets from one fixture and watch the price recalculate as selections change. Genuine utility, but it assumes betting literacy and sits deep in the wagering journey, well past acquisition.
- **DraftKings — Sportsbook.** Same Game Parlays, Pools, Free-to-Play Pools and daily Odds Boosts. A varied set of participation hooks, but the acquisition page still explains them as cards and copy rather than letting you try one.
- **BetMGM — Casino.** Conventional welcome bundles alongside chance-led mechanics including a wheel and an arcade claw machine. Its welcome-bonus guide also shows deposit match, free spins and bonus credit as the recurring building blocks users are expected to compare unaided.
- **DraftKings — Meta ads.** Creatives promising "Play $5, get 1000 Flex Spins" link straight to `itunes.apple.com`. A cold user is asked to install a native app before seeing or touching anything the ad promised.

Most acquisition creative in the category is video. Almost none of it is playable.

### The gap

What operators ship falls into two camps, and nothing I found does both at once:

| Camp | Strength | Limitation |
| --- | --- | --- |
| **Utility-first customisation** — bet builders, same-game parlays | Real control, immediate price feedback | Built for users who already understand markets |
| **Chance-led acquisition** — wheels, prize machines | Fast, legible reveal | The user's input rarely changes the offer in any explainable way |

Both concepts here sit in that gap: acquisition gamification with real utility underneath.

The DraftKings ad funnel is the sharpest version of the problem. It puts a ~150MB app install between the promise and the payoff. A mobile-web pre-lander lets a cold user *do* the thing the ad advertised, in the browser, before being asked for anything.

### What I built, and why it improves on that

**Sports — Take the Shot.** Instead of a static "boosted odds!" banner, the visitor times a shot on goal. The floor offer is visible before they play: this is upside-only, there is no losing state. The timing is real — tighter zones pay more, exactly as longer odds pay more in the market underneath. The visitor isn't reading an explanation of risk and reward, they're performing it with their thumb, and the resolved line (`Arsenal to win, 2.10 → 7.35`) shows how a boost actually applies to real odds, which a flat multiplier banner never does.

**Casino — Spin, Then Choose.** The wheel resolves a genuinely uncertain value; the visitor then decides whether to take it as Free Spins, Deposit Match or Cashback. This answers the second camp's weakness directly — the input *does* change the offer — while keeping the reveal that makes a wheel worth watching. Asking for the preference *after* the win also matters: at the top of a pre-lander "Deposit Match" versus "Cashback" is operator jargon aimed at a stranger, but once the value is won, the same three options become three concrete numbers and the choice reads as spending winnings rather than filling in a form.

The chosen format is carried into the handoff, so the preference is a real payload rather than decoration — and a zero-party signal about where a user sits on the slots ↔ bankroll ↔ risk-averse spectrum.

### Measurement

Funnel events push to `window.dataLayer`. Two earn their place: **`uplift_over_floor`** (Sports) decides whether the game deserved to exist — did players land meaningfully above the guaranteed floor, and does that correlate with CTA clicks? If not, the mechanic is decoration. **`format_selected`** (Casino) captures preference at the moment of ownership, which a spin outcome alone never could.

The number that matters downstream is cost per FTD, not CTR. Pre-landers reliably lift click-through and can still dilute registration quality.

### Compliance as a design constraint

Neither page links to a real operator. Copy uses *unlock*, *claim* and *boost* — never *win*, *guaranteed* or *risk-free*. Every prize is a bonus offer, never a cash amount. The guaranteed floor is stated before the spin, and the top prize is deliberately the least likely outcome rather than implied as typical. Both pages carry a persistent 18+ badge, a BeGambleAware link and the portfolio disclaimer.

## Next Steps

With another week, in priority order:

1. **Real A/B instrumentation.** The experiment is wired correctly — sticky assignment, four testable URLs, variant recorded with its source — but nothing collects it. Pointing `dataLayer` at GA4, Segment or a small custom collector is the highest-leverage next step; without it every hypothesis here is untestable in practice.
2. **The shootout, not the single shot.** One shot was a deliberate call to fit a short attention budget. Three markets, three timed shots, odds compounding as they land maps directly onto how an accumulator works — but it is more commitment, so it belongs after the single-shot mechanic proves it converts.
3. **Server-side config and an admin surface.** `config.json` is already the single source of truth for every string, price and probability. The next step is a CMS-backed editor so marketing can ship new fixtures, zones or prize ladders without a pull request.
4. **Session replay on the timing mechanic.** The riskiest part of the build for UX legibility: does a first-time visitor understand *why* they got a near miss rather than a perfect hit? Replay or a post-shot micro-survey answers that quickly.
5. **Real-device performance validation.** Lighthouse CI budgets, then a mid-tier Android device on a throttled connection. Simulated throttling and real hardware diverge, and this is mobile-first.
6. **Localisation.** Locale bundles once a second market exists, including market-specific compliance and number formatting. Unused locale and currency keys are deliberately absent from today's schema rather than stubbed.

## Running locally

Requires Node 18+.

```sh
npm install
npm run check     # builds dist/client and runs the contract tests
```

Then serve the repo root and open `/sports` or `/casino`.

`npm run check` verifies the things most likely to break silently: the exact 1.5s delay, config-driven copy, the non-dominated zone ladder, wheel prize reachability and entropy, team-colour contrast against the dark palette, token parity between the two skins, and all four A/B routing cases.

### Implementation notes

- **No libraries** — no framework, no animation engine. SCSS inlines at build time so nothing blocks render; Manrope is self-hosted and subset, metric-matched so the swap costs no layout shift.
- **The 1.5s delay never gates LCP.** Fetch and timer run concurrently; the hero paints as soon as config resolves and only the interactive module waits.
- **Abuse prevention** — a module-level lock guards every transition, handlers no-op off-step, `inert` freezes the container mid-animation, and `event.isTrusted` rejects synthetic events.
- **Geometry is config, not code.** `grid.cols`/`rows` and each zone's `col`/`row` drive the layout and the ball's landing point. `sweetZonePercent` is load-bearing: a marketer retunes the whole risk curve without touching JavaScript.
- **Reduced motion slows the sweep 30% rather than removing it** — the sweep *is* the mechanic; deleting it would break the page, not make it accessible.
