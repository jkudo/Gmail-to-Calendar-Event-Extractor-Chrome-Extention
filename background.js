// OAuth2認証とAPI通信を処理するバックグラウンドスクリプト
// AI分析機能を統合

// Service Workerでai-analyzer.jsをインポート（ファイルが存在する場合のみ）
try {
  self.importScripts('ai-analyzer.js');
} catch (e) {
  console.log('AI analyzer not available:', e.message);
}

// グローバル変数でコンテキストメニューの状態を管理
let contextMenuCreated = false;

class GmailCalendarExtension {
  constructor() {
    this.accessToken = null;
    this.aiAnalyzer = null;
    this.setupMessageListeners();
    this.initializeAI();
  }

  // 初期化（拡張機能のインストール/更新時）
  initialize() {
    // コンテキストメニューを設定（まだ作成されていない場合のみ）
    if (!contextMenuCreated) {
      this.setupContextMenu();
    }
  }

  // コンテキストメニューの設定
  setupContextMenu() {
    // すべてのコンテキストメニューをクリア
    chrome.contextMenus.removeAll(() => {
      // 新しくメニューアイテムを作成
      chrome.contextMenus.create({
        id: 'addToCalendar',
        title: '📅 選択テキストを予定として追加',
        contexts: ['selection']
      }, () => {
        if (chrome.runtime.lastError) {
          // このエラーは無視（Service Worker再起動時などに発生する可能性がある）
          return;
        }
        contextMenuCreated = true;
      });
    });
  }

  // AI分析機能の初期化
  async initializeAI() {
    try {
      // AIEventAnalyzerが存在する場合のみ初期化
      if (typeof AIEventAnalyzer !== 'undefined') {
        const settings = await chrome.storage.local.get(['aiEnabled', 'geminiApiKey', 'vertexApiKey', 'projectId', 'model', 'useGeminiDirect']);
        
        // AI機能が無効の場合はスキップ
        if (!settings.aiEnabled) {
          console.log('AI feature is disabled');
          this.aiAnalyzer = null;
          return;
        }
        
        this.aiAnalyzer = new AIEventAnalyzer();
        
        if (settings.useGeminiDirect && settings.geminiApiKey) {
          this.aiAnalyzer.useGeminiDirect = true;
          this.aiAnalyzer.geminiApiKey = settings.geminiApiKey;
          this.aiAnalyzer.apiKey = settings.geminiApiKey; // 両方に設定
          console.log('AI Analyzer initialized with Gemini API');
        } else if (settings.vertexApiKey && settings.projectId) {
          this.aiAnalyzer.apiKey = settings.vertexApiKey;
          this.aiAnalyzer.projectId = settings.projectId;
          this.aiAnalyzer.useGeminiDirect = false;
          console.log('AI Analyzer initialized with Vertex AI');
        } else {
          console.log('AI Analyzer created but no API key configured');
          this.aiAnalyzer = null; // APIキーがない場合はnullに設定
        }
        
        if (this.aiAnalyzer && settings.model) {
          this.aiAnalyzer.model = settings.model;
        }
      } else {
        console.log('AIEventAnalyzer not available');
      }
    } catch (error) {
      console.error('Failed to initialize AI:', error);
      this.aiAnalyzer = null;
    }
  }

  // 選択されたテキストを処理
  async handleSelectedText(selectedText, tab) {
    let eventData;
    
    // 最新の設定でAIを初期化
    await this.initializeAI();
    
    // AI分析が利用可能な場合はAIを使用
    if (this.aiAnalyzer) {
      try {
        const events = await this.aiAnalyzer.extractEventsWithAI(selectedText, {
          source: 'context_menu',
          url: tab.url,
          title: tab.title
        });
        
        if (events && events.length > 0) {
          // 最も信頼度の高いイベントを使用
          eventData = events.reduce((prev, current) => 
            (current.confidence > prev.confidence) ? current : prev
          );
        }
      } catch (error) {
        console.error('AI extraction failed, falling back to pattern matching:', error);
      }
    } else {
      console.log('AI not available, using pattern matching');
    }
    
    // AIが利用できない、または失敗した場合はパターンマッチングを使用
    if (!eventData) {
      eventData = this.parseEventFromText(selectedText);
    }
    
    // ポップアップウィンドウを開いて予定を編集
    const popupUrl = chrome.runtime.getURL('quick-add.html');
    const popupWindow = await chrome.windows.create({
      url: popupUrl + '?data=' + encodeURIComponent(JSON.stringify(eventData)),
      type: 'popup',
      width: 450,
      height: 600,
      left: 100,
      top: 100
    });
  }

