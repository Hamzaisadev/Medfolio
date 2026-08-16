# Medfolio — Build Specification

You are building **Medfolio**, a new application, from an empty directory.

## Read this first

**This specification is complete and self-contained. Build only from these nine documents.**

Do not read, open, search, copy, or take inspiration from any source file outside this `REBUILD/`
folder — including anything in a parent or sibling directory. If you find application code
nearby, ignore it entirely. It is discarded work whose patterns this spec explicitly forbids, and
reading it will actively mislead you.

Everything worth keeping has already been extracted into these documents. In particular,
[06-DOMAIN-RULES.md](06-DOMAIN-RULES.md) contains the complete clinical logic — dosing shorthand,
duration parsing, lab-test vocabulary, reference ranges, emergency red flags — as authoritative
spec. There is nothing to recover from anywhere else.

**Start here:** create a new directory of your own and run `npm create vite@latest`. Build from
these documents alone. If something you need is genuinely not specified, ask — do not go looking
for it in old code.

## Read these in order

| # | Doc | What it gives you |
|---|---|---|
| 0 | [00-BRIEF.md](00-BRIEF.md) | Product thesis, the user, scope, non-negotiables |
| 1 | [01-ARCHITECTURE.md](01-ARCHITECTURE.md) | Stack, exact versions, folder layout, boundaries |
| 2 | [02-DATA-MODEL.md](02-DATA-MODEL.md) | Supabase schema, RLS, storage, TypeScript types |
| 3 | [03-DESIGN-SYSTEM.md](03-DESIGN-SYSTEM.md) | Tailwind tokens, primitives, **product voice rules** |
| 4 | [04-FEATURES.md](04-FEATURES.md) | Every screen and flow, specified to build from |
| 5 | [05-AI-LAYER.md](05-AI-LAYER.md) | Gemini server-side, prompts, schemas, cost control |
| 6 | [06-DOMAIN-RULES.md](06-DOMAIN-RULES.md) | Clinical logic: dosing, durations, ranges, red flags |
| 7 | [07-TASKS.md](07-TASKS.md) | **The ordered build plan. This is your worklist.** |
| 8 | [08-DEFINITION-OF-DONE.md](08-DEFINITION-OF-DONE.md) | Gates you must pass before calling work done |

`06-DOMAIN-RULES.md` is the one to read most carefully. It encodes medical shorthand that is
not guessable and that the app's correctness depends on.

## Decisions already made — do not relitigate

| Decision | Choice |
|---|---|
| Language | **TypeScript**, `strict: true` |
| Framework | **React 19** + **Vite 8** |
| Styling | **Tailwind CSS v4**, CSS-first `@theme` configuration |
| Data | **Supabase** — Postgres + Auth + Storage + Row Level Security |
| AI | **Google Gemini**, model `gemini-3.5-flash`, called **only** from the server |
| Scope | Full product as specified in `04-FEATURES.md` |
| Hosting | Vercel — static SPA + serverless functions under `/api` |

## The two hard requirements behind this rebuild

1. **The interface must be genuinely well made.** Mobile-first, consistent spacing scale,
   one shadow system, one radius system, real empty states, real loading states, real error
   states, keyboard accessible, and legible on a cheap Android screen in daylight.
   `03-DESIGN-SYSTEM.md` is not a suggestion sheet — it is the contract.

2. **The product must not brand itself as an AI toy.** No "AI Active" badges, no sparkle icons
   used as decoration, no screens named after the technology, no invented copy about model
   tiers or server load, no red "low confidence" flags shouting at the user. It is a medical
   records app that happens to read handwriting. `03-DESIGN-SYSTEM.md` §Product voice gives the
   exact rules and a lint rule to enforce them.

## Working agreement

- Work through `07-TASKS.md` in order. Each task states its own acceptance check — run it
  before moving on.
- One task per commit, conventional commit messages.
- `npm run verify` (typecheck + lint + test + build) must pass before every commit.
- Never commit a secret. The Gemini key and the Supabase service key are server-side only.
- If something in this spec is wrong, impossible, or self-contradictory, stop and say so with
  a proposed fix. Do not silently deviate.
