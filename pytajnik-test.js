// pytajnik-test.js
// "Pytajnik" - adversarial / hard-case test harness for the recruitment voicebot engine.
//
// Why this exists (context for future-me / Tomasz):
// The bot talks to real people on real phone calls. Real callers don't answer
// politely in the shape the engine expects - they object to the offer, get
// hostile, go quiet, interrupt themselves, mix languages, or give an answer
// that is technically "yes" but means "no" in context. This file is a first
// batch of such cases, grounded in three real-world patterns instead of an
// academic personality typology:
//   1. SALES_OBJECTION   - standard sales-call objections (price, distance,
//      timing, needs approval from spouse) - does the engine route them to
//      the right objection bucket / decision state?
//   2. DIFFICULT_CALLER   - call-center "difficult caller" archetypes:
//      hostile/abusive, suspicious interrogator, wants a human, rushed/busy,
//      hard of hearing, wrong number.
//   3. CONVO_BREAKDOWN    - voice-conversation breakdown patterns: topic
//      change mid-answer, self-correction, code-switching to German,
//      ambiguous qualifiers, non-answers, silence/filler noise.
//
// Every case has a HARD assertion against the engine's actual return value
// (a field, a status, an array) - never "did it sound polite". A few cases
// are marked knownGap: true - they assert the engine's CURRENT (imperfect)
// behavior on purpose, so a future change to that behavior shows up here as
// an intentional decision, not a silent regression.
//
// Usage: node pytajnik-test.js   (from the repo root, next to engine.js)

const E = require('./engine.js');

function eq(a, b) { return JSON.stringify(a) === JSON.stringify(b); }

