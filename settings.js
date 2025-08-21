// 設定画面のJavaScript

// DOM要素
const elements = {
  // AI設定
  aiToggle: document.getElementById('aiToggle'),
  aiSettings: document.getElementById('aiSettings'),
  aiStatus: document.getElementById('aiStatus'),
  
  // API選択
  useGeminiDirect: document.getElementById('useGeminiDirect'),
  useVertexAI: document.getElementById('useVertexAI'),
  geminiSettings: document.getElementById('geminiSettings'),
  vertexSettings: document.getElementById('vertexSettings'),
  
  // Gemini API設定
  geminiApiKey: document.getElementById('geminiApiKey'),
  
  // Vertex AI設定
  projectId: document.getElementById('projectId'),
  vertexApiKey: document.getElementById('vertexApiKey'),
  
  // 共通設定
  model: document.getElementById('model'),
  
  // 抽出設定
  multiEventToggle: document.getElementById('multiEventToggle'),
  meetingUrlToggle: document.getElementById('meetingUrlToggle'),
  attendeesToggle: document.getElementById('attendeesToggle'),
  confidence: document.getElementById('confidence'),
  confidenceValue: document.getElementById('confidenceValue'),
  
  // デフォルト設定
  defaultDuration: document.getElementById('defaultDuration'),
  defaultReminder: document.getElementById('defaultReminder'),
  calendarId: document.getElementById('calendarId'),
  
  // ボタン
  saveBtn: document.getElementById('saveBtn'),
  testBtn: document.getElementById('testBtn'),
  
  // ステータス
  status: document.getElementById('status')
};

// 現在の設定
let currentSettings = {
  aiEnabled: false,
  useGeminiDirect: true,
  geminiApiKey: '',
  projectId: '',
  vertexApiKey: '',
  model: 'gemini-2.5-flash-lite',
  multiEvent: true,
  meetingUrl: true,
  attendees: false,
  confidenceThreshold: 0.7,
  defaultDuration: 60,
  defaultReminder: 10,
  calendarId: 'primary'
};

// API選択の切り替え
elements.useGeminiDirect.addEventListener('change', () => {
  if (elements.useGeminiDirect.checked) {
    elements.geminiSettings.style.display = 'block';
    elements.vertexSettings.style.display = 'none';
    currentSettings.useGeminiDirect = true;
  }
});

elements.useVertexAI.addEventListener('change', () => {
  if (elements.useVertexAI.checked) {
    elements.geminiSettings.style.display = 'none';
    elements.vertexSettings.style.display = 'block';
    currentSettings.useGeminiDirect = false;
  }
});

// 設定を読み込み
async function loadSettings() {
  try {
    const settings = await chrome.storage.local.get([
      'aiEnabled',
      'useGeminiDirect',
      'geminiApiKey',
      'vertexApiKey',
      'projectId',
      'model',
      'multiEvent',
      'meetingUrl',
      'attendees',
      'confidenceThreshold',
      'defaultDuration',
      'defaultReminder',
      'calendarId'
    ]);

    // 設定を反映
    if (settings.aiEnabled !== undefined) {
      currentSettings.aiEnabled = settings.aiEnabled;
      elements.aiToggle.classList.toggle('active', settings.aiEnabled);
      elements.aiSettings.style.display = settings.aiEnabled ? 'block' : 'none';
      updateAIStatus(settings.aiEnabled);
    }

    // API選択
    if (settings.useGeminiDirect !== undefined) {
      currentSettings.useGeminiDirect = settings.useGeminiDirect;
      if (settings.useGeminiDirect) {
        elements.useGeminiDirect.checked = true;
        elements.geminiSettings.style.display = 'block';
        elements.vertexSettings.style.display = 'none';
      } else {
        elements.useVertexAI.checked = true;
        elements.geminiSettings.style.display = 'none';
        elements.vertexSettings.style.display = 'block';
      }
    }

    if (settings.geminiApiKey) {
      currentSettings.geminiApiKey = settings.geminiApiKey;
      elements.geminiApiKey.value = '••••••••••••••••'; // マスク表示
    }

    if (settings.projectId) {
      currentSettings.projectId = settings.projectId;
      elements.projectId.value = settings.projectId;
    }

    if (settings.vertexApiKey) {
      currentSettings.vertexApiKey = settings.vertexApiKey;
      elements.vertexApiKey.value = '{"type": "service_account", ...}'; // マスク表示
    }

    if (settings.model) {
      currentSettings.model = settings.model;
      elements.model.value = settings.model;
    }

    if (settings.multiEvent !== undefined) {
      currentSettings.multiEvent = settings.multiEvent;
      elements.multiEventToggle.classList.toggle('active', settings.multiEvent);
    }

    if (settings.meetingUrl !== undefined) {
      currentSettings.meetingUrl = settings.meetingUrl;
      elements.meetingUrlToggle.classList.toggle('active', settings.meetingUrl);
    }

    if (settings.attendees !== undefined) {
      currentSettings.attendees = settings.attendees;
      elements.attendeesToggle.classList.toggle('active', settings.attendees);
    }

    if (settings.confidenceThreshold !== undefined) {
      currentSettings.confidenceThreshold = settings.confidenceThreshold;
      elements.confidence.value = settings.confidenceThreshold * 100;
      elements.confidenceValue.textContent = `${Math.round(settings.confidenceThreshold * 100)}%`;
    }

    if (settings.defaultDuration !== undefined) {
      currentSettings.defaultDuration = settings.defaultDuration;
      elements.defaultDuration.value = settings.defaultDuration;
    }

    if (settings.defaultReminder !== undefined) {
      currentSettings.defaultReminder = settings.defaultReminder;
      elements.defaultReminder.value = settings.defaultReminder;
    }

    if (settings.calendarId !== undefined) {
      currentSettings.calendarId = settings.calendarId;
      elements.calendarId.value = settings.calendarId;
    }

  } catch (error) {
    console.error('Failed to load settings:', error);
    showStatus('設定の読み込みに失敗しました', 'error');
  }
}

