# Standard RGB / gfx-lab

Three.js 互動色彩空間實驗，依據 [guidelines.md](guidelines.md) 建立。啟用 skill 時已檢查 `./guidelines`，此檔不存在，因此採用目錄內的 `guidelines.md`。

## 開發

```sh
direnv allow
# 或手動進入環境：nix develop path:.
just install
just dev
```

瀏覽器開啟 <http://localhost:8080>。開發環境提供 Node.js 22、Bun 與 Just。使用 `path:.` 可在新 Git repository 的 flake 尚未加入版本控制時直接啟動；加入版本控制後也可以使用 `nix develop`。也可以直接使用 `npm run dev`、`npm run build` 和 `npm run preview`。

執行 `just` 或 `just default` 會顯示可用指令的說明；執行 `just dev` 才會啟動伺服器。

所有套件透過 npm 安裝，本地打包；沒有 CDN、Import Maps 或外部貼圖請求。`scripts/fix-noexec.cjs` 將 esbuild 和 native Node 模組複製到私人暫存目錄，再執行，離開程序時清理。安裝使用 `--ignore-scripts`，避免 NixOS 的 `noexec` 分割區阻擋安裝腳本。

使用 Three.js 0.186 與 Vite 7。Vite 已從 skill 範例的 5.x 更新，以修正 npm 稽核發現的漏洞；Vite 7 需要 Node.js 20.19+ 或 22.12+，本專案的 Nix 環境與 CI 使用 Node.js 22。

## 實驗

- **Color comparison**：相同原始 Base Color 位元組，左側不解碼，右側使用 `THREE.SRGBColorSpace` 解碼；共用場景、幾何、相機、材質參數、光照與環境。
- **Break the pipeline**：切換 Base Color 解碼，觀察貼圖、線性輸入、實際場景像素和顯示編碼的數值。
- **Roughness reversal**：兩側使用相同 `THREE.NoColorSpace` 資料貼圖，左側 shader 故意套用 sRGB 解碼。關閉錯誤解碼後兩側結果一致。可調整 0–255 的粗糙度像素。

Light Intensity 同時調整方向光與共用環境強度；值為 0 時，物體不接收光照。沒有色調映射，輸出為 sRGB。中心標記的線性 RGB 是 GPU 浮點渲染結果；顯示位元組由此值套用 sRGB 輸出轉換並截取至 8 位元範圍，因此硬體取整與反鋸齒可能有一個位元組的差異。裝置若不支援浮點讀回，頁面會顯示數值不可用。

`128 / 255 ≈ 0.501961`，解碼後約 `0.215861`；假設輸入恰為 `0.5` 時，解碼後才是約 `0.214041`。

工具介面使用英文；只有固定 `💡` 按鈕開啟的說明 modal 可切換台灣繁體中文。modal 右上角固定提供 `Eng/中`，並使用 KaTeX 與 Prism.js；支援 Escape、背景點擊關閉及瀏覽器原生焦點管理。

拖動滑桿時，GPU 取樣完成前會保留上一組數值。數字採用等寬字型、固定通道欄位寬度與預留行高，避免位數改變或暫時的載入文字造成下方版面抖動。

材質與貼圖設定依據 [Three.js 官方 MeshStandardMaterial 文件](https://threejs.org/docs/pages/MeshStandardMaterial.html)。

## ambientCG 材質

已下載三組 1024 × 1024 JPEG 材質，包含 14 張原始貼圖，合計約 10.8 MB：

| 材質 | 來源 | 貼圖 |
| --- | --- | --- |
| 木材 Wood051 | [ambientCG](https://ambientcg.com/a/Wood051) | Color、Roughness、NormalGL、Displacement |
| 紅磚 Bricks059 | [ambientCG](https://ambientcg.com/a/Bricks059) | Color、Roughness、NormalGL、AO、Displacement |
| 金屬 Metal036 | [ambientCG](https://ambientcg.com/a/Metal036) | Color、Roughness、NormalGL、Metalness、Displacement |

貼圖位於 `public/textures/`，可在前兩階段的 **Base Color Texture** 選單切換。下載材質的 Color 貼圖使用 sRGB，Roughness、NormalGL、Metalness 與 AO 使用 NoColorSpace；錯誤材質共用相同影像與資料貼圖，只略過 Base Color 解碼。Displacement 保留供後續使用，未套用到球體。

貼圖與線性輸入的數值也由 GPU 在中心標記位置取樣，包含實際濾波結果。Roughness 教學階段仍使用可調整的灰階資料貼圖。

素材使用 [CC0 1.0 授權](https://docs.ambientcg.com/license/)，來源網址、下載網址、尺寸與 SHA-256 校驗碼記錄於 `src/materials.json`；貼圖說明見 [public/textures/README.md](public/textures/README.md)。所有素材都從本地載入，production URL 遵循 Vite 的 `base` 設定。

## 建構與 GitHub Pages

```sh
just build    # 產生 dist/
just preview  # 建構後在 localhost:8080 預覽
```

`vite.config.js` 的 production `base` 預設為 `/gfx-lab/`。若 GitHub repository 命名為 `standard_RGB`，請改為 `/standard_RGB/`；若部署到網域根目錄，請使用 `/`。

將專案放入 GitHub repository，於 **Settings → Pages → Source** 選擇 **GitHub Actions**。Push 到 `main` 後，`.github/workflows/deploy.yml` 會安裝相依套件、建構並部署；也可透過 Actions 手動啟動。請一併提交 `package-lock.json` 與 `flake.lock`，讓相依套件可重現。

`just clean` 可移除 `dist/` 與 `node_modules/`。

## 檔案

```text
.
├── .envrc
├── .github/workflows/deploy.yml
├── .gitignore
├── flake.nix
├── flake.lock
├── Justfile
├── package.json
├── package-lock.json
├── vite.config.js
├── index.html
├── README.md
├── scripts/fix-noexec.cjs
├── public/favicon.svg
├── public/textures/README.md
├── public/textures/{Wood051,Bricks059,Metal036}/
└── src/
    ├── main.js
    ├── color-math.js
    ├── materials.js
    ├── materials.json
    └── style.css
```
