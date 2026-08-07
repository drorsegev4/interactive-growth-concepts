# Interactive Growth Concepts

Two mobile-first pre-landing concepts for paid acquisition: an interactive football odds boost and a casino reward wheel with a post-reveal choice. Both experiences are designed to turn a passive offer into one quick moment of participation before the operator handoff.

This is a portfolio prototype. It uses no real money, creates no real betting offer and is not affiliated with a gaming operator.

## Live demo

**[Open the experience](https://interactive-growth-concepts.vercel.app)**

| Concept | Interaction | A/B test links |
| --- | --- | --- |
| **Sports — Take the Shot** | Stop the moving marker to reveal a protected odds boost. | [Variant A](https://interactive-growth-concepts.vercel.app/sports/?variant=A) · [Variant B](https://interactive-growth-concepts.vercel.app/sports/?variant=B) |
| **Casino — Spin, Then Choose** | Reveal a bonus value, then choose how to take it. | [Variant A](https://interactive-growth-concepts.vercel.app/casino/?variant=A) · [Variant B](https://interactive-growth-concepts.vercel.app/casino/?variant=B) |

## Strategy & Competitors

### Research approach

I assessed the category through a user-acquisition lens: ad-to-page continuity, speed to value, interaction cost, clarity of the offer, trust signals and the handoff into registration. The benchmark set included bet365, FanDuel, DraftKings, Paddy Power, Sky Bet, 888 and Stake, alongside current iGaming pre-landing research such as [AffRoom's betting landing-page review](https://affroom.com/blog/betting-pre-landing-and-landing-pages/).

The recurring market patterns were prominent welcome offers, sports-event relevance, short calls to action and familiar gamified reveals. Those patterns are effective, but they create two opportunities: turn the offer into a product-relevant interaction and give the user meaningful control over the revealed value.

| Market pattern | Conversion opportunity | Prototype response |
| --- | --- | --- |
| Fixed welcome offer | Participation can create more involvement than passive reading. | Sports turns the offer into one tap-and-stop interaction. |
| Generic spin-to-win wheel | Randomness creates anticipation, but a fixed prize format may not suit the user. | Casino reveals one value, then lets the user take it as Free Spins, Deposit Match or Cashback. |
| Large headline plus immediate CTA | Fast, but gives cold traffic little reason to engage. | Each concept earns the CTA through a short interaction without adding a registration form. |
| Campaign-specific teams, odds and prizes | Relevance is useful but hardcoded pages are slow to reuse. | All campaign details and offer values come from one local `config.json`. |
| Compliance pushed to the footer | Trust can arrive too late in the journey. | 18+, responsible-gambling copy and the portfolio disclaimer remain visible without competing with the main action. |

### Why these concepts

**Sports — Take the Shot** connects the interaction to the product context. Instead of placing a game beside an unrelated promotion, the user takes a football shot to reveal an odds boost on the featured match. The outcome is bounded by configured minimum and maximum values, rapid repeat input is blocked, and the revealed result survives refresh.

**Casino — Spin, Then Choose** separates anticipation from preference. The wheel first reveals a bonus value, then the user chooses whether to take the equivalent reward as Free Spins, Deposit Match or Cashback. This improves on a generic prize wheel by preserving the familiar reveal while giving the user control at the moment of claim.

Both flows deliberately stop at a clear operator handoff. They demonstrate the acquisition idea without imitating a real registration or collecting personal data.

## Technical implementation

- Pure HTML, modern SCSS/CSS and Vanilla JavaScript; no runtime libraries or animation engines.
- Copy, teams, markets, prizes, wheel segments, timing and interaction geometry are loaded from `config.json`.
- A real configuration request runs alongside an exact 1.5-second simulated loading state.
- `?variant=A` and `?variant=B` force headline variants; normal assignments persist separately for each concept.
- Interaction locks prevent double-clicks and duplicate outcomes during animations.
- Revealed outcomes persist in `sessionStorage`; **Start over** clears the state intentionally.
- Funnel events are pushed to `window.dataLayer` for later analytics integration.
- Semantic controls, keyboard focus management, live-region announcements, visible focus states, 44 px touch targets and reduced-motion support improve accessibility.
- SCSS is compiled and inlined at build time to remove a render-blocking stylesheet request. Manrope is self-hosted with `font-display: swap`.

## Run locally

Requirements: Node.js 18 or newer.

```sh
npm install
npm run check
```

Serve the repository root with any static server, then open:

- `/sports/?variant=A`
- `/casino/?variant=A`

`npm run check` builds the deployment into `dist/client` and validates the configuration schema, dynamic offer constraints, interaction geometry, state rules and experiment routing.

## Validation

The test log and manual QA matrix are documented in [TESTING.md](TESTING.md). Automated verification covers the highest-risk contracts, including the exact loading delay, configuration-driven offers, reward bounds, wheel state, duplicate-input protection and A/B routing.

The latest recorded Lighthouse runs scored:

| Page | Performance | Accessibility | Best Practices | SEO |
| --- | ---: | ---: | ---: | ---: |
| Casino | 99 | 100 | 100 | 100 |
| Sports | 99 | 96 | 100 | 100 |

The remaining Sports contrast finding and final narrow-viewport pass are tracked in the QA log rather than presented as completed.

## Next Steps

With an additional week, I would prioritize:

1. **Measure the full funnel:** connect `dataLayer` events to an analytics endpoint and compare interaction completion, CTA click-through and downstream registration by concept and headline variant.
2. **Preserve campaign continuity:** add campaign-specific creative themes and pass the selected team, chosen bonus format and revealed outcome into the operator registration handoff.
3. **Test mechanics, not only copy:** experiment with a static-offer control, wheel-first versus preference-first Casino flows, and different Sports difficulty curves.
4. **Strengthen production resilience:** validate remote configuration, add timeout and retry telemetry, apply content-security headers and introduce end-to-end browser tests.
5. **Complete accessibility and performance hardening:** resolve the remaining Sports contrast issue, test representative assistive technology and devices, and set Lighthouse budgets in CI.
6. **Add responsible personalisation:** localise sports, currency and compliant offer language by market without using sensitive behavioural targeting.