  // テキストから予定情報を抽出
  parseEventFromText(text) {
    const eventData = {
      title: '',
      date: '',
      startTime: '',
      endTime: '',
      location: '',
      description: text,
      originalText: text
    };

    // 日時パターン
    const datePatterns = [
      /(\d{4}年\d{1,2}月\d{1,2}日)\s*(\d{1,2}[:時]\d{2}分?)?/,
      /(\d{1,2}\/\d{1,2}\/\d{4})\s+(\d{1,2}:\d{2}\s*[AP]M)?/i,
      /(今日|明日|明後日|本日)\s*(\d{1,2}[:時]\d{2}分?)?/
    ];

    // 日時を検索
    for (const pattern of datePatterns) {
      const match = text.match(pattern);
      if (match) {
        eventData.date = match[1];
        if (match[2]) {
          eventData.startTime = match[2];
        }
        break;
      }
    }

    // 相対日付を実際の日付に変換
    if (eventData.date) {
      const today = new Date();
      switch (eventData.date) {
        case '今日':
        case '本日':
          eventData.date = this.formatDate(today);
          break;
        case '明日':
          today.setDate(today.getDate() + 1);
          eventData.date = this.formatDate(today);
          break;
        case '明後日':
          today.setDate(today.getDate() + 2);
          eventData.date = this.formatDate(today);
          break;
      }
    }

    // 日付がない場合は今日の日付を設定
    if (!eventData.date) {
      eventData.date = this.formatDate(new Date());
    }

    // タイトルを推定
    const lines = text.split('\n');
    if (lines.length > 0) {
      eventData.title = lines[0].trim().substring(0, 50) || '新しい予定';
    }

    return eventData;
  }

  // 日付をフォーマット
  formatDate(date) {
    const year = date.getFullYear();
    const month = date.getMonth() + 1;
    const day = date.getDate();
    return `${year}年${month}月${day}日`;
  }

