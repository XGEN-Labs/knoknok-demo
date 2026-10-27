import { uiIcon } from './ui-icons.mjs?v=20261026-experience-41c';
import { bindSheetDismiss } from './sheet-dismiss.mjs?v=20261021-refine-27c';
/** Touch-first local calendar wheels. Named native inputs remain the form authority. */
const pad=n=>String(n).padStart(2,'0');
const daysIn=(year,month)=>new Date(year,month,0).getDate();
const dateValue=d=>`${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
const calendarIcon=uiIcon('calendar');
const timeIcon=uiIcon('time');
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
/** Visual wheel order is chronological, matching ArrowDown and touch scrolling. */
export function getWheelKeyIndex(key,index,length){
 const last=Math.max(0,length-1),current=Math.max(0,Math.min(last,index));
 if(key==='Home')return 0;if(key==='End')return last;
 const delta={ArrowUp:-1,ArrowDown:1,PageUp:-5,PageDown:5}[key];
 return delta===undefined?null:Math.max(0,Math.min(last,current+delta));
}
export function clampPickerValue(value,type,{min='',max='',birthday=false,now=new Date()}={}){
 const ceiling=birthday&&type!=='time'?(!max||max>dateValue(now)?dateValue(now):max):max;
 return min&&value<min?min:ceiling&&value>ceiling?ceiling:value;
}
const numbers=(first,last)=>Array.from({length:Math.max(0,last-first+1)},(_,i)=>first+i);

function createWheel(element,{values,value,label,onChange}){
 const win=element.ownerDocument.defaultView;
 let items=[],current=0,settleTimer=0,scrollFrame=0,positionFrame=0,drag=null,disposed=false;
 const visibleRows=()=>Number.parseFloat(win.getComputedStyle(element).getPropertyValue('--kn-wheel-visible'))||5;
 const rowHeight=()=>element.clientHeight/visibleRows()||44;
 const setCurrent=(index,notify=false)=>{
  const next=Math.max(0,Math.min(items.length-1,index));if(!items.length)return;
  const changed=current!==next;current=next;
  element.setAttribute('aria-valuenow',String(items[current]));
  element.setAttribute('aria-valuetext',`${items[current]}${label}`);
  if(changed||!element.querySelector('.is-current'))element.querySelectorAll('.kn-date-wheel-row').forEach((row,i)=>row.classList.toggle('is-current',i===current));
  if(changed&&notify)onChange(items[current]);
 };
 const align=(index=current,smooth=false)=>{
  setCurrent(index,true);
  element.scrollTo({top:current*rowHeight(),behavior:smooth&&!win.matchMedia('(prefers-reduced-motion: reduce)').matches?'smooth':'instant'});
 };
 const settle=()=>{win.clearTimeout(settleTimer);settleTimer=0;if(!disposed&&!drag)align(Math.round(element.scrollTop/rowHeight()),true);};
 const onScroll=()=>{
  if(disposed)return;
  if(!scrollFrame)scrollFrame=win.requestAnimationFrame(()=>{scrollFrame=0;if(!disposed)setCurrent(Math.round(element.scrollTop/rowHeight()),true);});
  win.clearTimeout(settleTimer);settleTimer=win.setTimeout(settle,150);
 };
 const onKey=e=>{const next=getWheelKeyIndex(e.key,current,items.length);if(next===null)return;e.preventDefault();win.clearTimeout(settleTimer);align(next);};
 const onPointerDown=e=>{
  // Let the browser handle touch momentum and scroll snapping. Mouse/pen can drag too.
  if(e.pointerType==='touch'||e.button!==0)return;
  drag={id:e.pointerId,y:e.clientY,top:element.scrollTop,moved:false};element.setPointerCapture(e.pointerId);
 };
 const onPointerMove=e=>{if(!drag||drag.id!==e.pointerId)return;const delta=e.clientY-drag.y;if(Math.abs(delta)>3)drag.moved=true;if(drag.moved){e.preventDefault();element.scrollTop=drag.top-delta;}};
 const onPointerEnd=e=>{
  if(!drag||drag.id!==e.pointerId)return;
  const ended=drag;drag=null;if(element.hasPointerCapture(e.pointerId))element.releasePointerCapture(e.pointerId);
  const index=ended.moved?Math.round(element.scrollTop/rowHeight()):Math.floor((element.scrollTop+e.clientY-element.getBoundingClientRect().top-(visibleRows()-1)/2*rowHeight())/rowHeight());
  align(index,true);
 };
 const onPointerCancel=()=>{if(!drag)return;drag=null;settle();};
 element.addEventListener('scroll',onScroll,{passive:true});element.addEventListener('scrollend',settle);
 element.addEventListener('keydown',onKey);element.addEventListener('pointerdown',onPointerDown);
 element.addEventListener('pointermove',onPointerMove);element.addEventListener('pointerup',onPointerEnd);element.addEventListener('pointercancel',onPointerCancel);
 const update=(nextValues,nextValue)=>{
  const nextIndex=Math.max(0,nextValues.indexOf(nextValue));
  const changed=items.length!==nextValues.length||items.some((item,i)=>item!==nextValues[i]);
  if(changed){items=[...nextValues];element.innerHTML=items.map(item=>`<div class="kn-date-wheel-row" aria-hidden="true">${label==='年'?item:pad(item)}</div>`).join('');element.setAttribute('aria-valuemin',String(items[0]));element.setAttribute('aria-valuemax',String(items.at(-1)));}
  const needsPosition=changed||current!==nextIndex;setCurrent(nextIndex);
  if(needsPosition){win.clearTimeout(settleTimer);win.cancelAnimationFrame(positionFrame);element.scrollTop=current*rowHeight();positionFrame=win.requestAnimationFrame(()=>{positionFrame=0;if(!disposed)element.scrollTop=current*rowHeight();});}
 };
 update(values,value);
 return {update,align:()=>align(current),destroy:()=>{disposed=true;win.clearTimeout(settleTimer);win.cancelAnimationFrame(scrollFrame);win.cancelAnimationFrame(positionFrame);element.removeEventListener('scroll',onScroll);element.removeEventListener('scrollend',settle);element.removeEventListener('keydown',onKey);element.removeEventListener('pointerdown',onPointerDown);element.removeEventListener('pointermove',onPointerMove);element.removeEventListener('pointerup',onPointerEnd);element.removeEventListener('pointercancel',onPointerCancel);}};
}

export function initDatePickers(root=document){
 const cleanups=[];let openPicker=null;
 root.querySelectorAll('input[type="date"],input[type="datetime-local"],input[type="time"]').forEach(input=>{
  if(input.dataset.knDateReady)return;input.dataset.knDateReady='true';
  const type=input.type,birthday=input.dataset.datePurpose==='birthday'||input.name==='birth-date',doc=input.ownerDocument,win=doc.defaultView,phone=input.closest('.phone')||doc.body;
  const oldTab=input.getAttribute('tabindex'),oldHidden=input.getAttribute('aria-hidden');
  input.classList.add('kn-date-source');input.tabIndex=-1;input.setAttribute('aria-hidden','true');
  const trigger=doc.createElement('button');trigger.type='button';trigger.className='kn-date-trigger';trigger.setAttribute('aria-haspopup','dialog');trigger.setAttribute('aria-expanded','false');
  const label=input.labels?.[0]?.textContent?.trim()||(type==='time'?'時間':'日期');
  trigger.innerHTML=`<span class="kn-date-value"></span>${type==='time'?timeIcon:calendarIcon}`;input.after(trigger);
  const sync=()=>{trigger.querySelector('.kn-date-value').textContent=input.disabled?'未設定':formatPickerValue(input.value,type);trigger.disabled=input.disabled;trigger.classList.toggle('is-empty',!input.value||input.disabled);trigger.setAttribute('aria-label',`${label}，${input.disabled?'未設定':formatPickerValue(input.value,type)}`);};sync();
  const scheduleSync=()=>queueMicrotask(sync);root.addEventListener('change',scheduleSync);input.addEventListener('input',sync);input.addEventListener('change',sync);
  const observer=new win.MutationObserver(sync);observer.observe(input,{attributes:true,attributeFilter:['disabled','value','min','max']});
  let disposeDialog=null;
  const open=()=>{
   if(input.disabled)return;openPicker?.();
   const now=new Date(),fallback=birthday?new Date(2000,0,1,12):now;
   const limits={min:input.min,max:input.max,birthday,now};
   let selected=parseLocalPickerValue(input.value,type,fallback,now);if(Number.isNaN(selected.getTime()))selected=fallback;
   let y=selected.getFullYear(),m=selected.getMonth()+1,d=selected.getDate(),h=selected.getHours(),minute=selected.getMinutes();
   const value=()=>type==='time'?`${pad(h)}:${pad(minute)}`:`${y}-${pad(m)}-${pad(d)}${type==='datetime-local'?`T${pad(h)}:${pad(minute)}`:''}`;
   const assign=value=>{const next=parseLocalPickerValue(value,type,fallback,now);y=next.getFullYear();m=next.getMonth()+1;d=next.getDate();h=next.getHours();minute=next.getMinutes();};
   assign(clampPickerValue(value(),type,limits));
   const min=limits.min?parseLocalPickerValue(limits.min,type,fallback,now):null;
   const maximum=birthday&&(!limits.max||limits.max>dateValue(now))?dateValue(now):limits.max;
   const max=maximum?parseLocalPickerValue(maximum,type,fallback,now):null;
   const minYear=min?.getFullYear()??(birthday?Math.min(1900,y):Math.min(now.getFullYear(),y));
   const maxYear=max?.getFullYear()??(birthday?Math.max(now.getFullYear(),y):Math.max(now.getFullYear()+5,y));
   const dialog=doc.createElement('dialog');dialog.className='kn-date-picker';dialog.dataset.pickerType=type;dialog.dataset.datePurpose=birthday?'birthday':'general';
   const scrim=doc.createElement('div');scrim.className='kn-date-scrim';scrim.setAttribute('aria-hidden','true');
   const wheel=(part,label)=>`<div class="kn-date-column"><span aria-hidden="true">${label}</span><div class="kn-date-wheel" role="spinbutton" tabindex="0" aria-label="${label}" data-date-part="${part}"></div></div>`;
   dialog.innerHTML=`<div class="kn-date-handle" aria-hidden="true"></div><header><h2>${birthday?'選擇生日':type==='time'?'選擇時間':type==='date'?'選擇日期':'選擇日期與時間'}</h2></header>${type==='datetime-local'?'<div class="kn-date-shortcuts"><button type="button" data-date-shortcut="0">今天</button><button type="button" data-date-shortcut="1">明天</button><button type="button" data-date-shortcut="weekend">週末</button></div>':''}${type!=='time'?`<div class="kn-date-columns">${wheel('year','年')}${wheel('month','月')}${wheel('day','日')}</div>`:''}${type!=='date'?`<div class="kn-time-columns">${wheel('hour','時')}<span class="kn-time-colon" aria-hidden="true">:</span>${wheel('minute','分')}</div>`:''}<span class="kn-date-announcement" aria-live="polite" aria-atomic="true"></span><p class="kn-date-error" role="alert" hidden></p><button type="button" class="kn-date-confirm">確定</button>`;
   const headingId=`kn-date-heading-${input.id||'field'}`;dialog.querySelector('h2').id=headingId;dialog.setAttribute('aria-labelledby',headingId);
   const sameDate=boundary=>boundary&&boundary.getFullYear()===y&&boundary.getMonth()+1===m&&boundary.getDate()===d;
   const options=part=>{
    if(part==='year')return numbers(minYear,maxYear);
    if(part==='month')return numbers(min?.getFullYear()===y?min.getMonth()+1:1,max?.getFullYear()===y?max.getMonth()+1:12);
    if(part==='day')return numbers(min?.getFullYear()===y&&min.getMonth()+1===m?min.getDate():1,max?.getFullYear()===y&&max.getMonth()+1===m?max.getDate():daysIn(y,m));
    if(part==='hour')return numbers(sameDate(min)?min.getHours():0,sameDate(max)?max.getHours():23);
    return numbers(sameDate(min)&&min.getHours()===h?min.getMinutes():0,sameDate(max)&&max.getHours()===h?max.getMinutes():59);
   };
   const current=part=>({year:y,month:m,day:d,hour:h,minute}[part]);
   const wheels=new Map();
   const refresh=()=>{for(const[part,wheel]of wheels)wheel.update(options(part),current(part));dialog.querySelector('.kn-date-announcement').textContent=formatPickerValue(value(),type);dialog.querySelector('.kn-date-error').hidden=true;};
   const onChange=(part,n)=>{if(part==='year')y=n;if(part==='month')m=n;if(part==='day')d=n;if(part==='hour')h=n;if(part==='minute')minute=n;d=clampCalendarDay(y,m,d);assign(clampPickerValue(value(),type,limits));refresh();};
   const position=()=>{const r=phone.getBoundingClientRect(),width=Math.min(birthday?352:400,r.width-(birthday?32:16));dialog.style.width=`${width}px`;dialog.style.left=`${r.left+(r.width-width)/2}px`;dialog.style.bottom=`${Math.max(8,win.innerHeight-r.bottom+8)}px`;dialog.style.maxHeight=`${Math.max(260,r.height-38)}px`;for(const wheel of wheels.values())wheel.align();};
   let clearDismiss;
   const close=(restore=true)=>{clearDismiss?.();dialog.removeEventListener('cancel',cancel);win.removeEventListener('resize',position);win.visualViewport?.removeEventListener('resize',position);win.visualViewport?.removeEventListener('scroll',position);for(const wheel of wheels.values())wheel.destroy();if(dialog.open)dialog.close();dialog.remove();scrim.remove();trigger.setAttribute('aria-expanded','false');disposeDialog=null;openPicker=null;if(restore&&trigger.isConnected)trigger.focus();};
   const cancel=e=>{e.preventDefault();close();};disposeDialog=()=>close(false);openPicker=disposeDialog;dialog.addEventListener('cancel',cancel);
   clearDismiss=bindSheetDismiss(dialog,()=>close());
   dialog.addEventListener('click',e=>{if(e.target===dialog){const r=dialog.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)close();}});
   dialog.querySelectorAll('[data-date-shortcut]').forEach(button=>button.addEventListener('click',()=>{const next=new Date(now);next.setDate(now.getDate()+(button.dataset.dateShortcut==='weekend'?((6-now.getDay()+7)%7||7):Number(button.dataset.dateShortcut)));y=next.getFullYear();m=next.getMonth()+1;d=next.getDate();assign(clampPickerValue(value(),type,limits));refresh();}));
   dialog.querySelector('.kn-date-confirm').addEventListener('click',()=>{const result=value(),error=dialog.querySelector('.kn-date-error');if(clampPickerValue(result,type,limits)!==result){error.hidden=false;error.textContent=birthday?'生日不能晚於今天。':'請選擇有效範圍內的時間。';return;}input.value=result;sync();close();input.dispatchEvent(new win.Event('input',{bubbles:true}));input.dispatchEvent(new win.Event('change',{bubbles:true}));});
   phone.append(scrim,dialog);position();dialog.showModal();
   dialog.querySelectorAll('[data-date-part]').forEach(element=>{const part=element.dataset.datePart;wheels.set(part,createWheel(element,{values:options(part),value:current(part),label:element.getAttribute('aria-label'),onChange:n=>onChange(part,n)}));});
   refresh();trigger.setAttribute('aria-expanded','true');win.addEventListener('resize',position);win.visualViewport?.addEventListener('resize',position);win.visualViewport?.addEventListener('scroll',position);dialog.querySelector('.kn-date-wheel')?.focus({preventScroll:true});
  };
  trigger.addEventListener('click',open);
  const labels=[...(input.labels||[])],labelClick=e=>{if(e.target.closest('button'))return;e.preventDefault();trigger.focus();open();};labels.forEach(label=>label.addEventListener('click',labelClick));
  cleanups.push(()=>{disposeDialog?.();observer.disconnect();root.removeEventListener('change',scheduleSync);input.removeEventListener('input',sync);input.removeEventListener('change',sync);trigger.removeEventListener('click',open);labels.forEach(label=>label.removeEventListener('click',labelClick));trigger.remove();input.classList.remove('kn-date-source');delete input.dataset.knDateReady;if(oldTab===null)input.removeAttribute('tabindex');else input.setAttribute('tabindex',oldTab);if(oldHidden===null)input.removeAttribute('aria-hidden');else input.setAttribute('aria-hidden',oldHidden);});
 });
 return ()=>cleanups.forEach(cleanup=>cleanup());
}
