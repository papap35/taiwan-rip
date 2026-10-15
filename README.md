# 台灣事件風險地圖（taiwan-rip）

RWD 網頁地圖，顯示台灣的死亡事故與社會案件，並提供：

- **時間軸**：拖曳滑桿選擇結束日期，搭配「近 7 天／30 天／90 天／半年／1 年／全部」時間窗；▶ 可自動播放，每週前進一格。上方長條圖為每週事件量。
- **AI 危險分級**：把事件切成約 4 公里的網格，以「時間加權嚴重度、致死件數、近期升溫趨勢」三個特徵做 K-means 非監督式分群，分成 低／中／高／極高 四級。點擊網格可看分級原因與建議（例如「建議暫時避免前往」）。
- **宗教地圖／收驚**：內建精選宮廟（標示可收驚者），點事件或網格時列出最近的收驚／祈福宮廟並可導航；也可「搜尋目前畫面附近宮廟」從 OpenStreetMap 即時查詢，或用「我的位置」找最近的收驚宮廟並顯示所在區域的分級。
- **手機版**：設定面板會變成底部抽屜，地圖與時間軸全螢幕；支援深色模式。
- **分享目前畫面**：時間、時間窗、類別與地圖位置都會寫進網址（例：`/?end=2025-07-28&window=30&lat=25.04&lng=121.53&z=12`），按「分享」即可複製或用手機分享。
- **縣市統計**（`/county`、`/county/taipei`）：近 30／90／365 天事件與死亡事故數（含去年同期比較）、近 24 個月趨勢圖、類別分布、風險較高的 5 個網格（連回地圖）、該縣市收驚宮廟。
- **宮廟目錄**（`/temples`）：依縣市與「可收驚」篩選，每間宮廟有獨立頁面與導航、回報更正連結。
- **說明頁**：分級方法與限制、資料來源與更新紀錄、免責與隱私。
- **分享預覽與搜尋**：每頁有標題與描述，縣市頁有專屬分享圖（含數字與事件點小地圖），並提供 `sitemap.xml`、`robots.txt`。
- **可安裝（PWA）**：可加到手機主畫面；看過一次後，離線也能顯示最後載入的資料並提示「離線中」。

> ⚠️ `public/data/incidents.json` 預設是 `tools/generate-demo-data.mjs` **隨機產生的示範資料，不是真實事件**。上線前請換成真實資料來源。

## 技術架構

