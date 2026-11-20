// Polish answer normalizer + FAQ matcher for the recruitment voicebot demo.
// Pure functions, no dependencies. Works in the browser and in Node (tests).
(function (root) {
  'use strict';

  // ---------- text helpers ----------
  function deaccent(s) {
    return String(s || '')
      .replace(/ł/g, 'l').replace(/Ł/g, 'L')
      .normalize('NFD').replace(/[̀-ͯ]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9+.\/\- ]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }
  function has(t, re) { return re.test(t); }

  var NUM_WORDS = {
    'jeden': 1, 'jedna': 1, 'jednego': 1, 'jedno': 1, 'dwa': 2, 'dwie': 2, 'dwoch': 2, 'trzy': 3, 'trzech': 3,
    'cztery': 4, 'czterech': 4, 'piec': 5, 'pieciu': 5, 'szesc': 6, 'siedem': 7, 'osiem': 8, 'dziewiec': 9,
    'dziesiec': 10, 'jedenascie': 11, 'dwanascie': 12, 'poltora': 1.5, 'pol': 0.5
  };
  function numberBefore(t, unitRe) {
    // finds "<number> <unit>" where number is digits or a Polish number word
    var re = new RegExp('(\\d+(?:[.,]\\d+)?|' + Object.keys(NUM_WORDS).join('|') + ')\\s+(?:' + unitRe + ')', 'g');
    var m, best = null;
    while ((m = re.exec(t))) {
      var raw = m[1].replace(',', '.');
      best = isNaN(parseFloat(raw)) ? NUM_WORDS[raw] : parseFloat(raw);
    }
    return best;
  }

  // ---------- dates ----------
  var MONTHS = [
    [/\bstycz\w*/, 1], [/\blut\w*/, 2], [/\bmar(ca|zec|cu)\b/, 3], [/\bkwie\w*/, 4], [/\bmaj(a|u)?\b/, 5],
    [/\bczerw\w*/, 6], [/\blip(iec|ca|cu)\b/, 7], [/\bsierp\w*/, 8], [/\bwrze(sien|snia|sniu)\b/, 9],
    [/\bpazdziernik\w*/, 10], [/\blistopad\w*/, 11], [/\bgrud\w*/, 12]
  ];
  var MONTH_GEN = ['', 'stycznia', 'lutego', 'marca', 'kwietnia', 'maja', 'czerwca', 'lipca', 'sierpnia', 'września', 'października', 'listopada', 'grudnia'];
  var ORD_STEMS = [
    ['trzydziest', 30], ['dwudziest', 20], ['dziewietnast', 19], ['osiemnast', 18], ['siedemnast', 17],
    ['szesnast', 16], ['pietnast', 15], ['czternast', 14], ['trzynast', 13], ['dwunast', 12], ['jedenast', 11],
    ['dziesiat', 10], ['dziewiat', 9], ['osm', 8], ['siodm', 7], ['szost', 6], ['piat', 5], ['czwart', 4],
    ['trzec', 3], ['drug', 2], ['pierwsz', 1]
  ];
  var ORD_GEN = ['', 'pierwszego', 'drugiego', 'trzeciego', 'czwartego', 'piątego', 'szóstego', 'siódmego', 'ósmego',
    'dziewiątego', 'dziesiątego', 'jedenastego', 'dwunastego', 'trzynastego', 'czternastego', 'piętnastego',
    'szesnastego', 'siedemnastego', 'osiemnastego', 'dziewiętnastego', 'dwudziestego'];
  function ordinalSpoken(d) {
    if (d <= 20) return ORD_GEN[d];
    if (d < 30) return 'dwudziestego ' + ORD_GEN[d - 20];
    return d === 30 ? 'trzydziestego' : 'trzydziestego pierwszego';
  }
  function ordinalValue(word) {
    for (var i = 0; i < ORD_STEMS.length; i++) if (word.indexOf(ORD_STEMS[i][0]) === 0) return ORD_STEMS[i][1];
    return null;
  }
  function dayFromWords(t) {
    // "dwudziestego piatego" -> 25 ; "pietnastego" -> 15 ; "1" -> 1
    var words = t.split(' ');
    for (var i = 0; i < words.length; i++) {
      var v = ordinalValue(words[i]);
      if (v !== null) {
        if ((v === 20 || v === 30) && words[i + 1]) {
          var u = ordinalValue(words[i + 1]);
          if (u !== null && u < 10) return v + u;
        }
        return v;
      }
    }
    return null;
  }
  function mk(y, m, d) { return new Date(Date.UTC(y, m - 1, d)); }
  function addDays(dt, n) { return new Date(dt.getTime() + n * 86400000); }
  function iso(dt) { return dt.toISOString().slice(0, 10); }
  function lastDay(y, m) { return new Date(Date.UTC(y, m, 0)).getUTCDate(); }
  function nextMonthStart(today, n) {
    var y = today.getUTCFullYear(), m = today.getUTCMonth() + 1 + (n || 1);
    while (m > 12) { m -= 12; y++; }
    return mk(y, m, 1);
  }
  function upcoming(today, m, d) {
    var y = today.getUTCFullYear();
    var dt = mk(y, m, Math.min(d, lastDay(y, m)));
    if (dt < today) dt = mk(y + 1, m, Math.min(d, lastDay(y + 1, m)));
    return dt;
  }
  var WEEKDAYS = [[/\bpon\w*/, 1], [/\bwtor\w*/, 2], [/\bsrod\w*/, 3], [/\bczwart\w*/, 4], [/\bpiat\w*/, 5], [/\bsobot\w*/, 6], [/\bniedziel\w*/, 0]];
  function nextWeekday(today, wd) {
    var diff = (wd - today.getUTCDay() + 7) % 7;
    return addDays(today, diff === 0 ? 7 : diff);
  }
  function dateResult(dt, how) {
    var d = dt.getUTCDate(), m = dt.getUTCMonth() + 1, y = dt.getUTCFullYear();
    return { status: 'ok', value: iso(dt), display: d + ' ' + MONTH_GEN[m] + ' ' + y,
      spoken: how === 'od zaraz' ? 'od zaraz' : how === 'od jutra' ? 'od jutra' : ordinalSpoken(d) + ' ' + MONTH_GEN[m], how: how };
  }
  function parseStartDate(t, today) {
    if (has(t, /\bpo (trzech|3) krol\w*/)) return dateResult(upcoming(today, 1, 7), 'po Trzech Królach');
    if (has(t, /\bpo swietach\b/)) return dateResult(upcoming(today, 12, 27), 'po świętach');
    if (has(t, /\b(przyszl\w*|nastepn\w*) (tydz\w*|tygod\w*)/)) return dateResult(nextWeekday(today, 1), 'przyszły tydzień');
    if (has(t, /\bw ciagu tygodnia\b/)) return dateResult(addDays(today, 7), 'w ciągu tygodnia');
    if (has(t, /\b(od zaraz|od razu|od dzis\w*|natychmiast|w kazdej chwili|teraz|najszybciej|jak najszybciej|asap|choc\w* dzis|jak tylko sie da|kiedy (pani|pan) chce|kiedy trzeba|w kazdej chwili)\b/)) return dateResult(today, 'od zaraz');
    var SEASONS = [[/\b(wiosn\w*)\b/, 3], [/\b(lato|latem|w lecie|lata)\b/, 6], [/\b(jesien\w*)\b/, 9]];
    for (var si = 0; si < SEASONS.length; si++) if (SEASONS[si][0].test(t) && !has(t, /\blat\b|\b\d+ lata\b/)) return dateResult(upcoming(today, SEASONS[si][1], 1), 'pora roku');
    if (has(t, /\bpojutrze\b/)) return dateResult(addDays(today, 2), 'pojutrze');
    if (has(t, /\bjutr\w*/)) return dateResult(addDays(today, 1), 'od jutra');
    if (has(t, /\b(nowego roku|nowym roku)\b/)) return dateResult(upcoming(today, 1, has(t, /\bpo\b/) ? 2 : 1), 'nowy rok');
    var weeks = numberBefore(t, 'tygodni\\w*|tygodnie');
    if (has(t, /\bza tydzien\b/)) weeks = 1;
    if (weeks && has(t, /\bza\b/)) return dateResult(addDays(today, Math.round(weeks * 7)), 'za ' + weeks + ' tyg.');
    // explicit numeric date 15.12 / 15/12/2026
    var nd = t.match(/\b(\d{1,2})[.\/-](\d{1,2})(?:[.\/-](\d{2,4}))?\b/);
    if (nd) {
      var dd = +nd[1], mm = +nd[2];
      if (mm >= 1 && mm <= 12 && dd >= 1 && dd <= 31) {
        if (nd[3]) { var yy = +nd[3]; if (yy < 100) yy += 2000; return dateResult(mk(yy, mm, dd), 'data'); }
        return dateResult(upcoming(today, mm, dd), 'data');
      }
    }
    var sp = t.match(/\b(\d{1,2}) (\d{1,2})\b/);
    if (sp && +sp[2] >= 1 && +sp[2] <= 12 && +sp[1] >= 1 && +sp[1] <= 31 && !has(t, /tydz|tygod|miesiac|lat/)) return dateResult(upcoming(today, +sp[2], +sp[1]), 'data');
    var month = null;
    for (var i = 0; i < MONTHS.length; i++) if (MONTHS[i][0].test(t)) { month = MONTHS[i][1]; break; }
    var relMonth = has(t, /\b(przyszl\w*|nastepn\w*|nowego) miesiac\w*|\bza miesiac\b/);
    var monthsAhead = numberBefore(t, 'miesiac\\w*|miesiecy');
    if (month || relMonth || (monthsAhead && has(t, /\bza\b/))) {
      var base;
      if (month) base = upcoming(today, month, 1);
      else if (relMonth) base = nextMonthStart(today, 1);
      else return dateResult(addDays(today, Math.round(monthsAhead * 30.4)), 'za ' + monthsAhead + ' mies.');
      var by = base.getUTCFullYear(), bm = base.getUTCMonth() + 1;
      if (has(t, /\bpolow\w*/)) return dateResult(mk(by, bm, 15), 'połowa miesiąca');
      if (has(t, /\b(koniec|konca|koncem|koncowk\w*)\b/)) return dateResult(mk(by, bm, lastDay(by, bm)), 'koniec miesiąca');
      var day = null, dm = t.match(/\b(\d{1,2})\b/);
      if (dm) day = +dm[1]; else day = dayFromWords(t);
      if (day && month) return dateResult(upcoming(today, month, day), 'dzień + miesiąc');
      if (has(t, /\bza miesiac\b/)) return dateResult(addDays(today, 30), 'za miesiąc');
      return dateResult(base, month ? 'początek miesiąca' : 'od przyszłego miesiąca');
    }
    for (var w = 0; w < WEEKDAYS.length; w++) if (WEEKDAYS[w][0].test(t)) return dateResult(nextWeekday(today, WEEKDAYS[w][1]), 'dzień tygodnia');
    // day only: "od pierwszego", "od 15", "od dziesiatego" -> next such day
    var dOnly = null, dn = t.match(/^(od )?(\d{1,2})(-go|go)?$/);
    if (dn) dOnly = +dn[2]; else if (/^(od )?\w+$/.test(t) || /^od \w+( \w+)?$/.test(t)) dOnly = dayFromWords(t);
    if (dOnly && dOnly <= 31) {
      var cy = today.getUTCFullYear(), cm = today.getUTCMonth() + 1;
      var cand = mk(cy, cm, Math.min(dOnly, lastDay(cy, cm)));
      if (cand < today) { cm++; if (cm > 12) { cm = 1; cy++; } cand = mk(cy, cm, Math.min(dOnly, lastDay(cy, cm))); }
      return dateResult(cand, 'sam dzień');
    }
    return { status: 'unclear' };
  }

  // ---------- yes / no ----------
  function yesNo(t) {
    if (has(t, /\b(chyba|raczej|w sumie) tak\b|\bmoze byc\b|\bwszystko (mi )?jedno\b|\bbez roznicy\b|\bobojetnie\b/)) return true;
    if (has(t, /\b(chyba|raczej) nie\b/)) return false;
    if (has(t, /\b(nie wiem|nie jestem pewn\w*|zalezy|moze|trudno powiedziec|zastanowie sie|nie pamietam)\b/)) return null;
    if (has(t, /\b(nie ma problemu|czemu nie|no pewnie|jak najbardziej|nie ma sprawy|nie widze problemu|no jasne|a jakze|tak jest|pewka|ano)\b/)) return true;
    if (has(t, /\b(nie bardzo|nie za bardzo|niezbyt|nope|ni)\b/)) return false;
    if (has(t, /\b(nie|niestety|nigdy|w zadnym|brak|zadnego|zadnej)\b/)) return false;
    if (has(t, /\b(tak|jasne|oczywiscie|pewnie|zgadza sie|mhm|aha|no|ok|okej|dobrze|mam|moge|chetnie|zgoda|jestem|potrzebuje|owszem|jasna sprawa)\b/)) return true;
    return null;
  }
  function yn(t, yesVal, noVal) {
    var r = yesNo(t);
    if (r === null) return { status: 'unclear' };
    return r ? { status: 'ok', value: yesVal || 'tak', display: yesVal || 'tak' } : { status: 'ok', value: noVal || 'nie', display: noVal || 'nie' };
  }

  // ---------- field parsers ----------
  var LICENCE_ORDER = ['B', 'B+E', 'C1', 'C', 'C+E', 'D', 'T'];
  function parseLicence(t, original) {
    if (has(t, /\b(nie mam|brak|zadnego|nie posiadam)\b/) && !has(t, /\b(b|c|d|be|ce|de)\b/)) return { status: 'ok', value: [], display: 'brak' };
    t = t.replace(/\b(ale |a )?(chce|planuje|bede|zamierzam|moge) (zrobic|robic|zdawac)\b.*$|\b(robie|zdaje|w trakcie|na kursie|kurs na)\b.*$/, ' ').replace(/\b(fuhrerschein|fuehrerschein|klasse|kategori\w*|kat)\b/g, ' ');
    var s = ' ' + t + ' ';
    if (/\bCE\b/.test(original || '')) s = s.replace(/\bce\b/g, ' c+e ');
    if (/\bBE\b/.test(original || '')) s = s.replace(/\bbe\b/g, ' b+e ');
    s = s.replace(/\btir\w*/g, ' c+e ').replace(/\bosobow\w*/g, ' b ').replace(/\bna ciezarow\w*/g, ' c ')
      .replace(/\b(ce|c)\s*(plus|\+)\s*e\b|\bc\s+e\b/g, ' c+e ')
      .replace(/\b(be|b)\s*(plus|\+)\s*e\b/g, ' b+e ')
      .replace(/\b(ce|c) jeden\b|\bc 1\b/g, ' c1 ')
      .replace(/\bbe\b/g, ' b ').replace(/\bde\b/g, ' d ').replace(/\bce\b/g, ' c ');
    var found = {};
    var re = /(?:^|\s)(b\+e|c\+e|c1|b|c|d|t)(?=\s|$|,)/g, m;
    while ((m = re.exec(s))) found[m[1].toUpperCase()] = true;
    var list = LICENCE_ORDER.filter(function (k) { return found[k]; });
    if (!list.length) return { status: 'unclear', reprompt: has(t, /\b(mam|tak|prawo jazdy|prawko)\b/) ? 'A jakie to kategorie? Na przykład B albo C plus E.' : undefined };
    return { status: 'ok', value: list, display: list.join(', '), spoken: list.join(', ').replace(/\+/g, ' plus ') };
  }

  var GERMAN = ['brak', 'podstawowy (A1-A2)', 'komunikatywny (B1)', 'dobry (B2)', 'biegły (C1-C2)'];
  function parseGerman(t) {
    var cefr = t.match(/\b([abc])\s?([12])\b/);
    if (cefr) {
      var k = cefr[1] + cefr[2];
      var map = { a1: 1, a2: 1, b1: 2, b2: 3, c1: 4, c2: 4 };
      return lvl(map[k]);
    }
    if (has(t, /\b(nie znam|nie mowie|wcale|zero|ani slowa|nic|nie umiem)\b/) && !has(t, /\btroche|podstaw|kilka/)) return lvl(0);
    if (has(t, /\b(nein|kein\w*)\b/)) return lvl(0);
    if (has(t, /\b(biegl\w*|plynn\w*|perfekt\w*|jak niemiec|ojczyst\w*|bardzo dobr\w*|dwujezyczn\w*|sehr gut|fliessend)\b/)) return lvl(4);
    if (has(t, /\b(niezbyt|nie za dobr\w*|slab\w*|troche|podstaw\w*|kilka slow|pare slow|basic|jako tako|bisschen|ein wenig|wenig)\b/)) return lvl(1);
    if (has(t, /\b(komunikatywn\w*|kommunikativ\w*|dogadam sie|dogaduje sie|sredni\w*|dam rade|jakos|w miare|geht so)\b/)) return lvl(2);
    if (has(t, /\b(dobr\w*|dobrze|gut)\b/)) return lvl(3);
    return { status: 'unclear' };
    function lvl(i) { return { status: 'ok', value: GERMAN[i], display: GERMAN[i], spoken: GERMAN[i].replace(/\s*\(.*\)/, '') }; }
  }

  function parseForklift(t) {
    if (has(t, /\bstapler\w*/)) return { status: 'ok', value: 'Staplerschein (DE)', display: 'Staplerschein (DE)', spoken: 'niemiecki Staplerschein' };
    t = t.replace(/\./g, ' ').replace(/\s+/g, ' ').trim();
    if (has(t, /\b(paleciak\w*|reczn\w* wozek|wozek reczny|paleciarz\w*)\b/) && !has(t, /wjo|udt/)) return { status: 'ok', value: 'brak', display: 'brak (tylko wózek ręczny)' };
    var mentions = has(t, /\b(wjo|udt|wozek|wozki|wozka|widlak\w*|widlow\w*|uprawnien\w*|kategori\w*)\b/) || has(t, /\d\s*wjo/);
    if (has(t, /\b(nie mam|brak|nie posiadam|nie)\b/) && !has(t, /wjo/)) return { status: 'ok', value: 'brak', display: 'brak' };
    if (has(t, /\b(wysokiego skladowania|wysokiego skladu|reach\w*|wysiegnik\w*|teleskop\w*)\b/)) return { status: 'ok', value: 'I WJO', display: 'I WJO', spoken: 'pierwsza kategoria WJO' };
    t = t.replace(/\bdwojecz\w*/g, 'dwojka').replace(/\bjedyneczk\w*/g, 'jedynka');
    var cat = null;
    var m = t.match(/\b(i{1,3}|[123]|jeden|jedynk\w*|pierwsz\w*|dwa|dwojk\w*|drug\w*|trzy|trojk\w*|trzec\w*)\s*(?:kat\w*\s*)?wjo\b/) ||
            t.match(/wjo\s*(?:kat\w*\s*)?(i{1,3}|[123])\b/) || t.match(/\b([123])wjo\b/) ||
            (mentions && t.match(/\bkat\w*\s*(i{1,3}|[123]|pierwsz\w*|drug\w*)\b/));
    if (!m) m = t.match(/^(?:mam |tak )?(i|ii|1|2|jedynk\w*|dwojk\w*|pierwsz\w*|drug\w*)(?: kategori\w*)?$/) || (mentions && t.match(/\b(ii|i|[12])$/));
    if (m) {
      var w = m[1];
      if (/^(iii|3|trzy|troj|trzec)/.test(w)) cat = null;
      else if (/^(ii|2|dwa|dwoj|drug)/.test(w)) cat = 'II WJO';
      else if (/^(i|1|jeden|jedyn|pierwsz)/.test(w)) cat = 'I WJO';
    }
    if (cat) return { status: 'ok', value: cat, display: cat, spoken: (cat === 'I WJO' ? 'pierwsza' : 'druga') + ' kategoria WJO' };
    if (mentions || has(t, /\b(tak|mam)\b/)) return { status: 'unclear', reprompt: 'Jaka to kategoria UDT: pierwsza czy druga WJO?' };
    return { status: 'unclear' };
  }

  var EXP = ['brak', 'do 1 roku', '1-3 lata', 'powyżej 3 lat'];
  function parseExperience(t) {
    if (has(t, /\b(nie mam|brak|nigdy|zadnego|nie pracowal\w*)\b/) || /^nie\b/.test(t)) return e(0);
    if (has(t, /\bkilkanascie|kilkadziesiat|dwadziescia|pietnascie\b/)) return e(3);
    if (has(t, /^(jeden |przez )?miesiac$|^(jakis |okolo )?miesiac\b/)) return e(1);
    if (has(t, /\bkilka lat\b|\bpare lat\b|\bwiele lat\b|\bduzo\b/)) {
      if (has(t, /\bwiele lat|\bduzo\b/)) return e(3);
      return { status: 'unclear', reprompt: 'A ile to mniej więcej lat?' };
    }
    var since = t.match(/\bod (19\d\d|20\d\d)\b/);
    if (since) { var yrs = new Date().getUTCFullYear() - (+since[1]); return yrs < 1 ? e(1) : yrs <= 3 ? e(2) : e(3); }
    if (has(t, /\b(cale zycie|od zawsze|od lat|dlugie lata|wieki)\b/)) return e(3);
    var months = numberBefore(t, 'miesiac\\w*|miesiecy|miesiace');
    var years = numberBefore(t, 'lat\\w*|rok\\w*|lata');
    if (years === null && has(t, /\bpol roku\b/)) years = 0.5;
    if (years === null && has(t, /\b(rok|roku)\b/)) years = 1;
    if (years === null && months === null && has(t, /\b(kilka|pare) miesiec\w*/)) months = 3;
    if (years === null && months !== null) years = months / 12;
    if (years !== null && has(t, /\b(prawie|niecaly|niecale|nie cale)\b/)) years -= 0.1;
    if (years === null) return { status: 'unclear', reprompt: has(t, /\b(tak|troche|mam)\b/) ? 'A ile to mniej więcej lat lub miesięcy?' : undefined };
    if (years < 1) return e(1);
    if (years <= 3) return e(2);
    return e(3);
    function e(i) { return { status: 'ok', value: EXP[i], display: EXP[i] }; }
  }

  function parseShift(t) {
    if (has(t, /\b(tylko|wylacznie) (na )?(dzien|dzienn\w*|rano|ranne|popoludni\w*)|\bbez noc\w*|\bnoce nie\b|\bnocki nie\b|\bnie na noc\w*|\b(wole|wolal\w*|najlepiej|preferuje) (na )?(dzien|dzienn\w*|rano|ranne)/)) return { status: 'ok', value: 'tylko dzienne', display: 'tylko zmiany dzienne' };
    var r = yn(t, 'tak (także noce)', 'nie');
    if (r.status === 'ok' && r.value !== 'nie') r.spoken = 'tak, także nocne zmiany';
    return r;
  }
  function parseAccommodation(t) {
    if (has(t, /\bmam (gdzie|swoje|wlasne|mieszkanie)\b|\bu (rodziny|znajomych|brata|siostry|kolegi)\b|\bmieszkam w niemczech\b/)) return { status: 'ok', value: 'nie', display: 'nie (ma własne)' };
    if (has(t, /\b(przydal\w*|poprosze|bylo by dobrze|byloby dobrze)\b/)) return { status: 'ok', value: 'tak', display: 'tak' };
    return yn(t, 'tak', 'nie');
  }
  function parseDocuments(t) {
    if (has(t, /\b(nie mam ani|ani dowodu|stracil\w*|zgubil\w*|niewazn\w*|nie wazn\w*|skonczyl\w*|wygasl\w*|przeterminowan\w*)\b/)) return { status: 'ok', value: 'nie', display: 'nie' };
    if (has(t, /\bmam (tez |ale |za to )?(wazny )?(paszport|dowod)\w*|\b(paszport|dowod)\w* (tez )?mam\b/) && !has(t, /\bnie mam (ani )?(paszport|dowod)\w*.*\bani\b/)) return { status: 'ok', value: 'tak', display: 'tak' };
    if (has(t, /\btylko (prawo jazdy|prawko)\b/)) return { status: 'ok', value: 'nie', display: 'nie (tylko prawo jazdy)' };
    if (has(t, /\b(dowod|paszport)\w*/) && !has(t, /\bnie mam\b/)) return { status: 'ok', value: 'tak', display: 'tak' };
    return yn(t);
  }
  var REGIONS = [
    [/\bberlin\w*/, 'Berlin'], [/\b(bawari\w*|monachi\w*|norymberg\w*|augsburg\w*)/, 'Bayern'],
    [/\b(saksoni\w*|lipsk\w*|drezn\w*|chemnitz)/, 'Sachsen'], [/\bhamburg\w*/, 'Hamburg'], [/\bbrem\w*/, 'Bremen'],
    [/\b(dolna saksoni\w*|hanower\w*)/, 'Niedersachsen'], [/\b(nadreni\w*|kolonii|kolonia|dusseldorf\w*|dortmund\w*|essen|zaglebi\w* ruhr)/, 'Nordrhein-Westfalen'],
    [/\b(hesj\w*|frankfurt\w*)/, 'Hessen'], [/\b(badeni\w*|stuttgart\w*)/, 'Baden-Württemberg'], [/\b(brandenburgi\w*|poczdam\w*)/, 'Brandenburg'],
    [/\b(meklemburgi\w*|rostock\w*)/, 'Mecklenburg-Vorpommern'], [/\b(turyngi\w*|erfurt\w*)/, 'Thüringen']
  ];
  function parseRegion(t) {
    if (has(t, /\b(obojetnie|wszystko jedno|gdziekolwiek|dowolny|dowolnie|bez znaczenia|nie ma znaczenia|gdzie bedzie praca|gdzie jest praca|cale niemcy|wszedzie|wszystko jedno)\b/)) return { status: 'ok', value: ['dowolny'], display: 'dowolny region' };
    var out = [];
    REGIONS.forEach(function (r) { if (r[0].test(t) && out.indexOf(r[1]) < 0) out.push(r[1]); });
    if (has(t, /\bdolna saksoni/)) out = out.filter(function (x) { return x !== 'Sachsen'; });
    var DIRS = [[/\bzachod\w*/, ['Nordrhein-Westfalen', 'Hessen']], [/\bpoludni\w*/, ['Bayern', 'Baden-Württemberg']],
      [/\bpolnoc\w*/, ['Hamburg', 'Bremen', 'Niedersachsen']], [/\bwschod\w*/, ['Berlin', 'Brandenburg', 'Sachsen']]];
    DIRS.forEach(function (d) { if (d[0].test(t)) d[1].forEach(function (x) { if (out.indexOf(x) < 0) out.push(x); }); });
    if (has(t, /\bblisko (polski|granicy)|\bprzy granicy/)) { ['Brandenburg', 'Sachsen', 'Mecklenburg-Vorpommern'].forEach(function (x) { if (out.indexOf(x) < 0) out.push(x); }); }
    if (!out.length) return { status: 'unclear' };
    return { status: 'ok', value: out, display: out.join(', ') };
  }
  var DUR = ['do 3 miesięcy', '3-6 miesięcy', 'powyżej 6 miesięcy', 'na stałe'];
  function parseDuration(t) {
    if (has(t, /\b(na stale|na zawsze|na dobre|zostac na stale|przeprowadz\w*)\b/)) return d(3);
    if ((has(t, /\b(na )?dluzej\b|\bdlugo\b|\bile sie da\b|\bjak najdluzej\b/)) && !has(t, /\d|miesiac|rok/)) return d(2);
    if (has(t, /\bpol roku\b/)) return d(1);
    if (has(t, /\bdo (konca )?\w+/)) {
      for (var mi = 0; mi < MONTHS.length; mi++) if (MONTHS[mi][0].test(t)) {
        var now = new Date(), diff = (MONTHS[mi][1] - (now.getUTCMonth() + 1) + 12) % 12 || 12;
        return diff <= 3 ? d(0) : diff <= 6 ? d(1) : d(2);
      }
    }
    var months = numberBefore(t, 'miesiac\\w*|miesiecy|miesiace');
    var years = numberBefore(t, 'lat\\w*|rok\\w*|lata');
    if (years === null && has(t, /\b(rok|roku)\b/)) years = 1;
    if (years !== null) months = years * 12;
    if (months === null) {
      if (has(t, /\b(sezon\w*|na lato|wakacj\w*|kilka tygodni)\b/)) return d(0);
      if (has(t, /\b(kilka|pare) miesiec\w*/)) return { status: 'unclear', reprompt: 'Ile mniej więcej miesięcy?' };
      return { status: 'unclear' };
    }
    if (months <= 3) return d(0);
    if (months <= 6) return d(1);
    return d(2);
    function d(i) { return { status: 'ok', value: DUR[i], display: DUR[i] }; }
  }

  // ---------- identity & offer ----------
  function parseIdentity(t) {
    // statuses: who | hold | absent | relative | ok(true/false) | unclear
    if (has(t, /\b(zawolam|juz wolam|wolam|juz daje|daje (go|ja|tate|mame|meza|zone)|przekaze telefon|chwil\w*|moment\w*|sekund\w*|prosze (poczekac|zaczekac)|niech (pani|pan) poczeka|juz idzie|juz przychodzi|zaraz (przyjdzie|bedzie|podejdzie))\b/)) return { status: 'hold' };
    if (has(t, /\bnie ma (go|jej|taty|mamy|meza|zony)\b|\b(jest|jestem) w pracy\b|\b(wyszedl|wyszla|wyjechal\w*|spi|zajety|zajeta|nie moze rozmawiac|nie moze teraz)\b|\bprosze zadzwonic (pozniej|wieczorem|jutro)\b|\bza (godzine|pol godziny|chwile nie)\b/)) return { status: 'absent' };
    if (has(t, /\b(kto mowi|kto dzwoni|kto tam|o co chodzi|w jakiej sprawie|skad (pani|pan)? ?dzwoni\w*|co to za)\b/)) return { status: 'who' };
    if (has(t, /\b(pomylk\w*|zly numer|nie znam|nie mieszka|nikt taki|nie ma tu takiego|nie ma tu takiej)\b/)) return { status: 'ok', value: false };
    if (has(t, /\b(corka|corki|syn|syna|zona|zony|maz|meza|mama|matka|tata|ojciec|brat|siostra|zon\w*|mez\w*)\b/)) return { status: 'relative' };
    if (has(t, /\b(to ja|przy telefonie|slucham|we wlasnej osobie|zgadza sie|tak)\b/)) return { status: 'ok', value: true };
    if (has(t, /^(halo|hallo|tak halo|dzien dobry|halo halo)$/)) return { status: 'unclear' };
    var r = yesNo(t);
    if (r === false) return { status: 'relative' };   // a bare "nie": ask if the person is around, never hang up on it
    return r === null ? { status: 'unclear' } : { status: 'ok', value: r };
  }
  var text0 = '';
  function parseOffer(t) {
    if (has(t, /\b(zastanow\w*|pomysl\w*|oddzwonie|musze (zapytac|pogadac|porozmawiac|sprawdzic)|nie wiem|nie jestem pewn\w*|zalezy|moze|dam znac|przemysl\w*)\b/))
      return { status: 'ok', value: 'no_decision', display: 'brak decyzji' };
    if (has(t, /\b(nie interesuje|nie jestem zainteresowan\w*|nie dziekuje|raczej nie|nie chce|nie pasuje|nie)\b/) && !has(t, /\bnie ma problemu\b/))
      return { status: 'ok', value: 'not_interested', display: 'niezainteresowany',
        reason: (t.replace(/\b(nie|dziekuje|dzieki|raczej|nie jestem zainteresowan\w*|nie interesuje mnie|nie chce|to)\b/g, ' ').replace(/[^a-z ]/g, ' ').trim().length > 3) ? text0 : null };
    if (yesNo(t) === true || has(t, /\b(interesuje|zainteresowan\w*|wchodze|biore|chetnie|super|swietnie|brzmi dobrze|pasuje mi|jestem za|dawaj\w*|wchodze w to)\b/))
      return { status: 'ok', value: 'interested', display: 'zainteresowany' };
    return { status: 'unclear' };
  }

  // ---------- FAQ (module B) ----------
  var FAQ = [
    { id: 1, topic: 'Zakwaterowanie', keys: ['zakwaterowan', 'mieszkani', 'pokoj', 'nocleg', 'kwater', 'gdzie bede mieszkac', 'gdzie sie mieszka'],
      answer: 'Zakwaterowanie zapewnia agencja, w pokojach dwuosobowych. Koszt to 280 euro miesięcznie i jest potrącany z wypłaty.' },
    { id: 2, topic: 'Stawki', keys: ['stawk', 'zarob', 'ile plac', 'placa', 'placicie', 'placi sie', 'kasa', 'ile dostane', 'ile sie zarabia', 'pensj', 'wynagrodz', 'na reke', 'brutto', 'netto', 'za godzine'],
      answer: 'Stawki zależą od oferty. Zwykle jest to od 14 do 17 euro brutto za godzinę, plus dodatki za nadgodziny i nocki.' },
    { id: 3, topic: 'Dojazd', keys: ['dojazd', 'dojech', 'transport', 'bus', 'podroz', 'bilet', 'jak sie dostan', 'przejazd'],
      answer: 'Na pierwszy wyjazd organizujemy busa z Polski. Koszt przejazdu zwracamy po trzech miesiącach pracy.' },
    { id: 4, topic: 'Umowa', keys: ['umow', 'kontrakt', 'ubezpiecz', 'emerytaln', 'na czarno', 'legaln'],
      answer: 'Umowa jest niemiecka, z niemieckim ubezpieczeniem zdrowotnym i emerytalnym.' },
    { id: 5, topic: 'Wypłata', keys: ['wyplat', 'kiedy pieniadze', 'kiedy kasa', 'zaliczk', 'przelew', 'kiedy placa'],
      answer: 'Wypłata jest raz w miesiącu, do piętnastego dnia następnego miesiąca. Po pierwszym tygodniu można dostać zaliczkę.' },
    { id: 6, topic: 'Język', keys: ['czy musze znac', 'czy trzeba znac', 'bez niemieckiego', 'bez jezyka', 'koordynator', 'po polsku na miejscu'],
      answer: 'W wielu ofertach niemiecki nie jest wymagany. Na miejscu jest koordynator, który mówi po polsku.' },
    { id: 7, topic: 'Odzież robocza', keys: ['odziez', 'ubrani', 'buty', 'kask', 'roboczy', 'robocze'],
      answer: 'Odzież roboczą i buty ochronne zapewnia pracodawca.' },
    { id: 9, topic: 'Czas pracy', keys: ['ile godzin', 'godzin dziennie', 'czas pracy', 'soboty', 'sobota', 'nadgodzin', 'grafik'],
      answer: 'Zwykle pracuje się osiem godzin dziennie, od poniedziałku do piątku. Soboty i nadgodziny są dodatkowo płatne.' },
    { id: 8, topic: 'Kto dzwoni', keys: ['robot', 'bot', 'automat', 'czlowiek', 'sztuczn', 'z kim rozmawiam', 'nagrywan'],
      answer: 'Jestem asystentką głosową AI, nie człowiekiem. Jeśli woli {P} rozmawiać z człowiekiem, konsultant może oddzwonić.' }
  ];
  function isQuestion(original, t) {
    if (/\?/.test(original)) return true;
    return has(t, /^(a )?(ile|czy|jak|gdzie|kiedy|kto|co z|a co|jaki|jaka|jakie|dlaczego|po co|skad)\b/);
  }
  function faqLookup(t) {
    var best = null, bestScore = 0;
    FAQ.forEach(function (f) {
      var s = 0;
      f.keys.forEach(function (k) { if (t.indexOf(k) >= 0) s += k.length; });
      if (s > bestScore) { best = f; bestScore = s; }
    });
    return best;
  }

  // ---------- question catalogue (module A) ----------
  var QUESTIONS = [
    { id: 'start_date', label: 'Start date', ask: 'Od kiedy może {P} zacząć pracę w Niemczech?', parse: parseStartDate,
      reprompt: 'Proszę podać przybliżony termin, na przykład od zaraz, od przyszłego miesiąca albo konkretną datę.',
      explain: 'Chodzi o to, od którego dnia może {P} zacząć pracę. Wystarczy przybliżony termin.', allowed: 'ISO date', examples: ['od przyszłego miesiąca', 'po świętach', 'od piętnastego stycznia', 'za dwa tygodnie'] },
    { id: 'driving_licence', label: 'Driving licence', ask: 'Jakie kategorie prawa jazdy ma {P}?', parse: parseLicence,
      reprompt: 'Proszę podać kategorie, na przykład B albo C plus E.', allowed: 'brak | B | B+E | C1 | C | C+E | D | T',
      examples: ['B i C+E', 'jeżdżę na tira', 'be i ce', 'nie mam prawka'] },
    { id: 'german_level', label: 'German level', ask: 'Jak ocenia {P} swoją znajomość języka niemieckiego?', parse: parseGerman,
      reprompt: 'Czy to raczej podstawy, poziom komunikatywny, czy dobry?', allowed: GERMAN.join(' | '),
      examples: ['dogadam się', 'mam B1', 'trochę, kilka słów', 'wcale'] },
    { id: 'forklift_licence', label: 'Forklift licence (UDT)', ask: 'Czy ma {P} uprawnienia na wózki widłowe, na przykład UDT?', parse: parseForklift,
      reprompt: 'Czy ma {P} uprawnienia UDT pierwszej lub drugiej kategorii WJO?', allowed: 'brak | I WJO | II WJO | Staplerschein (DE)',
      explain: 'Chodzi o uprawnienia z Urzędu Dozoru Technicznego na wózki widłowe, czyli kategorię pierwszą albo drugą WJO. Czy ma {P} takie uprawnienia?',
      examples: ['2 WJO', 'mam UDT na wózki', 'dwójkę WJO', 'mam niemiecki Staplerschein'] },
    { id: 'warehouse_experience', label: 'Warehouse experience', ask: 'Jakie ma {P} doświadczenie w pracy na magazynie?', parse: parseExperience,
      reprompt: 'A ile to mniej więcej lat lub miesięcy pracy na magazynie?', allowed: EXP.join(' | '),
      examples: ['półtora roku na kompletacji', 'kilka lat', 'pół roku', 'nigdy'] },
    { id: 'shift_work', label: 'Shift work', ask: 'Czy może {P} pracować w systemie zmianowym, także na nocki?', parse: parseShift,
      reprompt: 'Czy praca na zmiany, także nocne, wchodzi w grę?', explain: 'Chodzi o pracę na zmiany, na przykład rano, po południu i w nocy, zmieniane co tydzień. Czy to {Pd} pasuje?', allowed: 'tak (także noce) | tylko dzienne | nie',
      examples: ['nie ma problemu', 'tylko na dzień', 'bez nocek', 'jasne'] },
    { id: 'own_car', label: 'Own car', ask: 'Czy ma {P} własny samochód?', parse: function (t) { return yn(t); },
      reprompt: 'Czy ma {P} własne auto: tak czy nie?', allowed: 'tak | nie', examples: ['mam', 'niestety nie', 'no pewnie'] },
    { id: 'accommodation_needed', label: 'Needs accommodation', ask: 'Czy potrzebuje {P} zakwaterowania od agencji?', parse: parseAccommodation,
      reprompt: 'Czy mamy zapewnić zakwaterowanie: tak czy nie?', allowed: 'tak | nie',
      examples: ['tak, poproszę', 'mam gdzie mieszkać, u brata', 'a ile kosztuje zakwaterowanie?'] },
    { id: 'preferred_region', label: 'Preferred region', ask: 'Który region Niemiec {Pd} odpowiada?', parse: parseRegion,
      reprompt: 'Proszę podać region lub miasto, albo powiedzieć, że obojętnie.', allowed: 'dowolny | Bundesland list',
      examples: ['obojętnie', 'okolice Lipska albo Berlina', 'blisko polskiej granicy', 'Bawaria'] },
    { id: 'contract_length', label: 'Planned stay', ask: 'Na jak długo planuje {P} wyjazd?', parse: parseDuration,
      reprompt: 'Czy to krótki wyjazd, kilka miesięcy, czy na dłużej?', allowed: DUR.join(' | '),
      examples: ['pół roku', 'na stałe', 'na sezon', 'rok, może dłużej'] },
    { id: 'id_document', label: 'Valid ID / passport', ask: 'Czy ma {P} ważny dowód osobisty lub paszport?', parse: parseDocuments,
      reprompt: 'Czy dokument tożsamości jest ważny: tak czy nie?', allowed: 'tak | nie',
      examples: ['dowód mam', 'dowód mi wygasł', 'tak'] }
  ];

  var FILLERS = /\b(y{2,}|e{2,}|m{2,}|hm+|ehm+|yhm+|no wiec|wie pani|kurcze|szczerze mowiac|powiem tak|znaczy sie|tak w ogole)\b/g;
  function clean(t) { return t.replace(FILLERS, ' ').replace(/\s+/g, ' ').trim(); }
  // "B... nie, czekaj, jednak C+E" -> parse the part after the last correction marker first
  var CORRECTION = /(?:^|\s)(?:nie,? (?:czekaj|przepraszam|sorry|zle)|a nie|przepraszam|poprawiam sie|poprawka|to znaczy|znaczy|jednak|wlasciwie|czyli)\s/g;
  function normalize(fieldId, text, today) {
    var q = QUESTIONS.filter(function (x) { return x.id === fieldId; })[0];
    if (!q) throw new Error('unknown field ' + fieldId);
    var t = clean(deaccent(text));
    if (!t) return { status: 'silence' };
    today = today || mk(2026, 11, 20);
    var m, last = -1;
    CORRECTION.lastIndex = 0;
    while ((m = CORRECTION.exec(t))) last = m.index + m[0].length;
    if (last > 0 && last < t.length && !/^(jeszcze|tez|takze|i|oraz|plus)\b/.test(t.slice(last).trim())) {
      var tail = t.slice(last).trim();
      var origTail = String(text).split(/,|\.{2,}|…/).pop();
      var rt = q.parse(tail, today, origTail);
      if (rt.status === 'ok') { rt.corrected = true; return rt; }
    }
    return q.parse(t, today, text);
  }

  // ---------- global intents (any phase of the call) ----------
  function detectIntent(original) {
    var t = clean(deaccent(original));
    if (!t) return null;
    if (has(t, /\b(wiecej|juz)\b.*\bnie dzwon\w*|\bnie dzwon\w*.*\b(wiecej|juz)\b/) || has(t, /\b(prosze (wiecej |juz )?nie dzwonic|nie dzwoncie|nie dzwon\w* (do mnie )?wiecej|usun\w* (moje )?(dane|numer)|wypisz\w*|nie zycze sobie|rodo)\b/)) return 'optout';
    if (has(t, /\b(z (prawdziwym )?czlowiekiem|z konsultant\w*|z rekruter\w*|z kims zywym|z (prawdziwa )?osoba|z zywym czlowiekiem|nie chce (rozmawiac )?z (robotem|botem|automatem))\b/)) return 'human';
    if (has(t, /\b(nie mam (teraz |w tej chwili )?czasu|jestem (teraz )?zajet\w*|prowadze (teraz|auto|samochod)\w*|jade (teraz|autem|samochodem)|za kierownica|jestem teraz w pracy|nie moge (teraz )?rozmawiac|(prosze|moze pani) zadzwonic (pozniej|wieczorem|jutro|za godzine)|oddzwonie|zadzwon\w* pozniej|nie teraz)\b/)) return 'busy';
    if (has(t, /\b(juz nie szukam|nie szukam (juz )?pracy|znalazl\w* (juz )?(prace|robote)|mam juz (prace|robote)|rezygnuje|nieaktualne)\b/)) return 'not_looking';
    if (has(t, /\b(prosze powtorzyc|moze pani powtorzyc|co pani powiedziala|nie doslyszal\w*|jeszcze raz|powtorz\w*|glosniej|nie slysze|slabo slychac|przerywa)\b/) || has(t, /^(co|ze co|slucham|he|hm|jak|prosze)$/) && /\?/.test(original)) return 'repeat';
    if (has(t, /\b(nie rozumiem|nie zrozumial\w*|co to znaczy|co to jest|o co chodzi z|w jakim sensie|w sensie)\b/)) return 'clarify';
    if (has(t, /^(chwil\w*|moment\w*|sekund\w*|zaraz|poczekaj\w*|prosze poczekac)( prosze)?$/)) return 'wait';
    return null;
  }

  var api = { deaccent: deaccent, normalize: normalize, parseIdentity: function (s) { return parseIdentity(clean(deaccent(s))); },
    parseOffer: function (s) { text0 = s; return parseOffer(clean(deaccent(s))); }, isQuestion: function (s) { return isQuestion(s, deaccent(s)); },
    faqLookup: function (s) { return faqLookup(deaccent(s)); }, detectIntent: detectIntent, clean: clean, QUESTIONS: QUESTIONS, FAQ: FAQ, mk: mk, iso: iso };

  // fix: parseStartDate & others receive (t, today, original)
  QUESTIONS.forEach(function (q) {
    var p = q.parse;
    q.parse = function (t, today, original) { return p === parseLicence ? parseLicence(t, original) : p(t, today); };
  });

  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.VBEngine = api;
})(this);
