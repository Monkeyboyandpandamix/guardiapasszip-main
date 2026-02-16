(function() {
  const hasChromeApis = () => !!(globalThis.chrome && chrome.runtime && chrome.runtime.id);
  const safeStorageSet = (payload) => {
    if (!hasChromeApis() || !chrome.storage?.local) return;
    try {
      chrome.storage.local.set(payload, () => { void chrome.runtime?.lastError; });
    } catch (e) {}
  };
  const safeRuntimeSend = (payload) => {
    if (!hasChromeApis() || !chrome.runtime?.sendMessage) return;
    try {
      chrome.runtime.sendMessage(payload, () => { void chrome.runtime?.lastError; });
    } catch (e) {}
  };

  let gpActiveAudio = null;
  let gpPasswordMeterEl = null;
  let gpPasswordMeterField = null;
  let gpLastPasswordField = null;
  let gpLastForm = null;
  const COMMON_WEAK_PASSWORDS = new Set([
    '123456', '1234567', '12345678', '12334567', '123456789', '1234567890',
    'password', 'password123', 'qwerty', 'qwerty123', 'letmein', 'admin', 'welcome'
  ]);

  function getPasswordStrength(password) {
    const value = String(password || '').trim();
    if (!value) return { label: 'Empty', score: 0, color: '#64748b' };
    const lower = value.toLowerCase();
    if (COMMON_WEAK_PASSWORDS.has(lower)) return { label: 'Weak (common)', score: 0, color: '#f87171' };
    let score = 0;
    if (value.length >= 8) score += 20;
    if (value.length >= 12) score += 20;
    if (value.length >= 16) score += 20;
    if (/[a-z]/.test(value)) score += 10;
    if (/[A-Z]/.test(value)) score += 10;
    if (/\d/.test(value)) score += 10;
    if (/[^A-Za-z0-9]/.test(value)) score += 10;
    if (score <= 40) return { label: 'Weak', score, color: '#f87171' };
    if (score <= 70) return { label: 'Medium', score, color: '#fbbf24' };
    return { label: 'Strong', score, color: '#34d399' };
  }

  function hidePasswordMeter() {
    if (gpPasswordMeterEl) {
      gpPasswordMeterEl.remove();
      gpPasswordMeterEl = null;
    }
    gpPasswordMeterField = null;
  }

  function generateStrongPassword(length = 18) {
    const upper = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
    const lower = 'abcdefghijkmnopqrstuvwxyz';
    const digits = '23456789';
    const symbols = '!@#$%^&*()-_=+[]{}?';
    const all = upper + lower + digits + symbols;
    const bytes = new Uint32Array(Math.max(4, length));
    crypto.getRandomValues(bytes);
    const chars = [
      upper[bytes[0] % upper.length],
      lower[bytes[1] % lower.length],
      digits[bytes[2] % digits.length],
      symbols[bytes[3] % symbols.length]
    ];
    for (let i = 4; i < length; i++) {
      chars.push(all[bytes[i] % all.length]);
    }
    for (let i = chars.length - 1; i > 0; i--) {
      const j = bytes[i % bytes.length] % (i + 1);
      const tmp = chars[i];
      chars[i] = chars[j];
      chars[j] = tmp;
    }
    return chars.join('');
  }

  function setInputValue(el, val) {
    if (!el) return;
    const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')?.set;
    if (setter) setter.call(el, val);
    else el.value = val;
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
  }

  function applySuggestedPassword(form, primaryField, password) {
    if (!primaryField) return;
    setInputValue(primaryField, password);
    const scope = form ? Array.from(form.querySelectorAll('input[type="password"]')) : [primaryField];
    for (const field of scope) {
      if (field === primaryField) continue;
      const hint = `${field.name || ''} ${field.id || ''} ${field.autocomplete || ''}`.toLowerCase();
      if (hint.includes('confirm') || hint.includes('new') || hint.includes('repeat') || field.value.length <= 2) {
        setInputValue(field, password);
      }
    }
    renderPasswordMeter(primaryField);
  }

  function renderPasswordMeter(field) {
    if (!field || !field.isConnected) return hidePasswordMeter();
    const strength = getPasswordStrength(field.value);
    const rect = field.getBoundingClientRect();
    if (!gpPasswordMeterEl) {
      gpPasswordMeterEl = document.createElement('div');
      gpPasswordMeterEl.id = 'gp-password-meter';
      gpPasswordMeterEl.style.cssText = [
        'position:fixed',
        'z-index:2147483647',
        'padding:4px 8px',
        'border-radius:8px',
        'font:700 10px -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif',
        'background:rgba(2,6,23,0.95)',
        'border:1px solid rgba(148,163,184,0.25)',
        'box-shadow:0 8px 20px rgba(0,0,0,0.35)',
        'pointer-events:none',
      ].join(';');
      document.body.appendChild(gpPasswordMeterEl);
    }
    gpPasswordMeterEl.textContent = `Password: ${strength.label} (${strength.score})`;
    gpPasswordMeterEl.style.color = strength.color;
    gpPasswordMeterEl.style.top = `${Math.max(8, rect.top - 26)}px`;
    gpPasswordMeterEl.style.left = `${Math.min(window.innerWidth - 220, Math.max(8, rect.left))}px`;
    gpPasswordMeterField = field;
  }

  function showTtsToast(message, isError = false) {
    const existing = document.getElementById('gp-tts-toast');
    if (existing) existing.remove();
    const toast = document.createElement('div');
    toast.id = 'gp-tts-toast';
    toast.textContent = message;
    toast.style.cssText = [
      'position:fixed',
      'right:16px',
      'bottom:16px',
      'z-index:2147483647',
      'padding:10px 12px',
      'border-radius:10px',
      'font:600 12px -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif',
      `background:${isError ? 'rgba(239,68,68,0.92)' : 'rgba(2,6,23,0.92)'}`,
      `border:1px solid ${isError ? 'rgba(248,113,113,0.7)' : 'rgba(16,185,129,0.6)'}`,
      `color:${isError ? '#fee2e2' : '#d1fae5'}`,
      'box-shadow:0 8px 30px rgba(0,0,0,0.35)',
      'max-width:360px',
    ].join(';');
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 2600);
  }

  function splitSpeechChunks(text, maxLen = 220) {
    const normalized = String(text || '').replace(/\s+/g, ' ').trim();
    if (!normalized) return [];
    const chunks = [];
    let start = 0;
    while (start < normalized.length) {
      const end = Math.min(start + maxLen, normalized.length);
      let part = normalized.slice(start, end);
      if (end < normalized.length) {
        const breakAt = Math.max(part.lastIndexOf('. '), part.lastIndexOf('! '), part.lastIndexOf('? '), part.lastIndexOf(', '));
        if (breakAt > 60) part = part.slice(0, breakAt + 1);
      }
      chunks.push(part.trim());
      start += part.length;
    }
    return chunks.filter(Boolean);
  }

  function pickPreferredVoice(voices) {
    const safeVoices = Array.isArray(voices) ? voices : [];
    const priorities = ['Google US English', 'Microsoft Aria', 'Samantha', 'Alex', 'Jenny', 'Zira', 'en-US'];
    for (const p of priorities) {
      const match = safeVoices.find(v => (v.name || '').includes(p) || (v.lang || '').includes(p));
      if (match) return match;
    }
    return safeVoices.find(v => (v.lang || '').toLowerCase().startsWith('en')) || safeVoices[0] || null;
  }

  function speakWithBrowserTts(text) {
    const phrase = String(text || '').trim();
    if (!phrase || !('speechSynthesis' in window)) return false;
    try {
      const engine = window.speechSynthesis;
      engine.cancel();
      const voices = engine.getVoices();
      const selectedVoice = pickPreferredVoice(voices);
      const chunks = splitSpeechChunks(phrase, 210);
      if (!chunks.length) return false;
      let idx = 0;
      const speakNext = () => {
        if (idx >= chunks.length) return;
        const utter = new SpeechSynthesisUtterance(chunks[idx]);
        if (selectedVoice) utter.voice = selectedVoice;
        utter.lang = (selectedVoice && selectedVoice.lang) || 'en-US';
        utter.rate = 0.98;
        utter.pitch = 1;
        utter.onend = () => {
          idx += 1;
          speakNext();
        };
        engine.speak(utter);
      };
      speakNext();
      return true;
    } catch {
      return false;
    }
  }

  function base64ToBlob(base64, mimeType) {
    const binary = atob(base64);
    const len = binary.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) bytes[i] = binary.charCodeAt(i);
    return new Blob([bytes], { type: mimeType || 'audio/mpeg' });
  }

  function playTtsAudio(payload) {
    const audioBase64 = payload?.audioBase64;
    if (!audioBase64) {
      showTtsToast('No audio returned for Read Aloud.', true);
      return;
    }
    const mimeType = payload?.mimeType || 'audio/mpeg';
    if (gpActiveAudio) {
      try {
        gpActiveAudio.pause();
      } catch (e) {}
      gpActiveAudio = null;
    }
    const blob = base64ToBlob(audioBase64, mimeType);
    const blobUrl = URL.createObjectURL(blob);
    const audio = new Audio(blobUrl);
    gpActiveAudio = audio;
    audio.onended = () => {
      URL.revokeObjectURL(blobUrl);
      if (gpActiveAudio === audio) gpActiveAudio = null;
    };
    audio.onerror = () => {
      URL.revokeObjectURL(blobUrl);
      if (gpActiveAudio === audio) gpActiveAudio = null;
      const fallbackSpoke = speakWithBrowserTts(payload?.text || '');
      showTtsToast(fallbackSpoke ? 'Played with browser voice fallback.' : 'Unable to play generated audio.', !fallbackSpoke);
    };
    audio.play().then(() => {
      showTtsToast('Reading selected text aloud...');
    }).catch(() => {
      URL.revokeObjectURL(blobUrl);
      const fallbackSpoke = speakWithBrowserTts(payload?.text || '');
      showTtsToast(fallbackSpoke ? 'Playback blocked, using browser voice.' : 'Playback blocked by browser on this page.', !fallbackSpoke);
    });
  }

  const isDashboard = document.documentElement.getAttribute('data-guardiapass-role') === 'dashboard';

  if (isDashboard) {
    console.debug("[GuardiaPass] Dashboard Bridge Active.");
    
    window.addEventListener('message', (e) => {
      if (e.data && e.data.source === 'guardiapass_dashboard') {
        if (e.data.type === 'VAULT_SYNC') safeStorageSet({ vault: e.data.payload });
        if (e.data.type === 'UI_SETTINGS_SYNC') safeStorageSet({ uiSettings: e.data.payload });
        
        if (e.data.type === 'DECRYPTED_AUTOFILL_READY') {
          safeRuntimeSend({
            type: 'DECRYPTED_DATA_REPLY',
            targetTabId: e.data.targetTabId,
            payload: e.data.payload,
            traceId: e.data.traceId
          });
        }
        
        if (e.data.type === 'AI_AUDIT_RESULT') {
          safeRuntimeSend({ 
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
          safeRuntimeSend({
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

    if (hasChromeApis() && chrome.runtime?.onMessage) {
      chrome.runtime.onMessage.addListener((msg) => {
        if (msg.source === 'guardiapass_extension') {
          window.postMessage({ ...msg }, "*");
        }
      });
    }

    safeRuntimeSend({ type: 'REQUEST_UI_SETTINGS' });
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
    const emailElements = findEmailElements();

    emailElements.forEach((item) => {
      try {
        const element = item?.element;
        const email = String(item?.email || '').toLowerCase();
        if (!element || !(element instanceof Element) || !email) return;
        if (!hasChromeApis() || !chrome.runtime?.sendMessage) return;

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
          if (!(element instanceof Element)) return;
          element.classList.remove('gp-email-scanning');
          if (response && response.result && typeof response.result === 'object') {
            hunterCache[email] = response.result;
            applyHighlight(element, email, response.result);
          }
        });
      } catch (e) {
        // Ignore malformed scan entries to keep page stable.
      }
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
    if (!result || typeof result !== 'object') return;
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
    if (!result || typeof result !== 'object') return;
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

  function getVisibleInputs(inputs) {
    return inputs.filter((i) => {
      if (!i || i.disabled || i.readOnly) return false;
      if (i.type === 'hidden') return false;
      const rect = i.getBoundingClientRect();
      return rect.width > 0 && rect.height > 0;
    });
  }

  function findPasswordField(inputs, mode = 'login') {
    const visible = getVisibleInputs(inputs).filter((i) => i.type === 'password' || matchesAny(i.name, ['pass', 'pwd']) || matchesAny(i.id, ['pass', 'pwd']));
    const scored = visible.map((i) => {
      let score = 0;
      const autocomplete = (i.autocomplete || '').toLowerCase();
      const hint = `${i.name || ''} ${i.id || ''} ${i.getAttribute('placeholder') || ''} ${i.getAttribute('aria-label') || ''}`.toLowerCase();
      if (mode === 'login') {
        if (autocomplete === 'current-password') score += 6;
        if (autocomplete === 'password') score += 4;
        if (hint.includes('current')) score += 3;
      } else {
        if (autocomplete === 'new-password') score += 6;
        if (hint.includes('new')) score += 3;
      }
      if (hint.includes('confirm')) score -= 4;
      if (i.form) score += 1;
      return { i, score };
    }).sort((a, b) => b.score - a.score);
    return scored[0]?.i || null;
  }

  function findUsernameField(inputs, passwordField) {
    const patterns = ['user', 'email', 'login', 'account', 'identifier', 'uname', 'uid', 'handle', 'signin', 'sign-in', 'log-in', 'username_or_email'];
    const autocompletePatterns = ['username', 'email', 'webauthn'];
    const placeholderPatterns = ['email', 'user', 'phone', 'login', 'account', 'id'];

    return inputs.find(i => {
      if (i === passwordField || i.type === 'hidden' || i.type === 'submit' || i.type === 'button' || i.type === 'checkbox' || i.type === 'radio') return false;
      if (i.offsetParent === null && i.type !== 'email') return false;
      if (i.disabled || i.readOnly) return false;

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

  function fillUsernameOnly(username) {
    const allInputs = Array.from(document.querySelectorAll('input'));
    const prioritized = [
      document.querySelector('#identifierId'),
      document.querySelector('input[type="email"]'),
      document.querySelector('input[name="identifier"]'),
      document.querySelector('input[name="email"]'),
      document.querySelector('input[autocomplete="username"]'),
      document.querySelector('input[autocomplete="email"]')
    ].filter(Boolean);
    const candidate = prioritized[0] || findUsernameField(allInputs, null) || allInputs.find((i) =>
      !i.disabled && !i.readOnly && (i.type === 'email' || i.type === 'text')
    );
    if (!candidate || !username) return false;
    const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')?.set;
    if (setter) setter.call(candidate, username);
    else candidate.value = username;
    candidate.dispatchEvent(new Event('input', { bubbles: true }));
    candidate.dispatchEvent(new Event('change', { bubbles: true }));
    candidate.dispatchEvent(new KeyboardEvent('keyup', { bubbles: true, key: 'Enter' }));
    return true;
  }

  function normalizeHost(value) {
    if (!value) return '';
    try {
      return new URL(value).hostname.toLowerCase();
    } catch {
      return String(value).toLowerCase().replace(/^https?:\/\//, '').split('/')[0];
    }
  }

  function domainMatches(currentHost, targetHostOrUrl) {
    const current = normalizeHost(currentHost);
    const target = normalizeHost(targetHostOrUrl);
    if (!current || !target) return false;
    return current === target || current.endsWith(`.${target}`) || target.endsWith(`.${current}`);
  }

  chrome.runtime.onMessage.addListener((msg) => {
    if (msg.type === 'PLAY_TTS_AUDIO') {
      playTtsAudio(msg.payload);
      return;
    }

    if (msg.type === 'TTS_ERROR') {
      const fallbackSpoke = speakWithBrowserTts(msg?.payload?.text || '');
      showTtsToast(fallbackSpoke ? 'ElevenLabs unavailable. Used local voice fallback.' : (msg?.payload?.message || 'Read Aloud failed.'), !fallbackSpoke);
      return;
    }

    if (msg.type === 'PLAY_TTS_FALLBACK') {
      const fallbackSpoke = speakWithBrowserTts(msg?.payload?.text || '');
      showTtsToast(fallbackSpoke ? 'Reading with local voice fallback.' : 'Fallback voice unavailable.', !fallbackSpoke);
      return;
    }

    if (msg.type === 'AUTOFILL_USERNAME_ONLY') {
      const ok = fillUsernameOnly(msg?.payload?.username || '');
      if (!ok) showTtsToast('Could not locate email/username field on this page.', true);
      return;
    }

    if (msg.type === 'AUTOFILL_EXECUTE_FINAL') {
      const { payload } = msg;
      const pageHost = location.hostname.toLowerCase();
      if (payload?.url && !domainMatches(pageHost, payload.url)) {
        showTtsToast('Autofill warning: credential domain differs from this page.', true);
      }
      if (location.protocol === 'http:' && pageHost !== 'localhost' && pageHost !== '127.0.0.1') {
        showTtsToast('Autofill warning: this page is not HTTPS.', true);
      }
      const allInputs = Array.from(document.querySelectorAll('input'));
      
      let passwordField = findPasswordField(allInputs, 'login');
      let userField = findUsernameField(allInputs, passwordField);
      if (!passwordField) {
        const fallbackPassword = allInputs.find((i) => i.type === 'password' && !i.disabled && !i.readOnly);
        if (fallbackPassword) passwordField = fallbackPassword;
      }
      if (!userField) {
        const fallbackUser = allInputs.find((i) =>
          !i.disabled &&
          !i.readOnly &&
          (i.type === 'email' || i.type === 'text' || i.autocomplete === 'username' || i.autocomplete === 'email')
        );
        if (fallbackUser) userField = fallbackUser;
      }

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
      if (!userField && !passwordField) {
        showTtsToast('Autofill failed: no compatible login fields detected.', true);
      }
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

    if (msg.type === 'PING_BRIDGE') {
      return;
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
  let lastSavePromptAt = 0;

  function maybeShowSavePrompt(username, password) {
    const now = Date.now();
    if (!password || password.length < 8) return;
    if (savePromptShown) return;
    if (now - lastSavePromptAt < 7000) return;
    detectedCredentials = { username: username || '', password, url: location.hostname };
    lastSavePromptAt = now;
    showSavePrompt();
  }

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
        setTimeout(() => {
          if (document.activeElement !== passField) hidePasswordMeter();
        }, 50);
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

      passField.addEventListener('focus', () => renderPasswordMeter(passField));
      passField.addEventListener('input', () => {
        gpLastPasswordField = passField;
        gpLastForm = form || passField.closest('form') || null;
        renderPasswordMeter(passField);
        const allInputs = form ? Array.from(form.querySelectorAll('input')) : Array.from(document.querySelectorAll('input'));
        const userField = findUsernameField(allInputs, passField);
        maybeShowSavePrompt(userField?.value || '', passField.value || '');
      });
      passField.addEventListener('change', () => {
        const allInputs = form ? Array.from(form.querySelectorAll('input')) : Array.from(document.querySelectorAll('input'));
        const userField = findUsernameField(allInputs, passField);
        gpLastPasswordField = passField;
        gpLastForm = form || passField.closest('form') || null;
        maybeShowSavePrompt(userField?.value || '', passField.value || '');
      });
      passField.addEventListener('keydown', (ev) => {
        if (ev.key !== 'Enter') return;
        const allInputs = form ? Array.from(form.querySelectorAll('input')) : Array.from(document.querySelectorAll('input'));
        const userField = findUsernameField(allInputs, passField);
        gpLastPasswordField = passField;
        gpLastForm = form || passField.closest('form') || null;
        maybeShowSavePrompt(userField?.value || '', passField.value || '');
      });
    });
  }

  function handleCredentialCapture(form, passField) {
    const allInputs = form ? Array.from(form.querySelectorAll('input')) : Array.from(document.querySelectorAll('input'));
    const userField = findUsernameField(allInputs, passField);

    const username = userField?.value || '';
    const password = passField?.value || '';
    gpLastPasswordField = passField;
    gpLastForm = form || passField?.closest('form') || null;
    
    maybeShowSavePrompt(username, password);
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
          <p style="font-size:13px;font-weight:700;color:#f1f5f9;margin:0 0 4px">Save password or use a stronger one?</p>
          <p style="font-size:10px;color:#64748b;margin:0 0 16px;font-family:monospace">${detectedCredentials.username || 'unknown-user'} @ ${detectedCredentials.url}</p>
          <div style="display:flex;gap:8px;flex-wrap:wrap">
            <button id="gp-save-yes" style="flex:1;padding:12px;background:#10b981;color:white;border:none;border-radius:12px;font-size:11px;font-weight:800;cursor:pointer;letter-spacing:0.05em;min-width:98px">SAVE TO VAULT</button>
            <button id="gp-save-suggest" style="flex:1;padding:12px;background:#6366f1;color:white;border:none;border-radius:12px;font-size:11px;font-weight:800;cursor:pointer;letter-spacing:0.05em;min-width:98px">SUGGEST STRONG</button>
            <button id="gp-save-no" style="flex:1;padding:12px;background:#1e293b;color:#94a3b8;border:1px solid #334155;border-radius:12px;font-size:11px;font-weight:800;cursor:pointer;min-width:98px">DISMISS</button>
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
    const suggestBtn = document.getElementById('gp-save-suggest');
    if (suggestBtn) {
      suggestBtn.onclick = () => {
        const generated = generateStrongPassword(18);
        const active = document.activeElement;
        const targetField = gpLastPasswordField || (active && active.tagName === 'INPUT' && active.type === 'password' ? active : null);
        const targetForm = gpLastForm || (targetField && targetField.closest ? targetField.closest('form') : null);
        applySuggestedPassword(targetForm, targetField, generated);
        detectedCredentials.password = generated;
        const statusEl = banner.querySelector('div > div:last-child');
        if (statusEl) {
          statusEl.innerHTML = '<p style="text-align:center;padding:8px;color:#818cf8;font-size:11px;font-weight:800">✓ STRONG PASSWORD APPLIED</p>';
        }
        setTimeout(() => { banner.remove(); savePromptShown = false; }, 1400);
      };
    }
  }

  detectPasswordFields();
  const observer = new MutationObserver(() => detectPasswordFields());
  observer.observe(document.body, { childList: true, subtree: true });
  window.addEventListener('scroll', () => {
    if (gpPasswordMeterField) renderPasswordMeter(gpPasswordMeterField);
  }, { passive: true });
  window.addEventListener('resize', () => {
    if (gpPasswordMeterField) renderPasswordMeter(gpPasswordMeterField);
  });

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
