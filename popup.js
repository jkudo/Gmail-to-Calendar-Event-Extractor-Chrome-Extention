// popup.js

// DOM要素の取得
const authenticateBtn = document.getElementById('authenticateBtn');
const extractBtn = document.getElementById('extractBtn');
const addToCalendarBtn = document.getElementById('addToCalendarBtn');
const statusDiv = document.getElementById('status');
const loadingDiv = document.getElementById('loading');
const eventsContainer = document.getElementById('eventsContainer');
const noEventsDiv = document.getElementById('noEvents');
const successMessage = document.getElementById('successMessage');
const useAICheckbox = document.getElementById('useAI');
const settingsLink = document.getElementById('settingsLink');

// 対応する<label>を取得するヘルパー（兄弟順に依存しない）
function getCheckboxLabel(checkbox) {
  return document.querySelector(`label[for="${checkbox.id}"]`) || checkbox.closest('label');
}

let extractedEvents = [];
let selectedEvents = new Set();
let currentTab = null;
let aiEnabled = false;

// AI設定を読み込み
async function loadAISettings() {
  const settings = await chrome.storage.local.get(['aiEnabled', 'geminiApiKey', 'vertexApiKey', 'useGeminiDirect']);
  
  // AI機能が有効で、かつAPIキーが設定されている場合
  aiEnabled = settings.aiEnabled && (
    (settings.useGeminiDirect && settings.geminiApiKey) || 
    (!settings.useGeminiDirect && settings.vertexApiKey)
  );
  
  useAICheckbox.checked = aiEnabled;
  
  // APIキーが未設定の場合
  if (settings.aiEnabled && !aiEnabled) {
    useAICheckbox.disabled = true;
    const label = getCheckboxLabel(useAICheckbox);
    if (label) {
      label.style.color = '#ccc';
      label.title = 'AI機能を使用するには設定画面でAPIキーを設定してください';
    }
  } else if (!settings.aiEnabled) {
    useAICheckbox.disabled = false;
    const label = getCheckboxLabel(useAICheckbox);
    if (label) {
      label.style.color = '#666';
      label.title = 'クリックしてAI分析を有効にします';
    }
  } else {
    useAICheckbox.disabled = false;
    const label = getCheckboxLabel(useAICheckbox);
    if (label) {
      label.style.color = '#666';
      label.title = 'AI分析が有効です';
    }
  }
}

// 設定ページを開く
settingsLink.addEventListener('click', (e) => {
  e.preventDefault();
  chrome.runtime.openOptionsPage();
});

// AI使用チェックボックス
useAICheckbox.addEventListener('change', async (e) => {
  aiEnabled = e.target.checked;
  await chrome.storage.local.set({ aiEnabled: aiEnabled });
  
  if (aiEnabled) {
    updateStatus('AI分析モードが有効になりました', 'success');
  } else {
    updateStatus('パターンマッチングモードに切り替えました', 'info');
  }
});

// ステータス表示を更新
function updateStatus(message, type = 'info') {
  statusDiv.textContent = message;
  statusDiv.className = `status ${type}`;
}

// ローディング表示
function showLoading(show) {
  loadingDiv.style.display = show ? 'block' : 'none';
}

// 初期化
async function initialize() {
  // 現在のタブを取得
  const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
  currentTab = tabs[0];
  
  // 認証ボタンは常に表示（Gmail以外でも認証が必要）
  authenticateBtn.style.display = 'block';
  
  // Gmailページかチェック
  if (currentTab && currentTab.url && currentTab.url.includes('mail.google.com')) {
    // Gmailページの状態を確認
    chrome.tabs.sendMessage(currentTab.id, { action: 'getPageStatus' }, (response) => {
      if (chrome.runtime.lastError) {
        updateStatus('Gmailページを読み込み中...', 'info');
        setTimeout(initialize, 1000);
        return;
      }
      
      if (response && response.isGmail) {
        if (response.hasEmail) {
          updateStatus('現在開いているメールから予定を抽出できます', 'success');
          extractBtn.textContent = '📧 現在のメールから予定を抽出';
          extractBtn.disabled = false;
        } else {
          updateStatus('メールを開いてください', 'info');
          extractBtn.disabled = true;
        }
      }
    });
  } else {
    updateStatus('Gmailを開くとメールから予定を抽出できます', 'info');
    extractBtn.disabled = true;
    extractBtn.textContent = '📧 メールから予定を抽出（Gmailで使用）';
  }
  
  // 認証状態をチェック
  chrome.runtime.sendMessage({ action: 'authenticate' }, (response) => {
    if (response && response.success) {
      authenticateBtn.textContent = '✓ 認証済み';
      authenticateBtn.disabled = true;
    }
  });
}

// 認証ボタンのクリックイベント
authenticateBtn.addEventListener('click', async () => {
  showLoading(true);
  updateStatus('認証中...', 'info');
  
  chrome.runtime.sendMessage({ action: 'authenticate' }, (response) => {
    showLoading(false);
    
    if (response.success) {
      updateStatus('認証成功！', 'success');
      authenticateBtn.textContent = '✓ 認証済み';
      authenticateBtn.disabled = true;
      initialize(); // 再初期化
    } else {
      updateStatus(`認証失敗: ${response.error}`, 'error');
    }
  });
});

