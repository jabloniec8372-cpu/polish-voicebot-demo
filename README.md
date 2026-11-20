# Polish screening-call voicebot with ATS write-back (demo)

**Live demo:** https://jabloniec8372-cpu.github.io/polish-voicebot-demo/

A working browser demo of an outbound Polish-language recruitment voicebot for a staffing agency (fictional agency "Most", fictional candidates). It runs entirely in the browser: Web Speech API for Polish TTS/ASR, a deterministic answer normalizer, and a mock REST API that shows every write to the ATS.

> Best in Chrome. For the microphone, open the page in its own tab. You can also type answers or click the suggested replies.

## What the call handles

**Opening and identity**
- AI disclosure in the first sentence, identity check by name
- "A kto mówi?" answered differently each time, then a closed yes/no question
- A family member answers: no details disclosed to third parties, hold ("zaraz zawołam tatę"), re-introduction when the candidate comes to the phone, callback time if absent, wrong number
- "Skąd macie mój numer?" answered from the lead source stored in the ATS, with a GDPR note

**Module A: 11 screening questions → ATS custom fields**
- Normalizes free Polish speech into allowed values: dates ("od następnego tygodnia", "po świętach", "15-tego", notice periods, "4 grudnia mi nie pasuje, 9 grudnia"), licence categories ("be i ce", "dwójka" → confirm C), German level, forklift licences, experience bands, shifts, car, accommodation, region, contract length, ID document
- Handles fillers, self-corrections, negations and conditional answers (stored with a constraint note)
- Smart skip: an answer that already covers a later question is saved and the question is not asked again
- Corrections of earlier answers at any point, with the previous value kept in history
- Unclear answers: 2 tries, then left empty; empty fields are revisited once at the end
- Spoken summary at the end; the candidate can correct anything before the call closes

**FAQ during the call**
- Answers only from the agency's FAQ table (pay, netto/brutto and tax classes, accommodation, transport, contract, etc.), up to two topics per question
- An answer and a question in one sentence: the answer is saved and the question answered
- Same question repeated: short form the second time, a note for the recruiter the third time
- Questions outside the FAQ are logged for the recruiter, never invented

**Module C: offer campaign**
- Presents a concrete offer; one rebuttal per objection (salary, location, accommodation, timing), no pushing
- A refusal with a stated reason gets no exit poll; no decision → SMS summary + follow-up time
- Outcome `interested_alternative` when the candidate wants something closer to Poland

**Global intents in every phase**
Busy / callback time, "proszę poczekać" (bot waits and resumes), repeat, explain, talk to a human (one offer to finish, then handoff), opt-out / GDPR erasure, "już znalazłem pracę", abusive caller (polite close).

**Persona** follows the browser voice: female voice → "Marta", male voice → "Karol", with Polish grammar switched accordingly.

## ATS integration (mock)
- `PATCH /api/candidates/{id}/custom-fields` per answer, with raw answer and status
- Notes, call result, consent changes, campaign results, SMS requests
- Idempotency keys, retry with backoff on 503, outbox that resends when the API is back (toggle "ATS API down")
- One final JSON record per call: `call_id`, answers with verbatim and source (direct / smart skip / correction), constraints, correction history, verification flags, recruiter note

## Files
- `engine.js`: normalizer, intents, FAQ, questions (no DOM, testable in Node)
- `app.js`: call state machine, UI, mock API, JSON record
- `cases.js`, `test.js`: 158 normalizer test cases (`node test.js`)
- `index.html`: the page

In production the same logic sits behind a telephony provider (SIP/WebRTC, streaming ASR/TTS) and the agency's real ATS REST API.