Next.js 16（App Router）+ React 19 + TypeScript + Tailwind CSS 4；地圖為 MapLibre GL（`react-map-gl`）搭配 [OpenFreeMap](https://openfreemap.org) 免費向量底圖。分級計算在 Web Worker 執行，拖時間軸不卡畫面。

## 開發

需要 Node.js 22.18 以上（`tools/` 會直接 import `lib/*.ts`）。

```bash
npm install
npm run dev          # http://localhost:3000
npm run typecheck    # TypeScript 型別檢查
npm test             # 單元測試（node:test）
npm run build && npm run e2e   # 端對端測試（Playwright，桌機＋手機寬度）
```

第一次跑端對端測試前執行 `npx playwright install chromium`。測試會把底圖換成本機空白樣式，不需要連外。

其他指令：

- `npm run og-font`：分享圖用的中文字型只含用得到的字（`lib/og-text.ts`），改了分享圖文字或縣市名稱後要重跑（需連網），`npm test` 會檢查有沒有缺字。
- `npm run icons`：由 `public/brand/app-icon.svg` 重新產生 PWA 與 Apple 圖示 PNG。Logo 原始檔在 `public/brand/`（`logo-mark.svg` 標誌、`app-icon.svg` App 圖示），瀏覽器分頁圖示是 `app/icon.svg`，頁面上的標誌是 `components/Logo.tsx`；改 logo 時這幾個要一起改。

正式網址：分享圖、sitemap 的絕對網址預設使用 Vercel 的正式網域；之後若綁自訂網域，在 Vercel 設定環境變數 `NEXT_PUBLIC_SITE_URL`（例如 `https://example.tw`）。

## 部署到 Vercel（CI/CD）

`.github/workflows/ci-cd.yml` 會：

| 事件 | 動作 |
| --- | --- |
| 開 PR／PR 有新 commit | 跑 `npm test`、`npm run build` → 通過後部署 **預覽網址**，並自動在 PR 留言（同一則留言會更新） |
| 合併／push 到 `main` | 跑測試 → 通過後部署 **正式站** |
| Actions 頁面手動執行 | 部署目前分支（在 `main` 上即正式站） |

型別檢查、單元測試、建置或端對端測試任一失敗就不會部署。`npm test` 也會檢查 `public/data/` 的資料格式，避免把壞掉的資料部署上去。

### 第一次設定（約 5 分鐘）

1. **建立 Vercel 專案並取得 ID**：在本機專案資料夾執行
   ```bash
   npx vercel@60.1.3 link
   cat .vercel/project.json   # 會看到 orgId 與 projectId
   ```
   （或在 vercel.com 新增專案後，到 Project Settings → General 找 Project ID，Team/帳號 Settings 找 ID。）
2. **建立權杖**：到 <https://vercel.com/account/tokens> 建立一個 token。
3. **在 GitHub 設定 secrets**：repo 的 Settings → Secrets and variables → Actions → New repository secret，新增
   `VERCEL_TOKEN`、`VERCEL_ORG_ID`、`VERCEL_PROJECT_ID`。
4. 開一個 PR 或 push 到 `main` 就會自動部署。

還沒設定 secrets 前，部署步驟會顯示警告並略過，測試照常執行。

`vercel.json` 設定了 `framework: nextjs` 與 `git.deploymentEnabled: false`：即使在 Vercel 後台連結了這個 GitHub repo，也只會由 GitHub Actions 部署（先測試再上線），不會重複部署。

本機預覽正式建置：`npm run build && npm start`。

## 匯入真實資料

在面板「匯入資料」上傳 CSV 或 JSON（也支援 GeoJSON Point），資料只在瀏覽器內處理。

CSV 欄位：

| 欄位 | 說明 |
| --- | --- |
| `date` | `2026-09-01`、`2026/09/01` 或 `20260901`（也接受 `發生日期`） |
| `lat`, `lng` | WGS84 經緯度（也接受 `緯度`、`經度`） |
| `type` | 代碼或中文：`命案`、`車禍`／`A1`、`意外`、`強盜`、`搶奪`、`傷害`、`毒品`、`竊盜`… |
| `severity` | 選填，1–5；省略時依類別給預設值 |
| `title`, `county`, `source` | 選填；`source` 若是網址會顯示「資料來源」連結 |

可參考的開放資料：

- 政府資料開放平臺（data.gov.tw）：「A1 類道路交通事故」（含經緯度，為當場或 24 小時內死亡的事故）、各縣市警察局竊盜案件點位。
- 刑案統計多為縣市／月份層級，沒有點位時可用鄉鎮中心點代替（請在 `title` 註明）。

### A1 交通事故轉換腳本

從政府資料開放平臺下載 A1 類交通事故 CSV（[即時 A1](https://data.gov.tw/dataset/12818)、[歷史交通事故](https://data.gov.tw/dataset/12197)、各年度「傷亡道路交通事故資料」），然後：

```bash
# 轉換一個或多個檔案（也可以直接給下載網址），輸出到 public/data/incidents.json
node tools/convert-a1.mjs ~/Downloads/112年度A1交通事故資料.csv ~/Downloads/113年度A1交通事故資料.csv

# 之後定期追加最新的即時 A1 資料，保留既有紀錄並自動去重
node tools/convert-a1.mjs ~/Downloads/A1.csv --append

# 只保留某日期之後
node tools/convert-a1.mjs A1.csv --since 2024-01-01
```

腳本會：

- 自動判斷 UTF-8／Big5 編碼，支援西元 `20230105`、民國 `112年01月05日 07時30分00秒`、`1120105`、`112/1/5` 等日期格式；時間欄前導 0 被省略（如 `73000`）會補回 6 碼。
- 年度檔一列是一位「當事者」，同一事故多列會依日期時間＋座標合併成一起，車種彙整、傷亡數不重複相加。
- 略過檔尾說明列與台澎金馬範圍外的座標；多人死亡事故嚴重度記為 5，其餘為 4。
- 輸出的 `meta.demo` 為 `false`，網頁就不會再顯示「示範資料」提示；彈出視窗會顯示時間、傷亡人數、初步肇因與車種。

`--append` 會丟掉示範資料，只保留真實紀錄。測試：`npm test`（使用 `tests/fixtures` 中的虛構樣本）。

> 官方欄位名稱可能隨年度調整；若轉出筆數為 0，請把 CSV 表頭貼給維護者，在 `tools/convert-a1.mjs` 的 `col(...)` 候選名稱中補上。

### 自動更新（GitHub Actions）

`.github/workflows/update-a1.yml` 會從 data.gov.tw 下載 A1 資料 → 轉換 → 跑測試 → commit 到 `main` → 觸發正式站部署。

1. **先手動試跑**：Actions → **Update A1 data** → Run workflow（可勾「只試跑」先看結果，摘要會顯示新增幾筆）。
2. **補歷史資料**：手動執行時在「資料集編號」加上年度資料集，例如 `12818,177136`（年度檔混有 A2，腳本只會取 A1）。
3. **開啟每日排程**：Settings → Secrets and variables → Actions → Variables 新增 `A1_SCHEDULE_ENABLED` = `true`（每天 09:17 台灣時間；資料沒變動就不會 commit 或部署）。
4. **查不到下載網址時**：新增 Variable `A1_URLS`，填 CSV 下載網址（逗號分隔），會略過自動查詢。

安全機制：下載失敗、下載到網頁、轉出 0 筆、或超過一半資料列無法解析時，workflow 會失敗且**不會覆蓋**現有資料，GitHub 會寄失敗通知。新資料與既有資料依 id 合併去重，預設保留最近 3 年。第一次成功執行會移除示範資料。

本機也能跑：`npm run update:a1`（`node tools/fetch-a1.mjs --help` 看參數）。

> 注意：workflow 會直接 push 到 `main`。若之後替 `main` 加上「必須經過 PR」的分支保護，需要改成開 PR 的方式。另外請確認 repo 的預設分支是 `main`，排程只會在預設分支上執行。

要替換預設資料，把轉好的 JSON（`{ "incidents": [...] }`）放到 `public/data/incidents.json` 即可；JSON 的 `meta.demo` 設為 `false` 時就不會顯示「目前為示範資料」提示。

## 檔案結構

```
app/                     Next.js 頁面（layout、首頁、全域樣式、manifest、sitemap、robots、分享圖）
app/(site)/              內容頁：county、temples、about（共用頂部選單與頁尾）
app/fonts/               分享圖用的中文字型子集
components/MapApp.tsx    首頁狀態：資料載入、篩選、網址同步、播放、匯入、分享
components/map/          MapLibre 地圖（事件聚合點、危險網格、宮廟）與彈出視窗
components/panel/        設定面板（手機為底部抽屜）
components/timeline/     時間軸與每週長條圖
components/charts/       縣市頁圖表（每月趨勢、類別分布）
hooks/useRiskCells.ts    在 Web Worker 計算分級（不支援時改在主執行緒）
workers/risk.worker.ts   分級計算 worker
lib/risk.ts              網格特徵與 K-means 分級（純函式）
lib/data.ts              類別定義、CSV/JSON 解析與正規化
lib/temples.ts           最近宮廟、導航連結、OpenStreetMap 宮廟搜尋
lib/url-state.ts         網址參數 ↔ 畫面狀態
lib/counties.ts          22 縣市清單與名稱正規化
lib/county-stats.ts      縣市統計與縣市內的風險網格（與地圖預設畫面一致）
lib/temple-schema.ts     宮廟資料欄位定義與驗證（格式錯誤會讓建置失敗）
lib/server/              建置時讀取資料、產生分享圖
public/sw.js             Service worker（離線快取）
public/data/             incidents.json（事件）、temples.json（精選宮廟，座標為概略位置）
tools/                   示範資料產生器、A1 轉換與自動下載、MapLibre worker 複製
tests/                   單元測試（含新舊版分級結果比對）
e2e/                     Playwright 端對端測試
vercel.json              Vercel 設定與安全標頭
.github/workflows/       ci-cd.yml（測試 → 部署）、update-a1.yml（每日更新 A1 資料）
```

## 分級方法與限制

1. 每格事件依嚴重度（命案 5、死亡事故 4、強盜 3、傷害／毒品 2、竊盜 1）乘上時間衰減（半衰期為時間窗的 1/3）加總。
2. 特徵：`log(1+加權嚴重度)`、`log(1+致死件數)`、近期 1/3 時段事件占比（以件數做收縮，件數少時趨向中性）。
3. 標準化後以分位數初始化做 K-means（k=4），依群中心分數排序對應到四個等級；單一事件的網格最多「低」、兩起最多「中」。

這是相對分級：同一時間窗內各區互相比較的結果，不代表絕對安全或危險，也未依人口或人流校正。請當作參考，並以警方與官方公告為準。

緊急狀況請撥 110／119；心情低落可撥 1925 安心專線。
