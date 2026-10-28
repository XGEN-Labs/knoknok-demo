export class LiveRequestError extends Error {
  constructor(message, status = 0, code = '') { super(message); this.status = status; this.code = code; }
}
export function createLiveSession({fetchImpl = globalThis.fetch, onChange = () => {}, onSessionLost = () => {}} = {}) {
  let owner = null, epoch = 0, abort = new AbortController();
  let items = new Map(), transient = [], cursor = null, historyReady = false, historyBusy = false, sending = false, error = '';
  const deleted = new Set();
  const snapshot = () => ({owner, historyReady, historyBusy, sending, error,
    messages:[...items.values()].filter(m => m.kind === 'message').sort((a,b) => a.seq-b.seq).map(m => ({
      id:m.eventId, seq:m.seq, messageId:m.messageId, role:m.role || 'system', text:m.content ?? (m.status === 'scrubbed' ? '這則訊息已清除。' : '這則訊息已撤回。'),
      status:m.status, createdAt:m.at, source:'model', provider:'knok-agent',
    })).concat(transient)});
  const emit = () => { const value = snapshot(); onChange(value); return value; };
  async function request(path, {method = 'GET', body, timeout = 20000} = {}) {
    if (!owner) throw new LiveRequestError('請先登入。', 401);
    const version = epoch, currentOwner = owner;
    let response;
    try {
      response = await fetchImpl(path, {method, credentials:'same-origin', redirect:'error', cache:'no-store',
        headers:{Accept:'application/json','X-Knok-User-Id':currentOwner,...(body === undefined ? {} : {'Content-Type':'application/json'})},
        ...(body === undefined ? {} : {body:JSON.stringify(body)}),signal:AbortSignal.any([abort.signal,AbortSignal.timeout(timeout)])});
    } catch (failure) {
      if (version !== epoch) throw Object.assign(Error('session_changed'),{name:'AbortError'});
      throw new LiveRequestError('連線未完成。請先讀取目前結果，再決定下一步。');
    }
    if (version !== epoch) throw Object.assign(Error('session_changed'),{name:'AbortError'});
    let data;try { data=await response.json(); } catch { throw new LiveRequestError('服務回覆無法讀取。',response.status); }
    if (version !== epoch) throw Object.assign(Error('session_changed'),{name:'AbortError'});
    if (!response.ok) {
      const code=data?.code || data?.error?.code || (typeof data?.error==='string'?data.error:'');
      if (response.status===401 || ['SESSION_CHANGED','HISTORY_SESSION_CHANGED'].includes(code)) onSessionLost();
      throw new LiveRequestError(response.status===503?'這項服務暫時不可用，請稍後重新讀取。':response.status===409?'狀態已變更，請重新讀取後核對。':'操作未完成，請稍後再試。',response.status,code);
    }
    return data;
  }
  function apply(page) {
    for (const item of page.items) {
      if (!item || !['message','redaction'].includes(item.kind) || typeof item.eventId!=='string' || !Number.isSafeInteger(item.seq)) throw new LiveRequestError('聊天歷史格式無效。');
      if (item.kind==='redaction') {
        if (item.messageId) deleted.add(item.messageId);
        for(const [id,message] of items) if(message.messageId===item.messageId && item.messageId)items.set(id,{...message,content:null,status:'redacted'});
      } else {
        if(item.status==='scrubbed')items.set(item.eventId,{...item,content:null});
        else items.set(item.eventId,deleted.has(item.messageId)?{...item,content:null,status:'redacted'}:item);
      }
    }
  }
  async function history({full=false}={}) {
    if(!owner || historyBusy)return snapshot();
    const version=epoch;historyBusy=true;error='';emit();
    try {
      let next=full?null:cursor, reset=full||!historyReady, reloaded=false, pages=0;
      if(reset){items.clear();deleted.clear();cursor=null;historyReady=false;emit();}
      for (;;) {
        if(++pages>205)throw new LiveRequestError('聊天歷史超出本次讀取範圍。');
        let page;
        try { page=await request('/api/web/chat/history?limit=100'+(next?'&cursor='+encodeURIComponent(next):'')); }
        catch(failure){
          if(!reloaded && next && (failure.code==='HISTORY_CURSOR_STALE'||failure.code==='HISTORY_CURSOR_INVALID')){
            reloaded=true;next=null;items.clear();deleted.clear();cursor=null;historyReady=false;emit();continue;
          }
          throw failure;
        }
        if(version!==epoch)return snapshot();
        if(String(page.user?.id)!==owner || page.order!=='asc' || !Array.isArray(page.items) || typeof page.hasMore!=='boolean')throw new LiveRequestError('聊天歷史身份或格式不符。');
        if(page.items.some(item=>item.kind==='redaction'&&item.requiresReload) && next && !reloaded){
          reloaded=true;next=null;items.clear();deleted.clear();cursor=null;historyReady=false;emit();continue;
        }
        apply(page);
        if(!page.hasMore){cursor=page.resumeCursor||null;historyReady=true;transient=[];break;}
        if(typeof page.nextCursor!=='string'||!page.nextCursor||page.nextCursor===next)throw new LiveRequestError('聊天歷史分頁無效。');
        next=page.nextCursor;
      }
    }catch(failure){if(version===epoch&&failure.name!=='AbortError')error=failure.message;}
    finally {if(version===epoch){historyBusy=false;emit();}}
    return snapshot();
  }
  return {
    getState:snapshot,request,history,
    activate(id) { abort.abort();abort=new AbortController();epoch++;owner=id==null?null:String(id);items=new Map();deleted.clear();transient=[];cursor=null;historyReady=false;historyBusy=false;sending=false;error='';return emit(); },
    async chat(messages, expectedOwner, signal) {
      if(String(expectedOwner)!==owner || signal?.aborted)throw Object.assign(Error('session_changed'),{name:'AbortError'});
      const result=await request('/api/web/chat',{method:'POST',body:{messages},timeout:70000});
      if(typeof result?.text!=='string'||!result.text.trim()||result.source!=='model'||!['knok-agent','gemini'].includes(result.provider))throw new LiveRequestError('回覆尚未確認。');
      return result;
    },
    async send(text) {
      if(sending||historyBusy||!owner||!text.trim())return false;
      const version=epoch, input=text.trim();sending=true;error='';
      const context=snapshot().messages.filter(m=>m.source==='model'&&m.status==='complete'&&['user','assistant'].includes(m.role)).slice(-11).map(m=>({role:m.role,content:m.text.slice(0,4000)}));
      while(context.length&&new TextEncoder().encode(JSON.stringify({messages:[...context,{role:'user',content:input}]})).length>15000)context.shift();
      transient.push({id:crypto.randomUUID(),role:'user',text:input,status:'pending',source:'local'});emit();
      try {
        const result=await this.chat([...context,{role:'user',content:input}],owner);
        if(version!==epoch)return false;
        transient=transient.map(m=>({...m,status:'complete'}));
        transient.push({id:crypto.randomUUID(),role:'assistant',text:result.text,status:'complete',source:'model',provider:result.provider});
        emit();
        if(result.provider==='knok-agent')await history();
        else error='這次回覆由備援服務提供，不會出現在 Agent 的歷史紀錄。';
        return true;
      }catch(failure){
        if(version===epoch){transient=transient.map(m=>({...m,status:'unknown'}));error=failure.message;}
        return false;
      }finally{if(version===epoch){sending=false;emit();}}
    },
  };
}
