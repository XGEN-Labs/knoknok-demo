const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
// Autofill may update the field without an input event. Trust the submitted
// account value, and check its routing before sending any password.
export function submitAuthEntryForm(controller,fields,{onUsernameCheck=()=>{}}={}){
 const view=controller.getState();
 if(view.busy||!['entry','login','register'].includes(view.step))return view;
 const username=String(fields.username??'');
 if(view.step==='entry'||username!==view.username){
  onUsernameCheck(username);
  if(view.step!=='entry')controller.changeUsername(username);
  return controller.entry(username);
 }
 return view.step==='register'?controller.register(fields.password||'',fields.confirmPassword||''):controller.signIn(fields.password||'');
}
export function authEntryPanel(view,{draft=undefined,passwordVisible=false,remaining=0,password='',confirmPassword=''}={}){
 const entry=view.step==='entry',registration=view.step==='register',setup=view.step==='setup',recover=view.step==='bootstrap',assigned=view.passwordMode==='assigned_password';
 const field=(name,label,autocomplete)=>`<div class="field auth-field"><label for="auth-${name}">${label}</label><div class="auth-password-wrap"><input class="input" id="auth-${name}" name="${name}" type="${passwordVisible?'text':'password'}" autocomplete="${autocomplete}" aria-describedby="auth-error" placeholder="${label}" value="${esc(name==='password'?password:confirmPassword)}" required>${name==='password'?`<button type="button" class="password-visibility" data-action="auth-show-password" aria-label="${passwordVisible?'隱藏密碼':'顯示密碼'}" aria-pressed="${passwordVisible}">${passwordVisible?'隱藏':'顯示'}</button>`:''}</div></div>`;
 const account=`<div class="field auth-field"><label for="auth-username">帳號</label><input class="input" id="auth-username" name="username" type="text" autocomplete="username" autocapitalize="none" spellcheck="false" value="${esc(draft===undefined?view.username:draft)}" placeholder="請輸入帳號" aria-describedby="auth-error" ${view.busy?'disabled':''} required></div>`;
 const title=entry?'歡迎來到 Knoknok':registration?'建立你的帳號':setup?'帳號已就緒':recover?'恢復你的帳號':'歡迎回來';
 const brand=`<div class="auth-heading"><h1 class="auth-form-brand" aria-label="NokNok · ${entry?'登入或註冊':registration?'建立你的帳號':'登入'}"><img class="brand-logo" data-logo-tone="dark" src="assets/brand-20261027-noknok/noknok-selected-white.png" alt="" width="2172" height="724"></h1></div>`;
 if(setup||recover)return `<div class="auth-heading"><h1>${title}</h1></div><p class="auth-state-copy">${setup?'Agent 尚未準備好。':'正在確認登入狀態…'}</p><div id="auth-error" class="auth-error" role="alert">${esc(view.error||'')}</div><div class="auth-state-actions"><button type="button" class="btn dark" data-action="auth-bootstrap" ${view.busy||remaining?'disabled':''}>${view.busy?'正在確認':remaining?`${remaining} 秒後重試`:'重新載入'}</button><button type="button" class="text-button" data-action="auth-exit">${setup?'退出帳號':'回到首頁'}</button></div>`;
 return `${brand}<form class="auth-form" id="auth-form" data-form="auth-entry-flow" novalidate>${account}${entry?'':field('password',registration?(assigned?'內測密碼':'設定密碼'):'密碼',registration?'new-password':'current-password')+(registration&&!assigned?field('confirmPassword','確認密碼','new-password'):'')}<div id="auth-error" class="auth-error" role="alert">${esc(view.error||'')}</div>${view.errorCode==='account_not_found'?'<button type="button" class="text-button" data-action="auth-recheck">重新檢查帳號</button>':''}<div class="auth-submit"><button type="submit" class="btn dark" ${view.busy||remaining?'disabled':''}><span>${view.busy?(entry?'正在檢查…':registration?'正在註冊…':'正在登入…'):remaining?`${remaining} 秒後重試`:entry?'登入或註冊':registration?'註冊並進入':'登入'}</span></button></div></form>`;
}
