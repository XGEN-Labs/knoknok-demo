// The native chart is authoritative; no browser date-only calculation or chat delivery.
export async function submitBirthChart(api, owner, form, { signal, wait = ms => new Promise(resolve => setTimeout(resolve, ms)) } = {}) {
  await api.saveBirthChart(form, owner, signal);
  for (let attempt = 0; attempt < 30; attempt++) {
    signal?.throwIfAborted();
    const result = await api.bootstrap(signal);
    if (String(result?.user?.id) !== String(owner)) throw Object.assign(new Error('登入帳號已變更。'), {code:'SESSION_CHANGED'});
    if (result.birthChart?.status === 'ready' && result.agent?.status === 'bound') {
      const chart = result.birthChart.chart;
      if (!/^[a-f0-9]{64}$/.test(chart?.id || '') || !chart?.labels?.dayMaster || !chart?.labels?.zodiac) throw new Error('排盤結果不完整，請稍後再試。');
      return chart;
    }
    if (result.agent?.initialization?.state === 'blocked') throw new Error('出生資料或家族設定需要核對，請聯絡管理員。');
    await wait(1000);
  }
  throw new Error('排盤與伙伴建立仍在處理中，請稍後重試。');
}
export function birthChartForm(state, esc) {
  const saved = state.onboarding?.birthChart;
  if (saved) return `<p role="status">日主：${esc(saved.labels.dayMaster)} · 星座：${esc(saved.labels.zodiac)}</p>`;
  const answers = state.onboarding?.conversation?.answers || {};
  return `<form data-form="birth-chart" class="landing-form-card"><h3>確認排盤資料</h3>
  <p>出生資料私有保存，日主與星座會顯示在名片。請填準確時間；只有時辰或時間未知時，先核對後再排盤。</p>
  <label for="chart-date">出生日期（必填）</label><input id="chart-date" name="birth-date" type="date" value="${esc(answers.birthDate || '')}" required>
  <label for="chart-time">當地出生時間（必填）</label><input id="chart-time" name="birth-time" type="time" required>
  <label for="chart-sex">排盤性別（必填）</label><select id="chart-sex" name="birth-sex" required><option value="">請選擇</option><option>男</option><option>女</option></select>
  <label for="chart-zone">出生時區（必填）</label><select id="chart-zone" name="birth-timezone" required><option value="">請選擇</option><option value="Asia/Shanghai">上海</option><option value="Asia/Hong_Kong">香港</option></select>
  <label for="chart-calendar">歷法（必填）</label><select id="chart-calendar" name="calendar" required><option value="">請選擇</option><option value="solar">公曆</option><option value="lunar">農曆</option></select>
  <label for="chart-leap">是否農曆閏月（必填）</label><select id="chart-leap" name="leap-month" required><option value="">請選擇</option><option>否</option><option>是</option></select>
  <label><input type="checkbox" name="timezone-confirmed" value="已确认" required>我已確認出生時間與時區</label>
  <label><input type="checkbox" name="chart-consent" value="同意" required>同意保存排盤結果，用於家族匹配、名片標籤與 Noking</label>
  <button type="submit" class="btn">保存並排盤</button><p data-chart-error role="alert"></p></form>`;
}
