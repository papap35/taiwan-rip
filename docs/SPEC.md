# 台灣事件風險地圖 — Next.js 改版與功能規劃 Spec

- 狀態：**草稿，待審閱**
- 日期：2026-10-15
- 範圍：把現有純靜態網站改寫為 Next.js，並分階段加入新功能

> 標 **【待決定】** 的地方需要你拍板，彙整在最後一節「待決定事項」。

---

## 1. 目標與原則

**目標**

1. 改用 Next.js（App Router + TypeScript），功能與現在完全一致後才加新功能。
2. 從「一張地圖」擴充成可分享、可被搜尋、資料自動更新的網站。
3. 加入 AI 白話解說、會員收藏與通知、宮廟資訊維護。

**原則**

- **分階段上線**：每個里程碑都能獨立部署、獨立驗收，不做一次性大改版。
- **資料誠實**：所有分級都顯示資料來源、件數與時間範圍；AI 內容一律標示「AI 生成」。
- **不污名化地區**：用「相對分級」語氣，不做比網格（約 4 公里）更細的危險標籤。
- **保留現有可測試的核心**：`risk.js`、`data.js`、`convert-a1.mjs` 是純函式，改成 TypeScript 後邏輯不變、測試照搬。

---

## 2. 里程碑總覽

| 里程碑 | 內容 | 預估工作量* | 需要的外部服務 |
| --- | --- | --- | --- |
| **M0 遷移** | Next.js 改寫，功能與現在一致；網址可分享狀態 | 3–4 天 | 無（資料仍是靜態 JSON） |
| **M1 內容與分享** | 縣市頁、宮廟目錄、方法／資料來源頁、SEO、分享圖、PWA | 4–5 天 | 無 |
| **M2 AI 區域解說** | 點網格或縣市 →「AI 解說」白話說明 | 2–3 天 | Claude API、資料庫（快取） |
| **M3 資料自動化與後台** | 每週自動匯入 A1、事件 API、管理後台 | 4–5 天 | 資料庫、Vercel Cron |
| **M4 會員與社群** | 登入、收藏地點、風險變化通知、宮廟資訊更正回報 | 5–7 天 | 資料庫 + 登入、Email 寄送 |
| 待規劃 | 路線風險、英文版、事件回報 | — | 路線規劃服務等 |

\* 以一位工程師搭配 Claude Code 的估計，含測試；實際依審閱回饋調整。

建議順序：M0 → M1 → M2 → M3 → M4。M2 與 M3 可以對調（若想先有真實資料再做 AI）。

---

## 3. 技術架構

### 3.1 技術選型

| 層 | 選擇 | 版本（鎖定） | 理由 |
| --- | --- | --- | --- |
| 框架 | **Next.js App Router** | `next@16.3.8`、`react@19.3.0` | Vercel 原生支援；頁面、API、Cron 同一專案 |
| 語言 | TypeScript | `typescript@7.0.2` | 型別保護資料格式 |
| 地圖 | **MapLibre GL + react-map-gl** 【待決定】 | `maplibre-gl@6.11.2`、`react-map-gl@8.1.3` | WebGL 繪製，上萬點不卡；內建點位聚合與熱區圖層 |
| 底圖 | **OpenFreeMap** 向量圖磚 【待決定】 | — | 免費、免金鑰、允許正式站使用（OSM 官方圖磚伺服器的使用政策不允許正式站大量使用） |
| 樣式 | Tailwind CSS | `tailwindcss@4.3.3` | 元件化後比手寫 CSS 好維護；保留現有深淺色配色 |
| 資料庫＋登入 | **Supabase**（Postgres + PostGIS + Auth） 【待決定】 | `@supabase/supabase-js@2.117.2` | 一個服務包辦資料庫、地理查詢、登入、權限（RLS） |
| 輸入驗證 | Zod | `zod@4.6.5` | API 參數與匯入資料驗證 |
| AI | Claude API | `@anthropic-ai/sdk@0.131.0` | 區域白話解說（見第 6 節） |
| 單元測試 | Vitest | `vitest@5.0.3` | 取代 `node:test`，支援 TS |
| 端對端測試 | Playwright | `@playwright/test@1.63.0` | 桌機＋手機寬度煙霧測試 |

