// public/js/chat.js
// IBEPS AI Spending Advisor — fixed 401, redesigned for spending input + food plan + email reminders

const ChatState = {
  messages:   [],
  streaming:  false,
  configured: null,
};

// ── Auth headers (FIXES 401) ───────────────────────────────
function authHeaders() {
  const token = localStorage.getItem('ibeps_token') || '';
  return {
    'Content-Type': 'application/json',
    ...(token ? { 'Authorization': 'Bearer ' + token } : {}),
  };
}

// ── Entry point ────────────────────────────────────────────
function renderChatScreen() {
  if (ChatState.messages.length === 0) {
    renderWelcome();
    loadQuickTip();
  }
  bindChatEvents();
  renderEmailPanel();
  scrollChatToBottom();
}

function initChat() {
  document.querySelectorAll('.quick-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const prompt = btn.dataset.prompt;
      if (prompt) sendChatMessage(prompt);
    });
  });
  document.getElementById('clearChatBtn')?.addEventListener('click', clearChat);
  document.getElementById('chatSendBtn')?.addEventListener('click', handleSend);
  document.getElementById('chatInput')?.addEventListener('keydown', e => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); }
  });
  document.getElementById('chatInput')?.addEventListener('input', autoGrowTextarea);
}

function bindChatEvents() {
  setTimeout(() => document.getElementById('chatInput')?.focus(), 100);
}

// ── Welcome card ───────────────────────────────────────────
function renderWelcome() {
  const name = AppState.profile?.name?.split(' ')[0] || 'there';
  const msgs = document.getElementById('chatMessages');
  msgs.innerHTML = `
    <div class="chat-welcome">
      <div class="welcome-icon">🤖</div>
      <h3>Hi ${name}, I'm <span>IBEPS-AI</span></h3>
      <p>Tell me what you spent and how — I'll analyze it, show where to save, and build you a healthy food plan that fits your budget.</p>
      <div style="display:flex;flex-wrap:wrap;gap:8px;margin-top:16px;justify-content:center">
        <button class="quick-pill" onclick="sendChatMessage('Analyze my spending this month and tell me where I can save money.')">📊 Analyze my spending</button>
        <button class="quick-pill" onclick="sendChatMessage('Give me a 7-day healthy meal plan that fits my remaining feeding budget.')">🥗 7-day food plan</button>
        <button class="quick-pill" onclick="sendChatMessage('How much can I spend on food each day for the rest of this month?')">💰 Daily food budget</button>
      </div>
    </div>`;
}

// ── Quick tip (FIXED: now sends auth header) ───────────────
async function loadQuickTip() {
  const card = document.getElementById('quickTipCard');
  if (!card) return;
  try {
    const res = await fetch(API_BASE + '/groq/quick-advice', {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify({ month: AppState.currentMonth }),
    });
    if (!res.ok) throw new Error('not configured');
    const { tip, error } = await res.json();
    if (error) throw new Error(error);
    card.innerHTML = `<span style="color:var(--text2)">${escapeHtml(tip)}</span>`;
    ChatState.configured = true;
  } catch (err) {
    ChatState.configured = false;
    card.innerHTML = `<span style="color:var(--text3);font-size:0.74rem">Add GROQ_API_KEY to .env to enable AI tips.</span>`;
  }
}

// ── Email reminder panel ───────────────────────────────────
function renderEmailPanel() {
  const panel = document.getElementById('emailReminderPanel');
  if (!panel) return;
  const email = AppState.profile?.email || '';

  panel.innerHTML = !email
    ? `<div class="erp-title">📧 Email Reminders</div>
       <div class="erp-note">Add your email in <a href="#" onclick="showScreen('profile');return false">Profile</a> first.</div>`
    : `<div class="erp-title">📧 Email Reminders</div>
       <div class="erp-note">To: <strong>${escapeHtml(email)}</strong></div>
       <div class="erp-btns">
         <button class="erp-btn" onclick="sendReminder('budget-alert')">🔔 Budget Alert</button>
         <button class="erp-btn" onclick="sendReminder('weekly-summary')">📅 Weekly Summary</button>
         <button class="erp-btn" onclick="sendReminder('monthly-report')">📊 Monthly Report</button>
       </div>
       <div id="erp-status" class="erp-status"></div>`;
}