const SCENARIOS = [

  // ---------------- SALES_OBJECTION ----------------
  {
    id: 'S1', category: 'SALES_OBJECTION',
    desc: 'Obiekcja: za mało płacą',
    run: () => {
      const r = E.offerObjection('Za tę robotę to stanowczo za mało płacą, w Polsce mam prawie tyle samo.');
      return { pass: r === 'SALARY', note: `offerObjection -> ${r}` };
    }
  },
  {
    id: 'S2', category: 'SALES_OBJECTION',
    desc: 'Obiekcja: za daleko',
    run: () => {
      const r = E.offerObjection('To jest kawał drogi, wolałbym coś bliżej domu.');
      return { pass: r === 'LOCATION', note: `offerObjection -> ${r}` };
    }
  },
  {
    id: 'S3', category: 'SALES_OBJECTION',
    desc: 'Obiekcja: warunki zakwaterowania',
    run: () => {
      const r = E.offerObjection('Jakie tam w ogóle są warunki mieszkaniowe, bo nie chcę mieszkać w czwórkę w jednym pokoju.');
      return { pass: r === 'ACCOMMODATION', note: `offerObjection -> ${r}` };
    }
  },
  {
    id: 'S4', category: 'SALES_OBJECTION',
    desc: 'Obiekcja: za wcześnie / termin',
    run: () => {
      const r = E.offerObjection('Mogę dopiero od marca, wcześniej nie dam rady.');
      return { pass: r === 'TIMING', note: `offerObjection -> ${r}` };
    }
  },
  {
    id: 'S5', category: 'SALES_OBJECTION',
    desc: 'Brak decyzji: "muszę to przemyśleć"',
    run: () => {
      const r = E.parseOffer('Szczerze to muszę to przemyśleć, zadzwonię później.');
      return { pass: r.status === 'ok' && r.value === 'no_decision', note: JSON.stringify(r) };
    }
  },
  {
    id: 'S6', category: 'SALES_OBJECTION',
    desc: 'Twarde "nie" bez konkretnego powodu',
    run: () => {
      const r = E.parseOffer('Nie no, zdecydowanie nie, to nie dla mnie.');
      return { pass: r.status === 'ok' && r.value === 'not_interested', note: JSON.stringify(r) };
    }
  },
  {
    id: 'S7', category: 'SALES_OBJECTION',
    desc: 'Konsultacja z małżonką + prośba o SMS',
    run: () => {
      const r = E.parseOffer('Muszę to jeszcze przegadać z żoną, proszę wysłać SMS-a z ofertą.');
      const ok = r.status === 'ok' && r.value === 'no_decision' && r.reason === 'FAMILY_CONSULTATION' && r.sms === true;
      return { pass: ok, note: JSON.stringify(r) };
    }
  },

  // ---------------- DIFFICULT_CALLER ----------------
  {
    id: 'D1', category: 'DIFFICULT_CALLER',
    desc: 'Podejrzliwy: skąd macie mój numer',
    run: () => {
      const r = E.detectIntent('A tak w ogóle to skąd w ogóle macie mój numer telefonu, bo ja nigdzie się nie zapisywałem.');
      return { pass: r === 'source', note: `detectIntent -> ${r}` };
    }
  },
  {
    id: 'D2', category: 'DIFFICULT_CALLER',
    desc: 'Wrogi/wulgarny - obelga ma pierwszeństwo nad opt-out',
    run: () => {
      const r = E.detectIntent('Spierdalaj i więcej nie dzwoń.');
      return { pass: r === 'abuse', note: `detectIntent -> ${r} (musi wygrać z 'optout')` };
    }
  },
  {
    id: 'D3', category: 'DIFFICULT_CALLER',
    desc: 'Chce człowieka (pozytyw) vs. sformułowanie, którego silnik NIE łapie (luka)',
    run: () => {
      const hit = E.detectIntent('Proszę, chcę rozmawiać z prawdziwym człowiekiem, nie z automatem.');
      const miss = E.detectIntent('Dajcie mi od razu jakiegoś prawdziwego konsultanta.');
      const pass = hit === 'human' && miss === null;
      return {
        pass,
        note: `hit="z prawdziwym czlowiekiem" -> ${hit} (oczekiwane human); ` +
              `miss="prawdziwego konsultanta" (bez słowa "z") -> ${miss} (oczekiwane null - to realna luka, nie błąd testu)`,
        knownGap: true
      };
    }
  },
  {
    id: 'D4', category: 'DIFFICULT_CALLER',
    desc: 'Zajęty/w pośpiechu - za kierownicą',
    run: () => {
      const r = E.detectIntent('Słuchaj pani, ja teraz jestem za kierownicą, nie mam jak gadać, oddzwonię wieczorem.');
      return { pass: r === 'busy', note: `detectIntent -> ${r}` };
    }
  },
  {
    id: 'D5', category: 'DIFFICULT_CALLER',
    desc: 'Niedosłyszący - prosi o powtórzenie i głośniej',
    run: () => {
      const r = E.detectIntent('Co? Proszę powtórzyć, słabo słychać, może pani głośniej?');
      return { pass: r === 'repeat', note: `detectIntent -> ${r}` };
    }
  },
  {
    id: 'D6', category: 'DIFFICULT_CALLER',
    desc: 'Osoba trzecia odbiera - nieobecność',
    run: () => {
      const r = E.parseIdentity('Nie ma go, pojechał w trasę, może pani zadzwonić wieczorem.');
      return { pass: r.status === 'absent', note: JSON.stringify(r) };
    }
  },
  {
    id: 'D7', category: 'DIFFICULT_CALLER',
    desc: 'Pomyłka numeru + żądanie zaprzestania dzwonienia (dwie funkcje, jedna wypowiedź)',
    run: () => {
      const id = E.parseIdentity('Ja nikogo takiego nie znam, to pomyłka, proszę więcej nie dzwonić.');
      const intent = E.detectIntent('Ja nikogo takiego nie znam, to pomyłka, proszę więcej nie dzwonić.');
      const pass = id.status === 'ok' && id.value === false && intent === 'optout';
      return { pass, note: `parseIdentity -> ${JSON.stringify(id)} | detectIntent -> ${intent}` };
    }
  },

  // ---------------- CONVO_BREAKDOWN ----------------
  {
    id: 'C1', category: 'CONVO_BREAKDOWN',
    desc: 'Odpowiedź + nagła zmiana tematu w tym samym zdaniu',
    run: () => {
      const r = E.splitAnswerQuestion('pół roku, a ile wy macie lat');
      const pass = !!r && r.answer === 'pół roku' && r.question === 'a ile wy macie lat';
      return { pass, note: JSON.stringify(r) };
    }
  },
  {
    id: 'C2', category: 'CONVO_BREAKDOWN',
    desc: 'Autokorekta w locie z wypełniaczami ("nie, czekaj, przepraszam...")',
    run: () => {
      const r = E.normalize('driving_licence', 'B, nie czekaj, przepraszam, miałem na myśli C plus E');
      const pass = r.status === 'ok' && eq(r.value, ['B', 'C', 'C+E']) && r.corrected === true;
      return { pass, note: JSON.stringify(r) };
    }
  },
  {
    id: 'C3', category: 'CONVO_BREAKDOWN',
    desc: 'Przełączenie na niemiecki w środku rozmowy',
    run: () => {
      const r = E.normalize('german_level', 'Ich spreche sehr gut Deutsch');
      return { pass: r.status === 'ok' && r.value === 'biegły (C1-C2)', note: JSON.stringify(r) };
    }
  },
  {
    id: 'C4', category: 'CONVO_BREAKDOWN',
    desc: 'Odpowiedź niejednoznaczna - zaprzeczenie przebija twierdzenie (ZNANA LUKA)',
    run: () => {
      // Mówi "mam" (mam auto), ale precyzuje że to nie jego tylko żony.
      // Silnik widzi "nie" w zdaniu i generycznie klasyfikuje to jako "nie".
      // To realne ryzyko przy telefonach: osoba de facto MA dostęp do auta.
      const r = E.normalize('own_car', 'mam, ale to nie mój, tylko żony');
      const pass = r.status === 'ok' && r.value === 'nie';
      return {
        pass,
        note: `normalize('own_car', 'mam, ale to nie moj, tylko zony') -> ${JSON.stringify(r)} ` +
              `(silnik gubi "mam" na rzecz "nie" - warto rozważyć poprawkę kolejności reguł w yesNo())`,
        knownGap: true
      };
    }
  },
  {
    id: 'C5', category: 'CONVO_BREAKDOWN',
    desc: 'Monosylabowa niby-odpowiedź bez treści',
    run: () => {
      const r = E.normalize('contract_length', 'no');
      return { pass: r.status === 'unclear', note: JSON.stringify(r) };
    }
  },
  {
    id: 'C6', category: 'CONVO_BREAKDOWN',
    desc: 'Sama wata słowna / wahanie, zero treści',
    run: () => {
      const r = E.normalize('start_date', 'yyyy eee no wiec');
      return { pass: r.status === 'silence', note: JSON.stringify(r) };
    }
  },
  {
    id: 'C7', category: 'CONVO_BREAKDOWN',
    desc: 'Cisza / pusta wypowiedź wprost',
    run: () => {
      const r = E.normalize('start_date', '   ');
      return { pass: r.status === 'silence', note: JSON.stringify(r) };
    }
  },
];

