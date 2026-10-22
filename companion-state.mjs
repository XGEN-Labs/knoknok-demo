// Only a fresh authenticated server response may call this function.
export function applyCompanionBinding(state, binding) {
  state.companionBinding=binding;
  if(binding?.state==='ready') {
    state.users.a.name=binding.userName;
    state.users.a.companionName=binding.companionName;
    state.private.a.companion.name=binding.companionName;
    state.onboarding.status='ready';
  } else {
    // Cached landing completion is not proof of native Agent creation.
    state.onboarding.status='pending';
    if(state.onboarding.conversation)state.onboarding.conversation.complete=false;
    if(binding?.state==='pending') {
      state.users.a.name=binding.userName;
      state.users.a.companionName=binding.companionName;
    }
  }
  return state;
}
export function selectLandingCharacter(characters, pending) {
  // This landing currently renders Klin. A nickname is not a character selector.
  const choices=characters.filter(c=>pending ? c.key===pending.character.key : c.name.toLowerCase()==='klin');
  if(choices.length!==1)throw Error('當前角色版本尚未準備好，請稍後重試。');
  return choices[0];
}
