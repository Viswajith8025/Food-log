# Thali Log

People describe a meal the way they would tell a friend. The app turns that sentence into a log they can trust, and fix with one hand, in well under 10 seconds.

## How a log happens

1. The text field sits in the thumb zone, focused, at the bottom of the screen.
2. While they type, the sentence is parsed (250ms debounce) into item cards above the field.
3. A big Save button writes the meal to today or yesterday. The day's kcal and protein, carbs, and fat stay visible at the top.
4. Anything uncertain is obvious. Tap the name to pick the right dish, tap the quantity to change the amount, swipe a card away to drop it.
5. A correction is remembered on this phone. The next "sabzi" can mean their bhindi without asking again.
6. The last 8 meals sit as chips. One tap logs that meal again.

## Why the parser is a dictionary first

Most logs are the same few dozen foods, said in Hinglish, with katori and plate and "ek" and "aadha". That should not wait on a network, and it should not change between Tuesday and Wednesday. A local dictionary plus a deterministic parser is the thing they can trust.

A model is only asked about the fragments the dictionary cannot place (no match, or a low-confidence guess). Those fragments are cached in IndexedDB, so a phrase is paid for once. If the model is slow or down, the rest of the meal still saves, and the gap says "Unknown — tap to fix".

Personal aliases outrank the dictionary. Otherwise correcting "sabzi" to bhindi could never stick, because "sabzi" is already an exact generic match.

## Folder structure

```
src/
  parser/          pure TypeScript, no React
    types.ts       ParsedItem and the inputs parse() accepts
    normalize.ts   lowercase, punctuation, spelling variants
    parse.ts       parse(text, userAliases) -> ParsedItem[]
    parse.test.ts
    llmFallback.ts model call, timeout, cache — only for gaps
    llmFallback.test.ts
  data/
    foods.ts       ~150 foods, per-100g macros, aliases, servings
    search.ts      alias index and Fuse lookup
  ui/
    App.tsx        the one screen
    ItemCard.tsx   quantity, unit, name, swipe to remove
    FoodDrawer.tsx alternatives, then search
    useLog.ts      day, drafts, save, recent, aliases
  db/
    db.ts          Dexie: meals, aliases, llm cache
netlify/functions/estimate.ts   API key stays server-side
```

Storage is on the device (IndexedDB). There is no account. Today and yesterday are local dates.

## What a parsed item is

`parse` returns `raw`, `foodId` or null, `qty`, `unit`, `grams`, `kcal`, `macros`, `confidence` (`high` | `medium` | `low`), and `alternatives`.

Resolution order inside a fragment: personal alias, exact alias, Fuse (threshold 0.35), unknown. Multi-word dishes are claimed before the sentence is split, so "dal chawal" and "chole bhature" stay one plate. Missing quantity uses that food's usual serving ("maggi" is one pack). Missing unit uses piece for foods you count and katori for curries.

## Screens

One screen. The log for the day you are saving to scrolls above a fixed composer: recent chips, the live cards, the text field, Yesterday/Today, Save. Targets are at least 44px. The composer follows the keyboard.