> 替代方案：若不想用 MapLibre，可用 `react-leaflet@5.0.0` 保留 Leaflet，改動最小，但正式站仍需換付費點陣圖磚。

### 3.2 目錄結構

```
app/
  layout.tsx                 全站版型、深色模式、metadata
  page.tsx                   首頁地圖（Client Component）
  county/[slug]/page.tsx     縣市頁（靜態產生 + 定期更新）
  temples/page.tsx           宮廟目錄
  temples/[id]/page.tsx      宮廟頁
  about/method/page.tsx      分級方法
  about/data/page.tsx        資料來源與更新紀錄
  about/disclaimer/page.tsx  免責與隱私
  me/page.tsx                會員：收藏地點、通知設定（M4）
  admin/...                  管理後台（M3）
  api/
    incidents/route.ts       事件查詢（M3）
    explain/route.ts         AI 解說（M2）
    cron/import-a1/route.ts  每週匯入（M3）
    reports/route.ts         宮廟資訊更正回報（M4）
components/
  map/                       MapView、IncidentLayer、RiskGridLayer、TempleLayer
  timeline/                  Timeline、Histogram
  panel/                     篩選、圖例、宮廟清單
lib/
  risk.ts                    ← js/risk.js（邏輯不變）
  data.ts                    ← js/data.js
  a1/convert.ts              ← tools/convert-a1.mjs
  url-state.ts               網址參數 ↔ 畫面狀態
  supabase/                  伺服器端與瀏覽器端 client
workers/
  risk.worker.ts             在 Web Worker 計算分級，拖時間軸不卡畫面
data/                        示範資料與宮廟（M3 前仍為靜態檔）
tests/                       Vitest 單元測試 + fixtures
e2e/                         Playwright
supabase/migrations/         資料庫 schema（M2 起）
```

### 3.3 頁面繪製策略

| 頁面 | 方式 | 說明 |
| --- | --- | --- |
| 首頁地圖 | 伺服器先輸出外框與 SEO 文字，地圖在瀏覽器載入 | 地圖必須在瀏覽器執行 |
| 縣市頁、宮廟頁 | 建置時產生靜態頁，資料更新時重新產生 | 快、對搜尋引擎友善 |
| AI 解說、事件查詢 | API Route（伺服器端） | 金鑰只存在伺服器 |

---

## 4. 功能規格

### M0 — 遷移（功能一致）

現有功能逐一搬到 React 元件，外觀與行為維持一致：

- 事件點、AI 危險分級網格、宮廟三個圖層與開關
- 事件類別篩選、時間軸（結束日期、時間窗、播放、每週長條圖）
- 點網格／事件顯示說明與附近收驚宮廟；我的位置；OSM 宮廟搜尋
- 瀏覽器匯入 CSV／JSON；示範資料提示；手機底部抽屜；深色模式

**新增：網址可分享狀態**

`/?end=2026-09-30&window=90&types=homicide,traffic_fatal&lat=25.04&lng=121.53&z=12`

- 移動地圖、改篩選時更新網址（不新增瀏覽紀錄）；打開網址還原同一畫面。
- 「分享」按鈕：手機呼叫系統分享，桌機複製連結。

**效能**

- 點位聚合：縮小時合併成數字泡泡，放大展開。
- 分級計算移到 Web Worker；拖時間軸時畫面保持流暢。

**驗收**

- [ ] Playwright：桌機 1280px、手機 390px 跑完現有所有互動，無主控台錯誤、無橫向捲動
- [ ] 現有 9 個測試改寫為 Vitest 後全數通過
- [ ] 同一份資料、同一時間窗，新舊版本分級結果完全相同（自動比對測試）
- [ ] 首頁 Lighthouse 效能 ≥ 85（手機）

### M1 — 內容與分享

1. **縣市頁 `/county/[slug]`**（22 縣市）
   - 統計卡：近 30／90／365 天事件數、死亡事故數、與去年同期比較
   - 月趨勢圖、類別分布、風險最高的 5 個網格（連回地圖並定位）
   - 該縣市可收驚宮廟清單
2. **宮廟目錄 `/temples` 與宮廟頁 `/temples/[id]`**
   - 欄位：名稱、主祀、地址、電話、收驚時段、是否需預約、官方網站、最後確認日期
   - 篩選：縣市、只看可收驚
   - 「資訊有誤？」連到回報表單（M4 前先用 Email／Google 表單）
