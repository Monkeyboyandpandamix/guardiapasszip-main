(function() {
  const isDashboard = document.documentElement.getAttribute('data-guardiapass-role') === 'dashboard' || 
                      document.title.includes("GuardiaPass");

  if (isDashboard) {
    console.debug("[GuardiaPass] Dashboard Bridge Active.");
    
    window.addEventListener('message', (e) => {
      if (e.data && e.data.source === 'guardiapass_dashboard') {
        if (e.data.type === 'VAULT_SYNC') chrome.storage.local.set({ vault: e.data.payload });
        
        if (e.data.type === 'DECRYPTED_AUTOFILL_READY') {
          chrome.runtime.sendMessage({
            type: 'DECRYPTED_DATA_REPLY',
            targetTabId: e.data.targetTabId,
            payload: e.data.payload,
            traceId: e.data.traceId
          });
        }
        
        if (e.data.type === 'AI_AUDIT_RESULT') {
          chrome.runtime.sendMessage({ 
            type: 'AI_RESPONSE_RELAY', 
            text: e.data.text, 
            correlationId: e.data.correlationId,
            traceId: e.data.traceId 
          });
        }

        if (e.data.type === 'CREDENTIAL_SAVED') {
          const banner = document.getElementById('gp-save-banner');
          if (banner) banner.remove();
        }

        if (e.data.type === 'HUNTER_VERIFY_RESULT') {
          chrome.runtime.sendMessage({
            type: 'HUNTER_RESULT_RELAY',
            payload: e.data.payload,
            correlationId: e.data.correlationId,
            traceId: e.data.traceId
          });
        }
      }
    });

    setInterval(() => {
      window.postMessage({ source: 'guardiapass_extension', type: 'HEARTBEAT' }, "*");
    }, 1000);

    chrome.runtime.onMessage.addListener((msg) => {
      if (msg.source === 'guardiapass_extension') {
        window.postMessage({ ...msg }, "*");
      }
    });
    return;
  }

  /* ========== HUNTER.IO EMAIL SCANNER FOR GMAIL/OUTLOOK ========== */

  const isGmail = location.hostname.includes('mail.google.com');
  const isOutlook = location.hostname.includes('outlook.live.com') || 
                    location.hostname.includes('outlook.office.com') || 
                    location.hostname.includes('outlook.office365.com');
  const isMailClient = isGmail || isOutlook;

  const hunterCache = {};
  let scanCount = 0;
  let flaggedCount = 0;
  let verifiedCount = 0;
  let activeTooltip = null;

  if (isMailClient) {
    console.debug("[GuardiaPass] Mail client detected. Hunter.io scanner activating...");
    setTimeout(() => startHunterScanner(), 3000);
  }

  function startHunterScanner() {
    showStatusBar('Initializing email scanner...');
    scanVisibleEmails();

    const mailObserver = new MutationObserver(() => {
      clearTimeout(mailObserver._debounce);
      mailObserver._debounce = setTimeout(() => scanVisibleEmails(), 1500);
    });
    mailObserver.observe(document.body, { childList: true, subtree: true });

    setInterval(() => scanVisibleEmails(), 15000);
  }

  function scanVisibleEmails() {
    const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
    const emailElements = findEmailElements();

    emailElements.forEach(({ element, email }) => {
      if (element.dataset.gpHunterScanned) return;
      element.dataset.gpHunterScanned = 'true';

      if (hunterCache[email]) {
        applyHighlight(element, email, hunterCache[email]);
        return;
      }

      element.classList.add('gp-email-scanning');
      element.dataset.gpHunterEmail = email;
      scanCount++;
      updateStatusBar();

      chrome.runtime.sendMessage({
        type: 'HUNTER_VERIFY_REQUEST',
        payload: { email },
        correlationId: email
      }, (response) => {
        if (chrome.runtime.lastError) return;
        element.classList.remove('gp-email-scanning');
        if (response && response.result) {
          hunterCache[email] = response.result;
          applyHighlight(element, email, response.result);
        }
      });
    });
  }

  function findEmailElements() {
    const results = [];
    const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;

    if (isGmail) {
      const senderEls = document.querySelectorAll(
        'span[email], .go span, .gD, .g2, [data-hovercard-id], .yP, .zF, .bA4 span, .qu span, .gE span'
      );
      senderEls.forEach(el => {
        const email = el.getAttribute('email') || 
                      el.getAttribute('data-hovercard-id') || 
                      el.textContent.trim();
        if (email && emailRegex.test(email) && !el.dataset.gpHunterScanned) {
          results.push({ element: el, email: email.toLowerCase() });
        }
      });

      const allSpans = document.querySelectorAll('.yP, .zF, .bA4 span, tr.zA td.yX span');
      allSpans.forEach(el => {
        const emailAttr = el.getAttribute('email');
        if (emailAttr && emailRegex.test(emailAttr) && !el.dataset.gpHunterScanned) {
          results.push({ element: el, email: emailAttr.toLowerCase() });
        }
      });

      const headerEls = document.querySelectorAll('.gE span[email], .go span[email], .g2 span');
      headerEls.forEach(el => {
        const email = el.getAttribute('email');
        if (email && emailRegex.test(email) && !el.dataset.gpHunterScanned) {
          results.push({ element: el, email: email.toLowerCase() });
        }
      });
    }

    if (isOutlook) {
      const senderEls = document.querySelectorAll(
        '[data-testid="SenderPersona"], .lpc-hoverTarget span, ._pe_h span, .rps_e2e, .Al, .OZZZK, .hcptT'
      );
      senderEls.forEach(el => {
        const emailData = el.getAttribute('title') || el.getAttribute('aria-label') || el.textContent.trim();
        const match = emailData.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/);
        if (match && !el.dataset.gpHunterScanned) {
          results.push({ element: el, email: match[0].toLowerCase() });
        }
      });

      document.querySelectorAll('button[title], span[title]').forEach(el => {
        const title = el.getAttribute('title') || '';
        const match = title.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/);
        if (match && !el.dataset.gpHunterScanned) {
          results.push({ element: el, email: match[0].toLowerCase() });
        }
      });
    }

    const seen = new Set();
    return results.filter(r => {
      const key = r.email + '_' + (r.element.textContent || '').substring(0, 20);
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }

  function applyHighlight(element, email, result) {
    element.classList.remove('gp-email-scanning', 'gp-email-valid', 'gp-email-risky', 'gp-email-invalid');

    if (result.status === 'invalid' || result.block || result.disposable || result.gibberish || result.score < 30) {
      element.classList.add('gp-email-invalid');
      flaggedCount++;
    } else if (result.status === 'risky' || result.score < 50 || !result.mx_records) {
      element.classList.add('gp-email-risky');
      flaggedCount++;
    } else {
      element.classList.add('gp-email-valid');
      verifiedCount++;
    }

    element.addEventListener('mouseenter', (e) => showHunterTooltip(e, email, result));
    element.addEventListener('mouseleave', () => hideHunterTooltip());

    updateStatusBar();
  }

  function showHunterTooltip(event, email, result) {
    hideHunterTooltip();

    let statusColor, statusLabel, reasonText;
    if (result.status === 'invalid' || result.block || result.disposable || result.gibberish || result.score < 30) {
      statusColor = '#ef4444';
      statusLabel = 'SUSPICIOUS';
      if (result.disposable) reasonText = 'Disposable/temporary email service';
      else if (result.gibberish) reasonText = 'Auto-generated gibberish address';
      else if (result.block) reasonText = 'Email address is blocked';
      else if (!result.mx_records) reasonText = 'No valid mail server found';
      else if (result.status === 'invalid') reasonText = 'Invalid email address';
      else reasonText = 'Very low trust score';
    } else if (result.status === 'risky' || result.score < 50 || !result.mx_records) {
      statusColor = '#f59e0b';
      statusLabel = 'RISKY';
      if (!result.mx_records) reasonText = 'No mail server records found';
      else if (result.status === 'risky') reasonText = 'Deliverability uncertain';
      else reasonText = 'Low trust score';
    } else {
      statusColor = '#10b981';
      statusLabel = 'VERIFIED';
      reasonText = result.status === 'accept_all' ? 'Server accepts all (catch-all)' : 'Email verified successfully';
    }

    const tooltip = document.createElement('div');
    tooltip.className = 'gp-hunter-tooltip';
    tooltip.innerHTML = `
      <div class="gp-hunter-tooltip-header">
        <svg viewBox="0 0 24 24" fill="none" stroke="${statusColor}" stroke-width="2.5"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path></svg>
        <span class="gp-hunter-tooltip-title" style="color:${statusColor}">GUARDIAPASS × HUNTER.IO</span>
      </div>
      <div class="gp-hunter-tooltip-email">${email}</div>
      <div class="gp-hunter-tooltip-score" style="color:${statusColor}">${result.score}/100</div>
      <div class="gp-hunter-tooltip-reason" style="background:${statusColor}15;color:${statusColor};border:1px solid ${statusColor}30">${statusLabel}: ${reasonText}</div>
      <div style="margin-top:12px;border-top:1px solid rgba(255,255,255,0.05);padding-top:10px">
        <div class="gp-hunter-tooltip-row"><span class="gp-hunter-tooltip-label">Status</span><span class="gp-hunter-tooltip-value" style="color:${statusColor}">${result.status.toUpperCase()}</span></div>
        <div class="gp-hunter-tooltip-row"><span class="gp-hunter-tooltip-label">MX Records</span><span class="gp-hunter-tooltip-value" style="color:${result.mx_records ? '#10b981' : '#ef4444'}">${result.mx_records ? '✓' : '✗'}</span></div>
        <div class="gp-hunter-tooltip-row"><span class="gp-hunter-tooltip-label">SMTP Verified</span><span class="gp-hunter-tooltip-value" style="color:${result.smtp_check ? '#10b981' : '#ef4444'}">${result.smtp_check ? '✓' : '✗'}</span></div>
        <div class="gp-hunter-tooltip-row"><span class="gp-hunter-tooltip-label">Disposable</span><span class="gp-hunter-tooltip-value" style="color:${result.disposable ? '#ef4444' : '#10b981'}">${result.disposable ? 'YES' : 'NO'}</span></div>
        <div class="gp-hunter-tooltip-row"><span class="gp-hunter-tooltip-label">Webmail</span><span class="gp-hunter-tooltip-value" style="color:#94a3b8">${result.webmail ? 'YES' : 'NO'}</span></div>
      </div>
    `;

    const rect = event.target.getBoundingClientRect();
    tooltip.style.top = (rect.bottom + 8) + 'px';
    tooltip.style.left = Math.min(rect.left, window.innerWidth - 360) + 'px';

    document.body.appendChild(tooltip);
    activeTooltip = tooltip;
  }

  function hideHunterTooltip() {
    if (activeTooltip) {
      activeTooltip.remove();
      activeTooltip = null;
    }
  }

  function showStatusBar(text) {
    let bar = document.getElementById('gp-hunter-status');
    if (!bar) {
      bar = document.createElement('div');
      bar.id = 'gp-hunter-status';
      bar.innerHTML = `
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#10b981" stroke-width="2.5"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path></svg>
        <div id="gp-hunter-status-icon"></div>
        <span id="gp-hunter-status-text">${text}</span>
        <span id="gp-hunter-status-count"></span>
      `;
      document.body.appendChild(bar);
    }
  }

  function updateStatusBar() {
    const textEl = document.getElementById('gp-hunter-status-text');
    const countEl = document.getElementById('gp-hunter-status-count');
    const iconEl = document.getElementById('gp-hunter-status-icon');
    if (textEl) {
      textEl.textContent = flaggedCount > 0 
        ? `${flaggedCount} suspicious email${flaggedCount > 1 ? 's' : ''} detected` 
        : 'All emails verified';
      textEl.style.color = flaggedCount > 0 ? '#f59e0b' : '#10b981';
    }
    if (countEl) {
      countEl.textContent = `${verifiedCount + flaggedCount} scanned`;
    }
    if (iconEl) {
      iconEl.style.background = flaggedCount > 0 ? '#f59e0b' : '#10b981';
      iconEl.style.animation = 'none';
    }
  }

  /* ========== END HUNTER.IO SCANNER ========== */

  function scrapeEmails() {
    const bodyText = document.body.innerText;
    const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
    const foundEmails = Array.from(new Set(bodyText.match(emailRegex) || []));
    
    if (foundEmails.length > 0) {
      chrome.storage.local.get(['foundEmails'], (res) => {
        const existing = res.foundEmails || {};
        const url = location.hostname;
        const currentBatch = existing[url] || [];
        const merged = Array.from(new Set([...currentBatch, ...foundEmails])).slice(0, 50);
        existing[url] = merged;
        chrome.storage.local.set({ foundEmails: existing });
      });
    }
  }

  setTimeout(scrapeEmails, 2000);
  setInterval(scrapeEmails, 10000);

  function matchesAny(value, patterns) {
    if (!value) return false;
    const lower = value.toLowerCase();
    return patterns.some(p => lower.includes(p));
  }

  function findPasswordField(inputs) {
    return inputs.find(i => 
      i.type === 'password' || 
      matchesAny(i.name, ['pass', 'pwd', 'senha', 'contraseña']) ||
      matchesAny(i.id, ['pass', 'pwd', 'password']) ||
      matchesAny(i.autocomplete, ['password', 'current-password', 'new-password']) ||
      matchesAny(i.getAttribute('placeholder'), ['password', 'contraseña', 'mot de passe']) ||
      matchesAny(i.getAttribute('aria-label'), ['password'])
    );
  }

  function findUsernameField(inputs, passwordField) {
    const patterns = ['user', 'email', 'login', 'account', 'identifier', 'uname', 'uid', 'handle', 'signin', 'sign-in', 'log-in', 'username_or_email'];
    const autocompletePatterns = ['username', 'email', 'webauthn'];
    const placeholderPatterns = ['email', 'user', 'phone', 'login', 'account', 'id'];

    return inputs.find(i => {
      if (i === passwordField || i.type === 'hidden' || i.type === 'submit' || i.type === 'button' || i.type === 'checkbox' || i.type === 'radio') return false;
      if (i.offsetParent === null && i.type !== 'email') return false;

      return (
        i.type === 'email' || i.type === 'tel' ||
        matchesAny(i.name, patterns) ||
        matchesAny(i.id, patterns) ||
        matchesAny(i.autocomplete, autocompletePatterns) ||
        matchesAny(i.getAttribute('placeholder'), placeholderPatterns) ||
        matchesAny(i.getAttribute('aria-label'), placeholderPatterns) ||
        (i.type === 'text' && passwordField && i.closest('form') === passwordField.closest('form') && !matchesAny(i.name, ['search', 'query', 'q', 'filter', 'captcha', 'code', 'otp', 'token', 'coupon', 'promo', 'zip', 'postal', 'city', 'state', 'country', 'address', 'street', 'phone', 'first', 'last', 'card', 'cvv', 'expir']))
      );
    });
  }

  chrome.runtime.onMessage.addListener((msg) => {
    if (msg.type === 'AUTOFILL_EXECUTE_FINAL') {
      const { payload } = msg;
      const allInputs = Array.from(document.querySelectorAll('input'));
      
      let passwordField = findPasswordField(allInputs);
      let userField = findUsernameField(allInputs, passwordField);

      const simulateInteraction = (el, val) => {
        if (!el || !val) return;
        el.focus();
        el.click();
        
        const nativeInputValueSetter = Object.getOwnPropertyDescriptor(
          window.HTMLInputElement.prototype, 'value'
        ).set;
        nativeInputValueSetter.call(el, val);
        
        el.dispatchEvent(new Event('input', { bubbles: true }));
        el.dispatchEvent(new Event('change', { bubbles: true }));
        el.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true }));
        el.dispatchEvent(new KeyboardEvent('keyup', { bubbles: true }));
        el.dispatchEvent(new Event('blur', { bubbles: true }));

        const originalTransition = el.style.transition;
        el.style.transition = 'all 0.3s ease';
        el.style.boxShadow = '0 0 15px rgba(16, 185, 129, 0.5)';
        el.style.border = '2px solid #10b981';
        
        setTimeout(() => {
          el.style.boxShadow = '';
          el.style.transition = originalTransition;
          el.style.border = '';
        }, 1500);
      };

      if (userField) simulateInteraction(userField, payload.username || payload.email);
      if (passwordField) simulateInteraction(passwordField, payload.password);
    }

    if (msg.type === 'OPEN_PAGE_SCOUT') injectScout();

    if (msg.type === 'SEND_PAGE_TO_ADVISOR') {
      const pageContent = document.body.innerText.substring(0, 5000);
      const pageTitle = document.title;
      const pageUrl = location.href;
      chrome.runtime.sendMessage({
        type: 'PAGE_CONTENT_FOR_ADVISOR',
        payload: { url: pageUrl, title: pageTitle, content: pageContent }
      });
    }

    if (msg.type === 'HUNTER_VERIFY_RESPONSE' && msg.payload) {
      const email = msg.correlationId;
      hunterCache[email] = msg.payload;
      
      const elements = document.querySelectorAll(`[data-gp-hunter-email="${email}"]`);
      elements.forEach(el => {
        el.classList.remove('gp-email-scanning');
        applyHighlight(el, email, msg.payload);
      });
    }
  });

  let savePromptShown = false;
  let detectedCredentials = { username: '', password: '', url: '' };

  function detectPasswordFields() {
    const passwordFields = document.querySelectorAll('input[type="password"]');
    
    passwordFields.forEach(passField => {
      if (passField.dataset.gpWatching) return;
      passField.dataset.gpWatching = 'true';

      const form = passField.closest('form');
      
      if (form) {
        form.addEventListener('submit', (e) => {
          handleCredentialCapture(form, passField);
        });
      }

      passField.addEventListener('blur', () => {
        if (passField.value.length >= 3) {
          const allInputs = form ? Array.from(form.querySelectorAll('input')) : Array.from(document.querySelectorAll('input'));
          const userField = findUsernameField(allInputs, passField);

          if (userField && userField.value && passField.value) {
            detectedCredentials = {
              username: userField.value,
              password: passField.value,
              url: location.hostname
            };
          }
        }
      });
    });
  }

  function handleCredentialCapture(form, passField) {
    const allInputs = form ? Array.from(form.querySelectorAll('input')) : Array.from(document.querySelectorAll('input'));
    const userField = findUsernameField(allInputs, passField);

    const username = userField?.value || '';
    const password = passField?.value || '';
    
    if (username && password && !savePromptShown) {
      detectedCredentials = { username, password, url: location.hostname };
      showSavePrompt();
    }
  }

  function showSavePrompt() {
    if (savePromptShown || document.getElementById('gp-save-banner')) return;
    savePromptShown = true;

    const banner = document.createElement('div');
    banner.id = 'gp-save-banner';
    banner.innerHTML = `
      <div style="position:fixed;top:20px;right:20px;z-index:2147483647;width:360px;background:#020617;border:1px solid rgba(16,185,129,0.3);border-radius:20px;box-shadow:0 30px 60px rgba(0,0,0,0.8);font-family:-apple-system,sans-serif;overflow:hidden;animation:gpSlideIn 0.3s ease">
        <div style="padding:16px 20px;background:rgba(16,185,129,0.1);border-bottom:1px solid rgba(16,185,129,0.1);display:flex;justify-content:space-between;align-items:center">
          <div style="display:flex;align-items:center;gap:8px">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#10b981" stroke-width="2.5"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path></svg>
            <span style="font-size:11px;font-weight:900;color:#10b981;letter-spacing:0.1em">GUARDIAPASS</span>
          </div>
          <button id="gp-save-close" style="background:none;border:none;color:#64748b;font-size:18px;cursor:pointer;padding:0 4px">×</button>
        </div>
        <div style="padding:20px">
          <p style="font-size:13px;font-weight:700;color:#f1f5f9;margin:0 0 4px">Save this password?</p>
          <p style="font-size:10px;color:#64748b;margin:0 0 16px;font-family:monospace">${detectedCredentials.username} @ ${detectedCredentials.url}</p>
          <div style="display:flex;gap:8px">
            <button id="gp-save-yes" style="flex:1;padding:12px;background:#10b981;color:white;border:none;border-radius:12px;font-size:11px;font-weight:800;cursor:pointer;letter-spacing:0.05em">SAVE TO VAULT</button>
            <button id="gp-save-no" style="flex:1;padding:12px;background:#1e293b;color:#94a3b8;border:1px solid #334155;border-radius:12px;font-size:11px;font-weight:800;cursor:pointer">DISMISS</button>
          </div>
        </div>
      </div>
      <style>@keyframes gpSlideIn{from{transform:translateY(-20px);opacity:0}to{transform:translateY(0);opacity:1}}</style>
    `;
    document.body.appendChild(banner);

    document.getElementById('gp-save-close').onclick = () => { banner.remove(); savePromptShown = false; };
    document.getElementById('gp-save-no').onclick = () => { banner.remove(); savePromptShown = false; };
    document.getElementById('gp-save-yes').onclick = () => {
      chrome.runtime.sendMessage({
        type: 'SAVE_CREDENTIAL',
        payload: {
          name: detectedCredentials.url,
          url: detectedCredentials.url,
          username: detectedCredentials.username,
          password: detectedCredentials.password
        }
      }, (response) => {
        const statusEl = banner.querySelector('div > div:last-child');
        if (statusEl) {
          statusEl.innerHTML = '<p style="text-align:center;padding:8px;color:#10b981;font-size:11px;font-weight:800">✓ SAVED TO VAULT</p>';
        }
        setTimeout(() => { banner.remove(); savePromptShown = false; }, 1500);
      });
    };
  }

  detectPasswordFields();
  const observer = new MutationObserver(() => detectPasswordFields());
  observer.observe(document.body, { childList: true, subtree: true });

  function injectScout() {
    if (document.getElementById('gp-scout')) return;
    const scout = document.createElement('div');
    scout.id = 'gp-scout';
    scout.innerHTML = `
      <div id="gp-scout-header"><span>NEURAL SCOUT</span><button id="gp-scout-close">×</button></div>
      <div id="gp-scout-chat"></div>
      <div id="gp-scout-input-container"><input type="text" id="gp-scout-input" placeholder="Ask AI about this page..."></div>
    `;
    document.body.appendChild(scout);
    document.getElementById('gp-scout-close').onclick = () => scout.remove();
    
    const input = document.getElementById('gp-scout-input');
    input.onkeypress = (e) => {
      if (e.key === 'Enter' && input.value.trim()) {
        const query = input.value;
        input.value = '';
        const msgDiv = document.createElement('div');
        msgDiv.className = 'gp-msg user';
        msgDiv.innerText = query;
        document.getElementById('gp-scout-chat').appendChild(msgDiv);
        
        chrome.runtime.sendMessage({ 
          type: 'GEMINI_CHAT_REQUEST', 
          payload: { contents: query, page: { url: location.href, title: document.title, text: document.body.innerText.substring(0, 3000) } } 
        }, (res) => {
          const botDiv = document.createElement('div');
          botDiv.className = 'gp-msg bot';
          botDiv.innerText = res?.text || "Neural connection error.";
          document.getElementById('gp-scout-chat').appendChild(botDiv);
          document.getElementById('gp-scout-chat').scrollTop = document.getElementById('gp-scout-chat').scrollHeight;
        });
      }
    };
  }
})();
