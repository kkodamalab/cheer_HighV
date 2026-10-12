# 検証記録（2026-10-12）

## ローカルで成功

- Node.js v24.19.0 / npm 11.9.0、固定lockfileで `npm ci --cache /tmp/cml-npm`。
- `npm test`：18件成功、0失敗・0スキップ。High V／Low V／T／Touchdown、画像縦横比、左右反転、関節内角、低visibility、評価変数ON/OFF、目標変更、重み付け、顔未検出、Smile計算、カスタム変数、設定JSON検証、CSV、目標からの腕と肘ライン、0／5／10秒のタイマー、二重開始・キャンセル、カメラトラック解放、音源切替・停止。
- `npm run build`：成功。公開パス `/cheer_HighV/`、distを生成。
- `CML_CHROMIUM=/usr/bin/chromium npm run test:browser`：6件成功。PC（1440×1000）・スマホ幅（390×844）の各3シナリオ。ポーズ選択、カスタム保存・再読込、設定JSON入出力、指標変更、リズム試聴、横はみ出しなし、記録CSV／JSON、削除、基準登録、即撮影、静止画、オーバーレイ切替、画像の保存オプトイン、33点の保存、再撮影、終了時srcObject解除。
- ブラウザ統合テストのカメラはChromium仮想カメラ、推論は明示的な模擬モデル。実人物／実モデルでの精度・速度を証明するものではありません。
- CDN上のTasks Vision 0.10.21 JS、GoogleのPoseモデル、既存公開URLへのTLS検証付きHTTPアクセスは200。

## 未検証・制限

- 実カメラ、PC Chrome／iPhone Safari／Android Chrome実機のカメラ許可・回転・実Pose／Face精度・FPS。
- クラウドChromiumはプロキシCAを信頼しておらず、外部CDNの直接読み込みは `ERR_CERT_AUTHORITY_INVALID`。証明書検証は無効化していません。環境のトラストストア変更は自動承認レビューで拒否されたため実施していません。
- 音声の可聴性とiOSでのAudioContext解除は実機未検証。VOICEの日本語音声は端末依存。
- 手動の理想ラインは腕挙上角・肘内角のみ対応。他の指標は数値比較。撮影基準は全身ラインを表示し、立ち位置・カメラ位置の調整が必要。
- localStorageの容量制限、2D測定の奥行き制約。計算式・検出不可の扱いはREADMEを参照。
- 新しいクラウドタスクでの環境スナップショット復元は別途未検証。

CI結果・mainのSHA・Pagesの最新公開結果はGitHubのPR／Actionsと作業完了報告で確認してください。ローカルの成功をCI・公開・実機検証の成功と同一視しません。
