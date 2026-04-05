// =====================================================
//  FlashPing — app.js
//  Supabase Realtime 기반 플래시 신호 앱
// =====================================================

const supabase = window.supabase.createClient(
  window.SUPABASE_URL,
  window.SUPABASE_ANON_KEY
);

// ─── State ───────────────────────────────────────────
const state = {
  myCode: '',
  myName: '',
  friendCode: '',
  friendName: '',
  statusText: '',
  paired: false,       // 최초 1회 페어링 완료 → true → 앱 껐다 켜도 바로 메인화면
  channel: null,
  connected: false,
  cooldown: false,
  pollingInterval: null,
  presenceInterval: null,
};

const COOLDOWN_MS = 5000;
const STORAGE_KEY = 'flashping_v2';

// ─── Init ─────────────────────────────────────────────
window.addEventListener('DOMContentLoaded', () => {
  addToast();
  loadFromStorage();
  generateOrLoadMyCode();

  if (state.paired && state.myCode && state.friendCode) {
    // 이미 페어링 완료 → 세팅화면 없이 바로 메인화면
    restoreSession();
  } else {
    showScreen('setup');
  }
});

// ─── Toast ────────────────────────────────────────────
function addToast() {
  if (!document.getElementById('toast')) {
    const t = document.createElement('div');
    t.id = 'toast';
    document.body.appendChild(t);
  }
}

function showToast(msg, duration = 2200) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(t._timer);
  t._timer = setTimeout(() => t.classList.remove('show'), duration);
}

// ─── Storage ─────────────────────────────────────────
function loadFromStorage() {
  const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
  state.myCode     = saved.myCode     || '';
  state.myName     = saved.myName     || '';
  state.friendCode = saved.friendCode || '';
  state.friendName = saved.friendName || '';
  state.statusText = saved.statusText || '';
  state.paired     = saved.paired     || false;

  if (state.myName)     document.getElementById('my-name').value       = state.myName;
  if (state.statusText) document.getElementById('my-status-input').value = state.statusText;
}

function saveToStorage() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify({
    myCode:      state.myCode,
    myName:      state.myName,
    friendCode:  state.friendCode,
    friendName:  state.friendName,
    statusText:  state.statusText,
    paired:      state.paired,
  }));
}

// ─── Code generation ─────────────────────────────────
function generateOrLoadMyCode() {
  if (!state.myCode) {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    state.myCode = Array.from({ length: 6 }, () =>
      chars[Math.floor(Math.random() * chars.length)]
    ).join('');
    saveToStorage();
  }
  document.getElementById('my-code').value    = state.myCode;
  document.getElementById('waiting-code').value = state.myCode;
}

function copyMyCode() {
  const code = state.myCode;
  if (navigator.clipboard) {
    navigator.clipboard.writeText(code);
  } else {
    const el = document.createElement('input');
    el.value = code;
    document.body.appendChild(el);
    el.select();
    document.execCommand('copy');
    document.body.removeChild(el);
  }
  showToast('코드 복사됨: ' + code);
}

// ─── Screen management ───────────────────────────────
function showScreen(id) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  document.getElementById('screen-' + id).classList.add('active');
}

function goBack() {
  clearInterval(state.pollingInterval);
  showScreen('setup');
}

// ─── Disconnect (의도적으로만 연결 해제) ──────────────
function disconnectFriend() {
  const confirmed = confirm(
    state.friendName + '와의 연결을 해제할까요?\n다시 연결하려면 코드를 새로 교환해야 합니다.'
  );
  if (!confirmed) return;

  clearInterval(state.pollingInterval);
  clearInterval(state.presenceInterval);
  if (state.channel) {
    supabase.removeChannel(state.channel);
    state.channel = null;
  }

  state.friendCode = '';
  state.friendName = '';
  state.paired     = false;
  saveToStorage();

  showScreen('setup');
  showToast('연결이 해제됐어요');
}

// ─── Connect flow ─────────────────────────────────────
async function connectFriend() {
  const nameInput   = document.getElementById('my-name').value.trim();
  const friendInput = document.getElementById('friend-code').value.trim().toUpperCase();
  const msgEl       = document.getElementById('setup-msg');

  if (!nameInput) {
    setMsg(msgEl, '내 이름을 입력해주세요', 'error'); return;
  }
  if (friendInput.length < 4) {
    setMsg(msgEl, '친구 코드를 입력해주세요', 'error'); return;
  }
  if (friendInput === state.myCode) {
    setMsg(msgEl, '본인 코드는 사용할 수 없어요', 'error'); return;
  }

  setMsg(msgEl, '연결 중...', '');
  state.myName     = nameInput;
  state.friendCode = friendInput;
  saveToStorage();

  await upsertPresence();

  const friend = await fetchPresence(state.friendCode);
  if (friend) {
    state.friendName = friend.name || state.friendCode;
    state.paired     = true;
    saveToStorage();
    await enterMainScreen();
  } else {
    // 친구가 아직 앱을 안 열었음 → waiting 화면에서 자동 감지
    showScreen('waiting');
    startPollingForFriend();
  }
}