3. **說明頁**：分級方法（含限制）、資料來源與更新紀錄、免責與隱私、緊急求助資訊（110／119／1925）
4. **SEO 與分享**：每頁 title／description、縣市頁專屬分享圖（以 `next/og` 動態產生地圖縮圖＋數字）、`sitemap.xml`、`robots.txt`
5. **PWA**：可加到手機主畫面；離線時顯示最後一次載入的資料並提示「離線中」

**驗收**

- [ ] 22 個縣市頁都能建置成功，數字與首頁地圖同一時間窗一致
- [ ] 分享任一縣市頁到 LINE／Facebook 顯示正確預覽圖
- [ ] 宮廟資料欄位驗證納入測試（缺欄位則建置失敗）

### M2 — AI 區域解說

使用者點網格或縣市頁的「AI 解說」，得到 3–5 句白話說明，例如：

> 這一區近 90 天有 12 起事件，其中 4 起是交通死亡事故，多發生在晚上 6–9 點。近一個月件數明顯增加。建議晚間騎車特別注意路口……附近可收驚：行天宮（1.2 公里）。

規格見第 6 節。**驗收**

- [ ] 同一網格、同一時間窗第二次查詢直接回傳快取，不再呼叫 API
- [ ] 每個 IP 每小時上限（預設 20 次），超過時顯示友善訊息
- [ ] 回覆一律標示「AI 生成，僅供參考」與資料範圍
- [ ] 以 20 個固定網格做輸出檢查：不得出現人名、具體地址門牌、未提供的數字

### M3 — 資料自動化與後台

1. **每週自動匯入**：Vercel Cron 每週一 18:00（台灣時間）呼叫 `/api/cron/import-a1`
   - 下載即時 A1 CSV → 用 `lib/a1/convert.ts` 轉換 → 寫入資料庫（依 id 去重）
   - 記錄匯入結果（新增幾筆、略過幾筆、錯誤）；失敗時寄信通知管理員
   - 成功後讓縣市頁重新產生
   - 歷年資料用一次性腳本匯入
2. **事件 API** `GET /api/incidents?from=&to=&bbox=&types=`
   - 回傳 GeoJSON；結果快取在 CDN；單次上限 20,000 筆
3. **管理後台 `/admin`**（僅管理員）
   - 匯入紀錄、手動重跑匯入
   - 宮廟資料新增／編輯（含「最後確認日期」）
   - 回報審核佇列（M4 啟用）

**驗收**

- [ ] 用 fixtures 模擬一次匯入：重複執行兩次，資料筆數不變
- [ ] 非管理員存取 `/admin` 與管理 API 一律拒絕（含測試）

### M4 — 會員與社群

1. **登入**：Email 魔法連結、Google。LINE 登入需另外評估整合方式 【待決定】
2. **收藏地點**：最多 5 個（例如家、公司、學校），可自訂名稱
3. **風險變化通知**：收藏地點所在網格的等級上升時通知
   - Email 每週摘要（預設）；可選瀏覽器推播
   - 每個地點每週最多通知一次，避免恐慌與騷擾
4. **宮廟資訊更正回報**：收驚時段、電話、是否歇業
   - 進入審核佇列，管理員核可後才更新
5. **帳號管理**：刪除帳號會一併刪除收藏與通知設定

**不在 M4 範圍**：使用者回報「事件」（見第 8 節的法律風險）。

**驗收**

- [ ] 資料庫權限：使用者只能讀寫自己的收藏（RLS 測試）
- [ ] 通知節流與取消訂閱連結有效
- [ ] 刪除帳號後相關資料確實清除

### 待規劃（不在本次範圍）

- **路線風險**：輸入起訖點，顯示沿線網格的分級（需要路線規劃服務）
- **英文版**：給觀光客使用
- **事件回報**：僅在有完整審核與法律評估後再考慮

### 線上資料來源（2026-10-15 調查）

