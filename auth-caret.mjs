// A one-CSS-pixel desktop caret; touch selection and IME keep the native caret.
export function initAuthCaret(root) {
  const document=root.ownerDocument||root,view=document.defaultView;
  if(!view.matchMedia('(pointer:fine)').matches||view.matchMedia('(forced-colors:active)').matches)return()=>{};
  const controller=new view.AbortController(),signal=controller.signal,records=[];
  for(const input of root.querySelectorAll('.auth-field > input[type="text"],.auth-field > input[type="password"]')){
    const caret=document.createElement('span');caret.className='auth-fine-caret';caret.setAttribute('aria-hidden','true');caret.hidden=true;input.after(caret);
    const mirror=document.createElement('span');mirror.style.cssText='position:absolute;visibility:hidden;white-space:pre;pointer-events:none';input.parentElement.append(mirror);
    let composing=false;
    const update=()=>{
      const css=view.getComputedStyle(input),start=input.selectionStart;
      const active=document.activeElement===input&&!composing&&start!==null&&start===input.selectionEnd;
      input.classList.toggle('has-fine-caret',active);caret.hidden=!active;if(!active)return;
      const text=input.value.slice(0,start);
      mirror.style.font=css.font;mirror.style.letterSpacing=css.letterSpacing;
      mirror.textContent=input.type==='password'?'•'.repeat(text.length):text;
      const x=parseFloat(css.borderLeftWidth)+parseFloat(css.paddingLeft)+mirror.offsetWidth-input.scrollLeft;
      const height=parseFloat(css.fontSize)*1.2;
      caret.style.left=`${input.offsetLeft+Math.max(parseFloat(css.paddingLeft),Math.min(input.clientWidth-parseFloat(css.paddingRight),x))}px`;
      caret.style.top=`${input.offsetTop+(input.offsetHeight-height)/2}px`;caret.style.height=`${height}px`;
    };
    for(const type of ['input','keyup','click','focus','blur','scroll','select'])input.addEventListener(type,update,{signal});
    input.addEventListener('compositionstart',()=>{composing=true;update()},{signal});
    input.addEventListener('compositionend',()=>{composing=false;update()},{signal});
    document.addEventListener('selectionchange',update,{signal});
    view.addEventListener('resize',update,{signal});
    records.push({input,caret,mirror});
  }
  return()=>{controller.abort();for(const{input,caret,mirror}of records){input.classList.remove('has-fine-caret');caret.remove();mirror.remove()}};
}