function setMsg(el, text, type) {
  el.textContent = text;
  el.className   = 'setup-msg' + (type ? ' ' + type : '');
}

// 앱 재실행 시 세션 복원 — 친구 오프라인이어도 메인화면 바로 진입
async function restoreSession() {
  await upsertPresence();
  populateMainUI();
  showScreen('main');
  subscribeRealtime();
  fetchFriendStatus();
  startPollingAndKeepalive();
}

function startPollingForFriend() {
  clearInterval(state.pollingInterval);
  state.pollingInterval = setInterval(async () => {
    const friend = await fetchPresence(state.friendCode);
    if (friend) {
      clearInterval(state.pollingInterval);
      state.friendName = friend.name || state.friendCode;
      state.paired     = true;
      saveToStorage();
      await enterMainScreen();
    }
  }, 3000);
}

// ─── Supabase helpers ─────────────────────────────────
async function upsertPresence(extra = {}) {
  const row = {
    code:       state.myCode,
    name:       state.myName,
    status:     state.statusText || '안녕!',
    updated_at: new Date().toISOString(),
    ...extra,
  };
  const { error } = await supabase.from('presence').upsert(row, { onConflict: 'code' });
  if (error) console.warn('upsert error', error);
}

async function fetchPresence(code) {
  const { data } = await supabase
    .from('presence')
    .select('*')
    .eq('code', code)
    .single();
  return data;
}

async function fetchFriendStatus() {
  const data = await fetchPresence(state.friendCode);
  if (data) updateFriendStatus(data);
}

// ─── Main screen ──────────────────────────────────────
async function enterMainScreen() {
  populateMainUI();
  showScreen('main');
  subscribeRealtime();
  await fetchFriendStatus();
  startPollingAndKeepalive();
}

function populateMainUI() {
  const name = state.friendName || state.friendCode;
  document.getElementById('friend-name-display').textContent = name;
  document.getElementById('friend-avatar').textContent       = (name[0] || '?').toUpperCase();
  document.getElementById('friend-code-display').textContent = state.friendCode;
  document.getElementById('my-status-input').value           = state.statusText || '';
}

function startPollingAndKeepalive() {
  clearInterval(state.pollingInterval);
  clearInterval(state.presenceInterval);
  // 친구 상태 15초마다 갱신
  state.pollingInterval  = setInterval(fetchFriendStatus, 15000);
  // 내 presence keepalive 30초마다
  state.presenceInterval = setInterval(() => upsertPresence(), 30000);
}

function updateFriendStatus(data) {
  document.getElementById('friend-status-text').textContent = data.status || '(없음)';

  if (data.updated_at) {
    const diff = Math.floor((Date.now() - new Date(data.updated_at)) / 1000);
    let label = '방금 전';
    if (diff > 59)   label = Math.floor(diff / 60) + '분 전';
    if (diff > 3599) label = Math.floor(diff / 3600) + '시간 전';
    document.getElementById('last-seen-label').textContent = label;
  }

  const dot = document.getElementById('friend-status-dot');
  const txt = (data.status || '').toLowerCase();
  if (txt.includes('방해') || txt.includes('자는') || txt.includes('바쁨') || txt.includes('수업')) {
    dot.className = 'status-indicator busy';
  } else if (txt.includes('없음') || txt.includes('외출') || txt.includes('자리')) {
    dot.className = 'status-indicator away';
  } else {
    dot.className = 'status-indicator available';
  }
}

