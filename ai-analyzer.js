// Vertex AI (Gemini) を使った予定情報の抽出

class AIEventAnalyzer {
  constructor() {
    // Vertex AI の設定
    this.projectId = 'YOUR_PROJECT_ID'; // Google Cloud Project ID
    this.location = 'asia-northeast1'; // リージョン（東京）
    this.model = 'gemini-1.5-flash'; // 使用するモデル
    this.apiKey = null; // API Key（設定画面から取得）
    
    // Gemini API直接使用の場合（Alternative）
    this.useGeminiDirect = false; // Gemini API を直接使用するかどうか
    this.geminiApiKey = null; // Gemini API Key
  }

  // API キーの設定
  async setApiKey(apiKey) {
    this.apiKey = apiKey;
    // Chrome Storageに保存
    await chrome.storage.local.set({ vertexApiKey: apiKey });
  }

  // API キーの取得
  async getApiKey() {
    // 毎回storageから最新の設定を取得
    const result = await chrome.storage.local.get(['vertexApiKey', 'geminiApiKey', 'useGeminiDirect', 'projectId']);
    
    // Project IDも更新
    if (result.projectId) {
      this.projectId = result.projectId;
    }
    
    if (result.useGeminiDirect && result.geminiApiKey) {
      this.useGeminiDirect = true;
      this.geminiApiKey = result.geminiApiKey;
      this.apiKey = result.geminiApiKey; // apiKeyプロパティにも設定
      return result.geminiApiKey;
    }
    
    if (result.vertexApiKey) {
      this.useGeminiDirect = false;
      this.apiKey = result.vertexApiKey;
      return result.vertexApiKey;
    }
    
    return null;
  }

  // Vertex AI APIを呼び出して予定を抽出
  async extractEventsWithAI(text, context = {}) {
    try {
      const apiKey = await this.getApiKey();
      console.log('API key retrieved:', apiKey ? 'Yes' : 'No');
      console.log('Use Gemini Direct:', this.useGeminiDirect);
      
      if (!apiKey) {
        const errorMsg = 'APIキーが設定されていません。設定画面でVertex AIまたはGemini APIキーを設定してください。';
        console.error(errorMsg);
        throw new Error(errorMsg);
      }

      // プロンプトの作成
      const prompt = this.createPrompt(text, context);
      
      let response;
      
      if (this.useGeminiDirect) {
        // Gemini API を直接使用
        console.log('Using Gemini API directly');
        response = await this.callGeminiAPI(prompt, this.geminiApiKey);
      } else {
        // Vertex AI を使用（サービスアカウント認証が必要）
        console.log('Using Vertex AI');
        response = await this.callVertexAI(prompt, apiKey);
      }
      
      // レスポンスから予定情報を抽出
      return this.parseAIResponse(response);
      
    } catch (error) {
      console.error('AI extraction error:', error);
      // エラー時は従来のパターンマッチングにフォールバック
      return this.fallbackToPatternMatching(text);
    }
  }

  // Gemini API を直接呼び出し
  async callGeminiAPI(prompt, apiKey) {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-latest:generateContent?key=${apiKey}`;
    
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        contents: [{
          parts: [{
            text: prompt
          }]
        }],
        generationConfig: {
          temperature: 0.2,
          topK: 40,
          topP: 0.8,
          maxOutputTokens: 2048
        }
      })
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Gemini API error: ${response.status} - ${error}`);
    }

    const data = await response.json();
    
    if (data.candidates && data.candidates[0] && data.candidates[0].content) {
      return data.candidates[0].content.parts[0].text;
    } else {
      throw new Error('Invalid Gemini API response');
    }
  }

  // Vertex AI を呼び出し（OAuth2トークンが必要）
  async callVertexAI(prompt, accessToken) {
    // 注意: Chrome拡張機能からVertex AIを直接呼び出すには、
    // サービスアカウントの認証が必要です。
    // ここではGoogle AI Studio (Gemini API) の使用を推奨します。
    
    const endpoint = `https://${this.location}-aiplatform.googleapis.com/v1/projects/${this.projectId}/locations/${this.location}/publishers/google/models/${this.model}:generateContent`;

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        contents: [{
          role: 'user',
          parts: [{
            text: prompt
          }]
        }],
        generationConfig: {
          temperature: 0.2,
          topK: 40,
          topP: 0.8,
          candidateCount: 1,
          maxOutputTokens: 2048
        }
      })
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Vertex AI API error: ${response.status} - ${error}`);
    }

    const data = await response.json();
    
    if (data.candidates && data.candidates[0] && data.candidates[0].content) {
      return data.candidates[0].content.parts[0].text;
    } else {
      throw new Error('Invalid Vertex AI response');
    }
  }

  // プロンプトの作成
  createPrompt(text, context) {
    const currentDate = new Date().toLocaleDateString('ja-JP', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      weekday: 'long'
    });

    return `あなたは予定管理アシスタントです。以下のテキストから予定・イベントに関する情報を抽出し、構造化されたJSON形式で出力してください。

現在の日付: ${currentDate}

テキスト:
"""
${text}
"""

${context.subject ? `メールの件名: ${context.subject}` : ''}
${context.from ? `送信者: ${context.from}` : ''}

以下の情報を抽出してください：
1. イベントのタイトル（明確に記載されていない場合は内容から推測）
2. 日付（相対的な表現の場合は具体的な日付に変換）
3. 開始時間
4. 終了時間
5. 場所（物理的な場所またはオンライン）
6. 会議URL（Zoom、Teams、Meet、Webexなど）
7. 参加者（メールアドレスや名前）
8. 議題や説明
9. 重要度（高/中/低）