// メール抽出ボタンのクリックイベント
extractBtn.addEventListener('click', async () => {
  showLoading(true);
  updateStatus('メールを解析中...', 'info');
  eventsContainer.style.display = 'none';
  noEventsDiv.style.display = 'none';
  addToCalendarBtn.style.display = 'none';
  
  // AI分析を使用するかチェック
  const useAI = useAICheckbox.checked && !useAICheckbox.disabled;
  
  if (useAI) {
    updateStatus('AIでメールを分析中...🤖', 'info');
    
    // 現在のタブからメールデータを取得してAI分析
    chrome.tabs.sendMessage(currentTab.id, { action: 'extractCurrentEmail' }, async (response) => {
      if (chrome.runtime.lastError) {
        showLoading(false);
        updateStatus('エラー: ページを再読み込みしてください', 'error');
        return;
      }
      
      if (response && response.success && response.emailData) {
        const emailData = response.emailData;
        
        // AI分析を実行
        chrome.runtime.sendMessage(
          { action: 'analyzeEmail', emailData: emailData },
          (aiResponse) => {
            showLoading(false);
            
            if (aiResponse && aiResponse.success && aiResponse.events) {
              extractedEvents = aiResponse.events;
              
              if (extractedEvents.length > 0) {
                updateStatus(`AI分析完了: ${extractedEvents.length}件の予定を検出しました`, 'success');
                displayEvents(extractedEvents);
                addToCalendarBtn.style.display = 'block';
              } else {
                updateStatus('予定情報が見つかりませんでした', 'info');
                noEventsDiv.style.display = 'block';
              }
            } else {
              // AI分析失敗時はパターンマッチングにフォールバック
              updateStatus('AI分析に失敗しました。パターンマッチングで再試行します', 'info');
              fallbackToPatternExtraction(emailData);
            }
          }
        );
      } else {
        showLoading(false);
        updateStatus('メールを読み取れませんでした', 'error');
      }
    });
  } else {
    // パターンマッチングを使用
    chrome.tabs.sendMessage(currentTab.id, { action: 'extractCurrentEmail' }, (response) => {
      showLoading(false);
      
      if (chrome.runtime.lastError) {
        updateStatus('エラー: ページを再読み込みしてください', 'error');
        return;
      }
      
      if (response && response.success && response.emailData) {
        const emailData = response.emailData;
        
        if (emailData.extractedEvents && emailData.extractedEvents.length > 0) {
          extractedEvents = emailData.extractedEvents;
          updateStatus(`${extractedEvents.length}件の予定候補が見つかりました`, 'success');
          displayEvents(extractedEvents);
          addToCalendarBtn.style.display = 'block';
        } else {
          updateStatus('予定情報が見つかりませんでした', 'info');
          noEventsDiv.style.display = 'block';
          
          // デバッグ情報を表示
          if (emailData.body) {
            console.log('メール本文:', emailData.body.substring(0, 500));
          }
        }
      } else {
        updateStatus('メールを読み取れませんでした', 'error');
      }
    });
  }
});

// パターンマッチングへのフォールバック
function fallbackToPatternExtraction(emailData) {
  if (emailData.extractedEvents && emailData.extractedEvents.length > 0) {
    extractedEvents = emailData.extractedEvents;
    updateStatus(`パターンマッチング: ${extractedEvents.length}件の予定を検出`, 'success');
    displayEvents(extractedEvents);
    addToCalendarBtn.style.display = 'block';
  } else {
    updateStatus('予定情報が見つかりませんでした', 'info');
    noEventsDiv.style.display = 'block';
  }
}

