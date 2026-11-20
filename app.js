(function(){
'use strict';
var E = window.VBEngine;
var $ = function(id){return document.getElementById(id);};
var TODAY = (function(){var d=new Date();return E.mk(d.getFullYear(), d.getMonth()+1, d.getDate());})();

// ---------- fictional ATS data ----------
var CANDIDATES = [
  {id:'48211', first:'Jan', last:'Kowalski', g:'m', phone:'+48 600 *** 214'},
  {id:'48236', first:'Anna', last:'Nowak', g:'f', phone:'+48 512 *** 908'},
  {id:'48302', first:'Piotr', last:'Wiśniewski', g:'m', phone:'+48 698 *** 377'}
];
var OFFER = {id:'JO-1187', title:'Operator wózka widłowego', place:'magazyn pod Lipskiem', rate:'15,50 euro brutto za godzinę', start:'piątego stycznia',
  text:'operator wózka widłowego w magazynie pod Lipskiem, piętnaście euro pięćdziesiąt brutto za godzinę, zakwaterowanie zapewnione, start piątego stycznia'};

var G = {
  m:{P:'Pan',Pd:'Panu',Pg:'Pana',Pi:'Panem',zaint:'zainteresowany'},
  f:{P:'Pani',Pd:'Pani',Pg:'Pani',Pi:'Panią',zaint:'zainteresowana'}
};
function fill(s){var g=G[S.cand.g];return s.replace(/\{P\}/g,g.P).replace(/\{Pd\}/g,g.Pd).replace(/\{Pg\}/g,g.Pg).replace(/\{Pi\}/g,g.Pi).replace(/\{zaint\}/g,g.zaint);}

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
var voice=null;
function pickVoice(){try{var vs=speechSynthesis.getVoices();voice=vs.filter(function(v){return /^pl/i.test(v.lang);})[0]||null;}catch(e){}}
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
function bot(text,tag){add('bot',text,tag);speak(text);}
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
      tr.innerHTML='<td>'+(i+1)+'. '+q.label+'</td><td>'+v+(f&&f.raw!==undefined?'<span class="raw">“'+esc(f.raw||'(silence)')+'”</span>':'')+'</td>';
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
function resetCall(){S.phase='idle';S.qi=0;S.tries=0;S.fields={};S.unanswered=[];S.faqUsed=[];S.notes=[];S.result=null;renderAts();}
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
    if(text&&ph!=='callback'&&ph!=='offer_reason'){var it=E.detectIntent(text);if(it&&handleIntent(it,text,ph))return;}
    if(ph==='identity')return onIdentity(text);
    if(ph==='relative')return onRelative(text);
    if(ph==='hold')return onHold(text);
    if(ph==='callback')return finishCallback(text);
    if(text&&E.isQuestion(text)&&ph!=='offer_reason'){
      // a real question ("?") goes to the FAQ; without "?" try the answer first ("ile się da" is an answer, not a question)
      var tryFirst=!/\?/.test(text)&&(ph==='question'?E.normalize(E.QUESTIONS[S.qi].id,text,TODAY).status==='ok':E.parseOffer(text).status==='ok');
      if(!tryFirst&&handleQuestion(text))return;
    }
    if(ph==='question')return onQuestion(text);
    if(ph==='offer')return onOffer(text);
    if(ph==='offer_reason'){S.fields.reason=text||'(no reason given)';renderAts();send('POST','/api/candidates/'+S.cand.id+'/notes',{module:'C',campaign:OFFER.id,text:'Powód odmowy: '+(text||'brak')});bot(fill('Dziękuję, to dla nas cenna informacja. Odezwiemy się, gdy pojawi się lepiej dopasowana oferta. Do widzenia!'));finish('completed');}
  },350);
}

function NAME(){return S.cand.first+' '+S.cand.last;}
function intro(){return fill('Dzień dobry, mówi Marta, wirtualna asystentka agencji pracy Most. Jestem programem AI, nie człowiekiem. Czy to {P} '+NAME()+'?');}
var FAMILY_CHIPS=function(){return [{t:'nie'},{t:'nie, tu córka, zaraz zawołam '+(S.cand.g==='m'?'tatę':'mamę')},{t:'a w jakiej sprawie?'},{t:'nie ma '+(S.cand.g==='m'?'go':'jej')+', jest w pracy'},{t:'pomyłka'}];};

