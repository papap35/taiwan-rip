'use client';

import { useEffect, useState } from 'react';

/** 註冊 service worker（僅正式建置），並在離線時顯示提示 */
export default function PwaSupport() {
  const [offline, setOffline] = useState(false);

  useEffect(() => {
    if (process.env.NODE_ENV === 'production' && 'serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').catch(() => {});
    }
    const update = () => setOffline(!navigator.onLine);
    update();
    window.addEventListener('online', update);
    window.addEventListener('offline', update);
    return () => {
      window.removeEventListener('online', update);
      window.removeEventListener('offline', update);
    };
  }, []);

  if (!offline) return null;
  return (
    <div
      role="status"
      className="fixed top-14 left-1/2 z-50 -translate-x-1/2 rounded-full border border-notice-line bg-notice px-4 py-1.5 text-[13px] text-ink shadow-float"
    >
      離線中：顯示最後一次載入的資料
    </div>
  );
}
