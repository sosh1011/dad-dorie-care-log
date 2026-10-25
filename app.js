'use strict';
/* Dad & Dorie Care Log — all data stays in this browser (IndexedDB). */
const DEFAULT_TYPES=['Medical appointments','Medications','Insurance / Medicare','DHS appointment','DHS contact','DHS / caseworker','Emergency room trip','Visit/checkout facility','Banking / finances','Legal / paperwork','Shopping / errands','Home care / safety','Phone / email coordination','Transport','Other'];
const DEFAULT_ROLES=['DHS caseworker','Primary doctor','Neurologist','Pharmacy','Medicare / insurance','Bank','Attorney','Home care agency','Family'];
const isDhs=t=>/dhs/i.test(t||'')&&/appoint|appt|contact|caseworker|case worker|visit|call|meeting/i.test(t);
const isMed=t=>/medical appoint|medical appt/i.test(t||'');
const isRx=t=>/medication/i.test(t||'');
const isFac=t=>/facility/i.test(t||'')&&/visit|check ?out/i.test(t);
const isBank=t=>/banking|finance/i.test(t||'');
const isEr=t=>/emergency|\ber\b/i.test(t||'');
const extras=x=>[x.caseNo&&'Case # '+x.caseNo,x.talkedTo&&'Talked to '+x.talkedTo,x.hospital&&'Hospital: '+x.hospital,x.clinic&&'Clinic: '+x.clinic,x.medication&&'Medication: '+x.medication,x.facility&&'Facility: '+x.facility,x.bill&&'Bill: '+x.bill].filter(Boolean).join(' · ');
const $=(s,r=document)=>r.querySelector(s),$$=(s,r=document)=>[...r.querySelectorAll(s)];
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const uid=()=>Date.now().toString(36)+Math.random().toString(36).slice(2,8);
const pad=n=>String(n).padStart(2,'0');
const ymd=d=>`${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
const today=()=>ymd(new Date());
const fmtH=h=>{h=Math.round(h*100)/100;const H=Math.floor(h),M=Math.round((h-H)*60);return `${h} h`+(M?` (${H}h ${M}m)`:'')};
const fmtDate=s=>new Date(s+'T12:00').toLocaleDateString(undefined,{weekday:'short',month:'short',day:'numeric',year:'numeric'});
const fmtDT=s=>new Date(s).toLocaleString(undefined,{weekday:'short',month:'short',day:'numeric',hour:'numeric',minute:'2-digit'});
function toast(m){const t=$('#toast');t.textContent=m;t.classList.add('on');clearTimeout(toast.t);toast.t=setTimeout(()=>t.classList.remove('on'),2200)}

/* ---------- IndexedDB ---------- */
let db;const S={hours:[],contacts:[],accounts:[],appts:[]};let meta={};
function openDB(){return new Promise((res,rej)=>{const r=indexedDB.open('careLog',1);r.onupgradeneeded=()=>{const d=r.result;d.createObjectStore('items',{keyPath:'id'});d.createObjectStore('meta')};r.onsuccess=()=>res(r.result);r.onerror=()=>rej(r.error)})}
const tx=(st,mode)=>db.transaction(st,mode).objectStore(st);
const req=r=>new Promise((res,rej)=>{r.onsuccess=()=>res(r.result);r.onerror=()=>rej(r.error)});
async function loadAll(){const all=await req(tx('items','readonly').getAll());for(const k in S)S[k]=[];for(const it of all)if(S[it.kind])S[it.kind].push(it);
  const st=tx('meta','readonly');const keys=await req(st.getAllKeys()),vals=await req(tx('meta','readonly').getAll());meta={};keys.forEach((k,i)=>meta[k]=vals[i]);
  if(!meta.types)await setMeta('types',DEFAULT_TYPES.slice());if(!meta.roles)await setMeta('roles',DEFAULT_ROLES.slice());
  if(!meta.typesV2){const t=meta.types.slice();for(const n of ['DHS appointment','DHS contact','Emergency room trip'])if(!t.some(x=>x.toLowerCase()===n.toLowerCase())){const o=t.indexOf('Other');o>=0?t.splice(o,0,n):t.push(n)}await setMeta('types',t);await setMeta('typesV2',true)}
  if(!meta.typesV3){const t=meta.types.slice();if(!t.some(isFac)){const o=t.indexOf('Other');o>=0?t.splice(o,0,'Visit/checkout facility'):t.push('Visit/checkout facility')}await setMeta('types',t);await setMeta('typesV3',true)}}
async function put(it){it.updated=Date.now();await req(tx('items','readwrite').put(it));const a=S[it.kind];const i=a.findIndex(x=>x.id===it.id);i>=0?a[i]=it:a.push(it)}
async function del(it){await put({...it,deleted:true})}/* tombstone so import/merge keeps deletions */
async function setMeta(k,v){meta[k]=v;await req(tx('meta','readwrite').put(v,k))}
const live=k=>S[k].filter(x=>!x.deleted);

/* ---------- Navigation ---------- */
function show(v){$$('.view').forEach(s=>s.hidden=s.id!=='v-'+v);$$('.tabs button').forEach(b=>b.toggleAttribute('aria-current',b.dataset.view===v));if(b4(v))location.hash=v;window.scrollTo(0,0)}
const b4=v=>['hours','appts','contacts','accounts','more'].includes(v);
$$('.tabs button').forEach(b=>b.onclick=()=>show(b.dataset.view));

/* ---------- Generic form helpers ---------- */
const formData=f=>Object.fromEntries(new FormData(f));
function fill(f,o){for(const el of f.elements){if(!el.name)continue;if(el.type==='radio')el.checked=o[el.name]===el.value;else el.value=o[el.name]??''}}
function editMode(f,on){const c=$('.cancel',f)||$('#hourCancel');if(c)c.hidden=!on;const h=$('h2',f);if(h){h.dataset.t??=h.textContent;h.textContent=on?h.dataset.t.replace(/^Add|^Log/,'Edit'):h.dataset.t}if(on)f.scrollIntoView({behavior:'smooth'})}
function resetForm(f){f.reset();f.elements.id.value='';editMode(f,false)}
$$('form .cancel').forEach(b=>b.onclick=()=>resetForm(b.form));

/* ---------- Hours ---------- */
const hf=$('#hourForm');
function renderTypes(){const t=meta.types,cur=$('#typeSelect').value;$('#typeSelect').innerHTML='<option value="" disabled selected>Choose a task…</option>'+t.map(x=>`<option>${esc(x)}</option>`).join('');
  $('#fType').innerHTML='<option value="">All</option>'+t.map(x=>`<option>${esc(x)}</option>`).join('');
  if(cur&&t.includes(cur))$('#typeSelect').value=cur;
  $('#roles').innerHTML=(meta.roles||[]).map(x=>`<option>${esc(x)}</option>`).join('')}
/* ---------- List manager (task types, contact roles) ---------- */
const MGR={types:{title:'Task types',def:DEFAULT_TYPES},roles:{title:'Contact roles',def:DEFAULT_ROLES}};let mk=null;
function mgrRender(){const l=meta[mk];$('#mgrTitle').textContent='Edit '+MGR[mk].title.toLowerCase();
  $('#mgrList').innerHTML=l.map((x,i)=>`<li><input value="${esc(x)}" data-i="${i}" aria-label="Rename ${esc(x)}"><div class="tools"><button type="button" data-up="${i}" aria-label="Move up" ${i?'':'disabled'}>↑</button><button type="button" data-dn="${i}" aria-label="Move down" ${i<l.length-1?'':'disabled'}>↓</button><button type="button" class="danger" data-rm="${i}" aria-label="Delete ${esc(x)}">✕</button></div></li>`).join('')||'<li class="muted">No options yet.</li>'}
async function mgrSave(l){await setMeta(mk,l);renderTypes();mgrRender()}
document.addEventListener('click',e=>{const b=e.target.closest('[data-manage]');if(!b)return;mk=b.dataset.manage;mgrRender();$('#mgr').showModal()});
$('#mgrList').addEventListener('change',async e=>{const i=e.target.dataset.i;if(i==null)return;const l=meta[mk].slice(),old=l[i],v=e.target.value.trim();
  if(!v||l.includes(v)){e.target.value=old;return toast(v?'Already in the list':'Name can\'t be empty')}
  l[i]=v;if(mk==='types'){for(const h of S.hours.filter(h=>h.type===old))await put({...h,type:v});renderHours()}await mgrSave(l);toast('Renamed')});
$('#mgrList').addEventListener('click',async e=>{const d=e.target.closest('button')?.dataset;if(!d)return;const l=meta[mk].slice();
  if(d.up){const i=+d.up;[l[i-1],l[i]]=[l[i],l[i-1]]}else if(d.dn){const i=+d.dn;[l[i+1],l[i]]=[l[i],l[i+1]]}
  else if(d.rm){if(!confirm(`Delete "${l[d.rm]}"?`+(mk==='types'?' Past entries keep it.':'')))return;l.splice(d.rm,1)}else return;await mgrSave(l)});
async function mgrAdd(){const v=$('#mgrNew').value.trim();if(!v)return;if(meta[mk].includes(v))return toast('Already in the list');const l=meta[mk].slice();
  const o=l.indexOf('Other');mk==='types'&&o>=0?l.splice(o,0,v):l.push(v);$('#mgrNew').value='';await mgrSave(l);toast('Added')}
$('#mgrAdd').onclick=mgrAdd;$('#mgrNew').onkeydown=e=>{if(e.key==='Enter'){e.preventDefault();mgrAdd()}};
$('#mgrReset').onclick=async()=>{if(!confirm('Restore the default list? Your custom options will be removed (entries keep their values).'))return;await mgrSave(MGR[mk].def.slice())};
$('#mgr').addEventListener('close',()=>{const sel=$('#typeSelect');if(mk==='types'&&!sel.value&&hf.elements.id.value==='')sel.selectedIndex=0});
$('#quickHours').innerHTML=[[0,15],[0,30],[1,0],[1,30],[2,0],[3,0]].map(([h,m])=>`<button type="button" data-h="${h}" data-m="${m}">${h?h+'h':''}${m?(h?' ':'')+m+'m':''}</button>`).join('');
$('#quickHours').onclick=e=>{const b=e.target.closest('button');if(!b)return;hf.h.value=b.dataset.h;hf.m.value=b.dataset.m};
function toggleExtras(){const t=$('#typeSelect').value;$('#xDhs').hidden=!isDhs(t);$('#xEr').hidden=!isEr(t);$('#xMed').hidden=!isMed(t);$('#xRx').hidden=!isRx(t);$('#xFac').hidden=!isFac(t);$('#xBank').hidden=!isBank(t)}
$('#typeSelect').addEventListener('change',toggleExtras);
function hourDefaults(){toggleExtras();hf.date.value=today();hf.who.value=meta.lastWho||'Dad'}
hf.onsubmit=async e=>{e.preventDefault();const d=formData(hf);const hours=(+d.h||0)+(+d.m||0)/60;if(!hours){toast('Enter hours or minutes');hf.h.focus();return}
  const old=S.hours.find(x=>x.id===d.id);await put({...(old||{}),id:d.id||uid(),kind:'hours',date:d.date,who:d.who,type:d.type,hours:Math.round(hours*100)/100,notes:d.notes.trim(),caseNo:isDhs(d.type)?d.caseNo.trim():'',talkedTo:isDhs(d.type)?d.talkedTo.trim():'',hospital:isEr(d.type)?d.hospital.trim():'',clinic:isMed(d.type)?d.clinic.trim():'',medication:isRx(d.type)?d.medication.trim():'',facility:isFac(d.type)?d.facility.trim():'',bill:isBank(d.type)?d.bill.trim():''});
  await setMeta('lastWho',d.who);resetForm(hf);hourDefaults();renderHours();toast(old?'Entry updated':'Saved ✓')};
$('#hourCancel').onclick=()=>{resetForm(hf);hourDefaults()};
function filteredHours(){const f=$('#fFrom').value,t=$('#fTo').value,w=$('#fWho').value,ty=$('#fType').value;
  return live('hours').filter(x=>(!f||x.date>=f)&&(!t||x.date<=t)&&(!w||x.who===w)&&(!ty||x.type===ty)).sort((a,b)=>b.date.localeCompare(a.date)||b.updated-a.updated)}
function weekStart(){const d=new Date();d.setDate(d.getDate()-((d.getDay()+6)%7));return ymd(d)}/* Monday */
function renderHours(){const all=live('hours'),sum=a=>a.reduce((s,x)=>s+x.hours,0),t=today(),w=weekStart();
  $('#totals').innerHTML=`<div><b>${+sum(all.filter(x=>x.date===t)).toFixed(2)}</b><span>Today</span></div><div><b>${+sum(all.filter(x=>x.date>=w)).toFixed(2)}</b><span>This week</span></div><div><b>${+sum(all).toFixed(2)}</b><span>All time</span></div>`;
  const list=filteredHours();$('#fSum').textContent=`${list.length} entr${list.length==1?'y':'ies'} · ${fmtH(sum(list))}`;
  $('#hourList').innerHTML=list.map(x=>`<li><div class="body"><div><b>${esc(x.type)}</b> · ${esc(x.who)}</div><div class="meta">${fmtDate(x.date)}${extras(x)?' · '+esc(extras(x)):''}${x.notes?' — '+esc(x.notes):''}</div></div><span class="hrs">${x.hours} h</span><div class="tools"><button data-ed="${x.id}">Edit</button><button class="danger" data-del="${x.id}">Delete</button></div></li>`).join('')||'<li class="muted">No entries yet.</li>'}
$('#hourList').onclick=async e=>{const id=e.target.dataset.ed||e.target.dataset.del;const x=S.hours.find(i=>i.id===id);if(!x)return;
  if(e.target.dataset.del){if(confirm('Delete this entry?')){await del(x);renderHours();toast('Deleted')}return}
  if(!meta.types.includes(x.type))$('#typeSelect').insertAdjacentHTML('beforeend',`<option>${esc(x.type)}</option>`);
  const H=Math.floor(x.hours),M=Math.round((x.hours-H)*60);fill(hf,{...x,h:H||'',m:[0,15,30,45].includes(M)?M:0});
  toggleExtras();if(![0,15,30,45].includes(M)){hf.m.insertAdjacentHTML('beforeend',`<option>${M}</option>`);hf.m.value=M}editMode(hf,true)};
['#fFrom','#fTo','#fWho','#fType'].forEach(s=>$(s).onchange=renderHours);

/* ---------- Contacts ---------- */
const cf=$('#contactForm');
cf.onsubmit=async e=>{e.preventDefault();const d=formData(cf);await put({...d,id:d.id||uid(),kind:'contacts'});resetForm(cf);renderContacts();toast('Contact saved')};
function renderContacts(){const l=live('contacts').sort((a,b)=>a.name.localeCompare(b.name));
  $('#contactList').innerHTML=l.map(x=>`<li><div class="body"><b>${esc(x.name)}</b>${x.role?` · ${esc(x.role)}`:''}<div class="meta">${x.org?esc(x.org)+'<br>':''}${x.phone?`<a href="tel:${esc(x.phone)}">${esc(x.phone)}</a> `:''}${x.email?`<a href="mailto:${esc(x.email)}">${esc(x.email)}</a>`:''}${x.notes?'<br>'+esc(x.notes):''}</div></div><div class="tools"><button data-ed="${x.id}">Edit</button><button class="danger" data-del="${x.id}">Delete</button></div></li>`).join('')||'<li class="muted">No contacts yet — try adding your DHS caseworker.</li>'}
$('#contactList').onclick=async e=>{const x=S.contacts.find(i=>i.id===(e.target.dataset.ed||e.target.dataset.del));if(!x)return;
  if(e.target.dataset.del){if(confirm(`Delete ${x.name}?`)){await del(x);renderContacts()}return}fill(cf,x);editMode(cf,true)};

/* ---------- Accounts (AES-GCM, PBKDF2 passphrase) ---------- */
let key=null;const enc=new TextEncoder(),dec=new TextDecoder();
const b64=u=>btoa(String.fromCharCode(...new Uint8Array(u))),unb64=s=>Uint8Array.from(atob(s),c=>c.charCodeAt(0));
async function deriveKey(pass,salt){const k=await crypto.subtle.importKey('raw',enc.encode(pass),'PBKDF2',false,['deriveKey']);return crypto.subtle.deriveKey({name:'PBKDF2',salt,iterations:250000,hash:'SHA-256'},k,{name:'AES-GCM',length:256},false,['encrypt','decrypt'])}
async function encrypt(txt){const iv=crypto.getRandomValues(new Uint8Array(12));return{iv:b64(iv),ct:b64(await crypto.subtle.encrypt({name:'AES-GCM',iv},key,enc.encode(txt)))}}
async function decrypt(o){return dec.decode(await crypto.subtle.decrypt({name:'AES-GCM',iv:unb64(o.iv)},key,unb64(o.ct)))}
function lockUI(){const first=!meta.vault;$('#lockTitle').textContent=first?'Set a passphrase for your logins':'Unlock logins';$('#pass2Wrap').hidden=!first;$('#lockForm button').textContent=first?'Create & unlock':'Unlock';$('#lockBox').hidden=!!key;$('#acctArea').hidden=!key}
$('#lockForm').onsubmit=async e=>{e.preventDefault();const f=e.target,p=f.pass.value;
  try{if(!meta.vault){if(p.length<6)return toast('Use at least 6 characters');if(p!==f.pass2.value)return toast("Passphrases don't match");
      const salt=crypto.getRandomValues(new Uint8Array(16));key=await deriveKey(p,salt);await setMeta('vault',{salt:b64(salt),check:await encrypt('care-log-ok')})}
    else{key=await deriveKey(p,unb64(meta.vault.salt));await decrypt(meta.vault.check)}
  }catch{key=null;toast('Wrong passphrase');return}
  f.reset();lockUI();renderAccounts();resetIdle()};
$('#lockNow').onclick=()=>{key=null;$('#acctList').innerHTML='';lockUI()};
let idleT;function resetIdle(){clearTimeout(idleT);idleT=setTimeout(()=>{if(key){key=null;lockUI()}},10*60*1000)}/* auto-lock after 10 min */
document.addEventListener('pointerdown',()=>key&&resetIdle());
const af=$('#acctForm');
af.onsubmit=async e=>{e.preventDefault();const d=formData(af);const old=S.accounts.find(x=>x.id===d.id);const pw=d.pw;delete d.pw;
  await put({...d,id:d.id||uid(),kind:'accounts',pwEnc:pw?await encrypt(pw):(old?.pwEnc||null)});resetForm(af);renderAccounts();toast('Account saved (encrypted)')};
function renderAccounts(){if(!key)return;const l=live('accounts').sort((a,b)=>a.site.localeCompare(b.site));
  $('#acctList').innerHTML=l.map(x=>`<li><div class="body"><b>${x.url?`<a href="${esc(x.url)}" target="_blank" rel="noopener">${esc(x.site)}</a>`:esc(x.site)}</b><div class="meta">User: ${esc(x.user)||'—'}<br>Password: <span class="pw" data-pw="${x.id}">••••••••</span>${x.notes?'<br>'+esc(x.notes):''}</div></div><div class="tools"><button data-show="${x.id}">Show</button><button data-copy="${x.id}">Copy</button><button data-ed="${x.id}">Edit</button><button class="danger" data-del="${x.id}">Del</button></div></li>`).join('')||'<li class="muted">No logins saved yet.</li>'}
$('#acctList').onclick=async e=>{const d=e.target.dataset,id=d.show||d.copy||d.ed||d.del;const x=S.accounts.find(i=>i.id===id);if(!x||!key)return;
  const pw=x.pwEnc?await decrypt(x.pwEnc).catch(()=>'(cannot decrypt)'):'';
  if(d.show){const s=$(`[data-pw="${id}"]`);const on=e.target.textContent==='Show';s.textContent=on?(pw||'—'):'••••••••';e.target.textContent=on?'Hide':'Show'}
  else if(d.copy){await navigator.clipboard.writeText(pw);toast('Password copied')}
  else if(d.del){if(confirm(`Delete ${x.site}?`)){await del(x);renderAccounts()}}
  else{fill(af,{...x,pw:''});af.pw.placeholder='Leave blank to keep current';editMode(af,true)}};
$('#inclPw').onchange=e=>{if(e.target.checked&&!confirm('Passwords will appear in plain text in the printout/email. Anyone who sees it can use them. Continue?'))e.target.checked=false};

/* ---------- Appointments & reminders ---------- */
const pf=$('#apptForm');const timers=[];
pf.onsubmit=async e=>{e.preventDefault();const d=formData(pf);const old=S.appts.find(x=>x.id===d.id);await put({...d,id:d.id||uid(),kind:'appts',notified:old&&old.when===d.when&&old.remind===d.remind?old.notified:false});resetForm(pf);renderAppts();askNotif();toast('Appointment saved')};
function renderAppts(){const now=Date.now(),l=live('appts').sort((a,b)=>a.when.localeCompare(b.when));const up=l.filter(x=>new Date(x.when)>=now-3600e3),past=l.filter(x=>!up.includes(x)).reverse();
  const li=x=>`<li><div class="body"><b>${esc(x.title)}</b> · ${esc(x.person)}<div class="meta">${fmtDT(x.when)}${x.loc?' · '+esc(x.loc):''}${+x.remind?` · ⏰ ${x.remind==1440?'1 day':x.remind+' min'} before`:''}${x.notes?'<br>'+esc(x.notes):''}</div></div><div class="tools"><button data-ics="${x.id}" title="Add to calendar">📅</button><button data-ed="${x.id}">Edit</button><button class="danger" data-del="${x.id}">Del</button></div></li>`;
  $('#apptList').innerHTML=(up.map(li).join('')||'<li class="muted">No upcoming appointments.</li>')+(past.length?`<li class="muted"><b>Past</b></li>`+past.slice(0,20).map(li).join(''):'');
  scheduleReminders();banner()}
$('#apptList').onclick=async e=>{const d=e.target.dataset,x=S.appts.find(i=>i.id===(d.ed||d.del||d.ics));if(!x)return;
  if(d.del){if(confirm(`Delete ${x.title}?`)){await del(x);renderAppts()}}else if(d.ics)downloadICS(x);else{fill(pf,x);editMode(pf,true)}};
function downloadICS(x){const f=s=>new Date(s).toISOString().replace(/[-:]|\.\d+/g,''),e=s=>String(s||'').replace(/[,;\\]/g,m=>'\\'+m).replace(/\n/g,'\\n');const st=new Date(x.when);
  const ics=['BEGIN:VCALENDAR','VERSION:2.0','PRODID:-//CareLog//EN','BEGIN:VEVENT',`UID:${x.id}@carelog`,`DTSTAMP:${f(Date.now())}`,`DTSTART:${f(st)}`,`DTEND:${f(st.getTime()+3600e3)}`,`SUMMARY:${e(x.title+' ('+x.person+')')}`,`LOCATION:${e(x.loc)}`,`DESCRIPTION:${e(x.notes)}`,...(+x.remind?['BEGIN:VALARM','ACTION:DISPLAY','DESCRIPTION:Reminder',`TRIGGER:-PT${x.remind}M`,'END:VALARM']:[]),'END:VEVENT','END:VCALENDAR'].join('\r\n');
  download(`${x.title.replace(/\W+/g,'-')}.ics`,ics,'text/calendar')}
function notify(x){const body=`${fmtDT(x.when)}${x.loc?' · '+x.loc:''}`,title=`Upcoming: ${x.title} (${x.person})`;
  if('Notification'in window&&Notification.permission==='granted'){navigator.serviceWorker?.ready.then(r=>r.showNotification(title,{body,icon:'icons/icon-192.png',tag:x.id})).catch(()=>new Notification(title,{body}))}
  else alert(title+'\n'+body)}
function scheduleReminders(){timers.splice(0).forEach(clearTimeout);const now=Date.now();
  for(const x of live('appts')){if(!+x.remind||x.notified)continue;const at=new Date(x.when)-x.remind*60e3,ms=at-now;
    if(ms<=0&&new Date(x.when)>now){fire(x)}else if(ms>0&&ms<2**31-1)timers.push(setTimeout(()=>fire(x),ms))}}
async function fire(x){notify(x);await put({...x,notified:true});banner()}
function banner(){const now=Date.now(),soon=live('appts').filter(x=>{const t=new Date(x.when);return t>=now&&t-now<48*3600e3}).sort((a,b)=>a.when.localeCompare(b.when));const b=$('#banner');
  b.hidden=!soon.length;b.innerHTML=soon.slice(0,2).map(x=>`⏰ <b>${esc(x.title)}</b> (${esc(x.person)}) — ${fmtDT(x.when)}`).join('<br>')}
function notifState(){$('#notifState').textContent=!('Notification'in window)?'This browser does not support notifications here (on iPhone, add the app to your Home Screen first). Upcoming appointments still show in the banner.':`Notifications: ${Notification.permission}.`;$('#notifBtn').hidden=!('Notification'in window)||Notification.permission!=='default'}
function askNotif(){if('Notification'in window&&Notification.permission==='default')Notification.requestPermission().then(notifState)}
$('#notifBtn').onclick=askNotif;
setInterval(()=>{banner()},60e3);document.addEventListener('visibilitychange',()=>{if(!document.hidden){scheduleReminders();banner()}});

/* ---------- Reports: print / Gmail / share ---------- */
function report(kind){const inclPw=$('#inclPw').checked&&!!key;const stamp=new Date().toLocaleString();
  if(kind==='hours'){const l=filteredHours(),tot=l.reduce((s,x)=>s+x.hours,0),f=$('#fFrom').value,t=$('#fTo').value;
    const byType={};l.forEach(x=>byType[x.type]=(byType[x.type]||0)+x.hours);
    const title=`Care hours — Dad & Dorie${f||t?` (${f||'start'} to ${t||'today'})`:''}`;
    return{title,text:`${title}\nTotal: ${fmtH(tot)} in ${l.length} entries\n\nBy task:\n${Object.entries(byType).map(([k,v])=>`  ${k}: ${+v.toFixed(2)} h`).join('\n')}\n\nEntries:\n${l.map(x=>`${x.date} | ${x.who} | ${x.type} | ${x.hours} h${extras(x)?' | '+extras(x):''}${x.notes?' | '+x.notes:''}`).join('\n')}`,
      html:`<h1>${esc(title)}</h1><p>Total <b>${fmtH(tot)}</b> · ${l.length} entries · printed ${stamp}</p><table><tr><th>Date</th><th>Who</th><th>Task</th><th>Hours</th><th>Details</th><th>Notes</th></tr>${l.map(x=>`<tr><td>${x.date}</td><td>${esc(x.who)}</td><td>${esc(x.type)}</td><td>${x.hours}</td><td>${esc(extras(x))}</td><td>${esc(x.notes)}</td></tr>`).join('')}</table><h3>By task</h3><table>${Object.entries(byType).map(([k,v])=>`<tr><td>${esc(k)}</td><td>${+v.toFixed(2)} h</td></tr>`).join('')}</table>`}}
  if(kind==='contacts'){const l=live('contacts').sort((a,b)=>a.name.localeCompare(b.name));const title='Important contacts — Dad & Dorie';
    return{title,text:`${title}\n\n${l.map(x=>[x.name+(x.role?` (${x.role})`:''),x.org,x.phone&&'Phone: '+x.phone,x.email&&'Email: '+x.email,x.notes].filter(Boolean).join('\n')).join('\n\n')}`,
      html:`<h1>${title}</h1><p>Printed ${stamp}</p><table><tr><th>Name</th><th>Role</th><th>Org</th><th>Phone</th><th>Email</th><th>Notes</th></tr>${l.map(x=>`<tr><td>${esc(x.name)}</td><td>${esc(x.role)}</td><td>${esc(x.org)}</td><td>${esc(x.phone)}</td><td>${esc(x.email)}</td><td>${esc(x.notes)}</td></tr>`).join('')}</table>`}}
  if(kind==='appts'){const l=live('appts').filter(x=>new Date(x.when)>=Date.now()-864e5).sort((a,b)=>a.when.localeCompare(b.when));const title='Upcoming appointments — Dad & Dorie';
    return{title,text:`${title}\n\n${l.map(x=>`${fmtDT(x.when)} — ${x.title} (${x.person})${x.loc?'\n  '+x.loc:''}${x.notes?'\n  '+x.notes:''}`).join('\n\n')}`,
      html:`<h1>${title}</h1><p>Printed ${stamp}</p><table><tr><th>When</th><th>What</th><th>Who</th><th>Where</th><th>Notes</th></tr>${l.map(x=>`<tr><td>${fmtDT(x.when)}</td><td>${esc(x.title)}</td><td>${esc(x.person)}</td><td>${esc(x.loc)}</td><td>${esc(x.notes)}</td></tr>`).join('')}</table>`}}
  if(kind==='accounts'){return(async()=>{const l=live('accounts').sort((a,b)=>a.site.localeCompare(b.site));const rows=[];for(const x of l)rows.push({...x,pw:inclPw&&x.pwEnc?await decrypt(x.pwEnc).catch(()=>''):(x.pwEnc?'(not included)':'')});const title='Accounts — Dad & Dorie';
    return{title,text:`${title}${inclPw?'\n⚠ CONTAINS PASSWORDS — keep private':''}\n\n${rows.map(x=>[x.site,x.url,'User: '+(x.user||'—'),'Password: '+x.pw,x.notes].filter(Boolean).join('\n')).join('\n\n')}`,
      html:`<h1>${title}</h1><p>Printed ${stamp}${inclPw?' — <b>CONTAINS PASSWORDS, keep private</b>':' — passwords not included'}</p><table><tr><th>Site</th><th>URL</th><th>Username</th><th>Password</th><th>Notes</th></tr>${rows.map(x=>`<tr><td>${esc(x.site)}</td><td>${esc(x.url)}</td><td>${esc(x.user)}</td><td>${esc(x.pw)}</td><td>${esc(x.notes)}</td></tr>`).join('')}</table>`}})()}}
document.addEventListener('click',async e=>{const b=e.target.closest('[data-print],[data-gmail],[data-share]');if(!b)return;const k=b.dataset.print||b.dataset.gmail||b.dataset.share;const r=await report(k);
  if(b.dataset.print){$('#print').innerHTML=r.html;window.print()}
  else if(b.dataset.gmail){let body=r.text;if(body.length>6000)body=body.slice(0,6000)+'\n…(truncated — use Download CSV for the full list)';window.open('https://mail.google.com/mail/?view=cm&fs=1&su='+encodeURIComponent(r.title)+'&body='+encodeURIComponent(body),'_blank','noopener')}
  else{if(navigator.share){try{await navigator.share({title:r.title,text:r.text})}catch{}}else{await navigator.clipboard.writeText(r.text);toast('Copied to clipboard')}}});

/* ---------- CSV / Sheet / Backup ---------- */
const csvCell=v=>/[",\n]/.test(v=String(v??''))?`"${v.replace(/"/g,'""')}"`:v;
function download(name,data,type){const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([data],{type}));a.download=name;document.body.append(a);a.click();setTimeout(()=>{URL.revokeObjectURL(a.href);a.remove()},500)}
$('#csvHours').onclick=()=>{const l=filteredHours().reverse();download(`care-hours-${today()}.csv`,'Date,Who,Activity,Hours,Notes,Case #,Talked to,Hospital,Clinic,Medication,Facility,Related bill\n'+l.map(x=>[x.date,x.who,x.type,x.hours,x.notes,x.caseNo,x.talkedTo,x.hospital,x.clinic,x.medication,x.facility,x.bill].map(csvCell).join(',')).join('\n'),'text/csv')};
$('#copySheet').onclick=async()=>{const l=filteredHours().reverse();const tsv=l.map(x=>[x.date,x.who,x.type,x.hours,[extras(x),x.notes].filter(Boolean).join(' — ').replace(/[\t\n]/g,' ')].join('\t')).join('\n');
  try{await navigator.clipboard.writeText(tsv);toast(`Copied ${l.length} rows — paste into the Sheet's Log tab`)}catch{download('hours-for-sheet.tsv',tsv,'text/tab-separated-values')}};