// イベントを表示
function displayEvents(events) {
  eventsContainer.innerHTML = '';
  eventsContainer.style.display = 'block';
  
  events.forEach((event, index) => {
    const eventDiv = document.createElement('div');
    eventDiv.className = 'event-item';
    eventDiv.dataset.index = index;
    
    const checkboxContainer = document.createElement('div');
    checkboxContainer.className = 'checkbox-container';
    
    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.id = `event-${index}`;
    checkbox.checked = true;
    selectedEvents.add(index);
    
    checkbox.addEventListener('change', (e) => {
      if (e.target.checked) {
        selectedEvents.add(index);
        eventDiv.classList.add('selected');
      } else {
        selectedEvents.delete(index);
        eventDiv.classList.remove('selected');
      }
      
      addToCalendarBtn.disabled = selectedEvents.size === 0;
    });
    
    const label = document.createElement('label');
    label.htmlFor = `event-${index}`;
    label.style.cursor = 'pointer';
    label.style.flex = '1';
    
    const title = document.createElement('div');
    title.className = 'event-title';
    title.textContent = event.title || event.subject || '予定';
    
    const date = document.createElement('div');
    date.className = 'event-date';
    let dateText = `📅 ${event.date}`;
    if (event.startTime) {
      dateText += ` ${event.startTime}`;
      if (event.endTime) {
        dateText += ` - ${event.endTime}`;
      }
    }
    date.textContent = dateText;
    
    label.appendChild(title);
    label.appendChild(date);
    
    if (event.location) {
      const location = document.createElement('div');
      location.className = 'event-location';
      location.textContent = `📍 ${event.location}`;
      label.appendChild(location);
    }
    
    if (event.meetingUrl) {
      const meetingUrl = document.createElement('div');
      meetingUrl.className = 'event-location';
      meetingUrl.textContent = `🔗 オンライン会議`;
      meetingUrl.style.color = '#1976d2';
      label.appendChild(meetingUrl);
    }
    
    // AI分析の場合、信頼度と重要度を表示
    if (event.extractedBy === 'ai' && event.confidence !== undefined) {
      const aiInfo = document.createElement('div');
      aiInfo.style.fontSize = '11px';
      aiInfo.style.color = '#888';
      aiInfo.style.marginTop = '4px';
      
      const confidencePercent = Math.round(event.confidence * 100);
      const confidenceColor = confidencePercent >= 80 ? '#4caf50' : 
                              confidencePercent >= 60 ? '#ff9800' : '#f44336';
      
      aiInfo.innerHTML = `
        <span style="color: ${confidenceColor}">
          🤖 信頼度: ${confidencePercent}%
        </span>
        ${event.importance ? ` | 重要度: ${event.importance === 'high' ? '🔴 高' : 
                                         event.importance === 'medium' ? '🟡 中' : '🟢 低'}` : ''}
      `;
      label.appendChild(aiInfo);
    }
    
    const from = document.createElement('div');
    from.className = 'event-from';
    from.textContent = `From: ${event.from || 'Unknown'}`;
    label.appendChild(from);
    
    checkboxContainer.appendChild(checkbox);
    checkboxContainer.appendChild(label);
    
    eventDiv.appendChild(checkboxContainer);
    eventDiv.classList.add('selected');
    eventsContainer.appendChild(eventDiv);
  });
}

// カレンダーに追加ボタンのクリックイベント
addToCalendarBtn.addEventListener('click', async () => {
  const eventsToAdd = Array.from(selectedEvents).map(index => extractedEvents[index]);
  
  if (eventsToAdd.length === 0) {
    updateStatus('追加する予定を選択してください', 'error');
    return;
  }
  
  showLoading(true);
  updateStatus(`${eventsToAdd.length}件の予定を追加中...`, 'info');
  
  let successCount = 0;
  let errorCount = 0;
  
  for (const event of eventsToAdd) {
    try {
      // イベントデータを整形
      const eventData = {
        subject: event.title,
        from: event.from,
        date: event.date,
        startTime: event.startTime,
        endTime: event.endTime,
        location: event.location,
        meetingUrl: event.meetingUrl,
        body: event.context || '',
        parsedDate: parseDateTime(event.date, event.startTime),
        parsedEndDate: event.endTime ? parseDateTime(event.date, event.endTime) : null
      };
      
      await new Promise((resolve) => {
        chrome.runtime.sendMessage(
          { action: 'createCalendarEvent', eventData: eventData },
          (response) => {
            if (response && response.success) {
              successCount++;
            } else {
              errorCount++;
              console.error('Failed to add event:', response ? response.error : 'Unknown error');
            }
            resolve();
          }
        );
      });
    } catch (error) {
      errorCount++;
      console.error('Error adding event:', error);
    }
  }
  
  showLoading(false);
  
  if (errorCount === 0) {
    updateStatus(`${successCount}件の予定を正常に追加しました！`, 'success');
    eventsContainer.style.display = 'none';
    addToCalendarBtn.style.display = 'none';
    successMessage.style.display = 'block';
    
    setTimeout(() => {
      successMessage.style.display = 'none';
      selectedEvents.clear();
      extractedEvents = [];
      initialize(); // 再初期化
    }, 3000);
  } else {
    updateStatus(`${successCount}件成功、${errorCount}件失敗`, 'error');
  }
});

// 日時を解析してISO形式に変換
function parseDateTime(dateStr, timeStr) {
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
        const timeMatch = timeStr.match(/(\d{1,2})[:時](\d{2})?/);
        if (timeMatch) {
          hour = parseInt(timeMatch[1]);
          minute = parseInt(timeMatch[2] || '0');
        }
      }
      
      return new Date(year, month, day, hour, minute).toISOString();
    }
    
    // その他の形式
    const parsed = new Date(dateStr + (timeStr ? ' ' + timeStr : ''));
    if (!isNaN(parsed.getTime())) {
      return parsed.toISOString();
    }
  } catch (e) {
    console.error('Date parse error:', e);
  }
  
  // パースできない場合は現在時刻を返す
  return new Date().toISOString();
}

// 初期化
document.addEventListener('DOMContentLoaded', async () => {
  await loadAISettings();
  await initialize();
});
