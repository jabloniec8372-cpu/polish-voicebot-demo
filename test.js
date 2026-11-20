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
  [E.detectIntent('skąd macie mój numer?'), 'source'],
  [E.detectIntent('dajcie mi spokój'), 'optout'],
  [E.detectIntent('spierdalaj'), 'abuse'],
  [E.isQuestion('nie wiem, zależy ile płacą'), true],
  [E.faqLookup('a ile brutto a ile netto?').id, 11],
  [E.faqLookup('to netto to ile?').id, 11],
  [E.faqLookup('a ile płacą na godzinę?').id, 2],
  [JSON.stringify(E.splitAnswerQuestion('po 2 października, aile mogę zarobić?')), JSON.stringify({answer:'po 2 października',question:'aile mogę zarobić?'})],
  [E.normalize('driving_licence','no mam dwójkę').pending.value.join(','), 'B,C'],
  [E.normalize('warehouse_experience','2 albo 3 jako komisioner ni ejako wózkowy').pending.value, '1-3 lata'],
  [E.faqLookup('nie wiem, zależy ile płacą').id, 2],
  [E.normalize('shift_work','tak, ale tylko bez nocnych').value, 'tylko dzienne'],
  [!!E.normalize('accommodation_needed','tak, ale tylko jak będzie pokój dwuosobowy').constraint, true],
  [E.offerObjection('za mało płacą'), 'SALARY'],
  [E.offerObjection('to za daleko'), 'LOCATION'],
  [E.offerObjection('mogę dopiero od lutego'), 'TIMING'],
  [E.faqLookup('jaki jest system zjazdów').id, 10],
  [E.normalize('start_date','mogę od 15-tego, ale najlepiej po Nowym Roku').preferred, '2027-01-04'],
  [E.normalize('start_date','Wie pan co, mam teraz dwutygodniowe wypowiedzenie w starej firmie, czyli do piątego grudnia, ale przed samymi świętami to już nie chcę jechać, najchętniej dopiero po Nowym Roku.').preferred, '2027-01-04'],
  [E.faqLookupAll('Czekaj pan, zanim odpowiem o to prawo jazdy – powiedz mi pan, czy mieszkanie jest za darmo i czy dajecie zaliczki po tygodniu?').map(f=>f.id).sort().join(','), '1,5'],
  [E.faqLookup('A czy tam na tej hali można zabrać ze sobą małego psa, bo nie mam go z kim zostawić?'), null],
  [E.detectIntent('A skąd wy w ogóle macie mój numer telefonu? Ja nigdzie nie dzwoniłem, proszę mnie natychmiast wykreślić z tej listy!'), 'optout'],
  [E.detectIntent('Panie, ja teraz na dach wchodzę, nie mam jak gadać, zadzwoń pan dzisiaj po osiemnastej albo jutro z rana.'), 'busy'],
  [E.offerObjection('Szesnaście euro brutto to trochę mało jak na wyjazd za granicę, w Polsce teraz mam prawie tyle samo na miejscu.'), 'SALARY'],
  [E.parseOffer('No oferta brzmi uczciwie, blisko granicy, ale muszę to wieczorem z żoną przegadać, bo mamy małe dziecko. Wyślij pan to na SMS-a.').value, 'no_decision'],
  [E.parseOffer('Nie, dziękuję, pod Monachium to dla mnie za daleko, ja szukam tylko czegoś przy samej granicy koło Berlina.').value, 'not_interested'],
  [E.offerObjection('Nie, dziękuję, pod Monachium to dla mnie za daleko, ja szukam tylko czegoś przy samej granicy koło Berlina.'), 'LOCATION'],
  [E.detectIntent('Na pewno nie teraz, na święta muszę być w domu, ale zaraz po drugim dniu świąt mogę wsiadać w busa.'), null],
  [E.parseIdentity('a kto mówi?').status, 'who'],
  [E.parseOffer('muszę pogadać z żoną').value, 'no_decision'],
  [E.parseOffer('tak, chętnie').value, 'interested'],
  [E.parseOffer('nie, dziękuję').value, 'not_interested'],
];
extra.forEach(([g, e], i) => { const ok = JSON.stringify(g) === JSON.stringify(e); ok ? pass++ : fail++; if (!ok) console.log('FAIL extra', i, g, e); });
console.log(`${pass} passed, ${fail} failed`);