  // メッセージリスナーの設定
  setupMessageListeners() {
    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
      // 認証処理
      if (request.action === 'authenticate') {
        this.authenticate().then(token => {
          sendResponse({ success: true, token: token });
        }).catch(error => {
          sendResponse({ success: false, error: error.message });
        });
        return true;
      }
      
      // 従来のパターンマッチング抽出
      if (request.action === 'extractEvents') {
        this.extractEventsFromGmail().then(events => {
          sendResponse({ success: true, events: events });
        }).catch(error => {
          sendResponse({ success: false, error: error.message });
        });
        return true;
      }
      
      // AI分析によるメール解析
      if (request.action === 'analyzeEmail') {
        // 非同期処理のため、先にtrueを返す
        (async () => {
          // AIアナライザーを初期化（最新の設定を取得）
          await this.initializeAI();
          
          if (!this.aiAnalyzer) {
            sendResponse({ success: false, error: 'AI not configured or API key not set' });
            return;
          }
          
          try {
            const events = await this.aiAnalyzer.analyzeEmailWithContext(request.emailData);
            sendResponse({ success: true, events: events });
          } catch (error) {
            sendResponse({ success: false, error: error.message });
          }
        })();
        return true; // 非同期レスポンスを示す
      }
      
      // AIを使った選択テキストの分析
      if (request.action === 'extractWithAI') {
        // 非同期処理のため、先にtrueを返す
        (async () => {
          // AIアナライザーを初期化（最新の設定を取得）
          await this.initializeAI();
          
          if (!this.aiAnalyzer) {
            sendResponse({ success: false, error: 'AI not configured or API key not set' });
            return;
          }
          
          try {
            const events = await this.aiAnalyzer.extractEventsWithAI(request.text, request.context || {});
            sendResponse({ success: true, events: events });
          } catch (error) {
            sendResponse({ success: false, error: error.message });
          }
        })();
        return true; // 非同期レスポンスを示す
      }
      
      // カレンダーイベント作成
      if (request.action === 'createCalendarEvent') {
        this.createCalendarEvent(request.eventData).then(result => {
          sendResponse({ success: true, result: result });
        }).catch(error => {
          sendResponse({ success: false, error: error.message });
        });
        return true;
      }
      
      // 設定の更新
      if (request.action === 'updateSettings') {
        this.initializeAI().then(() => {
          sendResponse({ success: true });
        }).catch(error => {
          sendResponse({ success: false, error: error.message });
        });
        return true;
      }
    });
  }

  // OAuth2認証
  async authenticate() {
    return new Promise((resolve, reject) => {
      chrome.identity.getAuthToken({ interactive: true }, (token) => {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
        } else {
          this.accessToken = token;
          resolve(token);
        }
      });
    });
  }

  // Gmailからメールを取得して予定を抽出
  async extractEventsFromGmail() {
    if (!this.accessToken) {
      await this.authenticate();
    }

    try {
      // 最近のメールを取得（過去7日間）
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
      const query = `after:${Math.floor(sevenDaysAgo.getTime() / 1000)}`;
      
      const response = await fetch(
        `https://www.googleapis.com/gmail/v1/users/me/messages?q=${encodeURIComponent(query)}&maxResults=20`,
        {
          headers: {
            'Authorization': `Bearer ${this.accessToken}`
          }
        }
      );

      if (!response.ok) {
        throw new Error(`Gmail API error: ${response.status}`);
      }

      const data = await response.json();
      const messages = data.messages || [];
      
      const extractedEvents = [];
      
      // 各メールを処理
      for (const message of messages) {
        const messageDetail = await this.getMessageDetail(message.id);
        const events = this.parseEventsFromEmail(messageDetail);
        extractedEvents.push(...events);
      }
      
      return extractedEvents;
    } catch (error) {
      console.error('Error extracting events:', error);
      throw error;
    }
  }

  // メールの詳細を取得
  async getMessageDetail(messageId) {
    const response = await fetch(
      `https://www.googleapis.com/gmail/v1/users/me/messages/${messageId}`,
      {
        headers: {
          'Authorization': `Bearer ${this.accessToken}`
        }
      }
    );

    if (!response.ok) {
      throw new Error(`Failed to get message detail: ${response.status}`);
    }

    return response.json();
  }

  // メールから予定情報を解析
  parseEventsFromEmail(messageData) {
    const events = [];
    
    // メール本文を取得
    const payload = messageData.payload;
    const headers = payload.headers || [];
    const subject = headers.find(h => h.name === 'Subject')?.value || '';
    const from = headers.find(h => h.name === 'From')?.value || '';
    
    // メール本文をデコード
    const body = this.extractBodyFromPayload(payload);
    
    // 日時パターンを検索
    const datePatterns = [
      /(\d{4}年\d{1,2}月\d{1,2}日)\s*(\d{1,2}[:時]\d{2}分?)?/g,
      /(\d{1,2}\/\d{1,2}\/\d{4})\s+(\d{1,2}:\d{2}\s*[AP]M)?/gi,
      /(\d{4}-\d{2}-\d{2})[T\s](\d{2}:\d{2})/g
    ];

    // 日時を検索
    for (const pattern of datePatterns) {
      const matches = body.matchAll(pattern);
      for (const match of matches) {
        const event = {
          id: `${messageData.id}_${Math.random().toString(36).substr(2, 9)}`,
          subject: subject,
          from: from,
          date: match[1],
          startTime: match[2] || null,
          body: body.substring(0, 500),
          originalDate: new Date(parseInt(messageData.internalDate)),
          parsedDate: this.parseDate(match[1], match[2])
        };
        
        events.push(event);
      }
    }

    return events;
  }

  // メール本文を抽出
  extractBodyFromPayload(payload) {
    let body = '';
    
    if (payload.parts) {
      for (const part of payload.parts) {
        if (part.mimeType === 'text/plain' || part.mimeType === 'text/html') {
          if (part.body && part.body.data) {
            body += this.base64Decode(part.body.data) + '\n';
          }
        }
        if (part.parts) {
          body += this.extractBodyFromPayload(part);
        }
      }
    } else if (payload.body && payload.body.data) {
      body = this.base64Decode(payload.body.data);
    }
    
    // HTMLタグを除去
    body = body.replace(/<[^>]*>/g, ' ');
    body = body.replace(/&nbsp;/g, ' ');
    body = body.replace(/\s+/g, ' ');
    
    return body.trim();
  }

  // Base64デコード
  base64Decode(data) {
    const base64 = data.replace(/-/g, '+').replace(/_/g, '/');
    try {
      return decodeURIComponent(escape(atob(base64)));
    } catch (e) {
      console.error('Base64 decode error:', e);
      return '';
    }
  }

  // 日付文字列を解析
  parseDate(dateStr, timeStr = null) {
    try {
      // 日本語形式
      const jpMatch = dateStr.match(/(\d{4})年(\d{1,2})月(\d{1,2})日/);
      if (jpMatch) {
        const year = parseInt(jpMatch[1]);
        const month = parseInt(jpMatch[2]) - 1;
        const day = parseInt(jpMatch[3]);
        
        let hour = 9; // デフォルト朝9時
        let minute = 0;
        
        if (timeStr) {
          const timeMatch = timeStr.match(/(\d{1,2})[:時](\d{2})/);
          if (timeMatch) {
            hour = parseInt(timeMatch[1]);
            minute = parseInt(timeMatch[2]);
          }
        }
        
        return new Date(year, month, day, hour, minute).toISOString();
      }
      
      // その他の形式はDate.parseを試す
      const parsed = new Date(dateStr + (timeStr ? ' ' + timeStr : ''));
      if (!isNaN(parsed.getTime())) {
        return parsed.toISOString();
      }
    } catch (e) {
      console.error('Date parse error:', e);
    }
    
    return null;
  }

  // Googleカレンダーにイベントを作成
  async createCalendarEvent(eventData) {
    if (!this.accessToken) {
      await this.authenticate();
    }

    const calendarEvent = {
      summary: eventData.subject || eventData.title || 'メールから抽出された予定',
      description: eventData.description || `送信者: ${eventData.from}\n\n${eventData.body || ''}`,
      start: {
        dateTime: eventData.parsedDate || new Date().toISOString(),
        timeZone: 'Asia/Tokyo'
      },
      end: {
        dateTime: eventData.parsedEndDate || 
                  new Date(new Date(eventData.parsedDate || new Date()).getTime() + 60 * 60 * 1000).toISOString(),
        timeZone: 'Asia/Tokyo'
      }
    };

    if (eventData.location) {
      calendarEvent.location = eventData.location;
    }

    if (eventData.meetingUrl) {
      calendarEvent.description += `\n\n会議URL: ${eventData.meetingUrl}`;
    }

    try {
      const response = await fetch(
        'https://www.googleapis.com/calendar/v3/calendars/primary/events',
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${this.accessToken}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(calendarEvent)
        }
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(`Calendar API error: ${JSON.stringify(error)}`);
      }

      return response.json();
    } catch (error) {
      console.error('Error creating calendar event:', error);
      throw error;
    }
  }
}

// 拡張機能の初期化
const extension = new GmailCalendarExtension();

// 拡張機能のインストール/更新時の処理
chrome.runtime.onInstalled.addListener((details) => {
  console.log('Extension installed/updated:', details.reason);
  // コンテキストメニューを初期化
  contextMenuCreated = false; // リセット
  extension.initialize();
  // AI機能も初期化
  extension.initializeAI();
});

// コンテキストメニューのクリックリスナー（グローバルに一度だけ設定）
chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === 'addToCalendar') {
    extension.handleSelectedText(info.selectionText, tab);
  }
});

// Service Workerの起動時にもコンテキストメニューを再作成
// （Service Workerは定期的に停止・再起動されるため）
if (!contextMenuCreated) {
  extension.initialize();
}

// 起動時にAI機能を初期化
extension.initializeAI();