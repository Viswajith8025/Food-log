# What the model costs

The dictionary resolves a normal sentence on the phone. The model is a fallback for fragments it could not place.

## Which model

Gemini 2.0 Flash was shut down on 1 June 2026. Its last paid list price was $0.10 / 1M input tokens and $0.40 / 1M output tokens. A new API key also gets HTTP 404 on `gemini-2.5-flash`.

The function calls `gemini-3.5-flash-lite` first, then `gemini-2.5-flash-lite` and `gemini-2.5-flash` if that id 404s. List price for 3.5 Flash-Lite text, checked November 2026, is $0.30 / 1M input and $2.50 / 1M output. If `GEMINI_API_KEY` is absent and `OPENAI_API_KEY` is set, the same JSON shape is requested from `gpt-4o-mini` ($0.15 / 1M input, $0.60 / 1M output).

## Per call

A call sends only the unmatched fragments, not the whole meal.

| | Tokens | 3.5 Flash-Lite | gpt-4o-mini |
|---|---|---|---|
| Input | ~150 | $0.000045 | $0.000023 |
| Output | ~80 | $0.000200 | $0.000048 |
| Call | | **$0.000245** | **$0.000071** |

Prices are paid-tier list prices. The free tier of the Gemini API covers a small app at this volume.

## Per 1,000 people a day

Assumption: each person logs 3 meals, and about 10% of those meals contain one fragment the dictionary misses. Repeats are cached in IndexedDB, so the 10% is first-time gaps, not every time someone types "maggi".

1,000 × 3 × 10% = **300 calls / day**

| Model | Per day | Per month |
|---|---|---|
| Gemini 3.5 Flash-Lite | 300 × $0.000245 ≈ **$0.07** | ≈ **$2.20** |
| gpt-4o-mini | 300 × $0.000071 ≈ **$0.02** | ≈ **$0.64** |

If the dictionary is doing its job, most days cost nothing for a returning user, because yesterday's "xyz" is already in the cache.