// AI機能のトグル
elements.aiToggle.addEventListener('click', () => {
  const isActive = elements.aiToggle.classList.toggle('active');
  elements.aiSettings.style.display = isActive ? 'block' : 'none';
  updateAIStatus(isActive);
  currentSettings.aiEnabled = isActive;
});

// その他のトグル
elements.multiEventToggle.addEventListener('click', () => {
  currentSettings.multiEvent = elements.multiEventToggle.classList.toggle('active');
});

elements.meetingUrlToggle.addEventListener('click', () => {
  currentSettings.meetingUrl = elements.meetingUrlToggle.classList.toggle('active');
});

elements.attendeesToggle.addEventListener('click', () => {
  currentSettings.attendees = elements.attendeesToggle.classList.toggle('active');
});

// 信頼度スライダー
elements.confidence.addEventListener('input', (e) => {
  const value = e.target.value;
  elements.confidenceValue.textContent = `${value}%`;
  currentSettings.confidenceThreshold = value / 100;
});

// AIステータスの更新
function updateAIStatus(enabled) {
  if (enabled) {
    elements.aiStatus.textContent = '有効';
    elements.aiStatus.className = 'ai-status enabled';
  } else {
    elements.aiStatus.textContent = '無効';
    elements.aiStatus.className = 'ai-status disabled';
  }
}

// ステータス表示
function showStatus(message, type = 'info') {
  elements.status.textContent = message;
  elements.status.className = `status show ${type}`;
  
  setTimeout(() => {
    elements.status.classList.remove('show');
  }, 5000);
}

// 設定を保存
elements.saveBtn.addEventListener('click', async () => {
  try {
    // バリデーション
    if (currentSettings.aiEnabled) {
      if (currentSettings.useGeminiDirect) {
        // Gemini API の場合
        const geminiKey = elements.geminiApiKey.value;
        if (!geminiKey || geminiKey.includes('•')) {
          showStatus('Gemini APIキーを入力してください', 'error');
          return;
        }
        currentSettings.geminiApiKey = geminiKey;
      } else {
        // Vertex AI の場合
        if (!elements.projectId.value.trim()) {
          showStatus('Project IDを入力してください', 'error');
          return;
        }
        
        const vertexKey = elements.vertexApiKey.value;
        if (!vertexKey || vertexKey === '{"type": "service_account", ...}') {
          showStatus('サービスアカウントキーを入力してください', 'error');
          return;
        }
        
        // JSONの妥当性チェック
        try {
          JSON.parse(vertexKey);
          currentSettings.vertexApiKey = vertexKey;
        } catch (e) {
          showStatus('サービスアカウントキーが正しいJSON形式ではありません', 'error');
          return;
        }
      }
    }

    // 設定を保存
    const settingsToSave = {
      aiEnabled: currentSettings.aiEnabled,
      useGeminiDirect: currentSettings.useGeminiDirect,
      model: elements.model.value,
      multiEvent: currentSettings.multiEvent,
      meetingUrl: currentSettings.meetingUrl,
      attendees: currentSettings.attendees,
      confidenceThreshold: currentSettings.confidenceThreshold,
      defaultDuration: parseInt(elements.defaultDuration.value),
      defaultReminder: parseInt(elements.defaultReminder.value),
      calendarId: elements.calendarId.value
    };

    if (currentSettings.useGeminiDirect) {
      // Gemini API設定を保存
      if (currentSettings.geminiApiKey && !currentSettings.geminiApiKey.includes('•')) {
        settingsToSave.geminiApiKey = currentSettings.geminiApiKey;
      }
    } else {
      // Vertex AI設定を保存
      settingsToSave.projectId = elements.projectId.value.trim();
      if (currentSettings.vertexApiKey && !currentSettings.vertexApiKey.includes('service_account", ...}')) {
        settingsToSave.vertexApiKey = currentSettings.vertexApiKey;
      }
    }

    await chrome.storage.local.set(settingsToSave);

    // バックグラウンドスクリプトに設定を通知
    chrome.runtime.sendMessage({
      action: 'updateSettings',
      settings: settingsToSave
    });

    showStatus('設定を保存しました', 'success');

  } catch (error) {
    console.error('Failed to save settings:', error);
    showStatus('設定の保存に失敗しました', 'error');
  }
});

