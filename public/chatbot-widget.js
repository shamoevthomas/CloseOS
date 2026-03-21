// Chatbot Widget - Embeddable script with markdown support
(function () {
  const script = document.currentScript;
  const chatbotId = script.getAttribute('data-chatbot-id');
  const supabaseUrl = script.getAttribute('data-supabase-url');
  const supabaseKey = script.getAttribute('data-supabase-key');

  if (!chatbotId || !supabaseUrl || !supabaseKey) {
    console.error('ChatBot Widget: Missing required attributes');
    return;
  }

  fetch(`${supabaseUrl}/rest/v1/chatbots?id=eq.${chatbotId}&select=*`, {
    headers: { 'apikey': supabaseKey, 'Authorization': `Bearer ${supabaseKey}` }
  })
    .then(r => r.json())
    .then(data => {
      if (!data || !data[0]) return;
      createWidget(data[0]);
    });

  // Simple markdown to HTML converter
  function md(text) {
    if (!text) return '';
    return text
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.+?)\*/g, '<em>$1</em>')
      .replace(/`(.+?)`/g, '<code style="background:#e5e7eb;padding:1px 4px;border-radius:3px;font-size:12px">$1</code>')
      .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" style="color:#2563eb;text-decoration:underline;">$1</a>')
      .replace(/\n- /g, '\n• ')
      .replace(/\n(\d+)\. /g, '\n$1. ')
      .replace(/\n/g, '<br>');
  }

  function createWidget(bot) {
    const bgType = bot.bg_type || 'solid';
    const bgColor = bot.bg_color || '#ffffff';
    const bgFrom = bot.bg_gradient_from || '#667eea';
    const bgTo = bot.bg_gradient_to || '#764ba2';
    const bgImage = bot.bg_image_url || '';

    let msgBgStyle = '';
    if (bgType === 'gradient') msgBgStyle = `background:linear-gradient(135deg,${bgFrom},${bgTo});`;
    else if (bgType === 'image' && bgImage) msgBgStyle = `background-image:url(${bgImage});background-size:cover;background-position:center;`;
    else msgBgStyle = `background:${bgColor};`;

    const container = document.createElement('div');
    container.id = 'chatbot-widget-container';
    container.innerHTML = `
      <style>
        #chatbot-widget-container { position: fixed; bottom: 24px; right: 24px; z-index: 999999; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; }
        #chatbot-widget-btn { width: 60px; height: 60px; border-radius: 50%; border: none; cursor: pointer; display: flex; align-items: center; justify-content: center; box-shadow: 0 4px 20px rgba(0,0,0,0.15); transition: transform 0.2s; transform: translateY(100px); opacity: 0; }
        #chatbot-widget-btn.cw-visible { transform: translateY(0); opacity: 1; transition: transform 0.6s cubic-bezier(0.16,1,0.3,1), opacity 0.6s ease; }
        #chatbot-widget-btn.cw-visible:hover { transform: scale(1.05); }
        #chatbot-widget-btn svg { width: 28px; height: 28px; fill: white; }
        #cw-tooltip { position: absolute; bottom: 70px; right: 0; background: #111; color: #fff; font-size: 13px; font-weight: 600; padding: 8px 14px; border-radius: 10px; white-space: nowrap; box-shadow: 0 4px 12px rgba(0,0,0,0.15); opacity: 0; transform: translateY(8px); transition: opacity 0.4s ease, transform 0.4s ease; pointer-events: none; }
        #cw-tooltip.cw-show { opacity: 1; transform: translateY(0); }
        #cw-tooltip::after { content: ''; position: absolute; bottom: -6px; right: 22px; width: 12px; height: 12px; background: #111; transform: rotate(45deg); border-radius: 2px; }
        #chatbot-widget-panel { display: none; width: 380px; height: 520px; border-radius: 16px; overflow: hidden; box-shadow: 0 8px 40px rgba(0,0,0,0.15); background: #fff; flex-direction: column; margin-bottom: 12px; }
        #chatbot-widget-panel.open { display: flex; }
        .cw-header { padding: 14px 16px; display: flex; align-items: center; gap: 10px; color: white; }
        .cw-header img { width: 32px; height: 32px; border-radius: 50%; object-fit: cover; }
        .cw-header-icon { width: 32px; height: 32px; border-radius: 50%; background: rgba(255,255,255,0.2); display: flex; align-items: center; justify-content: center; }
        .cw-header-icon svg { width: 16px; height: 16px; fill: white; }
        .cw-header span { font-weight: 600; font-size: 14px; flex: 1; }
        .cw-close { background: none; border: none; color: rgba(255,255,255,0.7); cursor: pointer; font-size: 20px; }
        .cw-messages { flex: 1; overflow-y: auto; padding: 16px; display: flex; flex-direction: column; gap: 8px; ${msgBgStyle} }
        .cw-msg { max-width: 80%; padding: 8px 12px; border-radius: 12px; font-size: 14px; line-height: 1.5; word-wrap: break-word; }
        .cw-msg.bot { background: rgba(255,255,255,0.9); backdrop-filter: blur(8px); border-top-left-radius: 4px; align-self: flex-start; box-shadow: 0 1px 3px rgba(0,0,0,0.08); }
        .cw-msg.bot strong { font-weight: 700; }
        .cw-msg.bot em { font-style: italic; }
        .cw-msg.user { color: white; border-top-right-radius: 4px; align-self: flex-end; }
        .cw-input-area { padding: 12px; border-top: 1px solid #e5e7eb; display: flex; gap: 8px; }
        .cw-input-area input { flex: 1; border: none; background: #f3f4f6; border-radius: 8px; padding: 8px 12px; font-size: 14px; outline: none; }
        .cw-input-area button { width: 36px; height: 36px; border-radius: 8px; border: none; color: white; cursor: pointer; display: flex; align-items: center; justify-content: center; }
        .cw-input-area button svg { width: 16px; height: 16px; fill: white; }
        .cw-typing { display: flex; gap: 4px; padding: 8px 12px; }
        .cw-typing span { width: 6px; height: 6px; border-radius: 50%; background: #9ca3af; animation: cwBounce 1.4s infinite; }
        .cw-typing span:nth-child(2) { animation-delay: 0.2s; }
        .cw-typing span:nth-child(3) { animation-delay: 0.4s; }
        @keyframes cwBounce { 0%,80%,100% { transform: scale(0.6); } 40% { transform: scale(1); } }
      </style>
      <div id="chatbot-widget-panel">
        <div class="cw-header" style="background:${bot.primary_color}">
          ${bot.logo_url ? '<img src="' + bot.logo_url + '" alt="">' : '<div class="cw-header-icon"><svg viewBox="0 0 24 24"><path d="M12 2a2 2 0 012 2c0 .74-.4 1.39-1 1.73V7h1a7 7 0 017 7h1a1 1 0 011 1v3a1 1 0 01-1 1h-1.27A7 7 0 015.27 19H4a1 1 0 01-1-1v-3a1 1 0 011-1h1a7 7 0 017-7h1V5.73c-.6-.34-1-.99-1-1.73a2 2 0 012-2zM9 14a1 1 0 100 2 1 1 0 000-2zm6 0a1 1 0 100 2 1 1 0 000-2z"/></svg></div>'}
          <span>${bot.name}</span>
          <button class="cw-close" onclick="document.getElementById('chatbot-widget-panel').classList.remove('open');document.getElementById('chatbot-widget-btn').style.display='flex'">&times;</button>
        </div>
        <div class="cw-messages" id="cw-messages">
          <div class="cw-msg bot">${bot.welcome_message}</div>
        </div>
        <div class="cw-input-area">
          <input id="cw-input" placeholder="Écrivez un message..." onkeydown="if(event.key==='Enter')document.getElementById('cw-send').click()">
          <button id="cw-send" style="background:${bot.primary_color}"><svg viewBox="0 0 24 24"><path d="M2 21l21-9L2 3v7l15 2-15 2z"/></svg></button>
        </div>
      </div>
      <div id="cw-tooltip">Une question ? N'hésite pas</div>
      <button id="chatbot-widget-btn" style="background:${bot.primary_color}">
        <svg viewBox="0 0 24 24"><path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2z"/></svg>
      </button>
    `;
    document.body.appendChild(container);

    const btnEl = document.getElementById('chatbot-widget-btn');
    const panelEl = document.getElementById('chatbot-widget-panel');
    const messagesEl = document.getElementById('cw-messages');
    const inputEl = document.getElementById('cw-input');
    const sendEl = document.getElementById('cw-send');

    let messages = [];
    let isLoading = false;

    const tooltipEl = document.getElementById('cw-tooltip');

    // Show button after 15s with slide-up animation
    setTimeout(() => {
      btnEl.classList.add('cw-visible');
      // Show tooltip 0.6s after button appears, hide after 5s
      setTimeout(() => {
        tooltipEl.classList.add('cw-show');
        setTimeout(() => { tooltipEl.classList.remove('cw-show'); }, 5000);
      }, 600);
    }, 15000);

    btnEl.addEventListener('click', () => {
      panelEl.classList.add('open');
      btnEl.style.display = 'none';
      tooltipEl.style.display = 'none';
      inputEl.focus();
    });

    sendEl.addEventListener('click', async () => {
      const text = inputEl.value.trim();
      if (!text || isLoading) return;
      inputEl.value = '';

      messages.push({ role: 'user', content: text });
      addMessage(text, 'user');
      isLoading = true;
      const typingEl = addTyping();

      try {
        const resp = await fetch(supabaseUrl + '/functions/v1/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + supabaseKey },
          body: JSON.stringify({ messages, chatbotId: bot.id })
        });

        if (!resp.ok || !resp.body) throw new Error('fail');

        typingEl.remove();
        const msgEl = addMessage('', 'bot');
        const reader = resp.body.getReader();
        const decoder = new TextDecoder();
        let buf = '';
        let full = '';

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buf += decoder.decode(value, { stream: true });
          let ni;
          while ((ni = buf.indexOf('\n')) !== -1) {
            let line = buf.slice(0, ni);
            buf = buf.slice(ni + 1);
            if (line.endsWith('\r')) line = line.slice(0, -1);
            if (!line.startsWith('data: ')) continue;
            const j = line.slice(6).trim();
            if (j === '[DONE]') break;
            try {
              const p = JSON.parse(j);
              const c = p.choices?.[0]?.delta?.content;
              if (c) { full += c; msgEl.innerHTML = md(full); }
            } catch { }
          }
        }
        messages.push({ role: 'assistant', content: full });
      } catch {
        typingEl.remove();
        addMessage('Désolé, une erreur est survenue.', 'bot');
      }
      isLoading = false;
      messagesEl.scrollTop = messagesEl.scrollHeight;
    });

    function addMessage(text, type) {
      const el = document.createElement('div');
      el.className = 'cw-msg ' + type;
      if (type === 'user') { el.style.background = bot.primary_color; el.textContent = text; }
      else { el.innerHTML = md(text); }
      messagesEl.appendChild(el);
      messagesEl.scrollTop = messagesEl.scrollHeight;
      return el;
    }

    function addTyping() {
      const el = document.createElement('div');
      el.className = 'cw-msg bot';
      el.innerHTML = '<div class="cw-typing"><span></span><span></span><span></span></div>';
      messagesEl.appendChild(el);
      messagesEl.scrollTop = messagesEl.scrollHeight;
      return el;
    }
  }
})();
