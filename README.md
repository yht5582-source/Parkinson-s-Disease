# 巴金森病治療決策台

巴金森病（Parkinson's disease）診斷流程與治療決策互動網頁。

線上版：https://yht5582-source.github.io/Parkinson-s-Disease/

## 功能

1. **診斷流程**：MDS 2015 臨床診斷標準（巴金森症候群、絕對排除條件、紅旗徵象、支持條件）即時判讀。
2. **起始治療**：依年齡、失能程度、認知功能與副作用風險排序 levodopa、多巴胺致效劑、MAO-B 抑制劑等選項。
3. **運動併發症調整模擬器**：輸入目前處方與狀況（wearing-off、異動症、幻覺等），產生階梯式調藥建議，可一鍵套用並以 24 小時示意曲線比較調整前後；含 LEDD 計算與 5-2-1 進階治療篩檢。
4. **LEDD 換算與文獻**。
5. **示範病例**：6 個虛構病例，可帶入工具（`#cases`）。
6. **考題**：基礎 10 題、高階 10 題，不保存作答（`#quiz`）。
7. **心智圖**：重點總覽，內容需隨指引手動更新（`#map`）。

## 開發

計算邏輯集中在 `index.html` 的 `/*ENGINE-START*/ … /*ENGINE-END*/` 區塊（`PDE`），測試：`node tests.cjs`。

## 主要依據

- Postuma RB, et al. MDS clinical diagnostic criteria for Parkinson's disease. *Mov Disord* 2015.
- Fox SH, et al. MDS EBM review: update on treatments for the motor symptoms of PD. *Mov Disord* 2018. doi:10.1002/mds.27372
- Seppi K, et al. Update on treatments for nonmotor symptoms of PD. *Mov Disord* 2019.
- Tomlinson CL, et al. 2010；Jost ST, et al. 2023（LEDD 換算）. doi:10.1002/mds.29410
- de Bie RMA, et al. MDS EBM review: motor fluctuations. *Mov Disord* 2025. doi:10.1002/mds.30162
- Pringsheim T, et al. AAN guideline: early PD. *Neurology* 2021. doi:10.1212/WNL.0000000000012868
- 台灣動作障礙學會相關共識

## 免責聲明

本工具為臨床決策輔助與教學用途，模擬曲線為示意模型，不代表個別患者真實血中濃度，不能取代醫師完整評估。藥物劑量、禁忌與健保給付請以仿單、院內處方集及最新規定為準。