| 資料 | 精細度 | 自動化 | 狀態 |
| --- | --- | --- | --- |
| 即時 A1 交通事故（data.gov.tw 12818） | 經緯度 | ✅ | **已完成**：`update-a1.yml` 每週自動更新（M3 前以 GitHub Actions 進行，M3 改為 Vercel Cron + 資料庫） |
| 年度傷亡交通事故（如 177136） | 經緯度 | ✅ | 手動執行時加入資料集編號補歷史；只取 A1 |
| 警政署犯罪發生資料（8 案類，每季） | 只有地點文字 | ⚠️ 需轉座標 | 待做：以內政部村里界線的中心點定位 |
| 犯罪週統計（13166） | 縣市 | ✅ | 待做：用於縣市頁趨勢圖 |
| 全國寺廟資料（8203，內政部） | 地址、無座標 | ⚠️ 需轉座標 | 待做：取代手寫的 17 間宮廟 |
| 命案 | — | ❌ | 無開放點位資料；不爬新聞（著作權、正確性、隱私） |

---

## 5. 資料模型（Supabase / Postgres + PostGIS）

```sql
-- 事件（M3 起；M0–M2 仍讀 data/incidents.json）
create table incidents (
  id          text primary key,              -- 例：a1-20230105-073000-25.03321-121.54321
  occurred_on date not null,
  occurred_at time,
  geom        geography(Point, 4326) not null,
  type        text not null,                 -- homicide / traffic_fatal / ...
  severity    smallint not null check (severity between 1 and 5),
  county      text,
  place       text,
  deaths      smallint, injuries smallint,
  cause       text, vehicles text[],
  source      text not null,                 -- 資料集網址或 'demo'
  imported_at timestamptz not null default now()
);
create index on incidents using gist (geom);
create index on incidents (occurred_on);

create table temples (
  id text primary key, name text not null, county text,
  geom geography(Point, 4326) not null,
  deity text, address text, phone text, website text,
  shoujing boolean not null default false,
  shoujing_hours text, needs_booking boolean,
  verified_on date,                           -- 最後確認日期
  updated_at timestamptz not null default now()
);

create table import_runs (                    -- 匯入紀錄
  id bigserial primary key, started_at timestamptz, finished_at timestamptz,
  source text, added int, skipped int, error text
);

create table ai_explanations (                -- AI 解說快取
  cache_key text primary key,                 -- 網格/縣市 + 時間窗 + 資料版本
  body jsonb not null, model text not null,
  input_tokens int, output_tokens int,
  created_at timestamptz not null default now()
);

-- M4
create table saved_places (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users on delete cascade,
  label text not null, geom geography(Point, 4326) not null,
  notify boolean not null default true, last_level smallint,
  created_at timestamptz not null default now()
);
create table temple_reports (
  id bigserial primary key, temple_id text references temples,
  user_id uuid references auth.users on delete set null,
  field text not null, proposed text not null,
  status text not null default 'pending',     -- pending / approved / rejected
  created_at timestamptz not null default now()
);
```

權限（RLS）：`incidents`、`temples` 所有人可讀；`saved_places` 只有本人可讀寫；`temple_reports` 本人可新增、管理員可審核；其餘表只有伺服器端可存取。

---

## 6. AI 區域解說設計

**流程**

1. 瀏覽器送出 `{ cellKey 或 county, end, windowDays }` 到 `POST /api/explain`。
2. 伺服器自行從資料重新計算該區統計（**不信任瀏覽器傳來的數字**）：件數、類別分布、死亡數、時段分布、趨勢、分級、附近收驚宮廟。
3. 查快取；沒有才呼叫 Claude。
4. 回傳結構化 JSON：`{ summary, factors[], advice[], caveats }`，前端排版。

**Prompt 原則**

- 只提供**彙總後的數字**，不提供個別事件內容，降低誤導與隱私風險。
- 要求：只根據提供的數字；不推測原因；不寫人名、門牌；語氣平實、不製造恐慌；繁體中文。
- 用結構化輸出（`output_config.format` + JSON Schema）確保格式正確。

**模型與成本**

- 模型：`claude-opus-5-5`，`effort: "low"`（這是短文摘要，不需要深度推理）【待決定】
- 預設啟用伺服器端備援（`fallbacks: "default"`），請求被安全機制拒絕時自動改由備援模型回答
- 估算：每次約 1,500 輸入 token、400 輸出 token → 每次約 US$0.014；快取命中不收費
- 若想更省，可改用 `claude-haiku-5-5`（約便宜 40 倍），品質需實測後由你決定
- 防濫用：每 IP 每小時 20 次；每日總呼叫上限（預設 2,000 次，約 US$28）到了就只回傳快取

