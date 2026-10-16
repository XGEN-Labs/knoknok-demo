// Sound is off until the user explicitly enables it. All tones are local.
export function createSceneSound(){
 let context, enabled=false;
 function cue(kind='reply'){
  if(!enabled||!context||context.state!=='running')return;
  const notes=kind==='portal'?[220,330,440]:kind==='send'?[392]:[523.25,659.25];
  notes.forEach((frequency,index)=>{
   const oscillator=context.createOscillator(), gain=context.createGain(),start=context.currentTime+index*.1;
   oscillator.type='sine';oscillator.frequency.value=frequency;
   gain.gain.setValueAtTime(0,start);gain.gain.linearRampToValueAtTime(.045,start+.018);gain.gain.exponentialRampToValueAtTime(.0001,start+.34);
   oscillator.connect(gain);gain.connect(context.destination);oscillator.start(start);oscillator.stop(start+.36);
   oscillator.onended=()=>{oscillator.disconnect();gain.disconnect();};
  });
 }
 return {async setEnabled(value){
  enabled=Boolean(value);
  if(enabled){const Audio=globalThis.AudioContext||globalThis.webkitAudioContext;if(!Audio){enabled=false;return false;}context??=new Audio();await context.resume();cue('reply');}
  else if(context)await context.suspend();
  return enabled;
 },cue};
}