function onIdentity(text){
  if(!text){S.tries++;if(S.tries<2){bot(fill('Halo, czy mnie słychać? Czy to {P} '+NAME()+'?'));return;}bot('Nie słyszę odpowiedzi. Zadzwonię później. Do widzenia.');finish('no_contact','Cisza po potwierdzeniu tożsamości. Ponowienie zaplanowane.');return;}
  var r=E.parseIdentity(text),tt=E.deaccent(text),ln=E.deaccent(S.cand.last),full=new RegExp('\\b'+ln+'\\b').test(tt);
  if(full&&r.status!=='relative'&&r.status!=='absent'&&r.status!=='hold')r={status:'ok',value:true};
  else if(!full&&r.status!=='hold'&&r.status!=='absent'&&tt.indexOf(ln.slice(0,Math.max(5,ln.length-1)))>=0)r={status:'relative'};
  if(r.status==='who'){bot(fill('Dzwonię z agencji pracy Most w sprawie zgłoszenia. Czy to {P} '+NAME()+'?'),'explains briefly, asks again');return;}
  if(r.status==='hold')return startHold();
  if(r.status==='absent')return askCallback();
  if(r.status==='relative'){S.phase='relative';S.tries=0;bot(fill('Rozumiem. Czy {P} '+NAME()+' jest może w pobliżu? Mogę chwilę poczekać.'),'someone else answered · no details disclosed');chips([{t:'tak, zaraz zawołam'},{t:'nie ma '+(S.cand.g==='m'?'go':'jej')+', proszę zadzwonić wieczorem'},{t:'a w jakiej sprawie?'},{t:'pomyłka, nie znam takiej osoby'}]);return;}
  if(r.status==='unclear'){S.tries++;if(S.tries<2){bot(fill('Przepraszam, chcę się tylko upewnić: czy to {P} '+NAME()+'?'));return;}bot('Nie udało mi się potwierdzić rozmówcy. Zadzwonimy ponownie. Do widzenia.');finish('no_contact','Nie potwierdzono tożsamości.');return;}
  if(r.value===false){bot('Przepraszam za pomyłkę. Życzę miłego dnia, do widzenia.');finish('wrong_person','Rozmówca nie zna kandydata. Numer do weryfikacji przez rekrutera.');return;}
  confirmed();
}
function handleIntent(it,text,ph){
  var inTalk=(ph==='question'||ph==='offer');
  if(it==='optout'){var erase=/usun|rodo/.test(E.deaccent(text));bot('Rozumiem. Usuwamy ten numer z listy kontaktów i nie będziemy więcej dzwonić. Przepraszam za kłopot, do widzenia.','opt-out · GDPR request');send('PATCH','/api/candidates/'+S.cand.id+'/consent',{contact_allowed:false,erasure_requested:erase,raw_answer:text});finish('opt_out','Prośba o niekontaktowanie się'+(erase?' i usunięcie danych (RODO)':'')+'. Przekazać do realizacji.');return true;}
  if(it==='human'&&(inTalk||ph==='identity')){bot('Oczywiście. Przekażę prośbę i konsultant oddzwoni najszybciej, jak to możliwe. Dziękuję, do widzenia!','handoff to a human');finish('handoff_requested','Kandydat prosi o rozmowę z konsultantem.'+(ph==='question'?' Zebrane odpowiedzi zapisane w ATS.':''));return true;}
  if(it==='busy'&&(inTalk||ph==='identity'||ph==='relative')){if(ph==='question')S.notes.push('Rozmowa przerwana na pytaniu '+(S.qi+1)+'/11 (kandydat zajęty); zebrane odpowiedzi zapisane.');S.phase='callback';bot('Rozumiem, nie zajmuję czasu. Kiedy mogę zadzwonić ponownie?','busy · asks for a callback time');chips([{t:'wieczorem, po osiemnastej'},{t:'jutro rano'},{t:'nie wiem'}]);return true;}
  if(it==='not_looking'&&ph==='question'){var found=/znalazl|mam juz/.test(E.deaccent(text));bot(found?'Rozumiem, gratuluję i dziękuję za informację. Powodzenia w nowej pracy, do widzenia!':'Rozumiem, dziękuję za informację. Do widzenia!','candidate no longer looking');finish('not_interested','Kandydat nie szuka już pracy: „'+text+'”.');return true;}
  if(it==='wait'&&inTalk){bot('Oczywiście, czekam.','waiting · no try counted');return true;}
  if(it==='repeat'||it==='clarify'){
    if(ph==='question'){var q=E.QUESTIONS[S.qi];bot(fill(it==='clarify'&&q.explain?q.explain:q.ask),it==='repeat'?'repeats · no try counted':'explains · no try counted');return true;}
    if(ph==='offer'){bot(fill('Oczywiście. Oferta to: '+OFFER.text+'. Czy jest {P} {zaint}?'),'repeats the offer');return true;}
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
  var known=text&&!/nie wiem|nie mam pojecia/.test(E.deaccent(text));
  bot(known?'Dziękuję, zadzwonimy w tym czasie. Do widzenia!':'Dobrze, spróbujemy później. Dziękuję i do widzenia!');
  finish('callback_scheduled',known?'Kandydat niedostępny, osoba trzecia prosi o kontakt: „'+text+'”.':'Kandydat niedostępny, brak wskazanej pory. Ponowienie zaplanowane.');
}
function confirmed(){
  S.tries=0;
  if(S.mode==='A'){
    bot(fill('Dziękuję. Mam jedenaście krótkich pytań, to potrwa około trzech minut. W każdej chwili może {P} też zapytać o warunki pracy.'));
    S.phase='question';S.qi=0;askCurrent();
  } else {
    S.phase='offer';
    bot(fill('Dziękuję. Dzwonię z nową ofertą pracy: '+OFFER.text+'. Czy jest {P} {zaint}?'),'module C · offer '+OFFER.id);
    chips([{t:'tak, chętnie'},{t:'muszę pogadać z żoną'},{t:'nie, dziękuję'},{t:'a jak wygląda dojazd?'},{t:'(silence)',v:'',alt:true}]);
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
  var f=E.faqLookup(text);
  var back=S.phase==='question'?fill('Wracając do pytania: '+lower(E.QUESTIONS[S.qi].ask)):fill('A wracając do oferty: czy jest {P} {zaint}?');
  if(f){
    S.faqUsed.push(f.id);
    send('POST','/api/candidates/'+S.cand.id+'/notes',{type:'faq_answered',faq_id:f.id,question:text});
    bot(fill(f.answer),'FAQ #'+f.id+' · '+f.topic);
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

function onQuestion(text){
  var q=E.QUESTIONS[S.qi];
  var r=text?E.normalize(q.id,text,TODAY):{status:'silence'};
  if(r.status==='ok'){
    S.fields[q.id]={value:r.value,display:r.display,raw:text};
    apiField(q.id,r.value,text,'ok');
    S.tries=0;next('Zapisuję: '+(r.spoken||r.display)+'. ');
    return;
  }
  S.tries++;
  if(S.tries<2){
    bot(r.status==='silence'?fill('Halo, czy mnie słychać? '+q.ask):fill(r.reprompt||q.reprompt),r.status==='silence'?'silence · try 2/2':'unclear · try 2/2');
    return;
  }
  S.fields[q.id]={value:null,display:'',raw:text};
  S.notes.push(q.label+': brak jasnej odpowiedzi po 2 próbach'+(text?' (ostatnio: „'+text+'”)':' (cisza)'));
  apiField(q.id,null,text,'empty_after_2_tries');
  S.tries=0;next('Nie szkodzi, przejdźmy dalej. ');
}
function next(prefix){
  S.qi++;
  if(S.qi<E.QUESTIONS.length){askCurrent(prefix);return;}
  bot(prefix+fill('To wszystkie pytania, dziękuję. Konsultant odezwie się do {Pg} w ciągu dwóch dni roboczych. Do widzenia!'));
  finish('completed');
}
function onOffer(text){
  var r=text?E.parseOffer(text):{status:'silence'};
  if(r.status!=='ok'){
    S.tries++;
    if(S.tries<2){bot(fill(r.status==='silence'?'Halo, czy mnie słychać? Czy oferta {Pg} interesuje?':'Czy mam rozumieć, że jest {P} {zaint}, czy raczej nie?'));return;}
    r={status:'ok',value:'no_decision'};
  }
  S.fields.offer={value:r.value,raw:text||'(silence)'};
  send('POST','/api/campaigns/'+OFFER.id+'/results',{candidate_id:S.cand.id,result:r.value,raw_answer:text});
  renderAts();
  if(r.value==='interested'){bot(fill('Świetnie! Przekażę to konsultantowi, odezwie się dziś lub jutro ze szczegółami. Do widzenia!'));finish('completed');}
  else if(r.value==='no_decision'){bot(fill('Rozumiem, to ważna decyzja. Zadzwonimy ponownie za dwa dni. Do widzenia!'));finish('completed');}
  else if(r.reason){S.fields.reason=r.reason;renderAts();send('POST','/api/candidates/'+S.cand.id+'/notes',{module:'C',campaign:OFFER.id,text:'Powód odmowy: '+r.reason});bot('Rozumiem, dziękuję za informację. Odezwiemy się, gdy pojawi się lepiej dopasowana oferta. Do widzenia!','reason captured from the answer');finish('completed');}
  else{S.phase='offer_reason';bot('Rozumiem. Czy mogę zapytać, co w tej ofercie nie pasuje? To pomoże nam dobrać lepszą.');chips([{t:'za daleko od Polski'},{t:'stawka za niska'},{t:'nie chcę mówić',v:'nie chcę mówić'}]);}
}

function finish(result,extra){
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
}

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
