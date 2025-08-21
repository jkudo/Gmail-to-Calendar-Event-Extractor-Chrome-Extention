// Gmail Content Script - 現在表示されているメールから予定情報を抽出

class GmailContentExtractor {
  constructor() {
    this.currentEmailData = null;
    this.setupMessageListener();
    this.observeGmailChanges();
  }

  // メッセージリスナーの設定
  setupMessageListener() {
    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
      if (request.action === 'extractCurrentEmail') {
        const emailData = this.extractCurrentEmail();
        sendResponse({ success: true, emailData: emailData });
      }
      return true;
    });
  }

  // Gmailの変更を監視
  observeGmailChanges() {
    // Gmail のメール表示エリアを監視
    const observer = new MutationObserver(() => {
      // メールが開かれたかチェック
      if (this.isEmailOpen()) {
        this.currentEmailData = this.extractCurrentEmail();
      }
    });

    // 監視開始（Gmail のロード完了を待つ）
    const startObserving = () => {
      const targetNode = document.querySelector('[role="main"]');
      if (targetNode) {
        observer.observe(targetNode, {
          childList: true,
          subtree: true
        });
      } else {
        setTimeout(startObserving, 1000);
      }
    };
    
    startObserving();
  }

  // メールが開かれているかチェック
  isEmailOpen() {
    // Gmailでメールが開かれているときの要素をチェック
    return document.querySelector('[role="article"]') !== null ||
           document.querySelector('.ii.gt') !== null ||
           document.querySelector('.a3s.aiL') !== null;
  }

  // 現在表示されているメールから情報を抽出
  extractCurrentEmail() {
    if (!this.isEmailOpen()) {
      return null;
    }

    const emailData = {
      subject: this.getEmailSubject(),
      from: this.getEmailSender(),
      body: this.getEmailBody(),
      date: this.getEmailDate(),
      extractedEvents: []
    };

    // メール本文から予定情報を抽出
    if (emailData.body) {
      emailData.extractedEvents = this.parseEventsFromContent(emailData);
    }

    return emailData;
  }

  // メールの件名を取得
  getEmailSubject() {
    // 複数のセレクタを試す（Gmailのバージョンによって異なる場合がある）
    const selectors = [
      'h2[data-legacy-message-id]',
      '.hP',
      '[role="heading"][aria-level="2"]',
      '.ha h2'
    ];

    for (const selector of selectors) {
      const element = document.querySelector(selector);
      if (element && element.textContent) {
        return element.textContent.trim();
      }
    }

    return '';
  }

  // メールの送信者を取得
  getEmailSender() {
    const selectors = [
      '.gD',
      '.go span[email]',
      '.qu [email]',
      '.g0'
    ];

    for (const selector of selectors) {
      const element = document.querySelector(selector);
      if (element) {
        // メールアドレスを取得
        const email = element.getAttribute('email') || element.textContent;
        const name = element.getAttribute('name') || element.textContent;
        return name && email && name !== email ? `${name} <${email}>` : email || name || '';
      }
    }

    return '';
  }

  // メール本文を取得
  getEmailBody() {
    // メール本文のセレクタ
    const selectors = [
      '.ii.gt .a3s.aiL',
      '.ii.gt',
      '[role="article"]',
      '.a3s'
    ];

    for (const selector of selectors) {
      const elements = document.querySelectorAll(selector);
      if (elements.length > 0) {
        // 最後の要素（最新の返信）を取得
        const element = elements[elements.length - 1];
        let text = element.innerText || element.textContent || '';
        
        // HTMLタグを除去して純粋なテキストを取得
        text = text.replace(/<[^>]*>/g, ' ');
        text = text.replace(/\s+/g, ' ');
        
        return text.trim();
      }
    }

    return '';
  }

  // メールの日付を取得
  getEmailDate() {
    const selectors = [
      '.g3',
      '[title*="20"]',
      '.date'
    ];

    for (const selector of selectors) {
      const element = document.querySelector(selector);
      if (element) {
        const dateText = element.getAttribute('title') || element.textContent;
        if (dateText) {
          return dateText.trim();
        }
      }
    }

    return new Date().toLocaleDateString();
  }

  // メール内容から予定情報を解析
  parseEventsFromContent(emailData) {
    const events = [];
    const body = emailData.body;
    
    if (!body) return events;

    // 日時パターン
    const datePatterns = [
      // 日本語パターン
      {
        pattern: /(\d{4}年\d{1,2}月\d{1,2}日)\s*(\d{1,2}[:時]\d{2}分?)?/g,
        type: 'japanese'
      },
      // 英語パターン MM/DD/YYYY
      {
        pattern: /(\d{1,2}\/\d{1,2}\/\d{4})\s+(\d{1,2}:\d{2}\s*[AP]M)?/gi,
        type: 'english'
      },
      // ISO形式
      {
        pattern: /(\d{4}-\d{2}-\d{2})[T\s](\d{2}:\d{2})/g,
        type: 'iso'
      },
      // 月 日, 年 形式
      {
        pattern: /(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+\d{1,2},?\s+\d{4}\s*(\d{1,2}:\d{2}\s*[AP]M)?/gi,
        type: 'month-day-year'
      },
      // 今日、明日、明後日
      {
        pattern: /(今日|明日|明後日|本日)\s*(\d{1,2}[:時]\d{2}分?)?/g,
        type: 'relative'
      }
    ];

    // 時間範囲パターン
    const timeRangePatterns = [
      /(\d{1,2}[:時]\d{2}分?)\s*[-~～から]\s*(\d{1,2}[:時]\d{2}分?)/g,
      /(\d{1,2}:\d{2}\s*[AP]M)\s*[-~to]\s*(\d{1,2}:\d{2}\s*[AP]M)/gi,
      /(\d{1,2})時\s*[-~～から]\s*(\d{1,2})時/g
    ];

    // 場所パターン
    const locationPatterns = [
      /場所[:：]\s*([^\n]+)/,
      /Location[:：]\s*([^\n]+)/i,
      /会場[:：]\s*([^\n]+)/,
      /Venue[:：]\s*([^\n]+)/i,
      /Where[:：]\s*([^\n]+)/i,
      /住所[:：]\s*([^\n]+)/,
      /Address[:：]\s*([^\n]+)/i
    ];

    // 会議URLパターン
    const meetingUrlPatterns = [
      /(https:\/\/[^\s]+meet[^\s]+)/gi,
      /(https:\/\/zoom\.us\/[^\s]+)/gi,
      /(https:\/\/teams\.microsoft\.com\/[^\s]+)/gi,
      /(https:\/\/[^\s]+webex[^\s]+)/gi
    ];

    // 日時を検索
    let foundDates = [];
    for (const dateInfo of datePatterns) {
      const matches = [...body.matchAll(dateInfo.pattern)];
      for (const match of matches) {
        foundDates.push({
          fullMatch: match[0],
          date: match[1],
          time: match[2] || null,
          type: dateInfo.type,
          index: match.index
        });
      }
    }

    // 各日付について前後のコンテキストから詳細情報を取得
    for (const dateInfo of foundDates) {
      // 日付の前後200文字を取得してコンテキストを解析
      const contextStart = Math.max(0, dateInfo.index - 200);
      const contextEnd = Math.min(body.length, dateInfo.index + 200);
      const context = body.substring(contextStart, contextEnd);

      // 時間範囲を検索
      let startTime = dateInfo.time;
      let endTime = null;
      
      for (const pattern of timeRangePatterns) {
        const timeMatch = context.match(pattern);
        if (timeMatch) {
          startTime = timeMatch[1];
          endTime = timeMatch[2];
          break;
        }
      }

      // 場所を検索
      let location = null;
      for (const pattern of locationPatterns) {
        const locationMatch = context.match(pattern);
        if (locationMatch && locationMatch[1]) {
          location = locationMatch[1].trim();
          break;
        }
      }

      // 会議URLを検索
      let meetingUrl = null;
      for (const pattern of meetingUrlPatterns) {
        const urlMatch = context.match(pattern);
        if (urlMatch) {
          meetingUrl = urlMatch[0];
          if (!location) {
            location = 'オンライン会議';
          }
          break;
        }
      }

      // イベントタイトルを推定（件名または日付周辺のテキスト）
      let title = emailData.subject;
      
      // コンテキストから会議名や予定名を抽出
      const titlePatterns = [
        /「([^」]+)」/,
        /【([^】]+)】/,
        /会議[:：]\s*([^\n]+)/,
        /Meeting[:：]\s*([^\n]+)/i,
        /予定[:：]\s*([^\n]+)/,
        /Event[:：]\s*([^\n]+)/i
      ];
      
      for (const pattern of titlePatterns) {
        const titleMatch = context.match(pattern);
        if (titleMatch && titleMatch[1]) {
          title = titleMatch[1].trim();
          break;
        }
      }

      // 相対日付を実際の日付に変換
      let actualDate = dateInfo.date;
      if (dateInfo.type === 'relative') {
        const today = new Date();
        switch (dateInfo.date) {
          case '今日':
          case '本日':
            actualDate = this.formatDate(today);
            break;
          case '明日':
            today.setDate(today.getDate() + 1);
            actualDate = this.formatDate(today);
            break;
          case '明後日':
            today.setDate(today.getDate() + 2);
            actualDate = this.formatDate(today);
            break;
        }
      }

      const event = {
        id: `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        title: title || '予定',
        date: actualDate,
        startTime: startTime,
        endTime: endTime,
        location: location,
        meetingUrl: meetingUrl,
        from: emailData.from,
        originalText: dateInfo.fullMatch,
        context: context.substring(0, 500)
      };

      events.push(event);
    }

    // 重複を除去（同じ日時の予定）
    const uniqueEvents = [];
    const seen = new Set();
    
    for (const event of events) {
      const key = `${event.date}_${event.startTime}`;
      if (!seen.has(key)) {
        seen.add(key);
        uniqueEvents.push(event);
      }
    }

    return uniqueEvents;
  }

  // 日付をフォーマット
  formatDate(date) {
    const year = date.getFullYear();
    const month = date.getMonth() + 1;
    const day = date.getDate();
    return `${year}年${month}月${day}日`;
  }
}

// Content Script を初期化
const gmailExtractor = new GmailContentExtractor();

// 拡張機能アイコンがクリックされたときにメールデータを送信
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'getPageStatus') {
    const isGmail = window.location.hostname === 'mail.google.com';
    const hasEmail = gmailExtractor.isEmailOpen();
    sendResponse({
      isGmail: isGmail,
      hasEmail: hasEmail,
      currentUrl: window.location.href
    });
  }
  return true;
});