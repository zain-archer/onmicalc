# Ask OmniCalc — what you can type

The app opens on **Ask OmniCalc** (`#/ask`). Type a sentence in ordinary words, press **Solve it**
(or Enter). OmniCalc picks the tool, reads the numbers out of your sentence and shows the working.

- Everything happens on your device — the matcher is a scored set of sentence templates, not an AI call.
- If the wording is unclear you get ranked suggestions, never a silent guess.
- Prefer boxes to sentences? Open **Enter the values instead** under any answer, or use the classic
  tools in the sidebar.
- `Ctrl/⌘ + K` accepts a full request too: type it and pick *Ask OmniCalc: “…”*.

| What you want | Type something like |
| --- | --- |
| Everyday sums | `what is 12 + 34 * 2` · `2^10` |
| Percentages | `20 percent of 250` · `what percent is 45 of 300` · `increase 80 by 15 percent` (answers with the new value, 92) |
| Tips, discounts, splitting | `tip 15 percent on a bill of 60` · `price 240 with 25 percent discount` · `split 120 between 4 people` |
| Units | `convert 5 km to miles` · `how many ounces is 250 g` · `72 fahrenheit in celsius` |
| Equations | `solve 3x + 5 = 20` · `x^2 - 5x + 6 = 0` · `solve 2x + y = 10, x - y = 2` |
| Graphs | `plot x^2 - 4` · `graph sin(x) from 0 to 6.28` · `where does x^3 - 3x cross zero` |
| Calculus | `differentiate x^3 + 2x` · `slope of x^2 at 3` · `integrate x^2 from 0 to 3` · `limit of sin(x)/x as x approaches 0` · `limit of 1/x as x tends to infinity` · `taylor series of sin(x) to order 5` |
| Statistics | `summarise 12, 15, 11, 19, 15` · `average of 4, 8, 15, 16, 23, 42` · `standard deviation of 2 4 4 4 5 5 7 9` |
| Regression | `linear regression for x 1, 2, 3, 4 y 1.9, 4.1, 5.9, 8.2` |
| Probability | `probability z < 1.96` · `probability between -1 and 1` · `chance of at most 8 successes in 10 trials with p 0.3` |
| Matrices | `determinant of 1 2; 3 4` · `inverse of 4 7; 2 6` · `rank of 1 2 3; 4 5 6` · `eigenvalues of 2 0; 0 3` |
| Vectors | `dot product of 1 2 3 and 4 5 6` · `cross product of 1 0 0 and 0 1 0` · `angle between 1 0 and 0 1` · `magnitude of 3 4` |
| Physics | `force from mass 1200 and acceleration 2` · `kinetic energy of mass 0.5 at speed 12` · `voltage with current 2 and resistance 50` · `energy stored in a capacitor of 0.0001 F at 12 V` |
| Geometry | `area of a circle with radius 4` · `volume of a cylinder radius 2 height 5` · `sphere volume with radius 3` |
| Money | `compound interest on 1000 at 5 percent for 10 years` · `loan of 200000 at 6 percent for 30 years` · `roi on 1000 growing to 1600 in 5 years` |
| Dates & time | `days between 2024-01-01 and 2026-09-25` · `how old am I if born 1995-04-12` · `time between 09:00 and 17:30` |

## Definitions and explanations

OmniCalc carries a **151-entry knowledge base** (mathematics 63, physics 45, chemistry 14, computing
15, finance 14) written as data: definition, a longer note, the formula where one exists, units, tags,
a source and a link to the tool that computes with it.

| What you want | Type something like | You get |
| --- | --- | --- |
| A definition | `what is pi` · `define acceleration` · `define entropy` | the entry, its formula, units and source — plus a live numeric check for constants |
| A unit explained | `what is a mile` · `what unit is N` · `what is a nibble` | the unit, its category and its exact definition relative to the base unit |
| A formula | `formula for kinetic energy` · `what is the equation for density` · `how do i calculate power` | the formula and what each variable means, ready to send to the calculator or the graph |
| Everything about a topic | `search for energy` · `list physics constants` · `what formulas do you know` | ranked matches (15 for "energy"), constants by area, or every stored formula |

An unknown term is never invented: you get the nearest entries that do exist, or `“x” is not in the
knowledge base — try another wording`.

## Questions inside your files

