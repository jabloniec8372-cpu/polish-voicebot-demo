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
  [E.parseIdentity('a kto mówi?').status, 'who'],
  [E.parseOffer('muszę pogadać z żoną').value, 'no_decision'],
  [E.parseOffer('tak, chętnie').value, 'interested'],
  [E.parseOffer('nie, dziękuję').value, 'not_interested'],
];
extra.forEach(([g, e], i) => { const ok = JSON.stringify(g) === JSON.stringify(e); ok ? pass++ : fail++; if (!ok) console.log('FAIL extra', i, g, e); });
console.log(`${pass} passed, ${fail} failed`);
