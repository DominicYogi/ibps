// public/js/chat.js
// Groq Llama AI chat — streaming responses, quick prompts,
// full markdown-like rendering, live budget context.

const ChatState = {
  messages:   [],   // { role: 'user'|'assistant', content: string }
  streaming:  false,
  configured: null, // null = unknown, true/false after first check
};

// ── Entry point called by navigation.js ───────────────────
function renderChatScreen() {
  if (ChatState.messages.length === 0) {
    renderWelcome();
    loadQuickTip();
  }
  bindChatEvents();
  scrollChatToBottom();
}

function initChat() {
  // Wire quick-prompt buttons
  document.querySelectorAll('.quick-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const prompt = btn.dataset.prompt;
      if (prompt) sendChatMessage(prompt);
    });
  });

  document.getElementById('clearChatBtn').addEventListener('click', clearChat);
  document.getElementById('chatSendBtn').addEventListener('click', handleSend);
  document.getElementById('chatInput').addEventListener('keydown', e => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); }
  });

  // Auto-grow textarea
  document.getElementById('chatInput').addEventListener('input', autoGrowTextarea);
}

function bindChatEvents() {
  // Already bound in initChat — just ensure input is focused
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
      <p>I know your live budget and spending data. Ask me anything — food prices in Lokoja, how to stretch your feeding budget, meal plans, or which category is bleeding your wallet.</p>
    </div>`;
}

// ── Quick tip loader ───────────────────────────────────────
async function loadQuickTip() {
  const card = document.getElementById('quickTipCard');
  if (!card) return;
  try {
    const res = await fetch('/api/groq/quick-advice', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
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
    showGroqNotConfigured();
  }
}

function showGroqNotConfigured() {
  const msgs = document.getElementById('chatMessages');
  msgs.innerHTML = `
    <div class="groq-not-configured">
      <div class="gnc-icon">🔑</div>
      <div>
        <h4>Groq API key not configured</h4>
        <p>To enable the AI chat, add your free Groq API key to your <code>.env</code> file:<br><br>
        <code>GROQ_API_KEY=gsk_your_key_here</code><br><br>
        Get a free key at <strong>console.groq.com</strong> — no credit card needed. Then restart the server.</p>
      </div>
    </div>`;
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

  // Clear welcome if present
  const msgs = document.getElementById('chatMessages');
  if (msgs.querySelector('.chat-welcome, .groq-not-configured')) msgs.innerHTML = '';

  // Append user bubble
  ChatState.messages.push({ role: 'user', content: text });
  appendBubble('user', text);
  scrollChatToBottom();

  // Show typing indicator
  const typingId = appendTyping();
  ChatState.streaming = true;
  setSendDisabled(true);

  try {
    const res = await fetch('/api/groq/chat', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({
        messages: ChatState.messages,
        month:    AppState.currentMonth,
      }),
    });

    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Request failed');
    }

    // Remove typing indicator; create streaming bubble
    removeTyping(typingId);
    const bubbleId = appendStreamingBubble();

    // Read SSE stream
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

    // Finalise
    finaliseStreamingBubble(bubbleId, full);
    ChatState.messages.push({ role: 'assistant', content: full });
    ChatState.configured = true;

  } catch (err) {
    removeTyping(typingId);
    appendBubble('ai', '⚠️ ' + err.message, true);
    if (err.message.includes('GROQ_API_KEY')) {
      ChatState.configured = false;
      showGroqNotConfigured();
    }
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

function removeTyping(id) {
  document.getElementById(id)?.remove();
}

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

// ── Markdown-lite renderer ─────────────────────────────────
function renderMarkdown(text) {
  if (!text) return '';
  let html = escapeHtml(text);

  // Bold **text** or __text__
  html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  html = html.replace(/__(.+?)__/g,    '<strong>$1</strong>');

  // Inline code `code`
  html = html.replace(/`([^`]+)`/g, '<code>$1</code>');

  // Simple table: | col | col | on its own line
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

  // Bullet lists
  html = html.replace(/^[ \t]*[-•*]\s+(.+)$/gm, '<li>$1</li>');
  html = html.replace(/(<li>.*<\/li>(\n|$))+/g, m => `<ul style="padding-left:18px;margin:6px 0">${m}</ul>`);

  // Numbered lists
  html = html.replace(/^\d+\.\s+(.+)$/gm, '<li>$1</li>');

  // Headings
  html = html.replace(/^###\s+(.+)$/gm, '<strong style="display:block;margin-top:10px;color:var(--gold)">$1</strong>');
  html = html.replace(/^##\s+(.+)$/gm,  '<strong style="display:block;margin-top:10px;font-size:1.02em;color:var(--gold)">$1</strong>');
  html = html.replace(/^#\s+(.+)$/gm,   '<strong style="display:block;margin-top:10px;font-size:1.05em;color:var(--gold)">$1</strong>');

  // Line breaks
  html = html.replace(/\n/g, '<br>');

  return html;
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// ── Utilities ──────────────────────────────────────────────
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
