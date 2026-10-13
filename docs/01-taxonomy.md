# Ambiguity Taxonomy

| Code | Label | Description | Example | Typical fix |
|---|---|---|---|---|
| `vague_term` | Vague term | Subjective/unmeasurable word | "respond **quickly**", "user-friendly" | Add measurable threshold |
| `missing_actor` | Missing actor | Passive voice, no responsible agent | "Reports **shall be generated**" | Name the actor/system |
| `unbounded_quantifier` | Unbounded quantifier | all / some / many / any with no bound | "support **many** users" | Give number or range |
| `referential` | Referential ambiguity | Pronoun/reference with unclear antecedent | "**It** sends the file to the server and **it** logs." | Replace pronoun with noun |
| `lexical` | Lexical ambiguity | Word has multiple meanings in context | "The system shall **bank** records" | Use unambiguous term |
| `syntactic` | Syntactic ambiguity | Sentence parses multiple ways | "Admins and users with access can edit" | Restructure / parenthesize |
| `conflicting_condition` | Conflicting / incomplete condition | and/or confusion, missing else-case | "If A or B and C" | Make logic explicit |
| `undefined_term` | Undefined term | Domain term/acronym not defined | "per the **SLA**" | Define or reference glossary |
| `open_ended` | Open-ended phrase | etc., and so on, as appropriate, TBD | "formats such as PDF, **etc.**" | Enumerate the list |
| `non_testable` | Non-testable | Cannot be verified by a test | "shall be **robust**" | Express as verifiable criterion |

## Severity
- **high** – requirement cannot be implemented/tested without clarification
- **medium** – multiple plausible interpretations
- **low** – minor wording looseness

## Quality score (0–100)
`100 - Σ(severity weights)` per requirement, weights: high 35, medium 20, low 8 (floored at 0).
Project score = mean of requirement scores.