$('#exportJson').onclick=()=>{const withPw=$('#bkPw').checked;const items=[].concat(...Object.values(S)).map(x=>x.kind==='accounts'&&!withPw?{...x,pwEnc:null}:x);
  const m={types:meta.types,roles:meta.roles};if(withPw)m.vault=meta.vault;download(`care-log-backup-${today()}.json`,JSON.stringify({app:'dad-dorie-care-log',version:1,exported:new Date().toISOString(),meta:m,items},null,1),'application/json');toast('Backup downloaded')};
$('#importFile').onchange=async e=>{const f=e.target.files[0];if(!f)return;try{const d=JSON.parse(await f.text());if(d.app!=='dad-dorie-care-log')throw 0;
  if(d.meta?.vault&&meta.vault&&d.meta.vault.salt!==meta.vault.salt&&d.items.some(x=>x.pwEnc))if(!confirm('This backup\'s passwords use a different passphrase. Replace this device\'s passphrase with the backup\'s? (Passwords saved only on this device would become unreadable.)'))d.items=d.items.map(x=>x.kind==='accounts'?{...x,pwEnc:null}:x);else await setMeta('vault',d.meta.vault);
  if(d.meta?.vault&&!meta.vault)await setMeta('vault',d.meta.vault);
  let n=0;const st=tx('items','readwrite');for(const it of d.items){const cur=S[it.kind]?.find(x=>x.id===it.id);if(!S[it.kind])continue;if(!cur||(it.updated||0)>(cur.updated||0)){const keep=it.kind==='accounts'&&!it.pwEnc&&cur?.pwEnc?{...it,pwEnc:cur.pwEnc}:it;st.put(keep);n++}}
  await new Promise(r=>st.transaction.oncomplete=r);if(d.meta?.types)await setMeta('types',[...new Set([...meta.types,...d.meta.types])]);if(d.meta?.roles)await setMeta('roles',[...new Set([...meta.roles,...d.meta.roles])]);
  await loadAll();renderAll();toast(`Imported ${n} items`)}catch(err){console.error(err);toast('Not a valid Care Log backup')}e.target.value=''};

/* ---------- Boot ---------- */
function renderAll(){renderTypes();renderHours();renderContacts();renderAppts();lockUI();renderAccounts();notifState()}
(async()=>{db=await openDB();await loadAll();renderAll();hourDefaults();show(b4(location.hash.slice(1))?location.hash.slice(1):'hours');
  if('serviceWorker'in navigator)navigator.serviceWorker.register('sw.js').catch(()=>{});
  setTimeout(askNotif,1500)})();
