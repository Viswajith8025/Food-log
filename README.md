# Thali Log

A mobile-first meal log for people who describe food the way they would tell a friend: "2 roti, dal aur ek katori sabzi", "1 plate chole bhature", "maggi".

## The problem, as I understood it

People are not searching a database. They are standing with the plate in front of them, one hand free, and they say the meal in Hinglish. Portions are a katori, a plate, a pack, "ek", "aadha", "dedh", not grams. The same lunch shows up again tomorrow. What they need is a reading of that sentence they can trust, and a way to fix the one thing that is wrong without starting over.

Speed is the product. If parsing waits on a network, or the correction takes a search through 150 foods before they can save, they will not log the meal.

## What this does

Type in the field at the bottom. Cards appear as you type. Save to today or yesterday. The day's kcal and protein, carbs, and fat stay at the top.

Tap a quantity to change the amount or the unit. Tap a name to pick another food, with the close guesses first. Swipe a card away, or hit Remove. The last 8 meals are chips: one tap logs that meal again.

Correcting a match is remembered on this phone. Next time, "sabzi" can mean bhindi fry. Personal aliases win over the shared dictionary, because otherwise a correction could never stick.

## Design decisions

The dictionary goes first. Most logs are the same foods, said with the same typos. A local table (IFCT 2017 for plain foods, household recipes built from those values for dishes people name as one thing) plus a deterministic parser is instant, free, and the same on Tuesday and Wednesday. "chole bhature", "dal chawal", and "idli sambar" are one item, matched before the sentence is split, so they do not fall apart into ingredients.

A model is only for the gap: a fragment the dictionary missed, or matched with low confidence. The request sends those fragments, not the whole sentence. The result is badged "AI estimate" and cached in IndexedDB, so the same phrase is never paid for twice. The call times out at 3 seconds. If it fails, that card says "Unknown — tap to fix" and the rest of the meal still saves.

Gemini 2.0 Flash was shut down on 1 June 2026, and new keys are refused on 2.5 Flash. The fallback calls Gemini 3.5 Flash-Lite. The key stays in `GEMINI_API_KEY` on the server (the Vite dev middleware locally, a Netlify function in production). It is not in the client bundle. See [COST.md](COST.md).

## Run

```bash
npm install
cp .env.example .env   # set GEMINI_API_KEY
npm test
npm run dev
```

`npm run build` outputs an installable PWA. Netlify is configured in `netlify.toml`: publish `dist`, function `estimate`, and `/api/estimate` points at it. Set `GEMINI_API_KEY` in the Netlify site environment. Do not commit `.env`.

## What I would do next

Voice, so the phone can be on the table. A deeper regional dictionary (a Mangalorean fish curry is not "fish curry"). A photo only when the sentence is ambiguous. A home-cooking adjustment for the oil or ghee that never appears in the sentence but changes the calories.

## Known limits

- A katori is 150g and a plate is a typical home plate. A restaurant plate is often larger. The card shows the assumption so it can be changed.
- Generic "sabzi" is a mixed dry vegetable curry, marked so you tap it and pick the real one. After you do, this phone remembers.
- The model guess is a guess. It is labeled, and it does not overwrite a confident dictionary hit.
- Without a key, or if the request fails, unknown foods stay unknown. The meal can still be saved.
- Memory is on this phone (IndexedDB). A new phone does not know that your sabzi is bhindi.
