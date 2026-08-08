# Interactive Growth Concepts

Two mobile-first gamified onboarding concepts — **"Take the Shot"** (Sports) and **"Spin for Your Welcome Bonus"** (Casino) — built with zero dependencies: pure HTML, modern CSS/SCSS and vanilla JavaScript.

Portfolio prototype: no real money, no real offer, not affiliated with any operator.

**Live:** [interactive-growth-concepts.vercel.app](https://interactive-growth-concepts.vercel.app)

| Concept | Interaction | Variants |
| --- | --- | --- |
| **Sports — Take the Shot** | Time a shot on goal to boost the odds on a featured market. | [A](https://interactive-growth-concepts.vercel.app/sports?variant=A) · [B](https://interactive-growth-concepts.vercel.app/sports?variant=B) |
| **Casino — Spin, Then Choose** | Spin for a bonus value, then choose the format it pays out in. | [A](https://interactive-growth-concepts.vercel.app/casino?variant=A) · [B](https://interactive-growth-concepts.vercel.app/casino?variant=B) |

## Strategy & Competitors

### Concept Selection & Market Context

Reviewed 5 to 8 August 2026 across live product surfaces, Meta Ad Library creatives, and by clicking through actual ads and promo pages on mobile:

- **bet365, Bet Builder.** Combine markets from one fixture and watch the price recalculate live. Real utility, but it assumes betting literacy and sits deep in the wagering journey, well past acquisition.
- **bet365, "New Player Offer" pre-lander.** A real acquisition page: static banner, headline, terms, and a single "Join" button straight to the registration form. No interaction of any kind before that CTA.
- **bet365, "Daily Prize Matcher."** A genuine interactive mechanic, three reveals a day on a game grid for cash, spins, or chips. But it lives inside the promotions section for existing accounts. Clicking "Play for Free" while logged out routes to the login form, not registration. The interaction and the acquisition page are two separate products that never meet.
- **DraftKings, Sportsbook.** Same Game Parlays, Pools, Free-to-Play Pools, daily Odds Boosts. Varied participation hooks, but the acquisition page still explains them as cards and copy rather than letting you try one.
- **BetMGM, Casino.** Conventional welcome bundles alongside chance-led mechanics including a wheel and an arcade claw machine. Its bonus guide leaves users to compare deposit match, free spins, and bonus credit unaided.
- **BetMGM, Meta ads.** US creative leads with a dollar figure ("$1,500 Paid Back"); UK creative drops the cash headline for heritage and safety messaging ("50 years of Las Vegas heritage"). Same brand, same offer category, different trust lever by market. Both link straight to the app store.
- **DraftKings, Meta ads.** Creatives promising "Play $5, get 1,000 Flex Spins" link straight to `itunes.apple.com`. A cold user must install a native app before touching anything the ad promised.

Every operator I checked either skips the pre-registration interaction entirely (DraftKings, BetMGM ads go straight to the app store) or keeps the interaction and the acquisition step apart, the way bet365 does with two separate pages that solve different problems for different users. Nobody puts a real mechanic in front of a cold, logged-out visitor before asking for anything. That is the gap both concepts sit in: a mobile-web pre-lander where the user does the advertised thing in the browser first, and the "Join" moment comes after they have already felt the value, not instead of it.

### Psychological & UX Rationale

**Sports — "Take the Shot": agency and performed risk**

- **Perceived control and effort justification.** The user times the shot, so the multiplier is theirs rather than assigned. People value outcomes they helped produce — and unlike a random reveal, this one is genuinely earned.
- **Loss aversion, neutralised by design.** The mechanic is upside-only: the floor is visible *before* playing and guaranteed after, and *"Skip the shot — take the standard offer"* gives a zero-friction exit. There is no losing state to regret.
- **Anchoring.** Showing the guaranteed floor first makes any boost read as a gain rather than a gamble.
- **Concrete beats abstract.** The resolved line — `Arsenal to win, 2.10 → 7.35` — teaches what a boost does to a real price. "Up to ×3.5" never does.
- **Fitts's Law.** The tap target is the entire goalmouth, not a small button, so the timing action stays reliable one-handed under time pressure.
- **Closed feedback loop.** The ball flies to where the reticle actually stopped and the net reacts, so cause and effect are legible without explanation.

**Casino — "Spin, Then Choose": familiarity, then flexibility**

- **Jakob's Law.** A wheel is a universally understood pattern, so the learning cost is zero and attention goes to the offer rather than the interface.
- **Curiosity gap, closed fast.** The spin opens a question and resolves it in 2.4 seconds. The outcome is genuinely uncertain across the whole prize set — a wheel whose result is already decided is animation, and users read that within one spin.
- **Anchoring, again.** *"60 credits guaranteed. Spin to see how much more"* is stated before the spin, so the floor is a promise rather than a consolation.
- **Endowment, then choice.** The user owns the win *before* being asked anything. Asking for a format first would mean asking a stranger to weigh "Deposit Match" against "Cashback" as abstract jargon; asking after the win turns the same three options into three concrete numbers, and the decision reads as spending winnings rather than filling in a form.
- **Hick's Law.** Exactly three formats, not a menu — enough to feel like a real choice, few enough to decide instantly.

**Shared UX principles**

- **Message match.** Fixture, team, market and offer are all config-driven so the page can continue the exact promise of the creative that delivered the click.
- **Progressive disclosure.** One decision per screen. Stacked on a single screen, the Casino wheel and its CTA fell below the fold on a typical handset.
- **Peak–end rule.** The reveal is the peak and the handoff is the end, so both carry the value explicitly — the CTA names the chosen reward rather than saying "Continue".
- **Cognitive fluency.** High-contrast focal points, single-tap mechanics, one accent colour reserved for the action, and no fine print competing inside the flow.

### Compliance as a design constraint

Neither page links to a real operator. Copy uses *unlock*, *claim* and *boost* — never *win*, *guaranteed* or *risk-free*. Every prize is a bonus offer, never a cash amount. The guaranteed floor is stated before the spin, and the top prize is deliberately the least likely outcome rather than implied as typical. Both pages carry a persistent 18+ badge, a BeGambleAware link and the portfolio disclaimer.

The metric that matters downstream is cost per FTD, not CTR — pre-landers reliably lift click-through and can still dilute registration quality.

## Next Steps

### Technical Optimizations

- **Server-side validation and anti-cheat.** Resolve timing accuracy (Sports) and prize selection (Casino) behind an authoritative API. Client-determined outcomes are fine for a prototype and unacceptable for a real promotion — this is the single largest gap between this build and production.
- **Real analytics instrumentation.** The experiment is wired correctly — sticky assignment, four testable URLs, variant recorded with its source — but nothing collects it. Pointing `dataLayer` at GA4, Segment or Mixpanel makes every hypothesis here testable in practice rather than only in theory.
- **Performance validation on real hardware.** Lighthouse CI budgets in the pipeline, then a mid-tier Android device on a throttled connection. Simulated throttling and real hardware diverge, and this is mobile-first. The animation stays on CSS transforms, which are already GPU-composited — moving to Canvas or WebGL would add weight and forfeit the DOM semantics the keyboard path and screen-reader announcements depend on.
- **Server-side config with an admin surface.** `config.json` is already the single source of truth for every string, price and probability. A CMS-backed editor would let marketing ship new fixtures, zones or prize ladders without a pull request.

### Product Features

- **Dynamic event integration.** Connect the Sports mechanic to live fixture and odds feeds so the boost attaches to whatever match the campaign is running against.
- **The shootout.** Three markets, three timed shots, odds compounding as they land — mapping directly onto how an accumulator works. More commitment, so it belongs after the single shot proves it converts.
- **Adaptive difficulty by segment.** Vary target band width by acquisition channel or player segment. `sweetZonePercent` already makes this a config change — but differential promotional value by segment needs compliance review before it ships, not after.
- **Cross-product wallet.** Let a Sports boost convert into Casino spins across a unified balance, turning two pre-landers into one acquisition ecosystem.

## Running locally

Requires Node 18+.

```sh
npm install
npm run check     # builds dist/client and runs the contract tests
```

Then serve the repo root and open `/sports` or `/casino`.

`npm run check` verifies what breaks silently: the exact 1.5 s delay, config-driven copy, the non-dominated zone ladder, wheel prize reachability and entropy, team-colour contrast, hero space reservation, and all four A/B routing cases.

### Implementation notes

- **No libraries** — no framework, no animation engine. SCSS inlines at build time so nothing blocks render; Manrope is self-hosted and subset, metric-matched so the font swap costs no layout shift.
- **The 1.5 s delay never gates LCP.** Fetch and timer run concurrently; the hero paints as soon as config resolves and only the interactive module waits.
- **Abuse prevention** — a module-level lock guards every transition, handlers no-op off-step, `inert` freezes the container mid-animation, and `event.isTrusted` rejects synthetic events.
- **Geometry is config, not code.** `grid.cols`/`rows` and each zone's `col`/`row` drive the layout and the ball's landing point. `sweetZonePercent` is load-bearing: a marketer retunes the whole difficulty curve without touching JavaScript.
- **Accessible team colours.** Real brand colours fail AA on this palette (Arsenal red at 3.50:1), so brand colour is fill-only and text uses a configured tint, enforced by test at ≥4.5:1.
- **Reduced motion slows the sweep by 30% rather than removing it** — the sweep *is* the mechanic; deleting it would break the page rather than make it accessible. Only decorative motion drops to near-zero.