**金鑰**：`ANTHROPIC_API_KEY` 只設在 Vercel 環境變數，不進前端、不進 repo。

---

## 7. 非功能需求

| 項目 | 要求 |
| --- | --- |
| 效能 | 手機 Lighthouse ≥ 85；首頁首次載入 JS ≤ 250 KB（gzip，不含地圖圖磚）；拖時間軸 ≥ 30 fps |
| 無障礙 | 鍵盤可操作所有控制項；圖例不只靠顏色（加文字）；對比度符合 WCAG AA |
| 瀏覽器 | 近兩年的 Chrome、Safari（含 iOS）、Edge、Firefox |
| 安全 | 安全標頭沿用並加入 CSP；所有 API 參數以 Zod 驗證；管理 API 檢查角色 |
| 隱私 | 不記錄使用者定位；收藏地點只存本人帳號；分析工具只用不追蹤個人的 Vercel Analytics |
| 監控 | 匯入失敗、AI API 錯誤率、每日 AI 花費寄信或通知管理員 |

---

## 8. 倫理與法律風險

| 風險 | 對策 |
| --- | --- |
| 地區被貼上「危險」標籤，影響居民與房價 | 相對分級＋顯示件數與範圍；網格約 4 公里，不做街道級標籤；方法頁說明限制 |
| 罹難者與家屬隱私 | 不顯示姓名；A1 資料本身不含個資；AI 不提供個別事件內容 |
| 錯誤或惡意回報造成誹謗 | 本次不開放事件回報；宮廟更正須審核 |
| AI 說錯數字或過度推論 | 只餵彙總數字；結構化輸出；固定網格輸出檢查；標示 AI 生成 |
| 造成恐慌 | 通知節流、語氣規範、每頁附 1925 安心專線 |
| 示範資料被誤認為真實 | 示範資料只在預覽環境使用；正式站必須是真實資料（建置時檢查） |

---

## 9. 測試與 CI/CD 調整

- `npm test`：Vitest（現有 9 個測試 + 新元件與 API 測試）
- `npm run lint`、`npm run typecheck`
- `npm run e2e`：Playwright 桌機＋手機煙霧測試（CI 中用預覽建置跑）
- `.github/workflows/ci-cd.yml`：保留「測試 → 部署」流程；`vercel build` 直接支援 Next.js，移除 `tools/build.mjs` 與 `outputDirectory`
- 環境變數（設在 Vercel，預覽與正式分開）：`ANTHROPIC_API_KEY`、`NEXT_PUBLIC_SUPABASE_URL`、`NEXT_PUBLIC_SUPABASE_ANON_KEY`、`SUPABASE_SERVICE_ROLE_KEY`、`CRON_SECRET`
- 預覽環境連到獨立的 Supabase 專案，不碰正式資料

---

## 10. 待決定事項

| # | 問題 | 建議 | 影響 |
| --- | --- | --- | --- |
| 1 | 地圖套件 | **MapLibre + OpenFreeMap** | 效能與正式站圖磚授權；選 Leaflet 則需付費圖磚 |
| 2 | 資料庫＋登入 | **Supabase** | 另一選擇：Neon（Vercel 市集）＋ Auth.js，彈性較高但要自己組 |
| 3 | 要不要做 M4 會員功能 | 先做到 M3，看使用量再決定 | M4 帶來帳號、個資與客服成本 |
| 4 | AI 模型與每日預算 | `claude-opus-5-5`（low effort），每日上限 US$28 | 改 Haiku 可大幅降成本，品質需實測 |
| 5 | LINE 登入 | M4 再評估 | 台灣使用者習慣，但整合較複雜 |
| 6 | 網域名稱 | — | 分享圖、SEO、Email 寄件網域 |
| 7 | 英文版 | 放到待規劃 | 加 i18n 會影響所有頁面結構，越早決定越省事 |
| 8 | M0 是否要換成 Tailwind | 換（一次改完） | 不換則保留現有 CSS，遷移較快 |

---

## 11. 本次不做

- 原生 App（PWA 先頂著）
- 使用者回報事件、留言區
- 街道級或即時（分鐘級）事件資料
- 付費功能、廣告
