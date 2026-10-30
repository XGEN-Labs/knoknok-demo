export const DEFAULT_PROFILE_INTRODUCTION='想和新朋友，慢慢聊些喜歡的事。';
export const PROFILE_LANGUAGES=Object.freeze(['粵語','普通話','英語']);
export function migrateProfileIntroduction(user){
 if(!user||user.bioDefaultVersion===1)return user;
 if(typeof user.bio!=='string'||!user.bio.trim())user.bio=DEFAULT_PROFILE_INTRODUCTION;
 user.bioDefaultVersion=1;
 return user;
}
