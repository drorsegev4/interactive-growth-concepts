# PRD — Sports: "Take the Shot"

**Status:** built, deployed
**Surface:** mobile-web pre-lander
**Live:** [/sports](https://interactive-growth-concepts.vercel.app/sports) · [variant A](https://interactive-growth-concepts.vercel.app/sports?variant=A) · [variant B](https://interactive-growth-concepts.vercel.app/sports?variant=B)

## 1. Summary

An interactive pre-lander that converts a static "boosted odds" promotion into one timed action. The visitor times a shot at a goalmouth; accuracy determines how far above a guaranteed floor their odds boost lands. The mechanic is upside-only — there is no losing state.

## 2. Problem

Sportsbook acquisition creative promises a boost, then hands the user a banner restating it. Two failures follow:

- **The offer is asserted, not experienced.** "Odds boosted up to ×3.5" is an abstract multiplier. Nothing shows what it does to a real price.
- **Existing interactive surfaces sit too deep.** Bet builders and same-game parlays give real control and live price feedback, but they assume betting literacy and live well past acquisition, inside the wagering journey.

## 3. Objective

Give cold traffic a three-second-comprehensible action that *demonstrates* risk/reward instead of explaining it, and hands a specific, personalised boost to the operator.

**Primary metric:** cost per FTD.
**Mechanic-justification metric:** `uplift_over_floor` — did players land meaningfully above the guaranteed floor, and does that uplift correlate with CTA clicks? If not, the game is decoration.
**Guardrails:** interaction completion rate, time to CTA, Lighthouse budgets.

## 4. Entry context

Paid social or display, football creative, fixture-specific. Message match matters: the fixture, market and team on the ad must be the fixture, market and team on the page. All three are config fields for exactly this reason.

## 5. Flow

| State | What the user sees | Exit |
| --- | --- | --- |
| `loading` | Spinner, exactly 1500 ms. Hero and footer already painted. | Timer + config resolve |
| `aim` | Fixture card, goalmouth, target zone, sweeping reticle, tolerance scale | Tap / Enter / Space, or Skip |
| `shoot` | Reticle freezes, ball flies to the stop point, net reacts | ~920 ms auto-advance |
| `reveal` | Outcome line, odds counting up to the boosted price, CTA | CTA, or Start over |
| `error` | Recoverable message with Retry | Retry re-fetches config |

One meaningful action. The stage persists between `aim` and `shoot` so the ball flies inside the same goal that was just being aimed at.

## 6. Mechanic

The featured team and target zone come from config (`featuredTeamId`, `featuredZoneId`) — currently Arsenal, "Top corner" at ×3.5.

A reticle sweeps horizontally across the goalmouth as a triangle wave, period **1400 ms**. The target zone sits at its true grid position: with a 3-column grid, the top-left zone centres at **16.67%** across. The sweet band is `sweetZonePercent` wide, centred on that target.

On stop, `delta = |reticle position − target|`:

| Tier | Condition | Multiplier | Result on 2.10 |
| --- | --- | --- | --- |
| **Sweet** | `delta ≤ 6%` | ×3.5 (zone value) | **7.35** |
| **Near** | `delta ≤ 15%` | linear ×1.2 → ×3.5 by proximity | up to 7.35 |
| **Floor** | beyond that | ×1.2 | 2.52 |

**Skip the shot** awards the floor directly, so the offer is reachable without playing.

Every zone multiplier sits strictly above `floorMultiplier` (1.2) — the easiest zone is 1.6×. A zone equal to the floor would be a dominated choice nobody should pick, and the test suite enforces this.

## 7. Reward model

Upside-only by design. The floor is visible before the shot and guaranteed after it, so the interaction can only add value. This is what keeps the mechanic compliant: there is no losing state to misrepresent, no near-miss framing, no lost prize.

Risk/reward is *performed* rather than described — tighter zones pay more, exactly as longer odds pay more in the market underneath. The resolved line (`Arsenal to win, 2.10 → 7.35`) teaches how a boost applies to a real price, which a flat multiplier banner cannot.

## 8. Configuration

Everything below is `config.json`, no code change:

- `fixture` — competition, both teams, brand colour and an accessible text tint
- `market` — label template, home/away odds
- `featuredTeamId`, `featuredZoneId` — which team and target this campaign runs
- `grid` (`cols`/`rows`) and per-zone `col`/`row` — the goal is not a hardcoded 3×2; geometry and the ball's landing point derive from these
- `sweetZonePercent` — **load-bearing.** Retunes the entire difficulty curve per zone without touching JavaScript
- `nearThresholdMultiple` — how wide the partial-credit band is
- `floorMultiplier` — the guarantee
- `sweepPeriodMs` — pace
- `ui`, `headlines.A/B`, `outcomeCopy` — all user-facing strings

## 9. Edge cases

- **Double input:** module-level lock plus `inert` on the container for 1450 ms; handlers no-op when `state.step` doesn't match; `event.isTrusted` rejects synthetic events.
- **Backgrounded tab:** the sweep pauses on `visibilitychange` and resumes with elapsed time corrected, so returning doesn't produce a spurious result.
- **Refresh:** the outcome persists in `sessionStorage` and restores without re-firing reward analytics. **Start over** clears it deliberately.
- **Stale storage:** a restored outcome is rejected if its team or zone no longer exists in config.
- **Config failure:** recoverable error state with Retry; the 1.5 s delay still elapses so the failure doesn't flash.

## 10. Accessibility

- The pitch is a real `role="button"` with `tabindex="0"`, operable by Enter or Space.
- Live-region announcements for the hint and the outcome.
- Focus moves to the reveal when the lock releases.
- 44 px minimum targets; visible focus rings.
- **Reduced motion slows the sweep by 30% rather than removing it** — the sweep *is* the mechanic. Only decorative motion (ball flight) drops to near-zero.
- Team brand colours fail AA on this palette (Arsenal red 3.50:1), so brand colour is fill-only and text uses a configured accessible tint. Enforced by test at ≥4.5:1.

## 11. Analytics

`landing_viewed` · `shot_taken` (zone, accuracy delta, tier) · `outcome_revealed` (final multiplier, **`uplift_over_floor`**, boosted odds) · `cta_clicked` (multiplier, time to CTA) · `flow_restarted` · `flow_abandoned` · `interaction_blocked` · `config_error`

## 12. Compliance

18+ badge, BeGambleAware link and portfolio disclaimer persist. Copy uses *boost*, *claim*, *unlock* — never *win*, *guaranteed profit* or *risk-free*. No real operator is linked; the CTA lands on the compliance footer.

## 13. Out of scope

- **The shootout** — three markets, three timed shots, compounding odds, mapping onto a real accumulator. Higher commitment, so it belongs after the single shot proves it converts.
- Sports other than football. `sport: "football"` is a label, not an abstraction — `outcomeCopy` ("keeper", "post", "top bins") is football vocabulary and another sport needs its own copy and plausibly a different grid.
- Live odds. Prices are config, not a feed.
