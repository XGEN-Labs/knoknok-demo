// Browser-local demonstration of an account-owned saved room. This is not an
// authentication store: it contains no password, hash, token or cookie.
export function freshDemoAccountState(initial){
 const state=JSON.parse(JSON.stringify(initial)),owner=state.users.a,space=state.private.a;
 Object.assign(owner,{name:'',bio:'',region:'',cardTags:[],cardLabels:{},cardAvatar:'',cardTagsEdited:false,shareRegion:false});
 space.memory=[];space.companionMessages=[];delete space.socialTags;
 space.birth={date:'',time:'',unknownTime:true,place:'',timezone:''};
 return state;
}
export function createDemoAccountRooms({storage=null,key='knok-demo-rooms',serialize=JSON.stringify,hydrate=JSON.parse}={}){
 const rooms=new Map();
 try{const saved=JSON.parse(storage?.getItem(key)||'[]');if(Array.isArray(saved))for(const row of saved)if(Array.isArray(row)&&typeof row[0]==='string'&&typeof row[1]==='string')rooms.set(row[0],row[1]);}catch{}
 return {
  save(userId,state){if(typeof userId!=='string'||!userId||state?.session?.localAuthUserId!==userId)return false;rooms.set(userId,serialize(state));try{storage?.setItem(key,JSON.stringify([...rooms]));}catch{}return true;},
  load(userId){if(typeof userId!=='string'||!rooms.has(userId))return null;try{const value=hydrate(rooms.get(userId));return value?.session?.localAuthUserId===userId?value:null;}catch{return null;}},
  remove(userId){rooms.delete(userId);try{storage?.setItem(key,JSON.stringify([...rooms]));}catch{}},
 };
}