// ─── Realtime subscription ────────────────────────────
function subscribeRealtime() {
  if (state.channel) {
    supabase.removeChannel(state.channel);
    state.channel = null;
  }

  // 두 코드를 정렬해서 항상 같은 채널명 → 두 사람 모두 동일한 채널 구독
  const pair = [state.myCode, state.friendCode].sort().join('_');

  state.channel = supabase.channel('fp_' + pair)
    .on('broadcast', { event: 'flash' }, (payload) => {
      if (payload.payload?.from === state.friendCode) {
        triggerIncomingFlash(payload.payload.name || state.friendName);
      }
    })
    .on('broadcast', { event: 'status' }, (payload) => {
      if (payload.payload?.from === state.friendCode) {
        document.getElementById('friend-status-text').textContent = payload.payload.status;
        document.getElementById('last-seen-label').textContent    = '방금 전';
        // 상태 dot도 즉시 갱신
        updateFriendStatus({ status: payload.payload.status, updated_at: new Date().toISOString() });
      }
    })
    .subscribe((status) => {
      const dot   = document.getElementById('conn-dot');
      const label = document.getElementById('conn-label');
      if (status === 'SUBSCRIBED') {
        state.connected   = true;
        dot.className     = 'dot pulse';
        label.textContent = '연결됨';
      } else {
        state.connected   = false;
        dot.className     = 'dot offline';
        label.textContent = '재연결 중...';
      }
    });
}

// ─── Send flash ───────────────────────────────────────
async function sendFlash() {
  if (state.cooldown) return;

  const btn  = document.getElementById('flash-btn');
  const wrap = document.getElementById('btn-wrap');
  btn.classList.add('pressed');
  wrap.classList.add('firing');
  setTimeout(() => {
    btn.classList.remove('pressed');
    wrap.classList.remove('firing');
  }, 800);

  const pair = [state.myCode, state.friendCode].sort().join('_');
  await supabase.channel('fp_' + pair).send({
    type: 'broadcast',
    event: 'flash',
    payload: { from: state.myCode, name: state.myName },
  });

  showToast('⚡ 플래시 전송!');
  startCooldown();
}

function startCooldown() {
  state.cooldown = true;
  const btn     = document.getElementById('flash-btn');
  const hintEl  = document.getElementById('btn-hint');
  const barWrap = document.getElementById('cooldown-wrap');
  const bar     = document.getElementById('cooldown-bar');

  btn.classList.add('cooldown');
  btn.querySelector('.btn-label').textContent = '대기 중';
  barWrap.style.display = 'block';

  const start = Date.now();
  function tick() {
    const elapsed = Date.now() - start;
    const pct     = Math.min(100, (elapsed / COOLDOWN_MS) * 100);
    bar.style.width  = pct + '%';
    hintEl.textContent = Math.ceil((COOLDOWN_MS - elapsed) / 1000) + '초 후 다시 보낼 수 있어요';
    if (elapsed < COOLDOWN_MS) {
      requestAnimationFrame(tick);
    } else {
      state.cooldown = false;
      btn.classList.remove('cooldown');
      btn.querySelector('.btn-label').textContent = 'FLASH';
      hintEl.textContent  = '버튼을 눌러 친구 폰을 깜박이게 하세요';
      barWrap.style.display = 'none';
      bar.style.width       = '0%';
    }
  }
  requestAnimationFrame(tick);
}

// ─── Incoming flash ───────────────────────────────────
function triggerIncomingFlash(fromName) {
  const overlay = document.getElementById('flash-overlay');
  overlay.classList.remove('flashing');
  void overlay.offsetWidth; // reflow 강제
  overlay.classList.add('flashing');
  overlay.addEventListener('animationend', () => overlay.classList.remove('flashing'), { once: true });

  const banner = document.getElementById('incoming-banner');
  banner.querySelector('.ib-text').textContent = fromName + '이(가) 플래시를 보냈어요!';
  banner.classList.add('show');
  setTimeout(() => banner.classList.remove('show'), 4000);

  if (navigator.vibrate) navigator.vibrate([200, 100, 200, 100, 400]);
}

function dismissBanner() {
  document.getElementById('incoming-banner').classList.remove('show');
}

// ─── Status ───────────────────────────────────────────
function onStatusInput() {
  document.getElementById('save-status-btn').style.display = 'block';
}

async function saveStatus() {
  const val = document.getElementById('my-status-input').value.trim();
  state.statusText = val;
  saveToStorage();
  document.getElementById('save-status-btn').style.display = 'none';

  await upsertPresence({ status: val });

  if (state.friendCode) {
    const pair = [state.myCode, state.friendCode].sort().join('_');
    await supabase.channel('fp_' + pair).send({
      type: 'broadcast',
      event: 'status',
      payload: { from: state.myCode, status: val },
    });
  }

  showToast('상태 저장됨');
}

function setQuickStatus(txt) {
  document.getElementById('my-status-input').value = txt;
  onStatusInput();
  saveStatus();
}