async function sendReminder(type) {
  const statusEl = document.getElementById('erp-status');
  const btns = document.querySelectorAll('.erp-btn');
  btns.forEach(b => { b.disabled = true; });
  if (statusEl) { statusEl.textContent = '⏳ Sending…'; statusEl.style.color = 'var(--text2)'; }

  try {
    const res = await fetch(API_BASE + '/notifications/' + type, {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify({ month: AppState.currentMonth }),
    });
    if (!res) return;
    const data = await res.json();
    if (statusEl) {
      if (data.sent) {
        statusEl.textContent = '✅ Email sent!';
        statusEl.style.color = 'var(--teal, #0ECFB0)';
      } else {
        statusEl.textContent = data.message || '⚠️ Nothing to send';
        statusEl.style.color = 'var(--gold)';
      }
    }
  } catch (err) {
    if (statusEl) { statusEl.textContent = '❌ ' + err.message; statusEl.style.color = '#F87171'; }
  } finally {
    btns.forEach(b => { b.disabled = false; });
    setTimeout(() => { if (statusEl) statusEl.textContent = ''; }, 4000);
  }
}

// ── Handle send ────────────────────────────────────────────
function handleSend() {
  const input = document.getElementById('chatInput');
  const text  = (input.value || '').trim();
  if (!text || ChatState.streaming) return;
  input.value = '';
  autoGrowTextarea.call(input);
  sendChatMessage(text);
}

async function sendChatMessage(text) {
  if (ChatState.streaming) return;

  const msgs = document.getElementById('chatMessages');
  if (msgs.querySelector('.chat-welcome')) msgs.innerHTML = '';

  ChatState.messages.push({ role: 'user', content: text });
  appendBubble('user', text);
  scrollChatToBottom();

  const typingId = appendTyping();
  ChatState.streaming = true;
  setSendDisabled(true);

  try {
    // FIXED: auth header included — no more 401
    const res = await fetch(API_BASE + '/groq/chat', {
      method:  'POST',
      headers: authHeaders(),
      body: JSON.stringify({
        messages: ChatState.messages,
        month:    AppState.currentMonth,
      }),
    });

    if (res && res.status === 401) {
      localStorage.removeItem('ibeps_token');
      window.location.href = '/login';
      return;
    }
    if (!res || !res.ok) {
      const err = await res?.json() || {};
      throw new Error(err.error || 'Request failed');
    }

    removeTyping(typingId);
    const bubbleId = appendStreamingBubble();

    const reader  = res.body.getReader();
    const decoder = new TextDecoder();
    let   full    = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      const lines = decoder.decode(value, { stream: true }).split('\n');
      for (const line of lines) {
        if (!line.startsWith('data: ')) continue;
        const payload = line.slice(6).trim();
        if (payload === '[DONE]') break;
        try {
          const { text: chunk, error } = JSON.parse(payload);
          if (error) throw new Error(error);
          if (chunk) {
            full += chunk;
            updateStreamingBubble(bubbleId, full);
            scrollChatToBottom();
          }
        } catch (_) {}
      }
    }

    finaliseStreamingBubble(bubbleId, full);
    ChatState.messages.push({ role: 'assistant', content: full });
    ChatState.configured = true;

  } catch (err) {
    removeTyping(typingId);
    appendBubble('ai', '⚠️ ' + err.message, true);
  } finally {
    ChatState.streaming = false;
    setSendDisabled(false);
    scrollChatToBottom();
    document.getElementById('chatInput')?.focus();
  }
}

// ── Bubble rendering ───────────────────────────────────────
function appendBubble(role, text, isError = false) {
  const msgs = document.getElementById('chatMessages');
  const div  = document.createElement('div');
  div.className = `chat-msg ${role}`;
  const avatar = role === 'ai' ? '🤖' : (AppState.profile?.name?.charAt(0)?.toUpperCase() || 'U');
  const time   = new Date().toLocaleTimeString('en-NG', { hour: '2-digit', minute: '2-digit' });
  div.innerHTML = `
    <div class="msg-avatar">${avatar}</div>
    <div style="display:flex;flex-direction:column;gap:3px;${role==='user'?'align-items:flex-end':''}">
      <div class="msg-bubble${isError ? ' error' : ''}">${role === 'ai' ? renderMarkdown(text) : escapeHtml(text)}</div>
      <div class="msg-time">${time}</div>
    </div>`;
  msgs.appendChild(div);
  return div;
}