// ---------------- runner + grouped report ----------------
const byCategory = {};
let passCount = 0, failCount = 0, gapCount = 0;

SCENARIOS.forEach(s => {
  const res = s.run();
  byCategory[s.category] = byCategory[s.category] || { pass: 0, fail: 0, gaps: [], failures: [] };
  if (res.pass) {
    passCount++;
    byCategory[s.category].pass++;
    if (res.knownGap) { gapCount++; byCategory[s.category].gaps.push(`${s.id} ${s.desc}: ${res.note}`); }
  } else {
    failCount++;
    byCategory[s.category].fail++;
    byCategory[s.category].failures.push(`${s.id} ${s.desc}: ${res.note}`);
  }
});

console.log('=== Pytajnik — raport (grupowany wg kategorii) ===\n');
Object.keys(byCategory).forEach(cat => {
  const c = byCategory[cat];
  console.log(`${cat}: ${c.pass} OK / ${c.fail} FAIL`);
  if (c.failures.length) {
    console.log('  NIEOCZEKIWANE (prawdziwy regres, nie udokumentowana luka):');
    c.failures.forEach(f => console.log('   - ' + f));
  }
  if (c.gaps.length) {
    console.log('  Udokumentowane luki (test asercji działa, ale ujawnia realną słabość):');
    c.gaps.forEach(g => console.log('   - ' + g));
  }
  console.log('');
});

console.log(`RAZEM: ${passCount} przeszło (w tym ${gapCount} to oznaczone luki), ${failCount} nieoczekiwanych błędów, ${SCENARIOS.length} scenariuszy.`);
if (failCount > 0) process.exitCode = 1;
