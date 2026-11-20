(function(){
'use strict';
var E = window.VBEngine;
var $ = function(id){return document.getElementById(id);};
var TODAY = (function(){var d=new Date();return E.mk(d.getFullYear(), d.getMonth()+1, d.getDate());})();

// ---------- fictional ATS data ----------
var CANDIDATES = [
  {id:'48211', first:'Jan', last:'Kowalski', g:'m', phone:'+48 600 *** 214', source:'formularza na portalu Pracuj.pl, przy ofercie pracy na magazynie w Niemczech'},
  {id:'48236', first:'Anna', last:'Nowak', g:'f', phone:'+48 512 *** 908', source:'formularza na naszej stronie internetowej, w zakładce praca w Niemczech'},
  {id:'48302', first:'Piotr', last:'Wiśniewski', g:'m', phone:'+48 698 *** 377', source:'formularza na portalu OLX, przy ogłoszeniu o pracy dla kierowców'}
];
var OFFER = {id:'JO-1187', title:'Operator wózka widłowego', place:'magazyn pod Lipskiem', rate:'15,50 euro brutto za godzinę', start:'piątego stycznia',
  text:'operator wózka widłowego w magazynie pod Lipskiem, piętnaście euro pięćdziesiąt brutto za godzinę, zakwaterowanie zapewnione, start piątego stycznia'};

var G = {
  m:{P:'Pan',Pd:'Panu',Pg:'Pana',Pi:'Panem',zaint:'zainteresowany',wypelnil:'wypełnił',mogl:'mógł'},
  f:{P:'Pani',Pd:'Pani',Pg:'Pani',Pi:'Panią',zaint:'zainteresowana',wypelnil:'wypełniła',mogl:'mogła'}
};
function fill(s){var g=G[S.cand.g];return s.replace(/\{P\}/g,g.P).replace(/\{Pd\}/g,g.Pd).replace(/\{Pg\}/g,g.Pg).replace(/\{Pi\}/g,g.Pi).replace(/\{zaint\}/g,g.zaint).replace(/\{wypelnil\}/g,g.wypelnil).replace(/\{mogl\}/g,g.mogl);}

// ---------- state ----------
var S = {mode:'A', cand:CANDIDATES[0], phase:'idle', qi:0, tries:0, fields:{}, unanswered:[], faqUsed:[], notes:[], result:null};

// ---------- tabs ----------
document.querySelectorAll('nav button').forEach(function(b){b.onclick=function(){
  document.querySelectorAll('nav button').forEach(function(x){x.classList.toggle('on',x===b);});
  document.querySelectorAll('.view').forEach(function(v){v.classList.toggle('on',v.id==='v-'+b.dataset.v);});
};});
document.querySelectorAll('#mode button').forEach(function(b){b.onclick=function(){
  if(S.phase!=='idle'&&S.phase!=='ended')return;
  S.mode=b.dataset.m; document.querySelectorAll('#mode button').forEach(function(x){x.classList.toggle('on',x===b);}); renderAts();
};});
CANDIDATES.forEach(function(c,i){var o=document.createElement('option');o.value=i;o.textContent=c.first+' '+c.last+' · #'+c.id;$('cand').appendChild(o);});
$('cand').onchange=function(){if(S.phase!=='idle'&&S.phase!=='ended')return;S.cand=CANDIDATES[+this.value];resetCall();};

// ---------- speech ----------
// Persona follows the voice: female Polish voice -> "Marta", male -> "Karol" (grammar switches too)
var voice=null,PERSONA='f',userPicked=false;
var FEMALE=/(zosia|zofia|paulina|ewa|maja|agnieszka|natalia|marta|aleksandra|hanna|alicja|kasia|katarzyna|google polski|female|kobiet)/i,MALE=/(adam|krzysztof|marek|jacek|karol|jakub|tomasz|piotr|\bmale\b|mezczyzn)/i;
function plVoices(){try{return speechSynthesis.getVoices().filter(function(v){return /^pl/i.test(v.lang);});}catch(e){return [];}}
function pickVoice(){
  var vs=plVoices();if(!vs.length){voice=null;return;}
  var fem=vs.filter(function(v){return FEMALE.test(v.name)&&!MALE.test(v.name);}),mal=vs.filter(function(v){return MALE.test(v.name);});
  if(!userPicked){PERSONA=fem.length?'f':(mal.length?'m':'f');}
  voice=(PERSONA==='f'?(fem[0]||null):(mal[0]||null))||vs[0];
  if(!userPicked&&voice&&MALE.test(voice.name))PERSONA='m';
  renderPersona();
}
function renderPersona(){try{document.querySelectorAll('#persona button').forEach(function(b){b.classList.toggle('on',b.dataset.p===PERSONA);});
  if(S.phase==='idle'||S.phase==='ended')$('phWho').innerHTML=(PERSONA==='f'?'Marta':'Karol')+' · AI voice agent<small>'+(voice?esc(voice.name):'browser default voice')+'</small>';}catch(e){}}
document.querySelectorAll('#persona button').forEach(function(b){b.onclick=function(){if(S.phase!=='idle'&&S.phase!=='ended')return;userPicked=true;PERSONA=b.dataset.p;pickVoice();};});
function persona(t){
  if(PERSONA==='f')return t;
  return t.replace(/Marta/g,'Karol').replace(/wirtualna asystentka/g,'wirtualny asystent').replace(/asystentką głosową/g,'asystentem głosowym')
    .replace(/Zanotowałam/g,'Zanotowałem').replace(/mówiłam/g,'mówiłem').replace(/zrozumiałam/g,'zrozumiałem').replace(/Poczekam\./g,'Poczekam.');
}
try{pickVoice();speechSynthesis.onvoiceschanged=pickVoice;}catch(e){}
function speak(text){
  if(!$('tts').checked)return;
  try{var u=new SpeechSynthesisUtterance(text.replace(/C\+E/g,'ce plus e').replace(/\bII WJO\b/g,'dwa WJO').replace(/\bI WJO\b/g,'jeden WJO').replace(/\bAI\b/g,'ej aj'));u.lang='pl-PL';if(voice)u.voice=voice;u.rate=1.02;speechSynthesis.speak(u);}catch(e){}
}
var SR = window.SpeechRecognition||window.webkitSpeechRecognition, rec=null;
$('mic').onclick=function(){
  if(!SR){sys('Speech recognition is not available in this browser. Type the answer instead.');return;}
  if(S.phase==='idle'||S.phase==='ended'){sys('Start the call first.');return;}
  if(rec){rec.stop();return;}
  try{
    rec=new SR();rec.lang='pl-PL';rec.interimResults=false;rec.maxAlternatives=1;
    $('mic').classList.add('rec');
    rec.onresult=function(e){var t=e.results[0][0].transcript;answer(t,'ASR');};
    rec.onerror=function(e){sys(e.error==='not-allowed'||e.error==='service-not-allowed'?'Microphone is blocked here (embedded preview). Open the page in its own Chrome tab, or type the answer.':'Speech error: '+e.error);};
    rec.onend=function(){$('mic').classList.remove('rec');rec=null;};
    rec.start();
  }catch(e){$('mic').classList.remove('rec');rec=null;sys('Microphone is not available here. Type the answer instead.');}
};

// ---------- chat ui ----------
function add(cls,text,tag){var d=document.createElement('div');d.className='msg '+cls;d.textContent=text;if(tag){var s=document.createElement('span');s.className='tag';s.textContent=tag;d.appendChild(s);}$('chat').appendChild(d);$('chat').scrollTop=1e9;}
function bot(text,tag){text=persona(text);add('bot',text,tag);speak(text);}
function sys(text){add('sys',text);}
function setStatus(t,live){$('phStatus').textContent=t;$('phStatus').className='status'+(live?' live':'');}
function chips(list){
  var c=$('chips');c.innerHTML='';
  (list||[]).forEach(function(x){var b=document.createElement('button');b.className='chip'+(x.alt?' alt':'');b.textContent=x.t;b.onclick=function(){answer(x.v!==undefined?x.v:x.t,'');};c.appendChild(b);});
}
function enable(on){$('answer').disabled=!on;$('btnSend').disabled=!on;$('btnHang').disabled=!on;$('btnCall').disabled=on;if(on)$('answer').focus();}

// ---------- ATS card ----------
function renderAts(){
  $('atsName').textContent=S.cand.first+' '+S.cand.last;
  $('atsMeta').textContent='Candidate #'+S.cand.id+' · '+S.cand.phone+' · '+(S.mode==='A'?'module A · custom fields':'module C · campaign '+OFFER.id);
  var t=$('fields');t.innerHTML='';
  if(S.mode==='A'){
    E.QUESTIONS.forEach(function(q,i){
      var f=S.fields[q.id],tr=document.createElement('tr');
      if(S.phase==='question'&&i===S.qi)tr.className='cur';
      var v=f?(f.value===null?'<span class="empty">empty · 2 tries</span>':'<span class="val">'+esc(f.display)+'</span>'):'<span class="small">—</span>';
      tr.innerHTML='<td>'+(i+1)+'. '+q.label+'</td><td>'+v+(f&&f.corrected?' <span class="small">· corrected (was: '+esc((f.history||[]).map(function(h){return Array.isArray(h.value)?h.value.join(', '):h.value;}).join(' → '))+')</span>':'')+(f&&f.skipped?' <span class="small">· from an earlier answer, not asked again</span>':'')+(f&&f.raw!==undefined?'<span class="raw">“'+esc(f.raw||'(silence)')+'”</span>':'')+'</td>';
      t.appendChild(tr);
    });
  } else {
    t.innerHTML='<tr><td>Offer</td><td><span class="val">'+OFFER.title+'</span><span class="raw">'+OFFER.place+' · '+OFFER.rate+' · start 5 Jan</span></td></tr>'+
      '<tr><td>Campaign result</td><td>'+(S.fields.offer?'<span class="val">'+S.fields.offer.value+'</span><span class="raw">“'+esc(S.fields.offer.raw)+'”</span>':'<span class="small">—</span>')+'</td></tr>'+
      (S.fields.reason?'<tr><td>Reason</td><td><span class="raw">“'+esc(S.fields.reason)+'”</span></td></tr>':'');
  }
  $('callResult').innerHTML=S.result?'Call result: <span class="result-badge">'+S.result+'</span>':'';
}
function esc(s){return String(s).replace(/[&<>"]/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c];});}

// ---------- mock REST API with retries + outbox ----------
var outbox=[], seq=0;
function logEntry(method,path,body,code,note){
  var l=$('log');if(l.firstChild&&l.firstChild.className==='small')l.innerHTML='';
  var d=document.createElement('div');d.className='e';
  var time=new Date().toTimeString().slice(0,8);
  d.innerHTML='<span class="small">'+time+'</span> <b class="m-'+method+'">'+method+'</b> '+esc(path)+' → <b class="'+(code===200?'c200':code==='queued'?'cQ':'c503')+'">'+code+'</b>'+(note?' <span class="small">'+esc(note)+'</span>':'')+'\n'+esc(JSON.stringify(body));
  l.prepend(d);
}
function apiUp(){return !$('simApiDown').checked;}
function send(method,path,body){
  body=Object.assign({idempotency_key:'k'+(++seq)},body);
  attempt({method:method,path:path,body:body},1);
}
function attempt(req,n){
  if(apiUp()){logEntry(req.method,req.path,req.body,200,n>1?'attempt '+n:'');return;}
  logEntry(req.method,req.path,req.body,503,'attempt '+n);
  if(n<3){setTimeout(function(){attempt(req,n+1);},300*Math.pow(2,n));}
  else{outbox.push(req);logEntry(req.method,req.path,req.body,'queued','held in outbox, will resend');renderOutbox();}
}
function renderOutbox(){$('outbox').textContent=outbox.length?outbox.length+' request(s) waiting in outbox — resent automatically when the API is back':'';}
$('simApiDown').onchange=function(){$('apiPill').textContent='ATS API · '+(apiUp()?'online':'503 down');$('apiPill').className='api-pill'+(apiUp()?'':' down');};
setInterval(function(){if(apiUp()&&outbox.length){var r=outbox.shift();logEntry(r.method,r.path,r.body,200,'resent from outbox (same idempotency key)');renderOutbox();}},1500);
function apiField(id,value,raw,status){send('PATCH','/api/candidates/'+S.cand.id+'/custom-fields',{field:id,value:value,raw_answer:raw,status:status});}

// ---------- call flow ----------
function resetCall(){S.callbackFrom=null;S.cbAsked=false;S.callId='call_'+new Date().toISOString().replace(/\D/g,'').slice(0,14)+'_'+S.cand.id;S.startedAt=new Date();S.faqLog=[];S.objections=[];S.phase='idle';S.qi=0;S.tries=0;S.fields={};S.unanswered=[];S.faqUsed=[];S.notes=[];S.result=null;S.faqStreak=0;S.rebutted=null;S.whoCount=0;S.faqSeen={};S.pending=null;S.revisit=null;S.identityConfirmed=false;renderAts();}
$('btnCall').onclick=function(){
  resetCall();$('chat').innerHTML='';try{speechSynthesis.cancel();}catch(e){}
  $('phWho').innerHTML='Calling '+esc(S.cand.first+' '+S.cand.last)+'<small>'+S.cand.phone+' · module '+S.mode+'</small>';
  sys('Call request received from ATS · dialing…');setStatus('dialing');
  setTimeout(function(){
    if($('simNoAnswer').checked){sys('No answer after 30 s.');finish('no_answer','Brak odpowiedzi. Ponowienie zaplanowane za 2 h.');return;}
    if($('simVoicemail').checked){
      sys('Voicemail detected.');
      bot('Dzień dobry, tu wirtualna asystentka agencji pracy Most. Dzwonimy w sprawie zgłoszenia do pracy. Zadzwonimy ponownie, a w razie pytań prosimy o kontakt z agencją.','voicemail · no personal data');
      finish('voicemail','Poczta głosowa, zostawiono krótką wiadomość bez danych osobowych. Ponowienie jutro.');return;
    }
    setStatus('on call',true);enable(true);S.phase='identity';S.tries=0;
    bot(intro(),'identity check · AI disclosure');
    chips([{t:'tak, przy telefonie'},{t:'a kto mówi?'}].concat(FAMILY_CHIPS()).concat([{t:'(silence)',v:'',alt:true}]));
  },900);
};
$('btnSend').onclick=function(){answer($('answer').value,'');};
$('answer').onkeydown=function(e){if(e.key==='Enter'){e.preventDefault();answer(this.value,'');}};
$('btnHang').onclick=function(){if(S.phase==='ended'||S.phase==='idle')return;sys('Candidate hung up.');finish('call_dropped','Rozmowa przerwana przez kandydata. Zapisane odpowiedzi pozostają w ATS.');};

function answer(text,src){
  if(S.phase==='idle'||S.phase==='ended')return;
  $('answer').value='';
  text=String(text||'').trim();
  if(text)add('me',text,src||'');else add('sys','(silence · 5 s)');
  var ph=S.phase;
  setTimeout(function(){
    if(text&&ph!=='callback'&&ph!=='offer_reason'&&ph!=='decision_callback'&&ph!=='handoff_confirm'){var it=E.detectIntent(text);if(it&&handleIntent(it,text,ph))return;}
    if(ph==='identity')return onIdentity(text);
    if(ph==='relative')return onRelative(text);
    if(ph==='hold')return onHold(text);
    if(ph==='callback')return finishCallback(text);
    if(ph==='waiting'){if(!text){S.waitCount++;if(S.waitCount<3){sys('Bot keeps waiting… ('+S.waitCount*10+' s)');return;}bot('Chyba nie mogę dłużej czekać. Zadzwonię później, do usłyszenia!');finish('callback_scheduled','Kandydat poprosił o chwilę i nie wrócił w ciągu 30 s.');return;}
      S.phase=S.callbackFrom;bot('Dziękuję. '+currentPrompt(S.phase),'candidate is back · resumes');return;}
    if(ph==='decision_callback')return finishDecisionCallback(text);
    if(ph==='handoff_confirm'){var yn=E.yesNo(text),tt=E.deaccent(text);
      if(/dokonczmy|dokoncze|kontynu|dalej|lecimy|mozemy|dobra|ok|okej/.test(tt)&&!/czlowiek|konsultant/.test(tt)||yn===true){S.phase=S.handoffFrom;bot('Dziękuję. '+currentPrompt(S.phase),'continues after handoff offer');return;}
      bot('Rozumiem. Konsultant oddzwoni najszybciej, jak to możliwe. Dziękuję, do widzenia!','handoff to a human');finish('handoff_requested','Kandydat prosi o rozmowę z konsultantem.');return;}
    if(text&&ph==='question'){var sp=E.splitAnswerQuestion(text);
      if(sp){var q0=E.QUESTIONS[S.qi],r0=E.normalize(q0.id,sp.answer,TODAY);
        if(r0.status==='ok'){saveAnswer(q0,r0,sp.answer);var said='Zapisuję: '+(r0.spoken||r0.display)+'. ';
          var all0=E.faqLookupAll(sp.question);if(!all0.length)S.unanswered.push(sp.question);
          bot(said+(all0.length?fill(faqText(all0)):fill('Na pytanie o to nie mam informacji w materiałach, zapiszę je dla konsultanta.')),all0.length?'answer saved + FAQ #'+all0.map(function(x){return x.id;}).join(' + #'):'answer saved + question logged for recruiter');
          S.faqLog.push({raw_question:sp.question,matched:all0.map(function(x){return x.topic;}),answered_from_table:!!all0.length,resumed_question:q0.id});
          setTimeout(function(){S.tries=0;next('');},50);return;}
      }
    }
    if(text&&E.isQuestion(text)&&ph!=='offer_reason'){
      // a real question ("?") goes to the FAQ; without "?" try the answer first ("ile się da" is an answer, not a question)
      var tryFirst=!/\?/.test(text)&&!/zalezy (ile|od)/.test(E.deaccent(text))&&(ph==='question'?E.normalize(E.QUESTIONS[S.qi].id,text,TODAY).status==='ok':E.parseOffer(text).status==='ok');
      if(!tryFirst&&handleQuestion(text))return;
    }
    if(ph==='summary')return onSummary(text);
    if(ph==='question')return onQuestion(text);
    if(ph==='offer')return onOffer(text);
    if(ph==='offer_reason'){S.fields.reason=text||'(no reason given)';renderAts();send('POST','/api/candidates/'+S.cand.id+'/notes',{module:'C',campaign:OFFER.id,text:'Powód odmowy: '+(text||'brak')});bot(fill('Dziękuję, to dla nas cenna informacja. Odezwiemy się, gdy pojawi się lepiej dopasowana oferta. Do widzenia!'));finish('completed');}
  },350);
}

function NAME(){return S.cand.first+' '+S.cand.last;}
function intro(){return fill('Dzień dobry, mówi Marta, wirtualna asystentka agencji pracy Most. Jestem programem AI, nie człowiekiem. Czy to {P} '+NAME()+'?');}
var FAMILY_CHIPS=function(){return [{t:'skąd macie mój numer?'},{t:'nie'},{t:'nie, tu córka, zaraz zawołam '+(S.cand.g==='m'?'tatę':'mamę')},{t:'a w jakiej sprawie?'},{t:'nie ma '+(S.cand.g==='m'?'go':'jej')+', jest w pracy'},{t:'pomyłka'}];};

function onIdentity(text){
  if(!text){S.tries++;if(S.tries<2){bot(fill('Halo, czy mnie słychać? Czy to {P} '+NAME()+'?'));return;}bot('Nie słyszę odpowiedzi. Zadzwonię później. Do widzenia.');finish('no_contact','Cisza po potwierdzeniu tożsamości. Ponowienie zaplanowane.');return;}
  var r=E.parseIdentity(text),tt=E.deaccent(text),ln=E.deaccent(S.cand.last),full=new RegExp('\\b'+ln+'\\b').test(tt);
  if(full&&r.status!=='relative'&&r.status!=='absent'&&r.status!=='hold')r={status:'ok',value:true};
  else if(!full&&r.status!=='hold'&&r.status!=='absent'&&tt.indexOf(ln.slice(0,Math.max(5,ln.length-1)))>=0)r={status:'relative'};
  if(r.status==='who'){S.whoCount=(S.whoCount||0)+1;
    if(S.whoCount===1){bot(fill('Mówi Marta, wirtualna asystentka agencji pracy Most. Dzwonię w sprawie zgłoszenia do pracy. Czy to {P} '+NAME()+'?'),'explains, asks again');return;}
    if(S.whoCount===2){bot('Jestem programem AI, który w imieniu agencji pracy Most prowadzi krótkie rozmowy z kandydatami. Rozmawiać mogę tylko z osobą, która się zgłosiła. Czy to '+(S.cand.g==='m'?'Pan':'Pani')+' '+NAME()+'?','explains in more detail');return;}
    bot('Jeśli woli '+(S.cand.g==='m'?'Pan':'Pani')+', konsultant może oddzwonić. Czy to '+(S.cand.g==='m'?'Pan':'Pani')+' '+NAME()+': tak czy nie?','third time · closed question');return;}
  if(r.status==='hold')return startHold();
  if(r.status==='absent')return askCallback();
  if(r.status==='relative'){S.phase='relative';S.tries=0;bot(fill('Rozumiem. Czy {P} '+NAME()+' jest może w pobliżu? Mogę chwilę poczekać.'),'someone else answered · no details disclosed');chips([{t:'tak, zaraz zawołam'},{t:'nie ma '+(S.cand.g==='m'?'go':'jej')+', proszę zadzwonić wieczorem'},{t:'a w jakiej sprawie?'},{t:'pomyłka, nie znam takiej osoby'}]);return;}
  if(r.status==='unclear'){S.tries++;if(S.tries<2){bot(fill('Przepraszam, chcę się tylko upewnić: czy to {P} '+NAME()+'?'));return;}bot('Nie udało mi się potwierdzić rozmówcy. Zadzwonimy ponownie. Do widzenia.');finish('no_contact','Nie potwierdzono tożsamości.');return;}
  if(r.value===false){bot('Przepraszam za pomyłkę. Życzę miłego dnia, do widzenia.');finish('wrong_person','Rozmówca nie zna kandydata. Numer do weryfikacji przez rekrutera.');return;}
  confirmed();
}
function currentPrompt(ph){
  if(ph==='question')return fill(E.QUESTIONS[S.qi].ask);
  if(ph==='summary')return 'Czy wszystko się zgadza?';
  if(ph==='offer')return fill('Czy oferta {Pg} interesuje?');
  return fill('Czy to {P} '+NAME()+'?');
}
function handleIntent(it,text,ph){
  var inTalk=(ph==='question'||ph==='offer'||ph==='summary');
  if(it==='abuse'){bot('Rozumiem. Dziękuję za czas i życzę miłego dnia.','abusive caller · polite close, no arguing');finish('ended_abusive','Rozmówca zakończył rozmowę wulgarnie. Bez automatycznego ponowienia, decyzja rekrutera.');return true;}
  if(it==='source'){
    if(ph==='relative'||ph==='hold'){bot('Dzwonię z agencji pracy Most. Szczegóły mogę omówić tylko bezpośrednio z tą osobą.','privacy · source given only to the candidate');return true;}
    bot(fill('Numer pochodzi z '+S.cand.source+', który {P} {wypelnil}. Administratorem danych jest agencja Most i w każdej chwili mogę je usunąć.'),'lead source from ATS · GDPR');
    setTimeout(function(){bot(currentPrompt(ph));},50);
    return true;
  }
  if(it==='optout'){var dt=E.deaccent(text),erase=/usun|rodo|wykresl|skresl/.test(dt),asked=/skad/.test(dt)&&ph!=='relative'&&ph!=='hold';bot((asked?fill('Numer pochodzi z '+S.cand.source+'. '):'')+'Rozumiem. Usuwamy ten numer z listy kontaktów i nie będziemy więcej dzwonić. Przepraszam za kłopot, do widzenia.','opt-out · GDPR request'+(asked?' · source given':''));send('PATCH','/api/candidates/'+S.cand.id+'/consent',{contact_allowed:false,erasure_requested:erase,raw_answer:text});finish('opt_out','Prośba o niekontaktowanie się'+(erase?' i usunięcie danych (RODO)':'')+'. Przekazać do realizacji.');return true;}
  if(it==='human'&&(inTalk||ph==='identity')){
    if(S.handoffAsked||ph==='identity'){bot('Oczywiście. Przekażę prośbę i konsultant oddzwoni najszybciej, jak to możliwe. Dziękuję, do widzenia!','handoff to a human');finish('handoff_requested','Kandydat prosi o rozmowę z konsultantem.'+(ph==='question'?' Zebrane odpowiedzi zapisane w ATS.':''));return true;}
    S.handoffAsked=true;S.handoffFrom=ph;S.phase='handoff_confirm';
    bot(fill('Oczywiście, przekażę prośbę i konsultant oddzwoni. Chyba że chce {P} jednak dokończyć ze mną? Zostało '+(ph==='question'?(E.QUESTIONS.length-S.qi)+' krótkich pytań':'tylko jedno pytanie')+'.'),'handoff · one offer to continue, no pressure');
    chips([{t:'dobra, dokończmy'},{t:'nie, wolę z człowiekiem'}]);return true;}
  if(it==='busy'&&(inTalk||ph==='identity'||ph==='relative')){if(ph==='question')S.notes.push('Rozmowa przerwana na pytaniu '+(S.qi+1)+'/11 (kandydat zajęty); zebrane odpowiedzi zapisane.');
    if(/\b(dzisiaj|dzis|jutro|wieczorem|rano|z rana|po \w+|w poniedzialek|w weekend|za godzine)\b/.test(E.deaccent(text))){bot('Jasne, nie przeszkadzam. Zadzwonię w podanym terminie. Do usłyszenia!','busy · callback time taken from the same sentence');finish('callback_scheduled','Kandydat zajęty, prosi o kontakt: „'+text+'”.');return true;}
    S.callbackFrom=ph;S.phase='callback';bot('Rozumiem, nie zajmuję czasu. Kiedy mogę zadzwonić ponownie?','busy · asks for a callback time');chips([{t:'wieczorem, po osiemnastej'},{t:'jutro rano'},{t:'nie wiem'}]);return true;}
  if(it==='not_looking'&&ph==='question'){var found=/znalazl|mam juz/.test(E.deaccent(text));bot(found?'Rozumiem, gratuluję i dziękuję za informację. Powodzenia w nowej pracy, do widzenia!':'Rozumiem, dziękuję za informację. Do widzenia!','candidate no longer looking');finish('not_interested','Kandydat nie szuka już pracy: „'+text+'”.');return true;}
  if(it==='wait'&&inTalk){bot('Oczywiście, czekam.','waiting · no try counted');return true;}
  if(it==='repeat'||it==='clarify'){
    if(ph==='question'){var q=E.QUESTIONS[S.qi];bot(fill(it==='clarify'&&q.explain?q.explain:q.ask),it==='repeat'?'repeats · no try counted':'explains · no try counted');return true;}
    if(ph==='offer'){bot(fill('Oczywiście. Oferta to: '+OFFER.text+'. Czy jest {P} {zaint}?'),'repeats the offer');return true;}
    if(ph==='summary'){startSummary('');return true;}
    if(ph==='identity'||ph==='hold'){S.phase='identity';bot(intro(),'repeats');return true;}
  }
  return false;
}
function onRelative(text){
  if(!text){S.tries++;if(S.tries<2){bot('Halo, czy mnie słychać? Czy mogę chwilę poczekać, czy lepiej zadzwonić później?');return;}return askCallback();}
  var t=E.deaccent(text);
  if(/\b(pozniej|innym razem|wieczorem|jutro)\b/.test(t))return askCallback(text);
  var r=E.parseIdentity(text);
  if(r.status==='who'){bot('Przepraszam, szczegóły mogę omówić tylko bezpośrednio z tą osobą. Czy mogę chwilę poczekać, czy lepiej zadzwonić później?','privacy · purpose not disclosed to a third person');return;}
  if(r.status==='hold'||(r.status==='ok'&&r.value===true))return startHold();
  if(r.status==='ok'&&r.value===false&&/pomylk|nie znam|zly numer|nikt taki|nie mieszka/.test(t)){bot('Przepraszam za pomyłkę. Życzę miłego dnia, do widzenia.');finish('wrong_person','Pod numerem nie ma kandydata. Numer do weryfikacji przez rekrutera.');return;}
  if(r.status==='absent'||r.status==='relative'||(r.status==='ok'&&r.value===false))return askCallback();
  S.tries++;
  if(S.tries<2){bot('Czy mogę chwilę poczekać, czy lepiej zadzwonić później?');return;}
  askCallback();
}
function startHold(){
  S.phase='hold';S.holdWaits=0;
  bot('Dobrze, dziękuję. Poczekam.','on hold · waiting for the candidate');
  chips([{t:'halo?'},{t:'tak, słucham, '+S.cand.last},{t:'jeszcze chwileczkę'},{t:'(silence · still waiting)',v:'',alt:true}]);
}
function onHold(text){
  if(!text){S.holdWaits++;if(S.holdWaits<3){sys('Bot keeps waiting… ('+S.holdWaits*10+' s)');return;}bot('Niestety nie mogę dłużej czekać. Zadzwonimy ponownie później. Do widzenia.');finish('callback_scheduled','Na linii osoba trzecia, kandydat nie podszedł w ciągu 30 s. Ponowienie zaplanowane.');return;}
  var r=E.parseIdentity(text),t=E.deaccent(text);
  if(r.status==='hold'){bot('Oczywiście, czekam.');return;}
  if(r.status==='absent')return askCallback();
  S.phase='identity';S.tries=0;
  if(r.status==='ok'&&r.value===true&&(/slucham|to ja|przy telefonie/.test(t)||t.indexOf(E.deaccent(S.cand.last))>=0)){
    bot(fill('Dzień dobry, mówi Marta, wirtualna asystentka agencji pracy Most. Jestem programem AI, nie człowiekiem.'),'new speaker · re-introduces');
    return confirmed();
  }
  bot(intro(),'new speaker · identity check again');
  chips([{t:'tak, to ja'},{t:'a kto mówi?'},{t:'(silence)',v:'',alt:true}]);
}
function askCallback(already){
  if(already)return finishCallback(already);
  S.phase='callback';
  bot('Rozumiem. Kiedy najlepiej zadzwonić ponownie?','asks for a callback time');
  chips([{t:'wieczorem, po osiemnastej'},{t:'jutro rano'},{t:'nie wiem'},{t:'(silence)',v:'',alt:true}]);
}
function finishCallback(text){
  var tc=E.deaccent(text||'');
  // the candidate himself, after "nie mam czasu": "prosze poczekac" / "dobra, jednak mozemy teraz"
  if(S.identityConfirmed&&S.callbackFrom){
    if(/\b(jednak (moge|mam czas|mozemy)|mozemy (teraz|kontynuowac|dalej)|juz (moge|mam czas)|kontynuujmy|dawaj\w*|dobra,? mozemy)\b/.test(tc)){S.phase=S.callbackFrom;bot('Świetnie, dziękuję. '+currentPrompt(S.phase),'candidate has time after all · resumes');return;}
    if(/\b(poczek\w*|zaczek\w*|chwil\w*|moment\w*|sekund\w*)\b/.test(tc)){S.phase='waiting';S.waitCount=0;bot('Dobrze, czekam.','candidate asks to wait · stays on the line');chips([{t:'już jestem, możemy'},{t:'(silence)',v:'',alt:true}]);return;}
  }
  // "o, wlasnie wrocil, zaraz go zawolam" -> wait on the line instead of hanging up
  if(/\b(wrocil\w*|wrocila|przyszedl|przyszla|juz jest|zawolam|wolam|juz daje|daje (go|ja|tate|mame)|chwil\w*|moment\w*|poczek\w*|podchodzi|idzie)\b/.test(tc))return startHold();
  if(text&&!/\b(dzisiaj|dzis|jutro|pojutrze|wieczor\w*|rano|z rana|po poludniu|popoludni\w*|po \w+|o \d+|w (poniedzialek|wtorek|srode|czwartek|piatek|sobote|niedziele|weekend)|za (godzine|dwie godziny|pol godziny|tydzien)|\d{1,2}[:.]\d{2}|nie wiem|obojetnie|kiedykolwiek|nie mam pojecia)\b/.test(tc)&&!S.cbAsked){S.cbAsked=true;bot('Czyli kiedy mogę zadzwonić? Na przykład dziś wieczorem albo jutro rano?','callback time unclear · asks once more');return;}
  var known=text&&!/nie wiem|nie mam pojecia/.test(E.deaccent(text));
  bot(known?'Dziękuję, zadzwonimy w tym czasie. Do widzenia!':'Dobrze, spróbujemy później. Dziękuję i do widzenia!');
  finish('callback_scheduled',known?'Kandydat niedostępny, osoba trzecia prosi o kontakt: „'+text+'”.':'Kandydat niedostępny, brak wskazanej pory. Ponowienie zaplanowane.');
}
function confirmed(){
  S.tries=0;S.identityConfirmed=true;
  if(S.mode==='A'){
    bot(fill('Dziękuję. Mam jedenaście krótkich pytań, to potrwa około trzech minut. W każdej chwili może {P} zapytać o warunki pracy, a na końcu przeczytam podsumowanie, więc wszystko będzie można poprawić.'));
    S.phase='question';S.qi=0;askCurrent();
  } else {
    S.phase='offer';
    bot(fill('Dziękuję. Dzwonię z nową ofertą pracy: '+OFFER.text+'. Czy jest {P} {zaint}?'),'module C · offer '+OFFER.id);
    chips([{t:'tak, chętnie'},{t:'za mało płacą'},{t:'to za daleko'},{t:'muszę pogadać z żoną'},{t:'nie, dziękuję'},{t:'a jak wygląda dojazd?'},{t:'(silence)',v:'',alt:true}]);
  }
}

function askCurrent(prefix){
  var q=E.QUESTIONS[S.qi];
  bot((prefix||'')+fill(q.ask),'question '+(S.qi+1)+'/11 · '+q.id);
  var ex=q.examples.map(function(t){return {t:t};});
  ex.push({t:'a ile kosztuje zakwaterowanie?',alt:true},{t:'proszę powtórzyć',alt:true},{t:'nie mam teraz czasu',alt:true},{t:'chcę rozmawiać z człowiekiem',alt:true},{t:'(silence)',v:'',alt:true});
  chips(ex);renderAts();
}

function handleQuestion(text){
  var all=E.faqLookupAll(text);
  if(all.length>1){
    S.faqStreak=(S.faqStreak||0)+1;
    all.forEach(function(x){S.faqUsed.push(x.id);});
    send('POST','/api/candidates/'+S.cand.id+'/notes',{type:'faq_answered',faq_id:all.map(function(x){return x.id;}),question:text});
    bot(fill(all.map(function(x){return x.answer;}).join(' ')),'FAQ #'+all.map(function(x){return x.id+' '+x.topic;}).join(' + #'));
    var back2=S.phase==='question'?fill('Wracając do pytania: '+lower(E.QUESTIONS[S.qi].ask)):fill('A wracając do oferty: czy jest {P} {zaint}?');
    setTimeout(function(){bot(back2);},50);
    return true;
  }
  var f=all[0]||null;
  if(f){S.faqSeen[f.id]=(S.faqSeen[f.id]||0)+1;
    if(S.faqSeen[f.id]>=3){var back3=S.phase==='question'?fill(E.QUESTIONS[S.qi].ask):fill('Czy oferta {Pg} interesuje?');
      S.notes.push('Kandydat kilkakrotnie pytał o: '+f.topic+'. Do wyjaśnienia przez konsultanta.');
      bot(fill('Krótko: '+lower(f.answer.split('. ')[0].replace(/\.$/,''))+'. Szczegóły wyjaśni jeszcze konsultant, zanotuję to. ')+back3,'same FAQ asked 3× · short answer, noted for recruiter');return true;}
    if(S.faqSeen[f.id]===2){bot('Tak jak mówiłam: '+lower(fill((S.phase==='offer'&&f.id===2)?'W tej ofercie stawka to piętnaście euro pięćdziesiąt brutto za godzinę, plus dodatki za nadgodziny i nocki.':(f.short||f.answer))),'FAQ #'+f.id+' repeated · said once more');
      setTimeout(function(){bot(S.phase==='question'?fill(E.QUESTIONS[S.qi].ask):fill('Czy oferta {Pg} interesuje?'));},50);return true;}
  }
  S.faqLog.push({raw_question:text,matched:all.map(function(x){return x.topic;}),answered_from_table:!!all.length,resumed_question:S.phase==='question'?E.QUESTIONS[S.qi].id:'offer'});
  S.faqStreak=(S.faqStreak||0)+1;
  var back=S.phase==='question'?fill((S.faqStreak>=2?'Jeśli {P} pozwoli, dokończymy pytania. ':'Wracając do pytania: ')+(S.faqStreak>=2?E.QUESTIONS[S.qi].ask:lower(E.QUESTIONS[S.qi].ask))):fill('A wracając do oferty: czy jest {P} {zaint}?');
  if(f){
    S.faqUsed.push(f.id);
    send('POST','/api/candidates/'+S.cand.id+'/notes',{type:'faq_answered',faq_id:f.id,question:text});
    var ans=(S.phase==='offer'&&f.id===2)?'W tej ofercie stawka to piętnaście euro pięćdziesiąt brutto za godzinę, plus dodatki za nadgodziny i nocki.':f.answer;
    bot(fill(ans),'FAQ #'+f.id+' · '+f.topic+(ans!==f.answer?' · offer value filled in':''));
    setTimeout(function(){bot(back);},50);
    return true;
  }
  S.unanswered.push(text);
  bot(fill('Na to pytanie nie mam informacji w materiałach. Zapiszę je, a konsultant odpowie przy kolejnym kontakcie.'),'not in FAQ · logged for recruiter');
  send('POST','/api/candidates/'+S.cand.id+'/notes',{type:'question_not_in_faq',question:text});
  setTimeout(function(){bot(back);},50);
  return true;
}
function lower(s){return s.charAt(0).toLowerCase()+s.slice(1);}

// Corrections of an EARLIER answer ("zaraz, nie w poniedziałek, we wtorek", "źle pani zrozumiała, niemiecki to podstawy")
var CORRECTION_SIGNAL=/\b(zaraz|chwila|chwileczke|poprawka|poprawiam|zle (pani |pan |mnie )?zrozumial\w*|nie o to chodzi|prostuje|nie mowilem|nie mowilam|pomylil\w*|pomylka|nie pasuje|jednak|wolal\w*|zmien\w*|zamiast)\b/;
var FIELD_HINT={start_date:/\b(poniedzial\w*|wtor\w*|srod\w*|czwart\w*|piat\w*|stycz\w*|lut\w*|grud\w*|listopad\w*|swiet\w*|nowym roku|od \d|tydzien|tygodni\w*|miesiac\w*)\b/};
function tryCorrection(text,force){
  var t=E.deaccent(text);
  if(!force&&!CORRECTION_SIGNAL.test(t))return false;
  for(var j=0;j<E.QUESTIONS.length;j++){
    var q=E.QUESTIONS[j],f=S.fields[q.id];
    if((j===S.qi&&S.phase==='question')||!f||f.value===null)continue;
    var hint=FIELD_HINT[q.id]||SKIP_TRIGGERS[q.id];if(!hint||!hint.test(t))continue;
    var r=E.normalize(q.id,text,TODAY);
    var hist=(f.history||[]).concat([{value:f.value,raw:f.raw}]);
    if(r.status==='ok'&&JSON.stringify(r.value)!==JSON.stringify(f.value)){
      S.fields[q.id]={value:r.value,display:r.display,raw:text,corrected:true,history:hist};
      send('PATCH','/api/candidates/'+S.cand.id+'/custom-fields',{field:q.id,value:r.value,previous_value:f.value,raw_answer:text,status:'corrected_by_candidate'});
      S.notes.push(q.label+': poprawione przez kandydata (było: '+JSON.stringify(f.value)+').');
      if(S.phase==='summary'){bot('Rozumiem, poprawiam: '+(r.spoken||r.display)+'. Czy teraz wszystko się zgadza?','correction in summary · previous value kept in history');renderAts();return true;}
      bot('Rozumiem, poprawiam: '+(r.spoken||r.display)+'. '+fill('Wracając do pytania: '+lower(E.QUESTIONS[S.qi].ask)),'correction of question '+(j+1)+' · previous value kept in history');
      renderAts();return true;
    }
    if(r.status!=='ok'&&/nie mowil|zle|nie o to/.test(t)){
      S.fields[q.id]=undefined;delete S.fields[q.id];
      send('PATCH','/api/candidates/'+S.cand.id+'/custom-fields',{field:q.id,value:null,previous_value:f.value,raw_answer:text,status:'contested_by_candidate'});
      S.notes.push(q.label+': kandydat zakwestionował zapis ('+JSON.stringify(f.value)+'), pytanie zadane ponownie.');
      S.resumeAt=S.qi;S.qi=j;S.tries=0;
      bot('Jasne, cofam tamten zapis. '+fill(q.ask),'contested · question asked again');renderAts();return true;
    }
  }
  return false;
}
function faqText(list){return list.map(function(x){return (S.phase==='offer'&&x.id===2)?'W tej ofercie stawka to piętnaście euro pięćdziesiąt brutto za godzinę, plus dodatki za nadgodziny i nocki.':x.answer;}).join(' ');}
function saveAnswer(q,r,text){
  S.faqStreak=0;S.pending=null;
  S.fields[q.id]={value:r.value,display:r.display,raw:text};
  apiField(q.id,r.value,text,'ok');
  if(r.constraint){S.fields[q.id].constraint=r.constraint;S.notes.push(q.label+': odpowiedź z warunkiem — „'+r.constraint+'”.');}
  if(r.verify){S.fields[q.id].verify=true;S.notes.push('Niemiecki: deklaracja niejednoznaczna („'+text+'”), do weryfikacji przez rekrutera.');}
  if(r.notice_until)S.notes.push('Okres wypowiedzenia do '+r.notice_until+'.');
  if(r.preferred){send('PATCH','/api/candidates/'+S.cand.id+'/custom-fields',{field:'preferred_start_date',value:r.preferred,raw_answer:text,status:'ok'});S.notes.push('Preferowany termin startu: '+r.preferred+' (najwcześniej '+r.value+').');}
}
function onQuestion(text){
  if(text&&S.pending&&E.yesNo(text)===true){var q1=E.QUESTIONS[S.qi],pv=S.pending;saveAnswer(q1,pv,S.pendingRaw+' → potwierdzone: „'+text+'”');S.tries=0;next('Dobrze, zapisuję: '+(pv.spoken||pv.display)+'. ');return;}
  if(text&&S.pending&&E.yesNo(text)===false){S.pending=null;}
  if(text&&tryCorrection(text))return;
  var q=E.QUESTIONS[S.qi];
  var r=text?E.normalize(q.id,text,TODAY):{status:'silence'};
  if(r.status==='ok'){
    S.faqStreak=0;
    S.fields[q.id]={value:r.value,display:r.display,raw:text};
    apiField(q.id,r.value,text,'ok');
    if(r.constraint){S.fields[q.id].constraint=r.constraint;S.notes.push(q.label+': odpowiedź z warunkiem — „'+r.constraint+'”.');}
    if(r.verify){S.fields[q.id].verify=true;S.notes.push('Niemiecki: deklaracja niejednoznaczna („'+text+'”), do weryfikacji przez rekrutera.');
    }
    if(r.notice_until)S.notes.push('Okres wypowiedzenia do '+r.notice_until+'.');
    if(r.preferred){send('PATCH','/api/candidates/'+S.cand.id+'/custom-fields',{field:'preferred_start_date',value:r.preferred,raw_answer:text,status:'ok'});S.notes.push('Preferowany termin startu: '+r.preferred+' (najwcześniej '+r.value+').');}
    var extra=smartSkip(text);
    S.tries=0;next('Zapisuję: '+(r.spoken||r.display)+'. '+extra);
    return;
  }
  if(r.pending){S.pending=r.pending;S.pendingRaw=text;}
  S.tries++;
  if(S.tries<2||(r.pending&&S.tries<3)){
    bot(r.status==='silence'?fill('Halo, czy mnie słychać? '+q.ask):fill(r.reprompt||q.reprompt),r.status==='silence'?'silence · try 2/2':(r.pending?'asks to confirm what it understood':'unclear · try 2/2'));
    return;
  }
  S.fields[q.id]={value:null,display:'',raw:text};
  S.notes.push(q.label+': brak jasnej odpowiedzi po 2 próbach'+(text?' (ostatnio: „'+text+'”)':' (cisza)'));
  apiField(q.id,null,text,'empty_after_2_tries');
  S.tries=0;next('Nie szkodzi, przejdźmy dalej. ');
}
// Smart skip: if the answer already covers a later question, save it and don't ask again
var SKIP_TRIGGERS={
  driving_licence:/\b(prawo jazdy|prawk\w*|c\+e|ce plus e|tir\w*|kategori\w* [bcd])\b/,
  german_level:/\b(niemieck\w*|po niemiecku)\b/,
  forklift_licence:/\b(wjo|udt|stapler\w*|widlak\w*)\b/,
  warehouse_experience:/\bmagazyn\w*\b.*\b(lat|lata|rok|roku|miesi\w*)\b|\b(lat|lata|rok|roku)\b.*\bmagazyn\w*/,
  accommodation_needed:/\b(zakwaterowan\w*|mieszkani\w*)\b/,
  own_car:/\b(auto|samochod\w*)\b/
};
function smartSkip(text){
  var t=E.deaccent(text),said=[];
  for(var j=S.qi+1;j<E.QUESTIONS.length;j++){
    var q=E.QUESTIONS[j];if(S.fields[q.id]||!SKIP_TRIGGERS[q.id]||!SKIP_TRIGGERS[q.id].test(t))continue;
    var r=E.normalize(q.id,text,TODAY);
    if(r.status==='ok'){S.fields[q.id]={value:r.value,display:r.display,raw:text,skipped:true};apiField(q.id,r.value,text,'ok_from_earlier_answer');said.push(({driving_licence:'prawo jazdy '+(r.spoken||r.display),german_level:'niemiecki na poziomie '+(r.spoken||r.display),forklift_licence:'uprawnienia: '+(r.spoken||r.display),warehouse_experience:'doświadczenie: '+(r.spoken||r.display),accommodation_needed:'zakwaterowanie: '+(r.spoken||r.display),own_car:'samochód: '+(r.spoken||r.display)})[q.id]||(r.spoken||r.display));}
  }
  return said.length?'Zanotowałam też: '+said.join(', ')+'. ':'';
}
function next(prefix){
  if(S.revisit){S.revisit.shift();if(S.revisit.length){S.qi=S.revisit[0];S.tries=1;bot((prefix||'')+'I jeszcze jedno: '+fill(lower(E.QUESTIONS[S.qi].ask)),'revisit unclear answer · last try');return;}
    S.revisit=null;return startSummary(prefix);}
  S.qi++;
  while(S.qi<E.QUESTIONS.length&&S.fields[E.QUESTIONS[S.qi].id])S.qi++;
  if(S.qi<E.QUESTIONS.length){askCurrent(prefix);return;}
  var empty=[];E.QUESTIONS.forEach(function(q,i){if(S.fields[q.id]&&S.fields[q.id].value===null)empty.push(i);});
  if(empty.length){S.revisit=empty;S.qi=empty[0];S.tries=1;
    bot((prefix||'')+'Na koniec wrócę jeszcze do '+(empty.length===1?'jednego pytania':empty.length+' pytań')+', na które nie mam pewnej odpowiedzi. '+fill(E.QUESTIONS[S.qi].ask),'revisits unclear answers before closing');return;}
  startSummary(prefix);
}
var SUM_LABEL={start_date:'start',driving_licence:'prawo jazdy',german_level:'niemiecki',forklift_licence:'wózki',warehouse_experience:'doświadczenie na magazynie',shift_work:'zmiany',own_car:'samochód',accommodation_needed:'zakwaterowanie',preferred_region:'region',contract_length:'wyjazd na',id_document:'ważny dokument'};
function spokenOf(q){var f=S.fields[q.id];if(!f||f.value===null)return 'brak odpowiedzi';var r=E.normalize(q.id,String(f.raw).split(' → ')[0],TODAY);return (r.status==='ok'&&JSON.stringify(r.value)===JSON.stringify(f.value)&&r.spoken)?r.spoken:f.display;}
function startSummary(prefix){
  S.phase='summary';S.tries=0;
  var parts=E.QUESTIONS.map(function(q){return SUM_LABEL[q.id]+': '+spokenOf(q);});
  bot((prefix||'')+'Na koniec krótkie podsumowanie. '+parts.join(', ')+'. Czy wszystko się zgadza?','summary · candidate can correct anything');
  chips([{t:'tak, wszystko się zgadza'},{t:'nie, start od 9 grudnia'},{t:'niemiecki to tylko podstawy'},{t:'nie wszystko'}]);
}
function onSummary(text){
  var yn=E.yesNo(text),t=E.deaccent(text||'');
  if(!text){S.tries++;if(S.tries<2){bot('Czy wszystko się zgadza: tak czy nie?');return;}return closeA();}
  if(yn===true&&!/\b(ale|tylko|poza)\b/.test(t))return closeA();
  if(tryCorrection(text,true))return;
  if(yn===false||/nie wszystko|cos nie|nie zgadza/.test(t)){bot('Co mam poprawić? Proszę powiedzieć, na przykład: start od dziewiątego grudnia.','asks what to correct');return;}
  S.tries++;if(S.tries<2){bot('Nie do końca zrozumiałam. Co mam poprawić, albo czy wszystko się zgadza?');return;}
  closeA();
}
function closeA(){bot(fill('Dziękuję, wszystko zapisane. Konsultant odezwie się do {Pg} w ciągu dwóch dni roboczych. Do widzenia!'));finish('completed');}
var REBUTTAL={
  SALARY:'Rozumiem. Do tej stawki dochodzą dodatki za nadgodziny i nocki, a zakwaterowanie w tej ofercie jest zapewnione. Czy przy takich warunkach oferta {Pg} interesuje?',
  LOCATION:'Rozumiem, Lipsk to około dwóch i pół godziny jazdy od granicy. Mamy też zlecenia w Brandenburgii, bliżej Polski. Czy mam przekazać rekruterowi, żeby szukał dla {Pg} czegoś bliżej?',
  ACCOMMODATION:'W tej ofercie są pokoje maksymalnie dwuosobowe, z kuchnią i internetem, a zdjęcia kwatery dostaje się przed wyjazdem. Czy przy takim standardzie oferta {Pg} interesuje?',
  TIMING:'Żaden problem, na to stanowisko rekrutujemy cały czas. Zapiszę {Pg} termin i rekruter odezwie się wcześniej, żeby zarezerwować miejsce. Pasuje taki plan?'
};
function onOffer(text){
  var obj=text?E.offerObjection(text):null;
  var definitive=text&&/^(nie\b|nie dziekuje|nie interesuje|nie jestem zainteresowan)/.test(E.clean(E.deaccent(text)));
  if(obj&&definitive){var rr=E.parseOffer(text);S.fields.offer={value:'not_interested',raw:text};S.fields.reason=obj+': '+text;renderAts();send('POST','/api/campaigns/'+OFFER.id+'/results',{candidate_id:S.cand.id,result:'not_interested',reason:obj,raw_answer:text});
    bot(obj==='LOCATION'?fill('Rozumiem, dziękuję. Przekażę rekruterowi, żeby szukał dla {Pg} czegoś bliżej granicy. Do widzenia!'):'Rozumiem, dziękuję za informację. Do widzenia!','refusal with reason · no exit-poll, no rebuttal');finish('completed','Odmowa, powód: '+obj+'.');return;}
  if(obj)S.objections.push({reason:obj,raw:text,rebuttal_attempted:!S.rebutted});
  if(obj&&!S.rebutted){S.rebutted=obj;S.tries=0;bot(fill(REBUTTAL[obj]),'objection: '+obj.toLowerCase()+' · one rebuttal only');send('POST','/api/candidates/'+S.cand.id+'/notes',{module:'C',campaign:OFFER.id,type:'objection',category:obj,raw_answer:text});return;}
  var r=text?E.parseOffer(text):{status:'silence'};
  if(S.rebutted&&r.status==='ok'&&r.value==='not_interested'&&!r.reason)r.reason=S.rebutted;
  if(S.rebutted==='LOCATION'&&r.status==='ok'&&r.value==='interested')r.value='interested_alternative';
  if(r.status!=='ok'){
    S.tries++;
    if(S.tries<2){bot(fill(r.status==='silence'?'Halo, czy mnie słychać? Czy oferta {Pg} interesuje?':'Czy mam rozumieć, że jest {P} {zaint}, czy raczej nie?'));return;}
    r={status:'ok',value:'no_decision'};
  }
  S.fields.offer={value:r.value,raw:text||'(silence)'};
  send('POST','/api/campaigns/'+OFFER.id+'/results',{candidate_id:S.cand.id,result:r.value,raw_answer:text});
  renderAts();
  if(r.value==='interested'){bot(fill('Świetnie! Wyślę SMS-em podsumowanie oferty, a rekruter zadzwoni dziś lub jutro, żeby ustalić szczegóły wyjazdu. Do widzenia!'));send('POST','/api/sms',{candidate_id:S.cand.id,template:'offer_summary',campaign:OFFER.id});finish('completed');}
  else if(r.value==='interested_alternative'){bot(fill('Dobrze, przekażę rekruterowi, żeby szukał dla {Pg} ofert bliżej Polski. Dziękuję i do widzenia!'));finish('completed','Kandydat zainteresowany ofertami bliżej granicy (Brandenburgia, Saksonia).');}
  else if(r.value==='no_decision'){if(r.reason)S.notes.push('Brak decyzji, powód: konsultacja z rodziną.');S.phase='decision_callback';bot(fill('Rozumiem, to ważna decyzja. Wyślę SMS-em podsumowanie oferty, żeby {P} {mogl} spokojnie to przemyśleć. Kiedy rekruter może zadzwonić po decyzję, na przykład jutro po szesnastej?'),'no decision · SMS + follow-up time');send('POST','/api/sms',{candidate_id:S.cand.id,template:'offer_summary',campaign:OFFER.id});chips([{t:'tak, jutro po szesnastej'},{t:'w poniedziałek rano'},{t:'sam zadzwonię'}]);}
  else if(r.reason){S.fields.reason=r.reason;renderAts();send('POST','/api/candidates/'+S.cand.id+'/notes',{module:'C',campaign:OFFER.id,text:'Powód odmowy: '+r.reason});bot('Rozumiem, dziękuję za informację. Odezwiemy się, gdy pojawi się lepiej dopasowana oferta. Do widzenia!','reason captured from the answer');finish('completed');}
  else{S.phase='offer_reason';bot('Rozumiem. Czy mogę zapytać, co w tej ofercie nie pasuje? To pomoże nam dobrać lepszą.');chips([{t:'za daleko od Polski'},{t:'stawka za niska'},{t:'nie chcę mówić',v:'nie chcę mówić'}]);}
}

function finishDecisionCallback(text){
  var t=E.deaccent(text||'');
  var self=/sam (zadzwonie|oddzwonie|sie odezwe)|sama (zadzwonie|oddzwonie|sie odezwe)|odezwe sie/.test(t);
  bot(self?'Dobrze, czekamy na kontakt. Dziękuję i do widzenia!':'Dziękuję, rekruter zadzwoni w tym czasie. Do widzenia!');
  finish('completed',self?'Brak decyzji, kandydat sam się odezwie.':'Brak decyzji, follow-up: „'+(text||'jutro')+'”.');
}
function finish(result,extra){
  if(!S.callId)resetCall();
  S.phase='ended';S.result=result;enable(false);chips([]);setStatus('ended');
  var filled=Object.keys(S.fields).filter(function(k){return S.fields[k]&&S.fields[k].value!==null&&k!=='reason';}).length;
  var note=[ 'Rozmowa AI, moduł '+S.mode+', wynik: '+result ];
  if(S.mode==='A'&&result!=='no_answer'&&result!=='voicemail')note.push('Pola: '+filled+'/11');
  if(extra)note.push(extra);
  S.notes.forEach(function(n){note.push(n);});
  if(S.faqUsed.length)note.push('Odpowiedzi z FAQ: #'+S.faqUsed.join(', #'));
  S.unanswered.forEach(function(u){note.push('Pytanie spoza FAQ: „'+u+'”');});
  send('PATCH','/api/candidates/'+S.cand.id+'/call-result',{module:S.mode,result:result});
  send('POST','/api/candidates/'+S.cand.id+'/notes',{type:'call_note',text:note.join(' · ')});
  sys('Call ended · '+result);renderAts();
  renderRecord(result,note);
}
// ---------- final ATS record (one JSON per call, keyed by call_id for idempotent upsert) ----------
var OUTCOME={completed:S=>S.mode==='C'?'COMPLETED_MODULE_C':'COMPLETED_MODULE_A',no_answer:'NO_ANSWER',voicemail:'VOICEMAIL',wrong_person:'WRONG_NUMBER',no_contact:'NO_INPUT',opt_out:'RODO_OPT_OUT',handoff_requested:'TRANSFER_TO_HUMAN_REQUESTED',callback_scheduled:'CALLBACK_SCHEDULED',call_dropped:'DROPPED',not_interested:'NOT_LOOKING_ANYMORE',ended_abusive:'ENDED_ABUSIVE'};
function renderRecord(result,note){
  var answers={},corrections=[],flags=[];
  E.QUESTIONS.forEach(function(q){var f=S.fields[q.id];if(!f)return;
    answers[q.id]={value:f.value,verbatim:f.raw||'',source:f.skipped?'smart_skip':(f.corrected?'candidate_correction':'direct_answer'),constraint:f.constraint||null,verify:!!f.verify};
    if(f.value===null)flags.push('UNCLEAR_ANSWER_FALLBACK:'+q.id);
    if(f.verify)flags.push('VERIFY_'+q.id.toUpperCase());
    if(f.constraint)flags.push('CONDITIONAL_ANSWER:'+q.id);
    (f.history||[]).forEach(function(h){corrections.push({field:q.id,previous_value:h.value,new_value:f.value,raw:f.raw});});
  });
  if(corrections.length>1)flags.push('MULTIPLE_CORRECTIONS');
  if(S.unanswered.length)flags.push('QUESTIONS_OUTSIDE_FAQ');
  var oc=OUTCOME[result];oc=typeof oc==='function'?oc(S):(oc||result.toUpperCase());
  var rec={
    schema_version:'1.0.0',call_id:S.callId,bot_instance:'polish-voicebot-demo',agency:'Most (fictional)',
    candidate:{ats_candidate_id:S.cand.id,identity_confirmed:!!S.identityConfirmed,
      do_not_call:result==='opt_out',lead_source:S.cand.source},
    call_session:{started_at:S.startedAt.toISOString(),ended_at:new Date().toISOString(),call_outcome:oc,faq_questions:S.faqLog,questions_outside_faq:S.unanswered},
    module_a_screening:S.mode==='A'?{answered:Object.keys(answers).filter(function(k){return answers[k].value!==null;}).length,of:11,
      smart_skipped:Object.keys(answers).filter(function(k){return answers[k].source==='smart_skip';}),answers:answers}:null,
    module_c_offer:S.mode==='C'?{offer_id:OFFER.id,decision_status:S.fields.offer?S.fields.offer.value:'not_decided',objections:S.objections,rejection_reason:S.fields.reason||null}:null,
    correction_history:corrections,
    verification_flags:{needs_human_review:flags.length>0,reasons:flags},
    recruiter_note:note.join(' · ')
  };
  $('record').textContent=JSON.stringify(rec,null,2);$('recordCard').style.display='block';
}
$('copyRecord').onclick=function(){try{navigator.clipboard.writeText($('record').textContent).then(function(){$('copyRecord').textContent='Copied';setTimeout(function(){$('copyRecord').textContent='Copy JSON';},1500);},function(){});}catch(e){}};

// ---------- playground ----------
E.QUESTIONS.forEach(function(q){var o=document.createElement('option');o.value=q.id;o.textContent=q.label+' ('+q.id+')';$('pgField').appendChild(o);});
function pgRun(){
  var q=E.QUESTIONS.filter(function(x){return x.id===$('pgField').value;})[0];
  $('pgAllowed').innerHTML='Allowed values: <code>'+esc(q.allowed)+'</code>';
  var ex=$('pgEx');ex.innerHTML='';
  q.examples.forEach(function(t){var b=document.createElement('button');b.className='chip';b.style.cssText='color:var(--ink);border-color:var(--line)';b.textContent=t;b.onclick=function(){$('pgText').value=t;pgOut();};ex.appendChild(b);});
  pgOut();
}
function pgOut(){
  var txt=$('pgText').value;
  if(!txt.trim()){$('pgOut').textContent='{ }';return;}
  var r=E.normalize($('pgField').value,txt,TODAY);
  var o={field:$('pgField').value,raw_answer:txt,status:r.status};
  if(r.status==='ok'){o.value=r.value;o.bot_reads_back='Zapisuję: '+(r.spoken||r.display);}
  else o.bot_reprompts=r.reprompt||'(field-specific reprompt, then empty after 2 tries)';
  $('pgOut').textContent=JSON.stringify(o,null,2);
}
$('pgField').onchange=pgRun;$('pgText').oninput=pgOut;pgRun();

// ---------- tests ----------
(function(){
  var cases=window.VBCases,base=E.mk(2026,11,20),pass=0,rows='<tr><th>#</th><th>Field</th><th>Candidate said</th><th>Expected</th><th>Got</th><th></th></tr>';
  cases.forEach(function(c,i){
    var r=E.normalize(c[0],c[1],base),got=r.status==='ok'?r.value:null,ok=JSON.stringify(got)===JSON.stringify(c[2]);if(ok)pass++;
    function f(v){return v===null?'<i>unclear → reprompt</i>':Array.isArray(v)?(v.length?v.join(', '):'brak'):esc(v);}
    rows+='<tr><td class="small">'+(i+1)+'</td><td><code>'+c[0]+'</code></td><td>“'+esc(c[1])+'”</td><td>'+f(c[2])+'</td><td>'+f(got)+'</td><td class="'+(ok?'pass':'failc')+'">'+(ok?'✓':'✗')+'</td></tr>';
  });
  $('tests').innerHTML=rows;$('score').textContent=pass+' / '+cases.length+' passed';
})();

renderAts();
})();
