/** Phone-scoped calendar controls. Original named inputs remain the form authority. */
const pad=n=>String(n).padStart(2,'0');
const daysIn=(year,month)=>new Date(year,month,0).getDate();
const dateValue=d=>`${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
const calendarIcon='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="4" y="5" width="16" height="16" rx="4"/><path d="M8 3v4m8-4v4M4 10h16"/></svg>';
const timeIcon='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>';
export function formatPickerValue(value,type){
 if(!value)return type==='time'?'選擇時間':'選擇日期';
 if(type==='time')return value.slice(0,5);
 const [date,time]=value.split('T'),[year,month,day]=date.split('-');
 return `${year} / ${Number(month)} / ${Number(day)}${time?`　${time.slice(0,5)}`:''}`;
}
export function parseLocalPickerValue(value,type,fallback=new Date(),now=new Date()){
 if(!value)return new Date(fallback);
 if(type==='time'){const [hour,minute]=value.split(':').map(Number);return new Date(now.getFullYear(),now.getMonth(),now.getDate(),hour,minute);}
 const [date,time='12:00']=value.split('T'),[year,month,day]=date.split('-').map(Number),[hour,minute]=time.split(':').map(Number);
 return new Date(year,month-1,day,hour,minute);
}
export function clampCalendarDay(year,month,day){return Math.min(Math.max(1,day),daysIn(year,month));}
export function initDatePickers(root=document){
 const cleanups=[];let openPicker=null;
 root.querySelectorAll('input[type="date"],input[type="datetime-local"],input[type="time"]').forEach(input=>{
  if(input.dataset.knDateReady)return;
  input.dataset.knDateReady='true';
  const type=input.type,birthday=input.dataset.datePurpose==='birthday'||input.name==='birth-date',doc=input.ownerDocument,win=doc.defaultView,phone=input.closest('.phone')||doc.body;
  const oldTab=input.getAttribute('tabindex'),oldHidden=input.getAttribute('aria-hidden');
  input.classList.add('kn-date-source');input.tabIndex=-1;input.setAttribute('aria-hidden','true');
  const trigger=doc.createElement('button');trigger.type='button';trigger.className='kn-date-trigger';trigger.setAttribute('aria-haspopup','dialog');trigger.setAttribute('aria-expanded','false');
  const label=input.labels?.[0]?.textContent?.trim()||(type==='time'?'時間':'日期');
  trigger.innerHTML=`<span class="kn-date-value"></span>${type==='time'?timeIcon:calendarIcon}`;
  input.after(trigger);
  const sync=()=>{trigger.querySelector('.kn-date-value').textContent=input.disabled?'未設定':formatPickerValue(input.value,type);trigger.disabled=input.disabled;trigger.classList.toggle('is-empty',!input.value||input.disabled);trigger.setAttribute('aria-label',`${label}，${input.disabled?'未設定':formatPickerValue(input.value,type)}`);};sync();
  const scheduleSync=()=>queueMicrotask(sync);root.addEventListener('change',scheduleSync);
  input.addEventListener('input',sync);input.addEventListener('change',sync);
  const observer=new MutationObserver(sync);observer.observe(input,{attributes:true,attributeFilter:['disabled','value','min','max']});
  let disposeDialog=null;
  const open=()=>{
   if(input.disabled)return;openPicker?.();
   const now=new Date(),fallback=birthday?new Date(2000,0,1,12):now;
   let selected=parseLocalPickerValue(input.value,type,fallback,now);
   if(Number.isNaN(selected.getTime()))selected=fallback;
   let y=selected.getFullYear(),m=selected.getMonth()+1,d=selected.getDate(),h=selected.getHours(),minute=selected.getMinutes();
   const dialog=doc.createElement('dialog');dialog.className='kn-date-picker';
   const scrim=doc.createElement('div');scrim.className='kn-date-scrim';scrim.setAttribute('aria-hidden','true');
   const option=(v,text,chosen)=>`<option value="${v}" ${v===chosen?'selected':''}>${text}</option>`;
   const currentYear=now.getFullYear(),minYear=birthday?Math.min(1900,y):Math.min(currentYear,y),maxYear=birthday?Math.max(currentYear,y):Math.max(currentYear+5,y);
   const years=Array.from({length:maxYear-minYear+1},(_,i)=>maxYear-i);
   const select=(part,label,options)=>`<label class="kn-date-column"><span>${label}</span><select size="5" data-date-part="${part}" aria-label="${label}">${options}</select></label>`;
   dialog.innerHTML=`<div class="kn-date-handle"></div><header><h2>${birthday?'選擇生日':type==='time'?'選擇時間':'選擇日期與時間'}</h2><button type="button" class="kn-date-cancel" aria-label="取消日期選擇">×</button></header>${type==='datetime-local'?'<div class="kn-date-shortcuts"><button type="button" data-date-shortcut="0">今天</button><button type="button" data-date-shortcut="1">明天</button><button type="button" data-date-shortcut="weekend">週末</button></div>':''}${birthday?`<label class="kn-date-year-entry"><span>直接輸入年份</span><input type="number" inputmode="numeric" min="${minYear}" max="${currentYear}" value="${y}" aria-label="直接輸入出生年份" data-date-year-entry></label>`:''}${type!=='time'?`<div class="kn-date-columns">${select('year','年',years.map(v=>option(v,String(v),y)).join(''))}${select('month','月',Array.from({length:12},(_,i)=>option(i+1,`${i+1} 月`,m)).join(''))}${select('day','日',Array.from({length:daysIn(y,m)},(_,i)=>option(i+1,`${i+1} 日`,d)).join(''))}</div>`:''}${type!=='date'?`<div class="kn-time-columns">${select('hour','時',Array.from({length:24},(_,i)=>option(i,pad(i),h)).join(''))}<span class="kn-time-colon" aria-hidden="true">:</span>${select('minute','分',Array.from({length:60},(_,i)=>option(i,pad(i),minute)).join(''))}</div>`:''}<div class="kn-date-selection" aria-live="polite"></div><p class="kn-date-error" role="alert" hidden></p><button type="button" class="kn-date-confirm">確定</button>`;
   const headingId=`kn-date-heading-${input.id||'field'}`;dialog.querySelector('h2').id=headingId;dialog.setAttribute('aria-labelledby',headingId);
   const value=()=>type==='time'?`${pad(h)}:${pad(minute)}`:`${y}-${pad(m)}-${pad(d)}${type==='datetime-local'?`T${pad(h)}:${pad(minute)}`:''}`;
   const refresh=()=>{dialog.querySelector('.kn-date-selection').textContent=formatPickerValue(value(),type);dialog.querySelector('.kn-date-error').hidden=true;const yearEntry=dialog.querySelector('[data-date-year-entry]');if(yearEntry&&doc.activeElement!==yearEntry)yearEntry.value=y;};
   const position=()=>{const r=phone.getBoundingClientRect();dialog.style.width=`${Math.min(400,r.width-24)}px`;dialog.style.left=`${r.left+(r.width-Math.min(400,r.width-24))/2}px`;dialog.style.bottom=`${Math.max(12,win.innerHeight-r.bottom+12)}px`;dialog.style.maxHeight=`${Math.max(280,r.height-60)}px`;};
   const close=(restore=true)=>{dialog.removeEventListener('cancel',cancel);win.removeEventListener('resize',position);dialog.close();dialog.remove();scrim.remove();trigger.setAttribute('aria-expanded','false');disposeDialog=null;openPicker=null;if(restore&&trigger.isConnected)trigger.focus();};
   const cancel=e=>{e.preventDefault();close();};disposeDialog=()=>close(false);openPicker=disposeDialog;
   dialog.addEventListener('cancel',cancel);
   dialog.querySelector('.kn-date-cancel').addEventListener('click',()=>close());
   dialog.addEventListener('click',e=>{if(e.target===dialog){const r=dialog.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)close();}});
   const yearEntry=dialog.querySelector('[data-date-year-entry]');if(yearEntry){const syncYear=()=>{const n=Number(yearEntry.value);if(n>=minYear&&n<=currentYear){y=n;dialog.querySelector('[data-date-part="year"]').value=String(y);d=clampCalendarDay(y,m,d);dialog.querySelector('[data-date-part="day"]').innerHTML=Array.from({length:daysIn(y,m)},(_,i)=>option(i+1,`${i+1} 日`,d)).join('');refresh();}};yearEntry.addEventListener('input',syncYear);yearEntry.addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();syncYear();dialog.querySelector('[data-date-part="month"]').focus();}});yearEntry.addEventListener('blur',()=>{yearEntry.value=y;});}
   dialog.addEventListener('change',e=>{const part=e.target.dataset.datePart;if(!part)return;const n=Number(e.target.value);if(part==='year')y=n;if(part==='month')m=n;if(part==='day')d=n;if(part==='hour')h=n;if(part==='minute')minute=n;if(part==='year'||part==='month'){d=clampCalendarDay(y,m,d);dialog.querySelector('[data-date-part="day"]').innerHTML=Array.from({length:daysIn(y,m)},(_,i)=>option(i+1,`${i+1} 日`,d)).join('');}refresh();});
   dialog.querySelectorAll('[data-date-shortcut]').forEach(button=>button.addEventListener('click',()=>{const next=new Date();next.setDate(now.getDate()+(button.dataset.dateShortcut==='weekend'?((6-now.getDay()+7)%7||7):Number(button.dataset.dateShortcut)));y=next.getFullYear();m=next.getMonth()+1;d=next.getDate();dialog.querySelector('[data-date-part="year"]').value=y;dialog.querySelector('[data-date-part="month"]').value=m;dialog.querySelector('[data-date-part="day"]').innerHTML=Array.from({length:daysIn(y,m)},(_,i)=>option(i+1,`${i+1} 日`,d)).join('');refresh();}));
   dialog.querySelector('.kn-date-confirm').addEventListener('click',()=>{const result=value(),error=dialog.querySelector('.kn-date-error');if((birthday&&result>dateValue(now))||(input.max&&result>input.max)||(input.min&&result<input.min)){error.hidden=false;error.textContent=birthday?'生日不能晚於今天。':'請選擇有效範圍內的時間。';return;}input.value=result;sync();close();input.dispatchEvent(new Event('input',{bubbles:true}));input.dispatchEvent(new Event('change',{bubbles:true}));});
   phone.append(scrim,dialog);position();refresh();dialog.showModal();trigger.setAttribute('aria-expanded','true');win.addEventListener('resize',position);
   // Focus the year column directly so typing a year or arrow keys works immediately.
   dialog.querySelector('select')?.focus();
  };
  trigger.addEventListener('click',open);
  const labels=[...(input.labels||[])],labelClick=e=>{e.preventDefault();trigger.focus();open();};labels.forEach(label=>label.addEventListener('click',labelClick));
  cleanups.push(()=>{disposeDialog?.();observer.disconnect();root.removeEventListener('change',scheduleSync);input.removeEventListener('input',sync);input.removeEventListener('change',sync);trigger.removeEventListener('click',open);labels.forEach(label=>label.removeEventListener('click',labelClick));trigger.remove();input.classList.remove('kn-date-source');delete input.dataset.knDateReady;if(oldTab===null)input.removeAttribute('tabindex');else input.setAttribute('tabindex',oldTab);if(oldHidden===null)input.removeAttribute('aria-hidden');else input.setAttribute('aria-hidden',oldHidden);});
 });
 return ()=>cleanups.forEach(cleanup=>cleanup());
}
