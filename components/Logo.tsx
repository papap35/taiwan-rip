// 「燈籠定位」標誌：定位針 + 燈籠。定位針跟著網站主色（深色模式自動變亮）。
// 圖形與 public/brand/logo-mark.svg 相同；改 logo 時兩邊一起改，再跑 npm run icons。

export function LogoMark({ size = 28, title }: { size?: number; title?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 120 120"
      role={title ? 'img' : undefined}
      aria-label={title}
      aria-hidden={title ? undefined : true}
      className="flex-none"
    >
      <path d="M60 113 C60 113 21 72 21 47 A39 39 0 1 1 99 47 C99 72 60 113 60 113 Z" fill="var(--color-accent)" />
      <rect x="47" y="20" width="26" height="6" rx="3" fill="#f2c14e" />
      <ellipse cx="60" cy="45" rx="19" ry="16.5" fill="#ffffff" />
      <path
        d="M44 39 H76 M41.5 45 H78.5 M44 51 H76"
        stroke="var(--color-accent)"
        strokeOpacity={0.35}
        strokeWidth={2.4}
        strokeLinecap="round"
      />
      <rect x="47" y="63" width="26" height="6" rx="3" fill="#f2c14e" />
      <rect x="58.5" y="69" width="3" height="8" rx="1.5" fill="#f2c14e" />
    </svg>
  );
}

/** 標誌 + 網站名稱（頂部列用） */
export function Wordmark({ as: Tag = 'span' }: { as?: 'span' | 'h1' }) {
  return (
    <span className="flex items-center gap-2">
      <LogoMark size={30} />
      <Tag className="text-base font-bold tracking-wide whitespace-nowrap md:text-lg">台灣事件風險地圖</Tag>
    </span>
  );
}
