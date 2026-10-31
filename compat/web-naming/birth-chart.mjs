// The native chart is authoritative; no browser date-only calculation or chat delivery.
export const SHARED_BIRTH_CHART_PROTOCOL = 'shared-birth-chart-v1';
export const isSharedBirthChart = bootstrap => bootstrap?.birthChart?.protocol === SHARED_BIRTH_CHART_PROTOCOL;
export function validBirthChart(chart) {
  return /^[a-f0-9]{64}$/.test(chart?.id || '') && Number.isSafeInteger(chart.version) && chart.version > 0 &&
    typeof chart.labels?.dayMaster === 'string' && Boolean(chart.labels.dayMaster.trim()) &&
    typeof chart.labels?.zodiac === 'string' && Boolean(chart.labels.zodiac.trim()) &&
    (chart.labels.element === undefined || ['wood','fire','earth','metal','water'].includes(chart.labels.element));
}
export function birthChartInput(form) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(form['birth-date'] || '') || !/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(form['birth-time'] || '') ||
      !['男','女'].includes(form['birth-sex']) || !['Asia/Shanghai','Asia/Hong_Kong'].includes(form['birth-timezone']) ||
      !['solar','lunar'].includes(form.calendar) || !['否','是'].includes(form['leap-month']) ||
      form['timezone-confirmed'] !== '已确认' || form['chart-consent'] !== '同意') throw new Error('請確認完整出生資料、準確時間、時區與保存同意。');
  return Object.fromEntries(['birth-date','birth-time','birth-sex','birth-timezone','calendar','leap-month','timezone-confirmed','chart-consent'].map(key => [key,form[key]]));
}
export async function submitBirthChart(api, owner, form, { signal, wait = ms => new Promise(resolve => setTimeout(resolve, ms)) } = {}) {
  signal?.throwIfAborted();
  await api.saveBirthChart(birthChartInput(form), owner, signal);
  for (let attempt = 0; attempt < 30; attempt++) {
    signal?.throwIfAborted();
    const result = await api.bootstrap(signal);
    if (String(result?.user?.id) !== String(owner)) throw Object.assign(new Error('登入帳號已變更。'), {code:'SESSION_CHANGED'});
    if (result.birthChart?.status === 'ready') {
      const chart = result.birthChart.chart;
      if (!validBirthChart(chart)) throw new Error('排盤結果不完整，請稍後再試。');
      return chart;
    }
    if (result.agent?.initialization?.state === 'blocked') throw new Error('出生資料或家族設定需要核對，請聯絡管理員。');
    await wait(1000);
  }
  throw new Error('排盤仍在處理中，請稍後重新確認狀態。');
}
export function birthChartForm(state, esc) {
  const saved = state.onboarding?.birthChart;
  if (validBirthChart(saved)) return `<p role="status" data-birth-chart>日主：${esc(saved.labels.dayMaster)} · 星座：${esc(saved.labels.zodiac)}</p>`;
  const answers = state.onboarding?.conversation?.answers || {};
  const draft = state.onboarding?.birthChartDraft || {};
  const selected = (key, value) => draft[key] === value ? ' selected' : '';
  return `<form data-form="birth-chart" class="landing-form-card"><h3>確認排盤資料</h3>
  <p>出生資料私有保存，日主與星座會顯示在名片。請填準確時間；只有時辰或時間未知時，先核對後再排盤。</p>
  <label for="chart-date">出生日期（必填）</label><input id="chart-date" name="birth-date" type="date" value="${esc(draft['birth-date'] ?? answers.birthDate ?? '')}" required>
  <label for="chart-time">當地出生時間（必填）</label><input id="chart-time" name="birth-time" type="time" required value="${esc(draft['birth-time'] || '')}">
  <label for="chart-sex">排盤性別（必填）</label><select id="chart-sex" name="birth-sex" required><option value="">請選擇</option><option${selected('birth-sex','男')}>男</option><option${selected('birth-sex','女')}>女</option></select>
  <label for="chart-zone">出生時區（必填）</label><select id="chart-zone" name="birth-timezone" required><option value="">請選擇</option><option value="Asia/Shanghai"${selected('birth-timezone','Asia/Shanghai')}>上海</option><option value="Asia/Hong_Kong"${selected('birth-timezone','Asia/Hong_Kong')}>香港</option></select>
  <label for="chart-calendar">歷法（必填）</label><select id="chart-calendar" name="calendar" required><option value="">請選擇</option><option value="solar"${selected('calendar','solar')}>公曆</option><option value="lunar"${selected('calendar','lunar')}>農曆</option></select>
  <label for="chart-leap">是否農曆閏月（必填）</label><select id="chart-leap" name="leap-month" required><option value="">請選擇</option><option${selected('leap-month','否')}>否</option><option${selected('leap-month','是')}>是</option></select>
  <label class="chart-check"><input type="checkbox" name="timezone-confirmed" value="已确认" required${draft['timezone-confirmed']==='已确认'?' checked':''}>我已確認出生時間與時區</label>
  <label class="chart-check"><input type="checkbox" name="chart-consent" value="同意" required${draft['chart-consent']==='同意'?' checked':''}>同意保存排盤結果，用於家族匹配、名片標籤與 Noking</label>
  <button type="submit" class="btn">保存並排盤</button><p data-chart-error role="alert"></p></form>`;
}
