Amend the existing five-commit `amend-series` branch. Do not create a new commit.

Route the already-present dirty changes like this:

- Amend the validation helper changes in `src/lead.ts`, the malformed-email test in `tests/lead.test.ts`, and the validation wording in `README.md` into commit `refactor validation helpers`.
- Amend the scoring changes in `src/lead.ts` and the enterprise-domain scoring test in `tests/lead.test.ts` into commit `add lead scoring`.
- Amend the response-behavior documentation changes in `README.md` and `docs/response.md` into commit `document response behavior`.

Leave the config logging change, the debug lead summary helper, and the investigation notes uncommitted.
