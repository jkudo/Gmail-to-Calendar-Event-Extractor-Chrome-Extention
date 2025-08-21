// クイック追加画面のJavaScript

// URLパラメータから初期データを取得
function getInitialData() {
  const params = new URLSearchParams(window.location.search);
  const dataParam = params.get('data');
  if (dataParam) {
    try {
      return JSON.parse(decodeURIComponent(dataParam));
    } catch (e) {
      console.error('Failed to parse initial data:', e);
    }
  }
  return null;
}

// フォームに初期データを設定
function populateForm(data) {
  if (!data) return;

  // タイトル
  if (data.title) {
    document.getElementById('title').value = data.title;
  }

  // 日付（YYYY-MM-DD形式に変換）
  if (data.date) {
    const dateInput = document.getElementById('date');
    // 日本語形式の日付を変換
    const jpMatch = data.date.match(/(\d{4})年(\d{1,2})月(\d{1,2})日/);
    if (jpMatch) {
      const year = jpMatch[1];
      const month = jpMatch[2].padStart(2, '0');
      const day = jpMatch[3].padStart(2, '0');
      dateInput.value = `${year}-${month}-${day}`;
    } else {
      // その他の形式を試す
      try {
        const parsedDate = new Date(data.date);
        if (!isNaN(parsedDate.getTime())) {
          dateInput.value = parsedDate.toISOString().split('T')[0];
        }
      } catch (e) {
        console.error('Failed to parse date:', e);
      }
    }
  }

  // 開始時間
  if (data.startTime) {
    const startTimeInput = document.getElementById('startTime');
    const time = convertToTime24(data.startTime);
    if (time) {
      startTimeInput.value = time;
    }
  }

  // 終了時間
  if (data.endTime) {
    const endTimeInput = document.getElementById('endTime');
    const time = convertToTime24(data.endTime);
    if (time) {
      endTimeInput.value = time;
    }
  }

  // 場所
  if (data.location) {
    document.getElementById('location').value = data.location;
  }

  // 会議URLがある場合の表示
  if (data.meetingUrl) {
    document.getElementById('meetingUrlIndicator').style.display = 'inline-block';
    if (!data.location) {
      document.getElementById('location').value = 'オンライン会議';
    }
  }

  // 説明
  if (data.description) {
    document.getElementById('description').value = data.description;
  }

  // 元のテキストを表示
  if (data.originalText) {
    const originalTextDiv = document.getElementById('originalText');
    originalTextDiv.textContent = '選択されたテキスト: ' + data.originalText.substring(0, 200);
    if (data.originalText.length > 200) {
      originalTextDiv.textContent += '...';
    }
  }
}

// 時間を24時間形式に変換
function convertToTime24(timeStr) {
  if (!timeStr) return null;

  // すでに24時間形式の場合
  const time24Match = timeStr.match(/(\d{1,2}):(\d{2})/);
  if (time24Match && !timeStr.includes('AM') && !timeStr.includes('PM')) {
    const hour = time24Match[1].padStart(2, '0');
    const minute = time24Match[2];
    return `${hour}:${minute}`;
  }

  // 日本語形式（14時30分）
  const jpMatch = timeStr.match(/(\d{1,2})時(\d{2})?分?/);
  if (jpMatch) {
    const hour = jpMatch[1].padStart(2, '0');
    const minute = (jpMatch[2] || '00').padStart(2, '0');
    return `${hour}:${minute}`;
  }

  // AM/PM形式
  const ampmMatch = timeStr.match(/(\d{1,2}):(\d{2})\s*(AM|PM)/i);
  if (ampmMatch) {
    let hour = parseInt(ampmMatch[1]);
    const minute = ampmMatch[2];
    const period = ampmMatch[3].toUpperCase();
    
    if (period === 'PM' && hour !== 12) {
      hour += 12;
    } else if (period === 'AM' && hour === 12) {
      hour = 0;
    }
    
    return `${hour.toString().padStart(2, '0')}:${minute}`;
  }

  return null;
}

