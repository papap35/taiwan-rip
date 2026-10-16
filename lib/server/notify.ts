// 通知管理員（目前用於匯入失敗）。有設定 RESEND_API_KEY 與 ADMIN_EMAIL 就寄信，否則只寫進伺服器紀錄。
export async function notifyAdmin(subject: string, text: string): Promise<void> {
  const key = process.env.RESEND_API_KEY;
  const to = process.env.ADMIN_EMAIL;
  console.error(`[notify] ${subject}\n${text}`);
  if (!key || !to) return;
  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: process.env.NOTIFY_FROM || '台灣事件風險地圖 <onboarding@resend.dev>',
        to: to.split(',').map((s) => s.trim()),
        subject,
        text,
      }),
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) console.error(`[notify] 寄信失敗：HTTP ${res.status} ${await res.text()}`);
  } catch (err) {
    console.error(`[notify] 寄信失敗：${(err as Error).message}`);
  }
}
