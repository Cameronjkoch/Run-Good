# Run-Good 🃏

**Who ran hottest tonight?** A Texas Hold'em companion app for live home games: every player props their iPhone in front of them, the camera reads their hole cards when they peek, folds are detected when the cards leave the frame, and at the end of the night the app tells you who was the luckiest — and unluckiest — player at the table.

## How a hand works

1. **Deal** — each player peeks at their cards like normal. The phone camera catches the faces during the peek and reads them (confirm with one tap). Cards stay hidden from everyone else's app until the hand ends.
2. **Play** — the camera watches your two card-backs on the felt. When they disappear mid-hand (you mucked), that's a fold. When everyone's remaining cards vanish together, the hand is over.
3. **Board** — one player (any player) enters the flop/turn/river; it syncs to everyone.
4. **Hand end** — the app knows every hole card and the board, so it determines the winner itself, reveals the recap, and updates the luck leaderboard.

## The luck model

Luck decomposes into two measurable, zero-ish-sum quantities:

- **Dealt luck** — were you handed good cards? For each hand you're dealt, we compute your hole cards' all-in equity vs. a random hand and score `equity − 0.5`. Summed over the night, this shows who got the deck's favor before anyone did anything.
- **Runout luck** — did the board cooperate? Every card reveal (flop, turn, river) shifts each live player's exact equity. The shift caused by the *cards* (holding the set of live players fixed across the reveal) is pure chance, so we credit it as luck: get in as an 80% favorite and lose, you accrue −0.8; win the 20% side, +0.8. Fold-induced equity shifts are deliberately excluded — that's play, not luck.

Runout luck sums to zero across the table on every reveal (equity is conserved), which keeps the leaderboard honest. Because folded hands are still captured, the app can also tell you things like *"you folded the eventual winner three times tonight."*

## Repo layout

```
engine/   — TypeScript core: cards, 7-card evaluator, equity (exact + Monte Carlo),
            luck accounting, session model, and a simulated-night CLI
app/      — (coming) Expo / React Native iPhone app
```

## Engine quickstart

```bash
cd engine
npm install
npm test        # evaluator + equity + luck accounting tests
npm run sim     # simulate a full poker night, print the luck report
npm run sim -- --players 8 --hands 200 --seed 7
```

## Roadmap

- [x] **Phase 1 — Engine.** Hand evaluator, equity calculator, luck accounting, simulated night proving the math end-to-end. (You are here.)
- [ ] **Phase 2 — App, manual entry.** Expo app: create/join a session with a code, tap in your hole cards, board scribe, live leaderboard synced via Firebase. Fully usable at a real table before any camera work.
- [ ] **Phase 3 — Camera presence.** Low-fps card-back detection: auto-detect deals, folds (cards leave the frame), and hand boundaries (everyone's cards vanish together). Fold auto-confirm with undo.
- [ ] **Phase 4 — Peek reading.** Rank/suit recognition during the natural peek gesture (Core ML / TFLite model via vision-camera frame processor), manual picker as fallback.

**Stack notes:** engine is portable TypeScript (runs in Node and React Native alike). App will be Expo/React Native so development works from Windows with testing on-device via Expo Go; the camera phase needs an EAS dev build. Chip counts are deliberately out of scope for v1 — luck is per-hand, not per-dollar.
