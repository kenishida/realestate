# デバッグガイド

## サーバーログの確認方法

### 1. ターミナルで確認（推奨）

開発サーバーを起動しているターミナルで、以下のようなログが表示されます：

```bash
npm run dev
```

ログの例：
```
[Analyze] ========================================
[Analyze] Scraping property data from URL: https://athomes.jp/...
[Analyze] ========================================
[Scraper] HTML length: 123456
[Scraper] Page title: 物件名 - athomes
[Scraper] Title found: 物件名
[Scraper] Price found: 50000000
[Scraper] Address found: 東京都...
...
[Analyze] Scraping completed successfully
[Analyze] Scraped data summary:
  - Title: ✓
  - Price: ✓ (50,000,000円)
  - Address: ✓
  ...
```

### 2. ブラウザの開発者ツールで確認

1. ブラウザで `F12` または `Cmd+Option+I` (Mac) / `Ctrl+Shift+I` (Windows) を押す
2. 「Console」タブを開く
3. クライアント側のログが表示されます

### 3. デバッグエンドポイントで確認

スクレイピング結果を直接確認できます：

```bash
curl -X POST http://localhost:3000/api/debug-scrape \
  -H "Content-Type: application/json" \
  -d '{"url": "物件URL"}'
```

または、ブラウザで以下を実行：

```javascript
fetch('/api/debug-scrape', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ url: '物件URL' })
})
.then(r => r.json())
.then(console.log)
```

## ログの見方

- `✓` = データが取得できた
- `✗` = データが取得できなかった
- `[Scraper]` = スクレイピング処理のログ
- `[Analyze]` = 分析処理のログ

## トラブルシューティング

### データが取得できない場合

1. **HTML構造が異なる可能性**
   - 実際のサイトのHTML構造を確認
   - セレクタを調整する必要があるかもしれません

2. **JavaScriptで動的に生成されるコンテンツ**
   - 一部のサイトはJavaScriptでコンテンツを生成
   - Puppeteerなどのヘッドレスブラウザが必要な場合があります

3. **アクセス制限**
   - サイトによってはボットをブロックする可能性
   - User-Agentを変更する必要があるかもしれません

## ログをファイルに保存する

```bash
npm run dev 2>&1 | tee server.log
```

これで、`server.log` ファイルにログが保存されます。
