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
| Percentages | `20 percent of 250` · `what percent is 45 of 300` · `increase 80 by 15 percent` |
| Tips, discounts, splitting | `tip 15 percent on a bill of 60` · `price 240 with 25 percent discount` · `split 120 between 4 people` |
| Units | `convert 5 km to miles` · `how many ounces is 250 g` · `72 fahrenheit in celsius` |
| Equations | `solve 3x + 5 = 20` · `x^2 - 5x + 6 = 0` · `solve 2x + y = 10, x - y = 2` |
| Graphs | `plot x^2 - 4` · `graph sin(x) from 0 to 6.28` · `where does x^3 - 3x cross zero` |
| Calculus | `differentiate x^3 + 2x` · `slope of x^2 at 3` · `integrate x^2 from 0 to 3` · `limit of sin(x)/x as x approaches 0` · `taylor series of sin(x) to order 5` |
| Statistics | `summarise 12, 15, 11, 19, 15` · `average of 4, 8, 15, 16, 23, 42` · `standard deviation of 2 4 4 4 5 5 7 9` |
| Regression | `linear regression for x 1, 2, 3, 4 y 1.9, 4.1, 5.9, 8.2` |
| Probability | `probability z < 1.96` · `probability between -1 and 1` · `chance of at most 8 successes in 10 trials with p 0.3` |
| Matrices | `determinant of 1 2; 3 4` · `inverse of 4 7; 2 6` · `rank of 1 2 3; 4 5 6` · `eigenvalues of 2 0; 0 3` |
| Vectors | `dot product of 1 2 3 and 4 5 6` · `cross product of 1 0 0 and 0 1 0` · `angle between 1 0 and 0 1` · `magnitude of 3 4` |
| Physics | `force from mass 1200 and acceleration 2` · `kinetic energy of mass 0.5 at speed 12` · `voltage with current 2 and resistance 50` · `energy stored in a capacitor of 0.0001 F at 12 V` |
| Geometry | `area of a circle with radius 4` · `volume of a cylinder radius 2 height 5` · `sphere volume with radius 3` |
| Money | `compound interest on 1000 at 5 percent for 10 years` · `loan of 200000 at 6 percent for 30 years` · `roi on 1000 growing to 1600 in 5 years` |
| Dates & time | `days between 2024-01-01 and 2026-09-25` · `how old am I if born 1995-04-12` · `time between 09:00 and 17:30` |

## How it decides

1. **Clean up the phrasing** — greetings, “please”, “could you” and trailing politeness are stripped.
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
examples, inputs, optional `patterns`, and a `run()` that returns result blocks), then export it from
`capabilities/index.ts`. Tests in `src/intents/intents.test.ts` automatically require every capability
to be well-formed, to route from its own examples, and to answer its documented sentences.