Attach a file in the Ask panel (button or drag-and-drop) and OmniCalc reads it **on your device** and
lists the questions it finds as chips; the first is solved straight away.

| Format | How it is read |
| --- | --- |
| PDF | built-in extractor: `FlateDecode` streams (raw-DEFLATE inflater written for the job), `Tj`/`TJ`/`'`/`"` text operators, string escapes, page count. A scanned or CID-only PDF is reported as a picture, never guessed at |
| Word `.docx`, Excel `.xlsx`, PowerPoint `.pptx` | unzipped in the browser with `DecompressionStream('deflate-raw')` — paragraphs, cell values and slide text |
| OpenDocument `.odt`/`.ods`/`.odp` | `content.xml` paragraphs and cells |
| Text, Markdown, CSV/TSV, JSON, XML, YAML, LaTeX, logs, source code | read directly, markup stripped |
| Images (`.png`, `.jpg`, …) | shown to you; OmniCalc does **not** do image recognition and says so rather than inventing text |

The extracted text appears in an editable box, so an imperfect read is fixable in place, and **Skip to
the next question** walks down the list. Question detection scores each line by instruction verb
("solve", "calculate", "convert"), an `=`, numbers with operators, and a trailing question mark.

## Typos are fine

You do not have to spell anything correctly — words are matched against everything the app knows
(capability keywords, sentence templates, unit names, function names, constants) with an edit-distance
budget that grows with word length:

| Typed | Understood as | Why it works |
| --- | --- | --- |
| `convret 5 km to miels` | convert 5 km → miles | one swapped pair each |
| `solv 3x + 5 = 20` | solve the equation | one missing letter |
| `intergrate x^2 from 0 to 3` | integrate | one extra letter |
| `72 fahrenhite in celsius` | 22.22222222 °C | two typos in a long word |
| `how many ouces is 250 g` | 8.818490487 oz | unit name fixed by the same engine |
| `what is 20 precent of 250` | 50 | two equally close words — the reading that makes sense wins |
| `aveage of 1, 2, 3` | summarise the data | … |

The panel never hides the guess: a **Typos** line under the answer reads *“I read “convret” as
“convert” and “miels” as “miles””*, and the live hint shows the assumption before you press Solve. If
your wording was right and a value was wrong, open **Enter the values instead**.

What is *never* touched: numbers, symbols, expressions (so `2.5e3 * (4 + 7) / 12.5` is byte-identical),
words of three letters or fewer, words the app already knows, and ordinary English (a protection list,
so “I want to know” can never become “watt” or “now”). History stores your own words, uncorrected.

## How it decides

1. **Clean up the phrasing** — greetings, “please”, “could you” and trailing politeness are stripped,
   then likely typos are corrected against the app's own vocabulary. If a correction is ambiguous, the
   sentence is read more than once and the reading that scores best wins.
2. **Score every capability** — keyword specificity, similarity to that capability's own example
   sentences, whether one of its sentence templates matches exactly, and domain hints (a unit word
   favours the converter, a bare sum favours the calculator). Two `=` in one request is a system of
   equations.
3. **Read the values** — the winning capability's templates pull numbers, unit words, lists (`x 1, 2, 3`)
   and function bodies straight out of the sentence.
4. **Run the engine** — capabilities only call existing, tested engine functions such as
   `evaluateExpression`, `solvePolynomial`, `integrate`, `summarize`, `ohmsLaw` or `compoundInterest`.
   Nothing about maths lives in the interface.

## When it cannot help

- It says what is missing: *“I need the capacitance (in farads) and the voltage…”*.
- It refuses rather than inventing: non-polynomial equations, inconsistent systems, cross-category
  conversions and one-sided limits all produce an explanation.
- Anything unclear offers the six closest capabilities as buttons, plus the full
  **Everything you can ask** browser at the bottom of the panel.

## Extending it

Add a `Capability` object in `src/intents/capabilities/*.ts` (id, title, promise, group, keywords,
examples, inputs, optional `patterns`, an optional `accepts(sentence)` guard that can rule the
capability out before scoring, and a `run()` that returns result blocks), then export it from
`capabilities/index.ts`. Typo tolerance, the “everything you can ask” list and the routing tests all
pick it up automatically. Tests in `src/intents/intents.test.ts` automatically require every capability
to be well-formed, to route from its own examples, and to answer its documented sentences.
