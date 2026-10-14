# 台灣事件風險地圖（taiwan-rip）

RWD 網頁地圖，顯示台灣的死亡事故與社會案件，並提供：

- **時間軸**：拖曳滑桿選擇結束日期，搭配「近 7 天／30 天／90 天／半年／1 年／全部」時間窗；▶ 可自動播放，每週前進一格。上方長條圖為每週事件量。
- **AI 危險分級**：把事件切成約 4 公里的網格，以「時間加權嚴重度、致死件數、近期升溫趨勢」三個特徵做 K-means 非監督式分群，分成 低／中／高／極高 四級。點擊網格可看分級原因與建議（例如「建議暫時避免前往」）。
- **宗教地圖／收驚**：內建精選宮廟（標示可收驚者），點事件或網格時列出最近的收驚／祈福宮廟並可導航；也可「搜尋目前畫面附近宮廟」從 OpenStreetMap 即時查詢，或用「我的位置」找最近的收驚宮廟並顯示所在區域的分級。
- **手機版**：設定面板會變成底部抽屜，地圖與時間軸全螢幕；支援深色模式。

> ⚠️ `data/incidents.json` 是 `tools/generate-demo-data.mjs` **隨機產生的示範資料，不是真實事件**。上線前請換成真實資料來源。

## 執行

純靜態網站，不需要建置：

```bash
python3 -m http.server 8000
# 開啟 http://localhost:8000
```

可直接部署到 GitHub Pages / Netlify / Cloudflare Pages。

## 部署到 Vercel（CI/CD）

`.github/workflows/ci-cd.yml` 會：

| 事件 | 動作 |
| --- | --- |
| 開 PR／PR 有新 commit | 跑 `npm test`、`npm run build` → 通過後部署 **預覽網址**，並自動在 PR 留言（同一則留言會更新） |
| 合併／push 到 `main` | 跑測試 → 通過後部署 **正式站** |
| Actions 頁面手動執行 | 部署目前分支（在 `main` 上即正式站） |

測試失敗就不會部署。`npm test` 除了轉換腳本，也會檢查 `data/incidents.json`、`data/temples.json` 格式與 `index.html` 引用的檔案都存在，避免把壞掉的資料部署上去。

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

`vercel.json` 設定了 `git.deploymentEnabled: false`：即使在 Vercel 後台連結了這個 GitHub repo，也只會由 GitHub Actions 部署（先測試再上線），不會重複部署。建置會把 `index.html`、`css/`、`js/`、`data/` 複製到 `dist/`，`tools/`、`tests/` 不會上線。

本機預覽建置結果：`npm run build && python3 -m http.server 8000 -d dist`。

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
# 轉換一個或多個檔案（也可以直接給下載網址），輸出到 data/incidents.json
node tools/convert-a1.mjs ~/Downloads/112年度A1交通事故資料.csv ~/Downloads/113年度A1交通事故資料.csv

# 之後每週追加最新的即時 A1 資料，保留既有紀錄並自動去重
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

要替換預設資料，把轉好的 JSON（`{ "incidents": [...] }`）放到 `data/incidents.json` 即可；JSON 的 `meta.demo` 設為 `false` 時就不會顯示「目前為示範資料」提示。

## 檔案結構

```
index.html               版面
css/style.css            樣式（RWD、深色模式）
js/app.js                地圖、時間軸、圖層、宮廟搜尋
js/risk.js               網格特徵與 K-means 分級（無 DOM 依賴，可在 Node 測試）
js/data.js               類別定義、CSV/JSON 解析與正規化
data/incidents.json      示範事件資料（隨機產生）
data/temples.json        精選宮廟（座標為概略位置）
tools/generate-demo-data.mjs  示範資料產生器
tools/convert-a1.mjs     A1 交通事故 CSV → incidents.json
tools/build.mjs          建置：複製靜態檔到 dist/
tests/                   轉換腳本與網站資料檢查（npm test）
vercel.json              Vercel 建置設定與安全標頭
.github/workflows/ci-cd.yml  CI/CD：測試 → 部署預覽／正式站
```

## 分級方法與限制

1. 每格事件依嚴重度（命案 5、死亡事故 4、強盜 3、傷害／毒品 2、竊盜 1）乘上時間衰減（半衰期為時間窗的 1/3）加總。
2. 特徵：`log(1+加權嚴重度)`、`log(1+致死件數)`、近期 1/3 時段事件占比（以件數做收縮，件數少時趨向中性）。
3. 標準化後以分位數初始化做 K-means（k=4），依群中心分數排序對應到四個等級；單一事件的網格最多「低」、兩起最多「中」。

這是相對分級：同一時間窗內各區互相比較的結果，不代表絕對安全或危險，也未依人口或人流校正。請當作參考，並以警方與官方公告為準。

緊急狀況請撥 110／119；心情低落可撥 1925 安心專線。
