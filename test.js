const E = require('./engine.js');
const CASES = require('./cases.js');
let pass = 0, fail = 0;
for (const [f, text, exp] of CASES) {
  const r = E.normalize(f, text);
  const got = r.status === 'ok' ? r.value : null;
  const ok = JSON.stringify(got) === JSON.stringify(exp);
  ok ? pass++ : fail++;
  if (!ok) console.log('FAIL', f, JSON.stringify(text), 'got', JSON.stringify(got), 'exp', JSON.stringify(exp));
}
// FAQ / question detection / identity / offer
const extra = [
  [E.isQuestion('a ile kosztuje zakwaterowanie?'), true],
  [E.faqLookup('a ile kosztuje zakwaterowanie').id, 1],
  [E.faqLookup('ile się zarabia na godzinę').id, 2],
  [E.faqLookup('czy rozmawiam z robotem').id, 8],
  [E.faqLookup('czy jest parking dla ciężarówek'), null],
  [E.parseIdentity('tak, przy telefonie').value, true],
  [E.parseIdentity('pomyłka').value, false],
  [E.parseIdentity('nie').status, 'relative'],
  [E.parseIdentity('nie, tu córka').status, 'relative'],
  [E.parseIdentity('nie, to córka, zaraz zawołam tatę').status, 'hold'],
  [E.parseIdentity('chwileczkę').status, 'hold'],
  [E.parseIdentity('nie ma go, jest w pracy').status, 'absent'],
  [E.parseIdentity('a w jakiej sprawie?').status, 'who'],
  [E.parseIdentity('halo?').status, 'unclear'],
  [E.detectIntent('proszę powtórzyć'), 'repeat'],
  [E.detectIntent('nie rozumiem pytania'), 'clarify'],
  [E.detectIntent('nie mam teraz czasu, jadę'), 'busy'],
  [E.detectIntent('chcę rozmawiać z człowiekiem'), 'human'],
  [E.detectIntent('proszę więcej do mnie nie dzwonić'), 'optout'],
  [E.detectIntent('już znalazłem pracę'), 'not_looking'],
  [E.detectIntent('chwileczkę'), 'wait'],
  [E.detectIntent('prowadzę wózek od trzech lat'), null],
  [E.detectIntent('od przyszłego tygodnia'), null],
  [E.parseOffer('nie, za daleko').reason, 'nie, za daleko'],
  [E.parseOffer('nie dziękuję').reason, null],
  [E.parseIdentity('a kto mówi?').status, 'who'],
  [E.parseOffer('muszę pogadać z żoną').value, 'no_decision'],
  [E.parseOffer('tak, chętnie').value, 'interested'],
  [E.parseOffer('nie, dziękuję').value, 'not_interested'],
];
extra.forEach(([g, e], i) => { const ok = JSON.stringify(g) === JSON.stringify(e); ok ? pass++ : fail++; if (!ok) console.log('FAIL extra', i, g, e); });
console.log(`${pass} passed, ${fail} failed`);
