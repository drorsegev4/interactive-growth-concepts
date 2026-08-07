# Testing & Presentation Notes

This document records how the interactive concepts were validated. It separates observed production behavior from automated checks and keeps unfinished tests visible instead of presenting them as complete.

## Test environment

- Production demo: https://interactive-growth-concepts.vercel.app
- Browser: Google Chrome with DevTools
- Date tested: 6–7 August 2026
- Latency test settings: Disable cache enabled, No throttling

## Manual production tests

| ID | Requirement and risk | Method | Expected result | Actual result | Evidence | Status |
| --- | --- | --- | --- | --- | --- | --- |
| QA-01 | Dynamic data must come from local configuration. | Reloaded Sports with DevTools Network recording and filtered for `config.json`. | `config.json` is requested successfully and supplies the experience data. | Request returned successfully from the production origin. | [Network timing](docs/evidence/qa-01-config-timing.png) | Passed |
| QA-02 | The real configuration request should complete before the simulated delay under normal conditions. | Disabled cache, selected No throttling, reloaded and inspected the request Timing panel. | Request duration is below 1,500 ms. | Total duration was 134.04 ms; waiting for server response was 66.19 ms. | [Network timing](docs/evidence/qa-01-config-timing.png) | Passed |
| QA-03 | The interface must remain unavailable during the simulated API delay. | Reloaded the experience and observed the loading state after the 134.04 ms configuration request completed. | Spinner remains visible and controls remain unavailable for approximately 1.5 seconds. | Loading state remained visible for approximately 1.5 seconds before interaction was enabled. | Manual observation | Passed |
| QA-04 | Rapid Sports input must not create duplicate shots or rewards. | Rapidly double-tapped the timing control, then counted analytics events in `window.dataLayer`. | One accepted shot and one revealed outcome. | `{ shots: 1, outcomes: 1, blocked: 0 }`. The second input was suppressed by the browser's `inert` state before reaching the lock handler. | [Sports console check](docs/evidence/qa-04-sports-double-input.png) | Passed |
| QA-05 | Casino must require a preference before the wheel can spin. | Attempt to spin before selecting a bonus type, then select each configured type in turn. | Spin remains disabled until a valid preference is selected; every configured preference enables it. | Not retested after the personalized-wheel redesign. | — | Pending |
| QA-06 | Rapid Casino input must not create duplicate spins or rewards. | Rapidly double-activate **Spin my wheel**, then inspect the result and analytics events. | One accepted spin and one revealed outcome. | Not retested after the personalized-wheel redesign. | — | Pending |
| QA-07 | A configuration failure must produce a recoverable error state. | Block `config.json`, reload, unblock it and select **Retry**. | Error UI appears after the loading delay; Retry successfully restores the experience. | The error UI appeared when the request was blocked, and Retry restored the experience after the request was unblocked. | Manual observation | Passed |
| QA-08 | The completed outcome must resist accidental replay after refresh. | Complete a flow, refresh, then use **Start over**. | Refresh restores the result without generating a second reward; Start over clears it. | Sports passed. Casino requires retesting after its persistence schema changed for the wheel. | Manual observation | Needs retest |
| QA-09 | The interaction must remain usable without a pointer or full motion. | Complete each flow with keyboard controls, then repeat with reduced motion enabled. | All actions remain reachable and understandable. | Sports passed. Casino requires keyboard and reduced-motion retesting after the wheel redesign. | Manual observation | Needs retest |
| QA-10 | The mobile-first layout must work on a narrow viewport. | Test both concepts at 320 px width. | No clipped copy, horizontal overflow or unreachable controls. | Not tested yet. | — | Pending |
| QA-11 | The production build must meet performance and accessibility expectations. | Run Lighthouse against both production routes in a mobile profile. | Record Performance, Accessibility, Best Practices and SEO results; investigate material failures. | Pre-redesign baseline: Casino scored 99 Performance, 100 Accessibility, 100 Best Practices and 100 SEO. Sports scored 99, 96, 100 and 100; its Arsenal-red accent text failed contrast in two locations. Casino must be rerun after deployment. | [Sports report](docs/evidence/lighthouse-sports.json), [Casino baseline](docs/evidence/lighthouse-casino.json) | Needs retest |

## Automated validation

`npm run check` builds the production assets and runs `verify.mjs`. The current checks cover:

- the `schemaVersion` and exact `loadingDurationMs: 1500` configuration;
- required config-driven UI copy;
- the sports offer floor and configurable outcome geometry;
- the Casino preference catalog, wheel segments, personalized outcomes and configured spin timing;
- removal of the previous multi-step Sports selection flow;
- A/B URL routing, invalid-variant fallback, config-extensible variants and concept-specific persistence;
- the CSS rule that removes the loading overlay after loading completes.

## Presentation talking points

Use the same sequence when explaining each decision:

1. **Requirement:** State what the assignment asked for.
2. **Risk:** Explain what could fail or be abused.
3. **Implementation:** Describe the protection or design choice in plain language.
4. **Test:** Explain how the production behavior was challenged.
5. **Evidence:** Give the observed number, screenshot or event count.
6. **Result:** State whether it passed and what remains to be tested.

Example:

> Rapid input could produce duplicate rewards during an animation. I combined an internal interaction lock with the browser's `inert` state, then rapidly double-tapped the Sports timing control in production. Analytics recorded one shot and one outcome, so the duplicate input did not create duplicate state.

## Remaining validation order

1. Retest Casino preference gating and rapid spin input.
2. Retest Casino refresh, keyboard and reduced-motion behavior.
3. Resolve the Sports accent-text contrast finding.
4. Test the redesigned Casino flow at 320 px width.
5. Rerun Casino Lighthouse after deployment.
