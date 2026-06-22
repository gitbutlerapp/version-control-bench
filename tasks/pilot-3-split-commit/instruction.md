Split the non-top commit `add lead workflow` on the existing `split-workflow` branch. Do not keep the original broad commit.

Replace it with these three commits, in this order, below the existing top commit `add handler routing metadata`:

- `refactor validation helpers`: the validation helper changes in `src/lead.ts` and the malformed-email test in `tests/lead.test.ts`.
- `tune lead scoring`: the enterprise-domain scoring changes in `src/lead.ts` and the enterprise-domain scoring test in `tests/lead.test.ts`.
- `document lead workflow`: the workflow documentation changes in `README.md` and `docs/lead-workflow.md`.

Keep `add handler routing metadata` as the top commit after the split.

Leave the config logging change, the debug lead summary helper, and the investigation notes uncommitted.
