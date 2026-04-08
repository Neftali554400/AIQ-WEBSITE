(function () {
  'use strict';

  // ── Don't show on admin pages ──────────────────────────────────────────────
  if (window.location.pathname.startsWith('/admin')) return;

  const STYLES = `
    #aiq-chat-btn {
      position: fixed; bottom: 1.5rem; right: 1.5rem; z-index: 9998;
      width: 54px; height: 54px; border-radius: 50%;
      background: #034f46; border: none; cursor: pointer;
      box-shadow: 0 4px 20px rgba(3,79,70,.5), 0 2px 8px rgba(0,0,0,.3);
      display: flex; align-items: center; justify-content: center;
      transition: transform .2s ease, background .2s ease;
    }
    #aiq-chat-btn:hover { background: #056b5e; transform: scale(1.08); }
    #aiq-chat-btn svg { width: 24px; height: 24px; }
    #aiq-chat-btn .badge {
      position: absolute; top: -2px; right: -2px;
      width: 14px; height: 14px; border-radius: 50%;
      background: #ffa946; border: 2px solid #0a0a08;
      animation: aiq-pulse 2s infinite;
    }
    @keyframes aiq-pulse {
      0%,100% { transform: scale(1); opacity: 1; }
      50% { transform: scale(1.25); opacity: .7; }
    }

    #aiq-chat-box {
      position: fixed; bottom: 5.5rem; right: 1.5rem; z-index: 9999;
      width: 340px; max-height: 520px;
      background: #111110; border: 1px solid rgba(255,255,235,.1);
      border-radius: 1.25rem; display: flex; flex-direction: column;
      box-shadow: 0 24px 64px rgba(0,0,0,.6), 0 4px 16px rgba(0,0,0,.4);
      transform: translateY(12px) scale(.97); opacity: 0;
      pointer-events: none; transition: transform .25s ease, opacity .25s ease;
    }
    #aiq-chat-box.open {
      transform: translateY(0) scale(1); opacity: 1; pointer-events: all;
    }
    @media(max-width:400px) {
      #aiq-chat-box { width: calc(100vw - 2rem); right: 1rem; }
    }

    .aiq-chat-head {
      display: flex; align-items: center; gap: .75rem;
      padding: 1rem 1.1rem; border-bottom: 1px solid rgba(255,255,235,.07);
      border-radius: 1.25rem 1.25rem 0 0;
    }
    .aiq-chat-avatar {
      width: 36px; height: 36px; border-radius: 50%;
      background: #034f46; display: flex; align-items: center; justify-content: center;
      font-size: 1rem; flex-shrink: 0;
    }
    .aiq-chat-name { font-family: 'Figtree',sans-serif; font-size: .88rem; font-weight: 600; color: #ffffeb; }
    .aiq-chat-status { font-size: .72rem; color: #5ecfbb; display: flex; align-items: center; gap: .3rem; }
    .aiq-chat-status::before { content:''; width:6px; height:6px; border-radius:50%; background:#5ecfbb; display:inline-block; }
    .aiq-chat-close {
      margin-left: auto; background: none; border: none; color: rgba(255,255,235,.4);
      cursor: pointer; padding: .3rem; border-radius: .4rem; font-size: 1.1rem; line-height: 1;
      transition: color .15s;
    }
    .aiq-chat-close:hover { color: #ffffeb; }

    .aiq-chat-msgs {
      flex: 1; overflow-y: auto; padding: 1rem; display: flex; flex-direction: column; gap: .75rem;
      scroll-behavior: smooth;
    }
    .aiq-chat-msgs::-webkit-scrollbar { width: 4px; }
    .aiq-chat-msgs::-webkit-scrollbar-track { background: transparent; }
    .aiq-chat-msgs::-webkit-scrollbar-thumb { background: rgba(255,255,235,.1); border-radius: 9999px; }

    .aiq-msg {
      max-width: 85%; font-family: 'Figtree',sans-serif; font-size: .84rem;
      line-height: 1.6; padding: .65rem .9rem; border-radius: 1rem;
      animation: aiq-fadein .2s ease;
    }
    @keyframes aiq-fadein { from { opacity:0; transform:translateY(6px); } to { opacity:1; transform:none; } }
    .aiq-msg.bot {
      background: rgba(255,255,235,.06); color: rgba(255,255,235,.85);
      border-radius: .3rem 1rem 1rem 1rem; align-self: flex-start;
    }
    .aiq-msg.user {
      background: #034f46; color: #ffffeb;
      border-radius: 1rem 1rem .3rem 1rem; align-self: flex-end;
    }
    .aiq-typing {
      display: flex; gap: .3rem; align-items: center; padding: .65rem .9rem;
      background: rgba(255,255,235,.06); border-radius: .3rem 1rem 1rem 1rem;
      align-self: flex-start;
    }
    .aiq-typing span {
      width: 6px; height: 6px; border-radius: 50%; background: rgba(255,255,235,.4);
      animation: aiq-bounce .9s infinite;
    }
    .aiq-typing span:nth-child(2) { animation-delay: .15s; }
    .aiq-typing span:nth-child(3) { animation-delay: .3s; }
    @keyframes aiq-bounce { 0%,60%,100%{transform:translateY(0)} 30%{transform:translateY(-5px)} }

    .aiq-chat-chips {
      display: flex; flex-wrap: wrap; gap: .4rem; padding: 0 1rem .75rem;
    }
    .aiq-chip {
      background: rgba(3,79,70,.25); border: 1px solid rgba(3,79,70,.5);
      color: #5ecfbb; border-radius: 9999px; padding: .3rem .75rem;
      font-family: 'Figtree',sans-serif; font-size: .75rem; font-weight: 500;
      cursor: pointer; transition: background .15s ease;
    }
    .aiq-chip:hover { background: rgba(3,79,70,.5); }

    .aiq-chat-foot {
      display: flex; align-items: center; gap: .5rem;
      padding: .75rem 1rem; border-top: 1px solid rgba(255,255,235,.07);
      border-radius: 0 0 1.25rem 1.25rem;
    }
    #aiq-chat-input {
      flex: 1; background: rgba(255,255,235,.06); border: 1px solid rgba(255,255,235,.1);
      border-radius: .75rem; padding: .55rem .85rem;
      font-family: 'Figtree',sans-serif; font-size: .84rem; color: #ffffeb;
      outline: none; transition: border-color .15s ease; resize: none;
    }
    #aiq-chat-input::placeholder { color: rgba(255,255,235,.3); }
    #aiq-chat-input:focus { border-color: rgba(3,79,70,.6); }
    #aiq-chat-send {
      width: 36px; height: 36px; border-radius: 50%;
      background: #034f46; border: none; cursor: pointer; flex-shrink: 0;
      display: flex; align-items: center; justify-content: center;
      transition: background .15s ease; color: #ffffeb;
    }
    #aiq-chat-send:hover { background: #056b5e; }
    #aiq-chat-send:disabled { opacity: .4; cursor: default; }
  `;

  // ── Inject styles ──────────────────────────────────────────────────────────
  const style = document.createElement('style');
  style.textContent = STYLES;
  document.head.appendChild(style);

  // ── Build HTML ─────────────────────────────────────────────────────────────
  const wrapper = document.createElement('div');
  wrapper.innerHTML = `
    <button id="aiq-chat-btn" aria-label="Chat with Aria" title="Chat with Aria">
      <span class="badge"></span>
      <svg viewBox="0 0 24 24" fill="none" stroke="#ffffeb" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
      </svg>
    </button>

    <div id="aiq-chat-box" role="dialog" aria-label="AIQ Chat Assistant">
      <div class="aiq-chat-head">
        <div class="aiq-chat-avatar">✦</div>
        <div>
          <div class="aiq-chat-name">Aria · AIQ Assistant</div>
          <div class="aiq-chat-status">Online now</div>
        </div>
        <button class="aiq-chat-close" id="aiq-chat-close" aria-label="Close chat">✕</button>
      </div>
      <div class="aiq-chat-msgs" id="aiq-chat-msgs"></div>
      <div class="aiq-chat-chips" id="aiq-chat-chips">
        <button class="aiq-chip">Which course suits me?</button>
        <button class="aiq-chip">How much do courses cost?</button>
        <button class="aiq-chip">Do I get a certificate?</button>
        <button class="aiq-chip">Is there a refund policy?</button>
      </div>
      <div class="aiq-chat-foot">
        <input id="aiq-chat-input" type="text" placeholder="Ask me anything…" maxlength="500" autocomplete="off" />
        <button id="aiq-chat-send" aria-label="Send">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/></svg>
        </button>
      </div>
    </div>
  `;
  document.body.appendChild(wrapper);

  // ── State ──────────────────────────────────────────────────────────────────
  const btn      = document.getElementById('aiq-chat-btn');
  const box      = document.getElementById('aiq-chat-box');
  const msgs     = document.getElementById('aiq-chat-msgs');
  const input    = document.getElementById('aiq-chat-input');
  const send     = document.getElementById('aiq-chat-send');
  const closeBtn = document.getElementById('aiq-chat-close');
  const chips    = document.getElementById('aiq-chat-chips');

  let history  = [];
  let isOpen   = false;
  let isWaiting = false;
  let greeted  = false;

  // ── Toggle ─────────────────────────────────────────────────────────────────
  function toggleChat() {
    isOpen = !isOpen;
    box.classList.toggle('open', isOpen);
    btn.querySelector('.badge').style.display = isOpen ? 'none' : '';
    if (isOpen) {
      input.focus();
      if (!greeted) {
        greeted = true;
        addMsg('bot', "Hi! I'm **Aria**, your AIQ assistant 👋\n\nI can help you pick the right course, answer questions about pricing, certificates, and more. What would you like to know?");
      }
    }
  }

  btn.addEventListener('click', toggleChat);
  closeBtn.addEventListener('click', toggleChat);

  // ── Quick chips ────────────────────────────────────────────────────────────
  chips.querySelectorAll('.aiq-chip').forEach(chip => {
    chip.addEventListener('click', () => {
      sendMessage(chip.textContent);
      chips.style.display = 'none';
    });
  });

  // ── Send ───────────────────────────────────────────────────────────────────
  function sendMessage(text) {
    text = (text || input.value).trim();
    if (!text || isWaiting) return;
    input.value = '';
    chips.style.display = 'none';
    addMsg('user', text);
    history.push({ role: 'user', content: text });
    fetchReply();
  }

  send.addEventListener('click', () => sendMessage());
  input.addEventListener('keydown', e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); } });

  // ── Add message bubble ─────────────────────────────────────────────────────
  function addMsg(role, text) {
    const el = document.createElement('div');
    el.className = 'aiq-msg ' + role;
    // Basic markdown: **bold**
    el.innerHTML = text
      .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/\n/g, '<br>');
    msgs.appendChild(el);
    msgs.scrollTop = msgs.scrollHeight;
    return el;
  }

  // ── Typing indicator ───────────────────────────────────────────────────────
  function showTyping() {
    const el = document.createElement('div');
    el.className = 'aiq-typing';
    el.id = 'aiq-typing';
    el.innerHTML = '<span></span><span></span><span></span>';
    msgs.appendChild(el);
    msgs.scrollTop = msgs.scrollHeight;
  }
  function hideTyping() {
    const el = document.getElementById('aiq-typing');
    if (el) el.remove();
  }

  // ── API call ───────────────────────────────────────────────────────────────
  async function fetchReply() {
    isWaiting = true;
    send.disabled = true;
    showTyping();
    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: history }),
      });
      const data = await res.json();
      hideTyping();
      const reply = data.reply || data.error || 'Something went wrong. Please try again.';
      addMsg('bot', reply);
      history.push({ role: 'assistant', content: reply });
    } catch (e) {
      hideTyping();
      addMsg('bot', 'Connection error. Please check your internet and try again.');
    } finally {
      isWaiting = false;
      send.disabled = false;
      input.focus();
    }
  }

})();
