# Injera Be Wat

**Add • Match • Think Fast**

A polished, local-first digital card game created for **Da Mystro Gamings**. One human player can play a complete match against one to three computer opponents.

## Run locally

Requires Node.js 20 or newer.

```bash
npm install
npm run dev
```

Open the local address printed by Vite, normally `http://127.0.0.1:5173`.

## Test and build

```bash
npm test
npm run build
```

## Implemented gameplay

- Two complete 52-card decks plus exactly two total Jokers
- One-card Middle matches, own-pile matches, opponent top-stack captures, and additions using two or more cards
- Player-discovered captures with no hints or take-backs
- Locked collected-card areas that only Jokers can take
- Joker sweeps of every opponent pile and the full Middle
- Continuing turns after capture and immediate turn ending after a miss
- Final-drawer collection of all remaining Middle cards
- End-only scoring: faces are 10 points; every other card is 1
- Two to four players with Easy, Medium, and Hard AI
- Local match saving, playable tutorial, responsive circular board, accessibility controls, and synthesized sound

Gameplay code in `src/game/` is independent of React. See [RULES.md](./RULES.md) for the authoritative rules.
