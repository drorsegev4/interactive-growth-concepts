# Interactive Growth Concepts

Two mobile-first acquisition concepts that turn a standard promotional offer into a short, memorable interaction. The prototype is a portfolio demo: it uses no real money, creates no real offer and is not affiliated with an operator.

**Live demo:** [interactive-growth-concepts.vercel.app](https://interactive-growth-concepts.vercel.app)

## Concepts

### Sports — Take the Shot

The user stops a moving marker to reveal an odds boost on a featured football market. The flow takes one action, always protects a configured minimum offer and persists the revealed result across refreshes.

### Casino — Choose and Spin

The user chooses whether they value Free Spins, Deposit Match or Cashback, then spins a wheel shaped around that preference. The result is guaranteed to match the choice, combining the anticipation of a familiar wheel with more agency and transparency than a generic random-prize mechanic.

## Growth strategy

Both concepts are designed to improve the transition from acquisition creative to operator handoff:

- **Participation before conversion:** a single, low-friction interaction creates investment before the claim CTA.
- **Clear value:** Sports guarantees a floor; Casino guarantees that the revealed reward matches the selected bonus style.
- **Personalisation:** headline variants and offer values are configuration-driven, so campaigns can match audience and channel.
- **Measurability:** funnel events are written to `window.dataLayer`, including views, interactions and revealed outcomes.
- **Responsible framing:** 18+ messaging, responsible-gambling copy and an explicit portfolio-demo notice remain visible.

## Competitive framing

Acquisition pages commonly present a fixed odds boost, a generic welcome package or a chance-based prize reveal. These concepts preserve the speed of those patterns while adding agency: timing in Sports and preference-led personalization in Casino. The Casino wheel deliberately improves on the common spin-to-win pattern by asking what the user values first and guaranteeing a relevant category rather than implying an opaque random prize. Deterministic outcomes and interaction locks prevent duplicate or unexpectedly large rewards.

## Product and technical decisions

- `config.json` controls copy, fixtures, offer values, timing, layout geometry and A/B headlines.
- `?variant=A` and `?variant=B` force a headline variant for review; otherwise assignment persists per concept.
- A real configuration request and a 1.5-second simulated delay model an API-backed experience.
- Interaction locks and inert UI prevent rapid input from generating duplicate outcomes.
- Completed outcomes use session storage; **Start over** clears them intentionally.
- Semantic controls, visible focus states, 44 px targets and reduced-motion CSS support accessible use.
- The build compiles and inlines SCSS, then assembles the static Vercel output in `dist/`.

## Run locally

```sh
npm install
npm run check
```

Serve the repository root with any static server, then open `/sports/` or `/casino/`. The automated check builds the deployable assets and validates the configuration contract, offer constraints, layout geometry, UI copy and experiment routing.

## Validation

Production observations, evidence and remaining checks are documented in [TESTING.md](TESTING.md). The high-risk paths—loading, duplicate inputs, limits, recovery, refresh persistence, keyboard navigation and reduced motion—have been tested. Lighthouse scored Casino 99/100/100/100 and Sports 99/96/100/100; the Sports contrast finding and narrow-viewport check remain open.

## Next steps

1. Resolve the Sports accent-text contrast finding.
2. Run the final 320 px responsive check.
3. Connect the tracked events to an analytics destination and compare conversion by concept and headline variant.
