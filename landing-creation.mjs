import {landingInformation} from './compat/web-naming/landing-handoff.mjs';
import {normalizeOnboardingConversation} from './conversation-onboarding.mjs?v=20261031-product-sync';

const clone=value=>JSON.parse(JSON.stringify(value));
const fields=['birthDate','birthTime','gender','birthPlace','response'];
export const isLandingCreation=bootstrap=>bootstrap?.landingCreation?.flow==='landing-v1';

// Only the actual completed questionnaire and signed paper can start creation.
// Keep the request alongside this account's draft so explicit retries reuse it.
export function prepareLandingSubmission(state,{randomUUID=()=>globalThis.crypto.randomUUID()}={}){
 const input=landingInformation(state),contract=state.onboarding?.contract;
 if(!input||fields.some(key=>!Object.hasOwn(input,key))||!contract||contract.version!==1||!(contract.signedAt>0)||contract.userName!==input.userName||contract.companionName!==input.agentName||state.onboarding?.conversation?.step!=='complete')return null;
 input.contract=clone(contract);
 const previous=state.onboarding.creationRequest;
 if(previous?.requestId&&JSON.stringify(previous.input)===JSON.stringify(input))return clone(previous);
 const result={requestId:randomUUID(),input};
 state.onboarding.creationRequest=clone(result);
 return result;
}

// This is a server-held receipt for this new-flow account, not a local selector.
// Restore only the intake fields, retaining history, card edits and other data.
export function restoreLandingSubmission(state,bootstrap){
 if(!isLandingCreation(bootstrap)||bootstrap.landingCreation.state!=='submitted')return false;
 const receipt=bootstrap.landingCreation,input=receipt.input,contract=input?.contract;
 if(!input||fields.some(key=>!Object.hasOwn(input,key))||contract?.version!==1||!Number.isFinite(contract.signedAt)||contract.signedAt<=0||contract.userName!==input.userName||contract.companionName!==input.agentName)return false;
 if(bootstrap.onboarding?.status==='completed'){
  // A fresh browser has no local nickname. Restore only the default display
  // name from the signed receipt, preserving later local edits and onboarding.
  if(!state.users.a.companionName||state.users.a.companionName==='Klin'){
   const savedName=state.private.a.companion.name;
   const name=savedName&&savedName!=='Klin'?savedName:input.agentName;
   state.users.a.companionName=name;state.private.a.companion.name=name;
  }
  return true;
 }
 if(bootstrap.onboarding?.status!=='required')return false;
 const answers={where:'我在哪兒',...Object.fromEntries(fields.map(key=>[key,input[key]])),contractLight:'打開我們的契約',name:input.userName,companionName:input.agentName};
 const conversation=normalizeOnboardingConversation({version:3,answers,messages:[],complete:false,migration:{implicitInteractions:['where','contractLight']}},Math.max(state.now,Date.now()));
 if(conversation.step!=='complete')return false;
 const same=state.onboarding.creationRequest?.requestId===receipt.requestId&&JSON.stringify(state.onboarding.creationRequest.input)===JSON.stringify(input);
 if(!same||state.onboarding.conversation?.step!=='complete'){
  state.onboarding.conversation=conversation;
  state.onboarding.contract=clone(contract);
  state.onboarding.contractRequired=true;
  state.onboarding.creationRequest={requestId:receipt.requestId,input:clone(input)};
  state.users.a.name=input.userName;state.users.a.companionName=input.agentName;
  Object.assign(state.private.a.birth,{date:input.birthDate,time:input.birthTime||'',unknownTime:input.birthTime===null,place:input.birthPlace||''});
  state.private.a.about={...(state.private.a.about||{}),gender:input.gender||''};
  state.private.a.companion.name=input.agentName;
 }
 return true;
}

export function creationHandoffInformation(bootstrap,state){
 if(!isLandingCreation(bootstrap))return landingInformation(state);
 if(bootstrap.landingCreation.state!=='submitted'||bootstrap.agent?.status!=='bound')return null;
 const input=bootstrap.landingCreation.input;
 if(!input)return null;
 return Object.fromEntries(['userName','agentName',...fields].map(key=>[key,input[key]]));
}