function appendTyping() {
  const msgs = document.getElementById('chatMessages');
  const id   = 'typing-' + Date.now();
  const div  = document.createElement('div');
  div.className = 'chat-msg ai msg-typing';
  div.id = id;
  div.innerHTML = `
    <div class="msg-avatar">🤖</div>
    <div class="msg-bubble">
      <div class="typing-dots"><span></span><span></span><span></span></div>
    </div>`;
  msgs.appendChild(div);
  return id;
}

function removeTyping(id) { document.getElementById(id)?.remove(); }

function appendStreamingBubble() {
  const msgs = document.getElementById('chatMessages');
  const id   = 'streaming-' + Date.now();
  const div  = document.createElement('div');
  div.className = 'chat-msg ai';
  div.id = id;
  div.innerHTML = `
    <div class="msg-avatar">🤖</div>
    <div style="display:flex;flex-direction:column;gap:3px;">
      <div class="msg-bubble" id="${id}-bubble"></div>
    </div>`;
  msgs.appendChild(div);
  return id;
}

function updateStreamingBubble(id, text) {
  const bubble = document.getElementById(id + '-bubble');
  if (bubble) bubble.innerHTML = renderMarkdown(text) + '<span class="stream-cursor">▋</span>';
}

function finaliseStreamingBubble(id, text) {
  const bubble = document.getElementById(id + '-bubble');
  if (!bubble) return;
  bubble.innerHTML = renderMarkdown(text);
  const time = new Date().toLocaleTimeString('en-NG', { hour: '2-digit', minute: '2-digit' });
  const wrap = bubble.parentElement;
  const timeEl = document.createElement('div');
  timeEl.className = 'msg-time';
  timeEl.textContent = time;
  wrap.appendChild(timeEl);
}

// ── Markdown renderer ──────────────────────────────────────
function renderMarkdown(text) {
  if (!text) return '';
  let html = escapeHtml(text);
  html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  html = html.replace(/__(.+?)__/g,    '<strong>$1</strong>');
  html = html.replace(/`([^`]+)`/g, '<code>$1</code>');
  html = html.replace(/((?:\|.+\|\n?)+)/g, (block) => {
    const rows = block.trim().split('\n').filter(r => r.includes('|'));
    if (rows.length < 2) return block;
    const isSep = r => /^[\s|:-]+$/.test(r);
    let table = '<table class="msg-table">';
    let inHeader = true;
    rows.forEach((row, i) => {
      if (isSep(row)) { inHeader = false; return; }
      const cells = row.split('|').filter((_, ci) => ci > 0 && ci < row.split('|').length - 1);
      const tag = (inHeader && i === 0) ? 'th' : 'td';
      table += `<tr>${cells.map(c => `<${tag}>${c.trim()}</${tag}>`).join('')}</tr>`;
    });
    table += '</table>';
    return table;
  });
  html = html.replace(/^[ \t]*[-•*]\s+(.+)$/gm, '<li>$1</li>');
  html = html.replace(/(<li>.*<\/li>(\n|$))+/g, m => `<ul style="padding-left:18px;margin:6px 0">${m}</ul>`);
  html = html.replace(/^\d+\.\s+(.+)$/gm, '<li>$1</li>');
  html = html.replace(/^###\s+(.+)$/gm, '<strong style="display:block;margin-top:10px;color:var(--gold)">$1</strong>');
  html = html.replace(/^##\s+(.+)$/gm,  '<strong style="display:block;margin-top:10px;font-size:1.02em;color:var(--gold)">$1</strong>');
  html = html.replace(/^#\s+(.+)$/gm,   '<strong style="display:block;margin-top:10px;font-size:1.05em;color:var(--gold)">$1</strong>');
  html = html.replace(/\n/g, '<br>');
  return html;
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function scrollChatToBottom() {
  const msgs = document.getElementById('chatMessages');
  if (msgs) msgs.scrollTop = msgs.scrollHeight;
}
function setSendDisabled(disabled) {
  const btn = document.getElementById('chatSendBtn');
  if (btn) btn.disabled = disabled;
}
function autoGrowTextarea() {
  this.style.height = 'auto';
  this.style.height = Math.min(this.scrollHeight, 140) + 'px';
}
function clearChat() {
  ChatState.messages = [];
  ChatState.streaming = false;
  setSendDisabled(false);
  renderWelcome();
}
