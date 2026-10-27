// One CSS-pixel desktop caret. Touch selection, IME and forced colors retain
// the native caret so composing and selection handles remain platform-owned.
export const FINE_CARET_INPUTS='input:not([type]),input[type="text"],input[type="password"],input[type="search"],input[type="email"],input[type="tel"],input[type="url"],textarea';
export function fineCaretActive({focused,composing,start,end,disabled,readOnly}){return focused&&!composing&&!disabled&&!readOnly&&start!==null&&start===end;}
export function initAuthCaret(root) {
  const document=root.ownerDocument||root,view=document.defaultView;
  if(!view.matchMedia('(pointer:fine)').matches||view.matchMedia('(forced-colors:active)').matches)return()=>{};
  const controller=new view.AbortController(),signal=controller.signal,records=[],parents=new Map();
  for(const input of root.querySelectorAll(FINE_CARET_INPUTS)){
    const parent=input.parentElement;
    if(view.getComputedStyle(parent).position==='static'&&!parents.has(parent)){parents.set(parent,parent.style.position);parent.style.position='relative';}
    const caret=document.createElement('span');caret.className='auth-fine-caret';caret.setAttribute('aria-hidden','true');caret.hidden=true;input.after(caret);
    const mirror=document.createElement('div');mirror.setAttribute('aria-hidden','true');mirror.style.cssText='position:absolute;visibility:hidden;pointer-events:none;left:0;top:0;margin:0;padding:0;border:0;';parent.append(mirror);
    const marker=document.createElement('span');marker.textContent='\u200b';
    let composing=false;
    const update=()=>{
      const css=view.getComputedStyle(input),start=input.selectionStart;
      const active=fineCaretActive({focused:document.activeElement===input,composing,start,end:input.selectionEnd,disabled:input.disabled,readOnly:input.readOnly});
      input.classList.toggle('has-fine-caret',active);caret.hidden=!active;if(!active)return;
      const multiline=input.tagName==='TEXTAREA',text=input.value.slice(0,start),left=parseFloat(css.paddingLeft)||0,right=parseFloat(css.paddingRight)||0,top=parseFloat(css.paddingTop)||0;
      mirror.style.font=css.font;mirror.style.letterSpacing=css.letterSpacing;mirror.style.lineHeight=css.lineHeight;mirror.style.wordSpacing=css.wordSpacing;
      mirror.style.whiteSpace=multiline?'pre-wrap':'pre';mirror.style.overflowWrap=multiline?'break-word':'normal';mirror.style.width=multiline?`${input.clientWidth-left-right}px`:'max-content';
      mirror.replaceChildren(document.createTextNode(input.type==='password'?'•'.repeat(text.length):text),marker);
      const mr=mirror.getBoundingClientRect(),mark=marker.getBoundingClientRect();
      const x=(parseFloat(css.borderLeftWidth)||0)+left+mark.left-mr.left-input.scrollLeft;
      const height=parseFloat(css.fontSize)*1.2,lineHeight=parseFloat(css.lineHeight)||height;
      const y=multiline?(parseFloat(css.borderTopWidth)||0)+top+mark.top-mr.top+(lineHeight-height)/2-input.scrollTop:(input.offsetHeight-height)/2;
      caret.hidden=x<left-1||x>input.clientWidth-right+1||y<0||y+height>input.clientHeight+2;
      caret.style.left=`${input.offsetLeft+x}px`;caret.style.top=`${input.offsetTop+y}px`;caret.style.height=`${height}px`;
    };
    for(const type of ['input','keyup','click','focus','blur','scroll','select'])input.addEventListener(type,update,{signal});
    input.addEventListener('compositionstart',()=>{composing=true;update()},{signal});
    input.addEventListener('compositionend',()=>{composing=false;update()},{signal});
    document.addEventListener('selectionchange',update,{signal});view.addEventListener('resize',update,{signal});
    records.push({input,caret,mirror});
  }
  return()=>{controller.abort();for(const{input,caret,mirror}of records){input.classList.remove('has-fine-caret');caret.remove();mirror.remove();}for(const[parent,position]of parents)parent.style.position=position;};
}