// ステータス表示
function showStatus(message, type) {
  const statusDiv = document.getElementById('status');
  statusDiv.textContent = message;
  statusDiv.className = `status show ${type}`;
  
  if (type === 'success') {
    setTimeout(() => {
      window.close();
    }, 2000);
  }
}

// ローディング表示
function showLoading(show) {
  const loadingDiv = document.getElementById('loading');
  const form = document.getElementById('eventForm');
  
  if (show) {
    loadingDiv.classList.add('show');
    form.querySelectorAll('input, textarea, button').forEach(el => {
      el.disabled = true;
    });
  } else {
    loadingDiv.classList.remove('show');
    form.querySelectorAll('input, textarea, button').forEach(el => {
      el.disabled = false;
    });
  }
}

// フォーム送信処理
document.getElementById('eventForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  
  const formData = new FormData(e.target);
  const eventData = {
    subject: formData.get('title'),
    date: formData.get('date'),
    startTime: formData.get('startTime'),
    endTime: formData.get('endTime'),
    location: formData.get('location'),
    body: formData.get('description')
  };

  // 日付を日本語形式に変換
  const dateParts = eventData.date.split('-');
  if (dateParts.length === 3) {
    eventData.date = `${dateParts[0]}年${parseInt(dateParts[1])}月${parseInt(dateParts[2])}日`;
  }

  // 時間を適切な形式に変換
  if (eventData.startTime) {
    const timeParts = eventData.startTime.split(':');
    eventData.startTime = `${parseInt(timeParts[0])}:${timeParts[1]}`;
  }
  if (eventData.endTime) {
    const timeParts = eventData.endTime.split(':');
    eventData.endTime = `${parseInt(timeParts[0])}:${timeParts[1]}`;
  }

  // ISO形式の日時を生成
  eventData.parsedDate = createISODateTime(formData.get('date'), formData.get('startTime'));
  if (formData.get('endTime')) {
    eventData.parsedEndDate = createISODateTime(formData.get('date'), formData.get('endTime'));
  } else if (formData.get('startTime')) {
    // 終了時間が指定されていない場合は1時間後
    const startDate = new Date(eventData.parsedDate);
    startDate.setHours(startDate.getHours() + 1);
    eventData.parsedEndDate = startDate.toISOString();
  }

  showLoading(true);
  showStatus('カレンダーに追加中...', 'info');

  // 認証とカレンダーへの追加
  chrome.runtime.sendMessage({ action: 'authenticate' }, (authResponse) => {
    if (!authResponse.success) {
      showLoading(false);
      showStatus('認証が必要です。拡張機能のポップアップから認証してください。', 'error');
      return;
    }

    // カレンダーに追加
    chrome.runtime.sendMessage(
      { action: 'createCalendarEvent', eventData: eventData },
      (response) => {
        showLoading(false);
        
        if (response && response.success) {
          showStatus('✅ カレンダーに追加しました！', 'success');
        } else {
          showStatus(`エラー: ${response ? response.error : '不明なエラー'}`, 'error');
        }
      }
    );
  });
});

// ISO日時を作成
function createISODateTime(dateStr, timeStr) {
  const date = new Date(dateStr);
  
  if (timeStr) {
    const timeParts = timeStr.split(':');
    date.setHours(parseInt(timeParts[0]));
    date.setMinutes(parseInt(timeParts[1]));
  } else {
    // 時間が指定されていない場合は9:00
    date.setHours(9);
    date.setMinutes(0);
  }
  
  date.setSeconds(0);
  date.setMilliseconds(0);
  
  return date.toISOString();
}

// キャンセルボタン
document.getElementById('cancelBtn').addEventListener('click', () => {
  window.close();
});

// 初期化
document.addEventListener('DOMContentLoaded', () => {
  const initialData = getInitialData();
  populateForm(initialData);
  
  // 日付が設定されていない場合は今日の日付を設定
  const dateInput = document.getElementById('date');
  if (!dateInput.value) {
    const today = new Date();
    dateInput.value = today.toISOString().split('T')[0];
  }
});