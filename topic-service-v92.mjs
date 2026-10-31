import {TOPIC_SKILLS} from './topic-journey-v92.mjs?v=20261031-noking-v06e';
/** Existing Web chat gateway. Runtime execute_skill is Agent-selected from its
 * published persona pack; no Studio authoring endpoint or invented skill ID.
 * Text replies cannot establish tag/diary/match/completed business events. */
export function createChatTopicProvider({chat,getOwner}={}){
 if(typeof chat!=='function'||typeof getOwner!=='function')throw new Error('主題聊天服務尚未配置。');
 const calls=new Map();
 return {run(request){
  const currentOwner=String(getOwner()||'');
  if(!currentOwner||currentOwner!==String(request.accountId))return Promise.reject(new Error('登入狀態已改變，請重新開啟主題。'));
  const signature=JSON.stringify(request);
  if(calls.has(request.id)){const cached=calls.get(request.id);return cached.signature===signature?cached.work:Promise.reject(new Error('請求編號與內容不一致，請重新開啟主題。'));}
  const work=(async()=>{
   const owner=String(getOwner()||'');if(!owner||owner!==String(request.accountId))throw new Error('登入狀態已改變，請重新開啟主題。');
   const topic=TOPIC_SKILLS.find(t=>t.id===request.topicId);if(!topic)throw new Error('找不到這個主題。');
   const start={role:'user',content:`我想聊聊「${topic.label}」，請用你適合的能力陪我看看。`};
   const messages=[start,...request.messages.filter(m=>['user','assistant'].includes(m.role)).map(m=>({role:m.role,content:String(m.text).slice(0,4000)}))];
   if(request.input.type==='finish')messages.push({role:'user',content:'這個主題先聊到這裡，請幫我整理這次對話；如果適合，請用你的能力看看有沒有適合認識的新朋友。'});
   while(messages.length>2&&new TextEncoder().encode(JSON.stringify({messages})).length>15000)messages.splice(1,1);
   if(new TextEncoder().encode(JSON.stringify({messages})).length>15000)throw new Error('訊息內容太長，請縮短後重新開啟主題。');
   const result=await chat(messages,owner);
   if(String(getOwner()||'')!==owner)throw new Error('登入狀態已改變，這次回應沒有套用。');
   if(result?.provider!=='knok-agent'||result?.source!=='model'||!result?.text?.trim())throw new Error('Agent 能力服務暫時不可用，這次沒有生成標籤或匹配。');
   return [{id:`${request.id}:reply`,ownerId:request.ownerId,sessionId:request.sessionId,type:'reply',payload:{text:result.text},source:'knok-agent'}];
  })();calls.set(request.id,{signature,work});return work;
 }};
}