// AI接続テスト
elements.testBtn.addEventListener('click', async () => {
  if (!currentSettings.aiEnabled) {
    showStatus('AI機能を有効にしてください', 'error');
    return;
  }

  if (currentSettings.useGeminiDirect) {
    // Gemini APIのテスト
    const geminiKey = elements.geminiApiKey.value;
    if (!geminiKey || geminiKey.includes('•')) {
      showStatus('Gemini APIキーを入力してください', 'error');
      return;
    }
  } else {
    // Vertex AIのテスト
    if (!elements.projectId.value.trim()) {
      showStatus('Project IDを入力してください', 'error');
      return;
    }
    
    const vertexKey = elements.vertexApiKey.value;
    if (!vertexKey || vertexKey === '{"type": "service_account", ...}') {
      showStatus('サービスアカウントキーを入力してください', 'error');
      return;
    }
  }

  showStatus('接続テスト中...', 'info');
  elements.testBtn.disabled = true;

  try {
    // 設定を一時保存（テスト用）
    await chrome.storage.local.set({
      useGeminiDirect: currentSettings.useGeminiDirect,
      geminiApiKey: currentSettings.useGeminiDirect ? elements.geminiApiKey.value : null,
      vertexApiKey: !currentSettings.useGeminiDirect ? elements.vertexApiKey.value : null,
      projectId: elements.projectId.value
    });

    // テスト用のテキスト
    const testText = '明日の14時から会議があります。場所は会議室Aです。';
    
    // AIアナライザーでテスト
    const response = await chrome.runtime.sendMessage({
      action: 'extractWithAI',
      text: testText,
      context: { test: true }
    });

    if (response.success) {
      const apiType = currentSettings.useGeminiDirect ? 'Gemini API' : 'Vertex AI';
      showStatus(`✅ ${apiType}接続テスト成功！予定を抽出できました`, 'success');
      console.log('Test extraction result:', response.events);
    } else {
      showStatus(`AI接続テスト失敗: ${response.error}`, 'error');
    }

  } catch (error) {
    console.error('Test failed:', error);
    showStatus('AI接続テストに失敗しました', 'error');
  } finally {
    elements.testBtn.disabled = false;
  }
});

// APIキーフィールドのフォーカス処理
elements.geminiApiKey.addEventListener('focus', () => {
  if (elements.geminiApiKey.value.includes('•')) {
    elements.geminiApiKey.value = '';
  }
});

elements.geminiApiKey.addEventListener('blur', () => {
  if (!elements.geminiApiKey.value && currentSettings.geminiApiKey) {
    elements.geminiApiKey.value = '••••••••••••••••';
  }
});

elements.vertexApiKey.addEventListener('focus', () => {
  if (elements.vertexApiKey.value === '{"type": "service_account", ...}') {
    elements.vertexApiKey.value = '';
  }
});

elements.vertexApiKey.addEventListener('blur', () => {
  if (!elements.vertexApiKey.value && currentSettings.vertexApiKey) {
    elements.vertexApiKey.value = '{"type": "service_account", ...}';
  }
});

// 初期化
document.addEventListener('DOMContentLoaded', () => {
  loadSettings();
});

// Enterキーで保存
document.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && !e.shiftKey) {
    const tagName = document.activeElement.tagName.toLowerCase();
    if (tagName !== 'textarea') {
      e.preventDefault();
      elements.saveBtn.click();
    }
  }
});
