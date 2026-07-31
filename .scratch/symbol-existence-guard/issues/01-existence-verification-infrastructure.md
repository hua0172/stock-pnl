# 01 — Symbol existence verification infrastructure

**What to build:** Cross-source existence checking for a market+symbol pair. For `TW`, consult two independent sources — the existing bulk Taiwan open-data lookup (TWSE + TPEx, already built for symbol-name-display) and an independent live Yahoo Finance price lookup (`.TW` → `.TWO` fallback). For `US`, only Yahoo is available. Each source's outcome is modeled as `{responded, found}` — a source that timed out or errored contributes nothing either way. A pure decision function combines these into `exists` / `confirmedAbsent` / undetermined (treated as existing, i.e. never blocks). This ticket adds the infrastructure and its tests only — no Server Action wiring yet.

**Blocked by:** None — can start immediately

**Status:** ready-for-agent

- [ ] TW check consults both the Taiwan open-data lookup and an independent Yahoo price lookup; US check consults only Yahoo
- [ ] Each source correctly distinguishes "responded with an answer" from "failed to respond" (timeout/network error) — a failure never counts as a negative answer
- [ ] Pure decision function: any source finding it → exists; every consulted source responding and none finding it → confirmedAbsent; any source not responding with none finding it → treated as existing (never blocks)
- [ ] Dedicated test file covers the decision function directly (not the network calls) for both the TW two-source case and the US one-source case
- [ ] No dedicated tests for the network-calling lookups themselves (matches existing `fetchTwSymbolNames`/`fetchUsSymbolName` convention) — full test suite and typecheck stay green
