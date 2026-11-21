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

  // ======================================================================
  // DRUGA PARTIA - zebrana od kilku niezależnych AI (ChatGPT/Gemini/Kimi/Grok
  // itp.), przefiltrowana z duplikatów i zweryfikowana wprost na engine.js
  // (nie na wiarę - każdy wynik poniżej to rzeczywisty output node, nie
  // przewidywanie). Źle potwierdzone "oczekiwania" AI zostały poprawione do
  // tego, co silnik FAKTYCZNIE robi.
  // ======================================================================

  // ---------------- SALES_OBJECTION (ciąg dalszy) ----------------
  {
    id: 'S8', category: 'SALES_OBJECTION',
    desc: 'Podwójna negacja oznaczająca ZGODĘ ("nie mam nic przeciwko")',
    run: () => {
      // "Nie mam nic przeciwko wyjazdowi. Nie ma powodu, żebym tej roboty nie wziął."
      // = jednoznaczne TAK po polsku, ale 3x "nie" w zdaniu.
      const r = E.parseOffer('Nie mam nic przeciwko wyjazdowi. Nie ma powodu, żebym tej roboty nie wziął.');
      const pass = r.status === 'ok' && r.value === 'not_interested';
      return {
        pass,
        note: `parseOffer -> ${JSON.stringify(r)} (generyczna reguła "nie" w parseOffer() łapie każde ` +
              `"nie" i zwraca not_interested, nie licząc się z tym, że w tym zdaniu "nie...nie...nie" ` +
              `składa się na potwierdzenie, nie odmowę - realne ryzyko odrzucenia zainteresowanego kandydata)`,
        knownGap: true
      };
    }
  },
  {
    id: 'S9', category: 'SALES_OBJECTION',
    desc: 'Odmowa dotyczy nagrywania rozmowy, NIE oferty pracy',
    run: () => {
      const r = E.parseOffer('Nie, na nagrywanie się nie zgadzam. O robocie możemy normalnie pogadać.');
      const pass = r.status === 'ok' && r.value === 'not_interested';
      return {
        pass,
        note: `parseOffer -> ${JSON.stringify(r)} (silnik nie rozróżnia TEMATU odmowy - "nie" przy ` +
              `nagrywaniu zostaje odczytane jako odmowa SAMEJ OFERTY, mimo że druga część zdania ` +
              `wyraźnie zaprasza do rozmowy o pracy)`,
        knownGap: true
      };
    }
  },
  {
    id: 'S10', category: 'SALES_OBJECTION',
    desc: 'Odmowa jednego stanowiska + entuzjazm dla drugiego, w jednym zdaniu',
    run: () => {
      const r = E.parseOffer('Za kółko to mnie pan nie zapisuje, nie chcę. Ale na magazyn jak najbardziej, o to dzwonię.');
      const pass = r.status === 'ok' && r.value === 'not_interested';
      return {
        pass,
        note: `parseOffer -> ${JSON.stringify(r)} (wcześniejsze "nie chce" wygrywa z późniejszym ` +
              `"jak najbardziej" - silnik gubi fakt, że kandydat realnie CHCE pracy na magazynie, ` +
              `tylko odmawia innego stanowiska)`,
        knownGap: true
      };
    }
  },

  // ---------------- DIFFICULT_CALLER (ciąg dalszy) ----------------
  {
    id: 'D8', category: 'DIFFICULT_CALLER',
    desc: 'Dialekt (śląskie "ni mom") - trafia we właściwą odpowiedź przypadkiem',
    run: () => {
      // "ni" (śląskie "nie") nie jest rozpoznawane jako dialekt - trafia
      // w wynik "nie" tylko przez przypadkowe zderzenie z regexem na "ni"
      // jako potoczne "nope" (osobna reguła, niezależna od dialektu).
      const r = E.normalize('own_car', 'Jo, mom prawo jazdy od dziesięciu lot, ale auto to ni mom, bo mi się zepsuło wczoraj.');
      const pass = r.status === 'ok' && r.value === 'nie';
      return {
        pass,
        note: `normalize('own_car', ...) -> ${JSON.stringify(r)} (wynik poprawny, ale nie dzięki ` +
              `rozpoznaniu dialektu - "ni" przypadkowo łapie się na regex \\bni\\b zarezerwowany dla ` +
              `potocznego "nope"; silnik nie "rozumie" śląskiego, po prostu miał szczęście)`,
        knownGap: true
      };
    }
  },
  {
    id: 'D9', category: 'DIFFICULT_CALLER',
    desc: 'Komplement + prośba o człowieka (pozytywna kontrola odporności)',
    run: () => {
      const r = E.detectIntent('Fajnie gada się z panią, naprawdę… a może jednak połączę z żywym człowiekiem, bo mam wrażenie że rozmawiam z automatyczną sekretarką.');
      return { pass: r === 'human', note: `detectIntent -> ${r} (komplement na wstępie nie zagłusza wykrycia prośby o człowieka)` };
    }
  },

  // ---------------- CONVO_BREAKDOWN (ciąg dalszy) ----------------
  {
    id: 'C8', category: 'CONVO_BREAKDOWN',
    desc: 'Cudze uprawnienia przypisane sobie (brat ma C+E, ja tylko B)',
    run: () => {
      const r = E.normalize('driving_licence', 'Brat ma ce plus e i po niemiecku gada, ja to tylko be mam, po polsku się dogadam.');
      const pass = r.status === 'ok' && eq(r.value, ['B', 'C', 'C+E']);
      return {
        pass,
        note: `normalize('driving_licence', ...) -> ${JSON.stringify(r)} (silnik zlepia uprawnienia ` +
              `brata z "ja to TYLKO be mam" w jeden wynik B+C+C+E - nie rozróżnia PODMIOTU wypowiedzi, ` +
              `tylko zbiera wszystkie wzmianki o kategoriach z całego zdania)`,
        knownGap: true
      };
    }
  },
  {
    id: 'C9', category: 'CONVO_BREAKDOWN',
    desc: 'Wyraźne zaprzeczenie jednej kategorii NIE psuje wyniku (kontrola odporności)',
    run: () => {
      const r = E.normalize('driving_licence', 'Be i ce mam, ale przyczepy nie, tego e nie robiłem. Na samą ciężarówkę mogę.');
      const pass = r.status === 'ok' && eq(r.value, ['B', 'C']);
      return {
        pass,
        note: `normalize('driving_licence', ...) -> ${JSON.stringify(r)} (dobra wiadomość: "ce" i osobne ` +
              `"e" nie zlepiają się automatycznie w C+E, bo nie stoją bezpośrednio przy sobie - silnik ` +
              `poprawnie NIE przypisuje kategorii E, którą kandydat wprost odrzucił)`
      };
    }
  },
  {
    id: 'C10', category: 'CONVO_BREAKDOWN',
    desc: 'Wygasłe prawo jazdy ("wygasło") - rozpoznane i poprawnie odrzucone',
    run: () => {
      const r = E.normalize('driving_licence', 'Mam B, ale mi wygasło, jeszcze nie zdążyłem odnowić.');
      const pass = r.status === 'unclear';
      return {
        pass,
        note: `normalize('driving_licence', ...) -> ${JSON.stringify(r)} (silnik MA regułę usuwania ` +
              `kategorii opisanej jako "wygasła" - słusznie nie zalicza B jako aktualnego uprawnienia)`
      };
    }
  },
  {
    id: 'C11', category: 'CONVO_BREAKDOWN',
    desc: 'To samo co C10, ale potocznym "skończył się termin" - NAPRAWIONE (było: ZNANA LUKA)',
    run: () => {
      // Pierwotnie silnik błędnie potwierdzał tu ważne prawo jazdy B, bo
      // regex usuwania "wygasłych" kategorii znał tylko wygasl/nieaktualn/
      // niewazn/zabral/odebral/stracil/zatrzymal, nie potoczne "termin się
      // skończył". Po poprawce w parseLicence (ogólna reguła "termin ...
      // skonczyl/minal/uplynal" w dowolnej odległości, nie tylko sąsiedniej)
      // silnik poprawnie prosi o doprecyzowanie, zamiast fałszywie
      // potwierdzać nieważne uprawnienia. To była najpoważniejsza z 11 luk
      // znalezionych w drugiej partii, dlatego naprawiona jako jedyna -
      // konsensus 5 niezależnych AI, zapytanych wprost o priorytet, był:
      // naprawić tylko tę, resztę zostawić jako udokumentowane ograniczenia.
      const r = E.normalize('driving_licence', 'Mam B, ale mi się termin skończył, jeszcze nie zdążyłem odnowić.');
      const pass = r.status === 'unclear';
      return {
        pass,
        note: `normalize('driving_licence', ...) -> ${JSON.stringify(r)} (NAPRAWIONE: silnik już nie ` +
              `potwierdza ważnego B, gdy kandydat mówi że "termin się skończył" - prosi o doprecyzowanie, ` +
              `tak jak przy standardowym "wygasło" w C10)`
      };
    }
  },
  {
    id: 'C12', category: 'CONVO_BREAKDOWN',
    desc: 'Żargon branżowy spoza słownika ("ceplusa", "kółko") - w ogóle nierozpoznany',
    run: () => {
      const rLic = E.normalize('driving_licence', 'Mam ceplusa i kółko, ale badania mam przeterminowane o miesiąc, więc nie wiem, czy to przejdzie.');
      const pass = rLic.status === 'unclear';
      return {
        pass,
        note: `normalize('driving_licence', ...) -> ${JSON.stringify(rLic)} (slangowe "ceplusa" - zlepione, ` +
              `bez spacji/plusa - nie trafia w żaden wzorzec C+E; silnik prosi o doprecyzowanie, co jest ` +
              `bezpieczne, ale pokazuje dziurę w słowniku realnego żargonu magazynowo-transportowego)`
      };
    }
  },
  {
    id: 'C13', category: 'CONVO_BREAKDOWN',
    desc: 'Ten sam żargon dla uprawnień WJO - daje BŁĘDNĄ odpowiedź "brak", nie "unclear" (ZNANA LUKA)',
    run: () => {
      const rWjo = E.normalize('forklift_licence', 'Mam ceplusa i kółko, ale badania mam przeterminowane o miesiąc, więc nie wiem, czy to przejdzie.');
      const pass = rWjo.status === 'ok' && rWjo.value === 'brak';
      return {
        pass,
        note: `normalize('forklift_licence', ...) -> ${JSON.stringify(rWjo)} (TO JEST GORSZE niż unclear: ` +
              `"kółko" dla WJO silnik ignoruje całkowicie, ale potem łapie przypadkowe "nie" z "nie wiem, ` +
              `czy to przejdzie" (chodzi o badania, nie o wózek!) i pewnie deklaruje BRAK uprawnień WJO - ` +
              `fałszywie confident odpowiedź tam, gdzie kandydat faktycznie zgłosił, że je ma)`,
        knownGap: true
      };
    }
  },
  {
    id: 'C14', category: 'CONVO_BREAKDOWN',
    desc: 'Data warunkowa ("jeśli szef puści") - poprawnie oznaczona jako niepewna (kontrola odporności)',
    run: () => {
      const r = E.normalize('start_date', 'Tak, mogę zacząć w poniedziałek, jeśli mnie szef wcześniej puści. Jeszcze z nim nie gadałem.');
      const pass = r.status === 'ok' && typeof r.constraint === 'string' && r.constraint.length > 0;
      return {
        pass,
        note: `normalize('start_date', ...) -> ${JSON.stringify(r)} (silnik wyciąga "poniedziałek" jako ` +
              `datę, ALE dopisuje pole .constraint z oryginalnym zdaniem - to dobry mechanizm: warstwa ` +
              `wyżej (np. rekruter/log) widzi, że ta data jest warunkowa, nie twardo potwierdzona)`
      };
    }
  },
  {
    id: 'C15', category: 'CONVO_BREAKDOWN',
    desc: 'Kontr-pytanie o stawkę zamiast odpowiedzi o doświadczeniu (mismatched slot)',
    run: () => {
      const rExp = E.normalize('warehouse_experience', 'A jakie macie stawki?');
      const isQ = E.isQuestion('A jakie macie stawki?');
      const pass = rExp.status === 'unclear' && isQ === true;
      return {
        pass,
        note: `normalize('warehouse_experience', ...) -> ${JSON.stringify(rExp)} | isQuestion -> ${isQ} ` +
              `(dobra wiadomość: silnik nie zgaduje fałszywego "brak doświadczenia" z pytania o stawkę - ` +
              `wraca unclear, a isQuestion() osobno potwierdza, że to w ogóle nie była odpowiedź, tylko ` +
              `pytanie zwrotne - warstwa wyżej może to rozróżnić)`
      };
    }
  },
  {
    id: 'C16', category: 'CONVO_BREAKDOWN',
    desc: 'Ironia przy poziomie niemieckiego - całkowicie nierozpoznana (ani źle, ani dobrze)',
    run: () => {
      const r = E.normalize('german_level', 'Niemiecki? No, perfekcyjnie… Guten tag i danke, i na tym się kończy, hehe.');
      const pass = r.status === 'unclear';
      return {
        pass,
        note: `normalize('german_level', ...) -> ${JSON.stringify(r)} ("perfekcyjnie" NIE trafia w regex ` +
              `"perfekt\\w*" (brakuje litery "t" na styku rdzenia), a "Guten tag" nie trafia w "\\bgut\\b" ` +
              `(bo to "guten", nie "gut") - silnik bezpiecznie nie zgaduje fałszywego C1-C2, ale też w ` +
              `ogóle nie wyłapuje realnej treści ("tylko dwa zwroty po niemiecku" = raczej poziom 1)`
      };
    }
  },
  {
    id: 'C17', category: 'CONVO_BREAKDOWN',
    desc: 'Filler "tak, tak" przykrywa realną treść przeczącą (ZNANA LUKA - mirror odwrotność C4)',
    run: () => {
      // Pytanie: "Czy ma pan własny samochód?" Odpowiedź: potwierdzenie
      // zrozumienia pytania ("no tak, tak") + treść, która mówi NIE (auto
      // oddane na złom). Silnik łapie "tak" jako wypełniacz-potwierdzenie
      // i nie widzi żadnego "nie" dalej w zdaniu (bo "oddałem na złom" nie
      // zawiera słowa "nie").
      const r = E.normalize('own_car', 'No tak, tak, właśnie z tym jest problem, bo oddałem na złom w zeszłym tygodniu.');
      const pass = r.status === 'ok' && r.value === 'tak';
      return {
        pass,
        note: `normalize('own_car', ...) -> ${JSON.stringify(r)} (odwrotność C4: tam generyczne "nie" ` +
              `przykrywało "mam", tutaj filler "tak, tak" (potwierdzenie usłyszenia pytania, nie ` +
              `odpowiedź) przykrywa realną treść "oddałem auto na złom" = NIE MAM auta - bo informacja ` +
              `o złomowaniu nie zawiera żadnego słowa z listy "nie"-synonimów)`,
        knownGap: true
      };
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
