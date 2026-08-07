# PRD — Casino: "Spin, Then Choose"

**Status:** built, deployed
**Surface:** mobile-web pre-lander
**Live:** [/casino](https://interactive-growth-concepts.vercel.app/casino) · [variant A](https://interactive-growth-concepts.vercel.app/casino?variant=A) · [variant B](https://interactive-growth-concepts.vercel.app/casino?variant=B)

## 1. Summary

An interactive pre-lander that splits a welcome bonus into two questions and answers them in the order that suits the user. A wheel resolves **how much** — genuinely uncertain. The user then chooses **what shape** it takes: Free Spins, Deposit Match or Cashback. The floor is guaranteed and disclosed before the spin.

## 2. Problem

Prize wheels are everywhere in casino acquisition and share one flaw: **the user's input never changes the offer.** You press a button and receive whatever was already decided. The reveal creates anticipation, then hands over a fixed format that may be irrelevant — free spins to someone who wanted cashback.

The obvious fix, asking for a preference first, fails differently. At the top of a pre-lander the visitor is cold, and "Deposit Match" versus "Cashback" is operator jargon. Asking a stranger to commit before they have any reason to care spends the highest-intent moment on a decision they aren't equipped to make — and every tap before the reward costs funnel.

## 3. Objective

Keep the speed and anticipation of a familiar wheel, but make the user's input genuinely change the offer — at the moment they are best placed to decide.

**Primary metric:** cost per FTD.
**Mechanic-justification metric:** `format_selected` distribution and reveal → selection rate. If nearly everyone picks the same format, the choice isn't doing work and should collapse to a default.
**Guardrails:** spin rate, abandonment after reveal, time to CTA, Lighthouse budgets.

## 4. Entry context

Casino-focused paid social or display. The visitor recognises bonus formats in the abstract but has no commitment and no basis for preferring one before seeing what's on offer.

## 5. Flow

| State | What the user sees | Exit |
| --- | --- | --- |
| `loading` | Spinner, exactly 1500 ms. Hero and footer already painted. | Timer + config resolve |
| `spin` | Title, guaranteed-floor pill, wheel, one Spin CTA | Tap Spin |
| `spinning` | Wheel rotates 5 turns over 2400 ms, floor restated | Auto-advance |
| `claim` | Won amount, three format cards with real numbers, format-specific CTA | CTA, or Start over |
| `error` | Recoverable message with Retry | Retry re-fetches config |

Two frames, three taps: spin → choose → claim. The claim screen **is** the reveal and the CTA together, so the choice sits inside the offer rather than in front of it.

## 6. Mechanic

### Wheel

Six prizes denominated in neutral **credits**, drawn by configured weight:

| Prize | Weight | Probability |
| ---: | ---: | ---: |
| 60 | 7 | 25.9% |
| 80 | 6 | 22.2% |
| 100 | 5 | 18.5% |
| 140 | 4 | 14.8% |
| 180 | 3 | 11.1% |
| 250 | 2 | 7.4% |

**Entropy 2.48 bits** against a 2.58 maximum; a fair coin is 1.00. The spin carries real information — this is asserted in the test suite with a 1.5-bit floor so a future config change can't quietly turn the wheel back into theatre.

**Expected value 111 credits.** The floor (60) is the single most likely outcome at 25.9%; the ceiling (250) is the least likely at 7.4%.

### Claim

The same win converts into every format, so the options are comparable as concrete numbers rather than as categories:

| Format | Rate | At floor (60) | At ceiling (250) |
| --- | ---: | --- | --- |
| Free Spins | ×1.5 | 90 Free Spins | 375 Free Spins |
| Deposit Match | ×1.0 | 60% Deposit Match | 250% Deposit Match |
| Cashback | ×0.2 | 12% Cashback | 50% Cashback |

No format dominates — they're different shapes of the same value, so this is a genuine preference rather than a puzzle with a correct answer. The CTA stays disabled until a format is chosen, then names it: *"Claim my Free Spins"*.

## 7. Reward model

Guaranteed floor, disclosed before the spin: *"60 credits guaranteed. Spin to see how much more."* The user is never spinning to avoid a loss, only to discover their upside — the same grammar as the Sports floor.

Three rules are enforced by test rather than left to intention:

- the floor must be the **most likely** outcome, so the guarantee describes where most people actually land;
- the top prize must sit at **≤25%**, so the upside can't be dressed up as typical;
- the ladder must span **≥2×**, or the spread is too flat to justify a spin at all.

## 8. Configuration

All `config.json`, no code change:

- `wheel.prizes` — value, label, colour and selection weight per segment
- `wheel.unitLabel` — the neutral denomination ("credits")
- `wheel.spinDurationMs`, `wheel.turns`, `wheel.hubLabel`
- `formats` — label, mark, colour, blurb, `perUnit` conversion rate and suffix
- `ui`, `headlines.A/B`, `cta.label` — all user-facing strings, including the `{format}` token in the CTA

Adding a fourth prize or a fourth format is a config edit. The wheel geometry, gradient, label angles and selection maths all derive from the array length.

## 9. Edge cases

- **Double spin:** module-level lock plus `inert` for the spin duration + 250 ms; handlers no-op when `state.step` doesn't match; `event.isTrusted` rejects synthetic events.
- **Format re-selection:** deliberately *not* rate-limited — it's reversible and produces no new outcome — but it is rejected unless `state.step === 'claim'`, so it cannot fire before a prize is owned.
- **CTA before choosing:** disabled via `aria-disabled` and `tabindex="-1"`, and the click handler hard-returns without emitting an event.
- **Refresh:** the prize and chosen format persist in `sessionStorage` and restore without re-firing reward analytics. **Start over** clears deliberately.
- **Stale storage:** `STORAGE_VERSION = 4` rejects outcomes saved by any earlier reward shape, so an old token-allocation or per-category result cannot resurrect into the current UI.
- **Config failure:** recoverable error state with Retry; the 1.5 s delay still elapses.

## 10. Accessibility

- Native `<button>` elements throughout; the wheel carries `role="img"` with a descriptive label.
- Live-region announcements at each beat: spinning, the win, and the selected format with its converted value.
- Focus moves to the CTA when a format is chosen.
- 44 px minimum targets; visible focus rings.
- Reduced motion collapses the spin transition to ~0 ms and drops the rotation, so the outcome is delivered without motion.
- Wheel labels are geometrically corrected: the 90° offset between `conic-gradient` (12 o'clock) and CSS `rotate()` (3 o'clock) is reconciled, and labels past the halfway point flip so no text renders upside-down.

## 11. Analytics

`landing_viewed` · `wheel_spun` (prize id, value) · `outcome_revealed` (prize id, value) · **`format_selected`** (prize, format, converted reward) · `cta_clicked` (prize, **format**, converted reward, time to CTA) · `flow_restarted` · `flow_abandoned` · `interaction_blocked` · `config_error`

The chosen format is carried into `cta_clicked` deliberately — without it the choice is decoration, and cost per FTD cannot be split by format. It is also a zero-party signal about where a user sits on the slots ↔ bankroll ↔ risk-averse spectrum, expressed at the moment of ownership rather than extracted by a form.

## 12. Compliance

18+ badge, BeGambleAware link and portfolio disclaimer persist. Prizes are bonus offers in credits, never cash amounts. No losing segment, no near-miss framing, no prize that is shown and then withdrawn — a mechanic that dangles a reward and reclaims it raises engagement and is exactly the creative that attracts regulatory attention. The floor is promised up front and the ceiling is never implied to be typical. No real operator is linked; the CTA lands on the compliance footer.

## 13. Out of scope

- Registration, deposits, real-money rewards.
- Server-authoritative prize selection — required before any real promotion, currently client-side.
- Remote prize APIs, account-level personalisation, full casino gameplay.
- Cross-vertical wallet bridging Sports boosts into Casino spins.
