# Gmail to Calendar Event Extractor

Gmail から予定を自動抽出して Google カレンダーに追加する Chrome 拡張機能です。AI 分析機能（Gemini/Vertex AI）を使用して、より正確な予定抽出が可能です。

## ⚠️ 注意事項

このプロジェクトの開発には生成AIを一部利用しています。

## 📷 スクリーンショット
<img width="200" alt="image" src="https://github.com/user-attachments/assets/0e0eb693-bcf4-48c3-9d84-b0dc34ec3e4c" />
<img width="200" alt="image" src="https://github.com/user-attachments/assets/b6b09319-3dbc-41e4-9ca4-82ce1b4a4b5e" />

## 🚀 機能

### 主要機能
- **Gmail 統合**: Gmail のメールから予定情報を自動抽出
- **AI 分析**: Gemini 2.5 Flash Lite を使用した高精度な予定抽出
- **Google カレンダー連携**: 抽出した予定を直接カレンダーに追加
- **コンテキストメニュー**: 選択したテキストから予定を作成
- **パターンマッチング**: AI が利用できない場合のフォールバック機能

### AI 機能
- **Gemini API 直接接続**: Google AI Studio の API キーを使用
- **Vertex AI 統合**: Google Cloud Platform のサービスアカウントを使用
- **自動言語検出**: 日本語と英語のメールに対応
- **複数予定抽出**: 一つのメールから複数の予定を抽出

## 📋 必要な権限

- `identity`: Google OAuth2 認証
- `storage`: 設定とデータの保存
- `activeTab`: アクティブタブへのアクセス
- `contextMenus`: 右クリックメニューの追加
- Gmail と Google APIs へのアクセス

## 🛠️ セットアップ

### 1. 拡張機能のインストール

1. このリポジトリをクローンまたはダウンロード
2. Chrome で `chrome://extensions/` を開く
3. 「デベロッパーモード」を有効にする
4. 「パッケージ化されていない拡張機能を読み込む」をクリック
5. ダウンロードしたフォルダを選択

### 2. Google OAuth2 設定

拡張機能には Google OAuth2 クライアント ID が含まれていますが、本番環境では独自の設定が推奨されます：

1. [Google Cloud Console](https://console.cloud.google.com/) でプロジェクトを作成
2. Gmail API と Calendar API を有効化
3. OAuth2 クライアント ID を作成（Chrome 拡張機能用）
4. `manifest.json` の `client_id` を更新

### 3. AI 機能の設定

#### オプション A: Gemini API（推奨）

1. [Google AI Studio](https://aistudio.google.com/app/apikey) で API キーを取得
2. 拡張機能の設定画面を開く
3. 「Gemini API を直接使用」を選択
4. API キーを入力

#### オプション B: Vertex AI

1. [Google Cloud Console](https://console.cloud.google.com/) でプロジェクトを作成
2. Vertex AI API を有効化
3. サービスアカウントを作成し、JSON キーをダウンロード
4. 拡張機能の設定画面でサービスアカウントキーを設定

## 📖 使用方法

### 基本的な使い方

1. **認証**: 拡張機能のポップアップで「認証する」をクリック
2. **予定抽出**: Gmail でメールを開き、「メールから予定を抽出」をクリック
3. **確認**: 抽出された予定を確認・選択
4. **追加**: 「選択した予定をカレンダーに追加」をクリック

### AI 分析の使用

1. 設定画面で AI 機能を有効化
2. API キーまたはサービスアカウントを設定
3. ポップアップで「AI 分析を使用」にチェック
4. 通常通り予定を抽出

### コンテキストメニュー

1. ウェブページでテキストを選択
2. 右クリックで「選択テキストを予定として追加」を選択
3. 予定の詳細を確認・編集
4. カレンダーに追加

## ⚙️ 設定オプション

### AI 設定
- **AI 機能**: AI 分析の有効/無効
- **API 選択**: Gemini API または Vertex AI
- **モデル**: 使用する AI モデル（Gemini 2.5 Flash Lite 推奨）

### 抽出設定
- **複数予定**: 一つのメールから複数予定を抽出
- **会議 URL**: オンライン会議の URL を自動検出
- **参加者**: メールの参加者情報を含める

## 🔧 開発

### ファイル構成

```
├── manifest.json          # 拡張機能の設定
├── popup.html             # ポップアップ UI
├── popup.js               # ポップアップのロジック
├── background.js          # バックグラウンドスクリプト
├── content.js             # コンテンツスクリプト
├── ai-analyzer.js         # AI 分析機能
├── settings.html          # 設定画面
├── settings.js            # 設定画面のロジック
├── quick-add.html         # クイック追加画面
├── quick-add.js           # クイック追加のロジック
└── icons/                 # アイコンファイル
```

### 主要なクラス・関数

- `GmailCalendarExtension`: メイン拡張機能クラス
- `AIAnalyzer`: AI 分析機能
- `loadAISettings()`: AI 設定の読み込み
- `extractEventsFromGmail()`: Gmail からの予定抽出
- `createCalendarEvent()`: カレンダーイベントの作成

## 🐛 トラブルシューティング

### よくある問題

**AI チェックボックスが有効にならない**
- API キーが正しく設定されているか確認
- 設定画面で API 接続テストを実行
- ブラウザの開発者ツールでエラーを確認

**認証エラー**
- OAuth2 クライアント ID が正しく設定されているか確認
- 必要な API（Gmail、Calendar）が有効になっているか確認

**予定が抽出されない**
- メールに日時情報が含まれているか確認
- AI 機能が有効な場合は API キーを確認
- パターンマッチングモードでも試行

## 📝 更新履歴

### v1.0.0
- 初回リリース
- Gmail からの予定抽出機能
- Google カレンダー連携
- AI 分析機能（Gemini 2.5 Flash Lite）
- コンテキストメニュー対応

## 🔗 関連リンク

- [Google AI Studio](https://aistudio.google.com/)
- [Google Cloud Console](https://console.cloud.google.com/)
- [Chrome 拡張機能開発ガイド](https://developer.chrome.com/docs/extensions/)
- [Gmail API ドキュメント](https://developers.google.com/gmail/api)
- [Google Calendar API ドキュメント](https://developers.google.com/calendar/api)

## 📄 ライセンス

このプロジェクトは MIT ライセンスの下で公開されています。

