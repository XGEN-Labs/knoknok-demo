import {initialState, reduce} from './model.mjs?v=20261026-experience-41c';

/** Local prototype validation. Credentials are never copied into demo state. */
export function validateRegistration({account = '', password = '', confirmPassword = ''} = {}) {
  const errors = {}, name = String(account).trim(), secret = String(password), confirmation = String(confirmPassword);
  if (!name) errors.account = '請填寫帳號。';
  else if (Array.from(name).length < 3 || Array.from(name).length > 30) errors.account = '帳號需要 3–30 個字元。';
  if (!secret.trim()) errors.password = '請設定密碼。';
  else if (secret.length < 6 || secret.length > 64) errors.password = '密碼需要 6–64 個字元。';
  if (!confirmation) errors.confirmPassword = '請再輸入一次密碼。';
  else if (confirmation !== secret) errors.confirmPassword = '兩次密碼不一致，請再確認。';
  return errors;
}

export function submitDemoRegistration(draft, now = Date.now()) {
  const errors = validateRegistration(draft);
  if (Object.keys(errors).length) return {errors, state: null};
  return {errors, state: reduce(initialState(now), {type: 'DEMO_LOGIN', provider: 'demo', now})};
}