複数の予定が含まれている場合は、すべて抽出してください。

出力形式（JSON）:
{
  "events": [
    {
      "title": "イベントタイトル",
      "date": "YYYY年MM月DD日",
      "startTime": "HH:mm",
      "endTime": "HH:mm",
      "location": "場所",
      "meetingUrl": "URL",
      "attendees": ["参加者1", "参加者2"],
      "description": "説明",
      "importance": "high/medium/low",
      "confidence": 0.95
    }
  ],
  "summary": "抽出内容の要約"
}

注意事項：
- 日付は必ず「YYYY年MM月DD日」形式で出力
- 時間は24時間形式（HH:mm）で出力
- 不明な項目はnullとして出力
- confidenceは抽出の確信度（0-1）
- 「今日」「明日」「来週」などは具体的な日付に変換
- 曖昧な情報には低いconfidenceスコアを設定

JSONのみを出力し、他の説明は不要です。`;
  }

  // AIレスポンスの解析
  parseAIResponse(responseText) {
    try {
      // JSONを抽出（マークダウンのコードブロックに対応）
      let jsonStr = responseText;
      if (responseText.includes('```json')) {
        jsonStr = responseText.split('```json')[1].split('```')[0];
      } else if (responseText.includes('```')) {
        jsonStr = responseText.split('```')[1].split('```')[0];
      }

      const parsed = JSON.parse(jsonStr.trim());
      
      if (!parsed.events || !Array.isArray(parsed.events)) {
        throw new Error('Invalid response format');
      }

      // 抽出されたイベントを変換
      return parsed.events.map(event => ({
        id: `ai_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        title: event.title || '新しい予定',
        date: event.date,
        startTime: event.startTime,
        endTime: event.endTime,
        location: event.location,
        meetingUrl: event.meetingUrl,
        attendees: event.attendees || [],
        description: event.description,
        importance: event.importance || 'medium',
        confidence: event.confidence || 0.5,
        extractedBy: 'ai',
        summary: parsed.summary
      }));

    } catch (error) {
      console.error('Failed to parse AI response:', error);
      return [];
    }
  }

  // フォールバック：従来のパターンマッチング
  fallbackToPatternMatching(text) {
    const events = [];
    
    // 日時パターン
    const datePatterns = [
      /(\d{4}年\d{1,2}月\d{1,2}日)\s*(\d{1,2}[:時]\d{2}分?)?/g,
      /(\d{1,2}\/\d{1,2}\/\d{4})\s+(\d{1,2}:\d{2}\s*[AP]M)?/gi,
      /(今日|明日|明後日|本日)\s*(\d{1,2}[:時]\d{2}分?)?/g
    ];

    // 基本的なパターンマッチング
    for (const pattern of datePatterns) {
      const matches = [...text.matchAll(pattern)];
      for (const match of matches) {
        events.push({
          id: `pattern_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          title: '予定',
          date: match[1],
          startTime: match[2] || null,
          endTime: null,
          location: null,
          extractedBy: 'pattern',
          confidence: 0.3
        });
      }
    }

    return events;
  }

  // 高度な分析：コンテキストを考慮した予定抽出
  async analyzeEmailWithContext(emailData) {
    // メール全体のコンテキストを含めて分析
    const fullText = `
件名: ${emailData.subject || ''}
送信者: ${emailData.from || ''}
本文:
${emailData.body || ''}
    `.trim();

    const context = {
      subject: emailData.subject,
      from: emailData.from,
      date: emailData.date
    };

    return await this.extractEventsWithAI(fullText, context);
  }

  // バッチ処理：複数のテキストから予定を一括抽出
  async batchExtractEvents(texts) {
    const allEvents = [];
    
    for (const text of texts) {
      try {
        const events = await this.extractEventsWithAI(text);
        allEvents.push(...events);
        
        // レート制限対策
        await new Promise(resolve => setTimeout(resolve, 1000));
      } catch (error) {
        console.error('Batch extraction error:', error);
      }
    }

    // 重複を除去
    return this.deduplicateEvents(allEvents);
  }

  // 重複イベントの除去
  deduplicateEvents(events) {
    const seen = new Map();
    
    for (const event of events) {
      const key = `${event.date}_${event.startTime}_${event.title}`;
      
      if (!seen.has(key) || seen.get(key).confidence < event.confidence) {
        seen.set(key, event);
      }
    }

    return Array.from(seen.values());
  }

  // スマート提案：AIによる予定の最適化提案
  async suggestOptimizations(events) {
    if (events.length === 0) return [];

    const prompt = `
以下の予定リストを分析し、スケジュールの最適化提案を行ってください：

${events.map(e => `- ${e.date} ${e.startTime || ''}: ${e.title}`).join('\n')}

提案内容：
1. 時間の重複
2. 移動時間の考慮
3. 効率的なスケジューリング
4. 準備時間の確保

JSON形式で提案を出力してください。
    `;

    try {
      const response = await this.extractEventsWithAI(prompt, { type: 'optimization' });
      return response;
    } catch (error) {
      console.error('Optimization suggestion error:', error);
      return [];
    }
  }
}

// グローバルスコープで利用可能にする（Service Worker用）
if (typeof self !== 'undefined') {
  self.AIEventAnalyzer = AIEventAnalyzer;
}