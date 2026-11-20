# Polish Recruitment Voicebot — working demo

**Live demo:** https://jabloniec8372-cpu.github.io/polish-voicebot-demo/

An outbound screening-call voicebot for a recruitment agency that places Polish candidates in jobs in Germany. The bot speaks Polish, and every answer ends up as a fixed value in the ATS.

The agency ("Most"), the candidates and the ATS API are fictional. The dialogue logic, the answer normalizer and the error handling are real and tested.

## What it does

| Module | Behaviour |
|---|---|
| **A · Screening call** | Says it is an AI assistant, confirms the right person, asks 11 questions, maps each free answer to an allowed value and saves it to custom fields right away |
| **B · FAQ** | Answers candidate questions during A and C **only from the FAQ table**, shows the entry used, returns to the open question. Questions outside the FAQ are logged for the recruiter, never improvised |
| **C · Job offer** | Presents one offer and saves `interested` / `not_interested` / `no_decision` ("muszę pogadać z żoną" is *no decision*, not a no); asks for the reason on a no |

### Free Polish answers → fixed values

| Candidate says | Saved as |
|---|---|
| „od następnego tygodnia”, „po świętach”, „od piętnastego stycznia” | ISO date relative to today |
| „jeżdżę na tira”, „B i C+E”, „be i ce”, „prawko na osobówkę” | `["C+E"]`, `["B","C+E"]`, `["B","C"]`, `["B"]` |
| „2 WJO”, „dwójkę WJO”, „Staplerschein” | `II WJO`, `II WJO`, `Staplerschein (DE)` |
| „dogadam się”, „mam B1”, „kilka słów” | German level bands |
| „półtora roku”, „pół roku”, „kilka lat” | experience band, or a follow-up question when vague |
| „bez nocek”, „wolę dzień” | `tylko dzienne` |

### Errors handled

- no answer and voicemail (short message, no personal data), saved as call results for retry
- wrong person, "who is calling?", silence
- unclear answer: a different reprompt, then after **2 tries** the field stays empty and the call note says why
- candidate hangs up: answers already collected are kept (each one is saved immediately)
- **ATS API down (503)**: retries with backoff, then holds requests in an outbox and resends them with the same idempotency key when the API is back

## Files

- `index.html` — the demo UI (call simulator, normalizer playground, test suite)
- `engine.js` — dependency-free normalizer, identity/offer parsing, FAQ matcher
- `cases.js` — test cases (base date 2026-11-20)
- `test.js` — run with `node test.js`

Voice uses the browser's Web Speech API (pl-PL); the microphone works in Chrome on the live page. In production the same flow, value mapping and error handling are built on the voice platform's telephony, ASR/TTS and HTTP integration blocks.

---
Built by Tomasz Dembinski — Python automation, bots and API integrations.
