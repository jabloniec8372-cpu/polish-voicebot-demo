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
      spoken: ordinalSpoken(d) + ' ' + MONTH_GEN[m], how: how };
  }
  function parseStartDate(t, today) {
    if (has(t, /\b(nie wiem|nie jestem pewn\w*|zalezy|trudno powiedziec|zobaczymy)\b/)) return { status: 'unclear' };
    if (has(t, /\bpo swietach\b/)) return dateResult(upcoming(today, 12, 27), 'po świętach');
    if (has(t, /\b(przyszl\w*|nastepn\w*) (tydz\w*|tygod\w*)/)) return dateResult(nextWeekday(today, 1), 'przyszły tydzień');
    if (has(t, /\bw ciagu tygodnia\b/)) return dateResult(addDays(today, 7), 'w ciągu tygodnia');
    if (has(t, /\b(od zaraz|od razu|od dzis\w*|natychmiast|w kazdej chwili|teraz|najszybciej|jak najszybciej|asap|choc\w* dzis)\b/)) return dateResult(today, 'od zaraz');
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
    // month name (+ optional day / "polowy" / "konca")
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
    return { status: 'unclear' };
  }

  // ---------- yes / no ----------
  function yesNo(t) {
    if (has(t, /\b(chyba|raczej|w sumie) tak\b/)) return true;
    if (has(t, /\b(chyba|raczej) nie\b/)) return false;
    if (has(t, /\b(nie wiem|nie jestem pewn\w*|zalezy|moze|trudno powiedziec|zastanowie sie|nie pamietam)\b/)) return null;
    if (has(t, /\b(nie ma problemu|czemu nie|no pewnie|jak najbardziej|nie ma sprawy)\b/)) return true;
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
    var s = ' ' + t + ' ';
    if (/\bCE\b/.test(original || '')) s = s.replace(/\bce\b/g, ' c+e ');
    s = s.replace(/\btir\w*/g, ' c+e ').replace(/\bosobow\w*/g, ' b ').replace(/\bna ciezarow\w*/g, ' c ')
      .replace(/\b(ce|c)\s*(plus|\+)\s*e\b|\bc\s+e\b/g, ' c+e ')
      .replace(/\b(be|b)\s*(plus|\+)\s*e\b/g, ' b+e ')
      .replace(/\bce jeden\b|\bc 1\b/g, ' c1 ')
      .replace(/\bbe\b/g, ' b ').replace(/\bde\b/g, ' d ').replace(/\bce\b/g, ' c ');
    var found = {};
    var re = /(?:^|\s)(b\+e|c\+e|c1|b|c|d|t)(?=\s|$|,)/g, m;
    while ((m = re.exec(s))) found[m[1].toUpperCase()] = true;
    var list = LICENCE_ORDER.filter(function (k) { return found[k]; });
    if (!list.length) return { status: 'unclear' };
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
    if (has(t, /\b(biegl\w*|plynn\w*|perfekt\w*|jak niemiec|ojczyst\w*|bardzo dobr\w*)\b/)) return lvl(4);
    if (has(t, /\b(niezbyt|nie za dobr\w*|slab\w*|troche|podstaw\w*|kilka slow|pare slow|na budowie|basic)\b/)) return lvl(1);
    if (has(t, /\b(komunikatywn\w*|dogadam sie|dogaduje sie|sredni\w*|dam rade|jakos|w miare)\b/)) return lvl(2);
    if (has(t, /\b(dobr\w*|dobrze)\b/)) return lvl(3);
    return { status: 'unclear' };
    function lvl(i) { return { status: 'ok', value: GERMAN[i], display: GERMAN[i], spoken: GERMAN[i].replace(/\s*\(.*\)/, '') }; }
  }

  function parseForklift(t) {
    if (has(t, /\bstapler\w*/)) return { status: 'ok', value: 'Staplerschein (DE)', display: 'Staplerschein (DE)', spoken: 'niemiecki Staplerschein' };
    var mentions = has(t, /\b(wjo|udt|wozek|wozki|wozka|widlak\w*|uprawnien\w*)\b/) || has(t, /\d\s*wjo/);
    if (has(t, /\b(nie mam|brak|nie posiadam|nie)\b/) && !has(t, /wjo/)) return { status: 'ok', value: 'brak', display: 'brak' };
    var cat = null;
    var m = t.match(/\b(i{1,3}|[123]|jeden|jedynk\w*|pierwsz\w*|dwa|dwojk\w*|drug\w*|trzy|trojk\w*|trzec\w*)\s*(?:kat\w*\s*)?wjo\b/) ||
            t.match(/wjo\s*(?:kat\w*\s*)?(i{1,3}|[123])\b/) || t.match(/\b([123])wjo\b/) ||
            (mentions && t.match(/\bkat\w*\s*(i{1,3}|[123]|pierwsz\w*|drug\w*)\b/));
    if (m) {
      var w = m[1];
      if (/^(iii|3|trzy|troj|trzec)/.test(w)) cat = null;
      else if (/^(ii|2|dwa|dwoj|drug)/.test(w)) cat = 'II WJO';
      else if (/^(i|1|jeden|jedyn|pierwsz)/.test(w)) cat = 'I WJO';
    }
    if (cat) return { status: 'ok', value: cat, display: cat, spoken: (cat === 'I WJO' ? 'pierwsza' : 'druga') + ' kategoria WJO' };
    if (mentions) return { status: 'unclear', reprompt: 'Jaka to kategoria UDT: pierwsza czy druga WJO?' };
    return { status: 'unclear' };
  }

  var EXP = ['brak', 'do 1 roku', '1-3 lata', 'powyżej 3 lat'];
  function parseExperience(t) {
    if (has(t, /\b(nie mam|brak|nigdy|zadnego|nie pracowal\w*)\b/) || t === 'nie') return e(0);
    if (has(t, /\bkilka lat\b|\bpare lat\b|\bwiele lat\b|\bduzo\b/)) {
      if (has(t, /\bwiele lat|\bduzo\b/)) return e(3);
      return { status: 'unclear', reprompt: 'A ile to mniej więcej lat?' };
    }
    var months = numberBefore(t, 'miesiac\\w*|miesiecy|miesiace');
    var years = numberBefore(t, 'lat\\w*|rok\\w*|lata');
    if (years === null && has(t, /\bpol roku\b/)) years = 0.5;
    if (years === null && has(t, /\b(rok|roku)\b/)) years = 1;
    if (years === null && months === null && has(t, /\b(kilka|pare) miesiec\w*/)) months = 3;
    if (years === null && months !== null) years = months / 12;
    if (years === null) return { status: 'unclear', reprompt: has(t, /\b(tak|troche|mam)\b/) ? 'A ile to mniej więcej lat lub miesięcy?' : undefined };
    if (years < 1) return e(1);
    if (years <= 3) return e(2);
    return e(3);
    function e(i) { return { status: 'ok', value: EXP[i], display: EXP[i] }; }
  }

  function parseShift(t) {
    if (has(t, /\b(tylko|wylacznie) (na )?(dzien|dzienn\w*|rano|ranne|popoludni\w*)|\bbez noc\w*|\bnoce nie\b|\bnocki nie\b|\bnie na noc\w*|\b(wole|wolal\w*|najlepiej|preferuje) (na )?(dzien|dzienn\w*|rano|ranne)/)) return { status: 'ok', value: 'tylko dzienne', display: 'tylko zmiany dzienne' };
    return yn(t, 'tak (także noce)', 'nie');
  }
  function parseAccommodation(t) {
    if (has(t, /\bmam (gdzie|swoje|wlasne|mieszkanie)\b|\bu (rodziny|znajomych|brata|siostry|kolegi)\b|\bmieszkam w niemczech\b/)) return { status: 'ok', value: 'nie', display: 'nie (ma własne)' };
    if (has(t, /\b(przydal\w*|poprosze|bylo by dobrze|byloby dobrze)\b/)) return { status: 'ok', value: 'tak', display: 'tak' };
    return yn(t, 'tak', 'nie');
  }
  function parseDocuments(t) {
    if (has(t, /\b(nie mam ani|ani dowodu|stracil\w*|zgubil\w*|niewazn\w*|nie wazn\w*|skonczyl\w*|wygasl\w*|przeterminowan\w*)\b/)) return { status: 'ok', value: 'nie', display: 'nie' };
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
    if (has(t, /\b(obojetnie|wszystko jedno|gdziekolwiek|dowolny|dowolnie|bez znaczenia|nie ma znaczenia|gdzie bedzie praca|cale niemcy)\b/)) return { status: 'ok', value: ['dowolny'], display: 'dowolny region' };
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
    if (has(t, /\b(na )?dluzej\b|\bdlugo\b/) && !has(t, /\d|miesiac|rok/)) return d(2);
    if (has(t, /\bpol roku\b/)) return d(1);
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
    if (has(t, /\b(kto mowi|kto dzwoni|o co chodzi|skad (pani|pan)? ?dzwoni\w*|co to za)\b/)) return { status: 'who' };
    if (has(t, /\b(pomylk\w*|nie ma go|nie ma jej|zly numer|to nie ja|nie znam|jego zon\w*|jej mez\w*|nie mieszka)\b/)) return { status: 'ok', value: false };
    if (has(t, /\b(to ja|przy telefonie|slucham|we wlasnej osobie|zgadza sie|tak)\b/)) return { status: 'ok', value: true };
    var r = yesNo(t);
    return r === null ? { status: 'unclear' } : { status: 'ok', value: r };
  }
  function parseOffer(t) {
    if (has(t, /\b(zastanow\w*|pomysl\w*|oddzwonie|musze (zapytac|pogadac|porozmawiac|sprawdzic)|nie wiem|nie jestem pewn\w*|zalezy|moze|dam znac|przemysl\w*)\b/))
      return { status: 'ok', value: 'no_decision', display: 'brak decyzji' };
    if (has(t, /\b(nie interesuje|nie jestem zainteresowan\w*|nie dziekuje|raczej nie|nie chce|nie pasuje|nie)\b/) && !has(t, /\bnie ma problemu\b/))
      return { status: 'ok', value: 'not_interested', display: 'niezainteresowany' };
    if (yesNo(t) === true || has(t, /\b(interesuje|zainteresowan\w*|wchodze|biore|chetnie|super|swietnie)\b/))
      return { status: 'ok', value: 'interested', display: 'zainteresowany' };
    return { status: 'unclear' };
  }

  // ---------- FAQ (module B) ----------
  var FAQ = [
    { id: 1, topic: 'Zakwaterowanie', keys: ['zakwaterowan', 'mieszkani', 'pokoj', 'nocleg', 'kwater', 'gdzie bede mieszkac', 'gdzie sie mieszka'],
      answer: 'Zakwaterowanie zapewnia agencja, w pokojach dwuosobowych. Koszt to 280 euro miesięcznie i jest potrącany z wypłaty.' },
    { id: 2, topic: 'Stawki', keys: ['stawk', 'zarob', 'ile plac', 'ile sie zarabia', 'pensj', 'wynagrodz', 'na reke', 'brutto', 'netto', 'za godzine'],
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
      allowed: 'ISO date', examples: ['od przyszłego miesiąca', 'po świętach', 'od piętnastego stycznia', 'za dwa tygodnie'] },
    { id: 'driving_licence', label: 'Driving licence', ask: 'Jakie kategorie prawa jazdy ma {P}?', parse: parseLicence,
      reprompt: 'Proszę podać kategorie, na przykład B albo C plus E.', allowed: 'brak | B | B+E | C1 | C | C+E | D | T',
      examples: ['B i C+E', 'jeżdżę na tira', 'be i ce', 'nie mam prawka'] },
    { id: 'german_level', label: 'German level', ask: 'Jak ocenia {P} swoją znajomość języka niemieckiego?', parse: parseGerman,
      reprompt: 'Czy to raczej podstawy, poziom komunikatywny, czy dobry?', allowed: GERMAN.join(' | '),
      examples: ['dogadam się', 'mam B1', 'trochę, kilka słów', 'wcale'] },
    { id: 'forklift_licence', label: 'Forklift licence (UDT)', ask: 'Czy ma {P} uprawnienia na wózki widłowe, na przykład UDT?', parse: parseForklift,
      reprompt: 'Czy ma {P} uprawnienia UDT pierwszej lub drugiej kategorii WJO?', allowed: 'brak | I WJO | II WJO | Staplerschein (DE)',
      examples: ['2 WJO', 'mam UDT na wózki', 'dwójkę WJO', 'mam niemiecki Staplerschein'] },
    { id: 'warehouse_experience', label: 'Warehouse experience', ask: 'Jakie ma {P} doświadczenie w pracy na magazynie?', parse: parseExperience,
      reprompt: 'A ile to mniej więcej lat lub miesięcy pracy na magazynie?', allowed: EXP.join(' | '),
      examples: ['półtora roku na kompletacji', 'kilka lat', 'pół roku', 'nigdy'] },
    { id: 'shift_work', label: 'Shift work', ask: 'Czy może {P} pracować w systemie zmianowym, także na nocki?', parse: parseShift,
      reprompt: 'Czy praca na zmiany, także nocne, wchodzi w grę?', allowed: 'tak (także noce) | tylko dzienne | nie',
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

  function normalize(fieldId, text, today) {
    var t = deaccent(text);
    var q = QUESTIONS.filter(function (x) { return x.id === fieldId; })[0];
    if (!q) throw new Error('unknown field ' + fieldId);
    if (!t) return { status: 'silence' };
    return q.parse(t, today || mk(2026, 11, 20), text);
  }

  var api = { deaccent: deaccent, normalize: normalize, parseIdentity: function (s) { return parseIdentity(deaccent(s)); },
    parseOffer: function (s) { return parseOffer(deaccent(s)); }, isQuestion: function (s) { return isQuestion(s, deaccent(s)); },
    faqLookup: function (s) { return faqLookup(deaccent(s)); }, QUESTIONS: QUESTIONS, FAQ: FAQ, mk: mk, iso: iso };

  // fix: parseStartDate & others receive (t, today, original)
  QUESTIONS.forEach(function (q) {
    var p = q.parse;
    q.parse = function (t, today, original) { return p === parseLicence ? parseLicence(t, original) : p(t, today); };
  });

  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.VBEngine = api;
})(this);
