const mainScreen = document.getElementById('mainScreen');
const chatScreen = document.getElementById('chatScreen');
const askAiBtn = document.getElementById('askAiBtn');
const dashBtn = document.getElementById('dashBtn');
const list = document.getElementById('list');
const auditIndicator = document.getElementById('auditIndicator');
const auditDomain = document.getElementById('auditDomain');
const itemUrl = document.getElementById('itemUrl');
const itemPhish = document.getElementById('itemPhish');
const statusBadge = document.getElementById('statusBadge');

const chatBackBtn = document.getElementById('chatBackBtn');
const chatMessages = document.getElementById('chatMessages');
const chatInput = document.getElementById('chatInput');
const chatSendBtn = document.getElementById('chatSendBtn');
const chatPageTitle = document.getElementById('chatPageTitle');
const chatPageUrl = document.getElementById('chatPageUrl');
const quickPrompts = document.getElementById('quickPrompts');

const tabPasswords = document.getElementById('tabPasswords');
const tabIdentities = document.getElementById('tabIdentities');

let currentTab = 'passwords';
let cachedData = { passwords: [], identities: [] };
let pageContext = null;
let isSending = false;

function applyUiSettings(uiSettings = {}) {
  const accent = typeof uiSettings.accentColor === 'string' && uiSettings.accentColor ? uiSettings.accentColor : '#10b981';
  const brand = typeof uiSettings.brandColor === 'string' && uiSettings.brandColor ? uiSettings.brandColor : accent;
  const bg = typeof uiSettings.bgColor === 'string' && uiSettings.bgColor ? uiSettings.bgColor : '#020617';
  const uiScale = Number(uiSettings.uiScale || 100);
  const accessibilityMode = !!uiSettings.accessibilityMode;
  const effectiveScale = accessibilityMode ? Math.max(uiScale, 118) : uiScale;
  document.documentElement.style.setProperty('--gp-accent', accent);
  document.documentElement.style.setProperty('--gp-brand', brand);
  document.documentElement.style.setProperty('--gp-bg', bg);
  document.documentElement.style.setProperty('--gp-accent-soft', `${accent}24`);
  document.body.style.fontSize = `${effectiveScale}%`;
}

if (chrome.storage?.onChanged) {
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== 'local' || !changes.uiSettings) return;
    applyUiSettings(changes.uiSettings.newValue || {});
  });
}

function normalizeHost(value) {
  if (!value) return '';
  try {
    return new URL(value).hostname.toLowerCase();
  } catch {
    return String(value).toLowerCase().replace(/^https?:\/\//, '').split('/')[0];
  }
}

function domainMatches(currentHost, savedUrl) {
  const targetHost = normalizeHost(savedUrl);
  if (!currentHost || !targetHost) return false;
  return currentHost === targetHost || currentHost.endsWith(`.${targetHost}`) || targetHost.endsWith(`.${currentHost}`);
}

init();

async function init() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab) return;

  chrome.storage.local.get(['uiSettings'], (res) => {
    applyUiSettings(res.uiSettings || {});
  });

  chrome.runtime.sendMessage({ type: 'REQUEST_UI_SETTINGS' }, () => {
    setTimeout(() => {
      chrome.storage.local.get(['uiSettings'], (res) => {
        applyUiSettings(res.uiSettings || {});
      });
    }, 500);
  });

  runAudit(tab);

  chrome.storage.local.get(['vault'], (res) => {
    if (res.vault) {
      cachedData.passwords = res.vault.passwords || [];
      cachedData.identities = res.vault.identities || [];
    }
    renderList();
    if (!cachedData.passwords.length && !cachedData.identities.length) {
      chrome.runtime.sendMessage({ type: 'REQUEST_VAULT_SYNC' }, () => {
        setTimeout(() => {
          chrome.storage.local.get(['vault'], (fresh) => {
            if (fresh.vault) {
              cachedData.passwords = fresh.vault.passwords || [];
              cachedData.identities = fresh.vault.identities || [];
              renderList();
            }
          });
        }, 900);
      });
    }
  });
}

function runAudit(tab) {
  try {
    const url = new URL(tab.url);
    auditDomain.innerText = url.hostname;
    const isHttps = url.protocol === 'https:';
    itemUrl.className = `audit-item ${isHttps ? 'ok' : 'fail'}`;
    itemUrl.innerText = isHttps ? '✓ Protocol Secured (HTTPS)' : '✗ Insecure Protocol (HTTP)';
    
    const brands = ['google', 'paypal', 'facebook', 'amazon', 'microsoft', 'apple', 'netflix'];
    const hostname = url.hostname.toLowerCase();
    const isSuspicious = brands.some(brand => hostname.includes(brand) && !hostname.endsWith(brand + ".com") && !hostname.endsWith(brand + ".org") && !hostname.includes("." + brand + "."));
    
    itemPhish.className = `audit-item ${isSuspicious ? 'fail' : 'ok'}`;
    itemPhish.innerText = isSuspicious ? '✗ Typosquatting Risk Detected' : '✓ Domain Verified Authentic';
    auditIndicator.className = `audit-indicator ${isSuspicious || !isHttps ? 'indicator-danger' : 'indicator-safe'}`;
    statusBadge.innerText = isSuspicious ? 'THREAT DETECTED' : 'SHIELD ACTIVE';
    const accent = getComputedStyle(document.documentElement).getPropertyValue('--gp-accent').trim() || '#10b981';
    const accentSoft = getComputedStyle(document.documentElement).getPropertyValue('--gp-accent-soft').trim() || 'rgba(16,185,129,0.1)';
    statusBadge.style.color = isSuspicious ? '#ef4444' : accent;
    statusBadge.style.background = isSuspicious ? 'rgba(239,68,68,0.1)' : accentSoft;
    statusBadge.style.borderColor = isSuspicious ? 'rgba(239,68,68,0.2)' : `${accent}55`;
  } catch (e) {
    auditDomain.innerText = 'System Page';
    auditIndicator.className = 'audit-indicator indicator-safe';
  }
}

async function renderList() {
  list.innerHTML = '';
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  let currentDomain = '';
  try { currentDomain = tab ? new URL(tab.url).hostname : ''; } catch(e) {}

  const data = currentTab === 'passwords' ? cachedData.passwords : cachedData.identities;
  
  if (!data || data.length === 0) {
    list.innerHTML = `<div class="empty-state">
      <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#334155" stroke-width="1.5" style="margin:0 auto 12px;display:block"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0110 0v4"></path></svg>
      <p>Vault is empty. Add items in the dashboard.</p>
    </div>`;
    return;
  }

  const matchingFirst = currentTab === 'passwords' 
    ? [...data].sort((a, b) => {
        const aMatch = currentDomain && a.url && domainMatches(currentDomain, a.url);
        const bMatch = currentDomain && b.url && domainMatches(currentDomain, b.url);
        return (bMatch ? 1 : 0) - (aMatch ? 1 : 0);
      })
    : data;

  matchingFirst.forEach(item => {
    const el = document.createElement('div');
    el.className = 'list-item';
    const isMatch = currentTab === 'passwords' && currentDomain && item.url && domainMatches(currentDomain, item.url);
    
    if (isMatch) el.style.borderColor = 'rgba(16, 185, 129, 0.3)';

    el.innerHTML = `
      <div style="min-width: 0; flex:1;">
        <h4>${currentTab === 'passwords' ? item.name : item.label}</h4>
        <p>${currentTab === 'passwords' ? item.username : item.email}</p>
      </div>
      ${currentTab === 'passwords' ? `<div class="autofill-btn">${isMatch ? '⚡ AUTOFILL' : 'FILL'}</div>` : ''}
    `;
    
    if (currentTab === 'passwords') {
      el.onclick = async () => {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        if (tab?.id && item?.username) {
          chrome.tabs.sendMessage(tab.id, {
            type: 'AUTOFILL_USERNAME_ONLY',
            payload: { username: item.username }
          }).catch(() => {});

          // Fallback for sites like Google where content-script message timing can fail.
          chrome.scripting.executeScript({
            target: { tabId: tab.id, allFrames: true },
            func: (username) => {
              const selectors = [
                '#identifierId',
                'input[type="email"]',
                'input[name="identifier"]',
                'input[name="email"]',
                'input[autocomplete="username"]',
                'input[autocomplete="email"]',
                'input[type="text"]'
              ];
              const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')?.set;
              for (const sel of selectors) {
                const field = document.querySelector(sel);
                if (!field || field.disabled || field.readOnly) continue;
                if (setter) setter.call(field, username);
                else field.value = username;
                field.dispatchEvent(new Event('input', { bubbles: true }));
                field.dispatchEvent(new Event('change', { bubbles: true }));
                const nextBtn = document.querySelector('#identifierNext button, #identifierNext, button[jsname=\"LgbsSe\"]');
                if (nextBtn && typeof nextBtn.click === 'function') {
                  setTimeout(() => nextBtn.click(), 120);
                }
                return true;
              }
              return false;
            },
            args: [item.username]
          }).catch(() => {});
        }
        chrome.runtime.sendMessage({
          type: 'AUTOFILL_TRIGGER',
          tabId: tab.id,
          payload: { id: item.id, url: item.url, username: item.username, password: item.password }
        });
        window.close();
      };
    }
    list.appendChild(el);
  });
}

tabPasswords.onclick = () => {
  currentTab = 'passwords';
  tabPasswords.classList.add('active');
  tabIdentities.classList.remove('active');
  renderList();
};

tabIdentities.onclick = () => {
  currentTab = 'identities';
  tabIdentities.classList.add('active');
  tabPasswords.classList.remove('active');
  renderList();
};

askAiBtn.onclick = async () => {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab || !tab.id) return;

  try {
    const url = new URL(tab.url);
    if (url.protocol === 'chrome:' || url.protocol === 'chrome-extension:' || url.protocol === 'about:') {
      addChatMessage('This is a browser system page — AI can\'t read its content. Try navigating to a website first.', 'error');
      showChat(tab.title || 'System Page', tab.url || '');
      return;
    }
  } catch(e) {}

  chatPageTitle.textContent = tab.title || 'Unknown Page';
  chatPageUrl.textContent = tab.url ? new URL(tab.url).hostname : '';

  mainScreen.style.display = 'none';
  chatScreen.style.display = 'flex';
  chatScreen.classList.add('active');
  chatMessages.innerHTML = '';
  quickPrompts.style.display = 'flex';

  addChatMessage('Scanning page content...', 'system');

  try {
    const [result] = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: () => {
        const bodyText = (document.body?.innerText || '').replace(/\s+/g, ' ').trim();
        const description = document.querySelector('meta[name="description"]')?.getAttribute('content') || '';
        const headings = Array.from(document.querySelectorAll('h1, h2'))
          .map((el) => (el.textContent || '').replace(/\s+/g, ' ').trim())
          .filter(Boolean)
          .slice(0, 8);

        return {
          url: location.href,
          title: document.title || 'Untitled',
          description,
          headings,
          text: bodyText.slice(0, 12000)
        };
      }
    });

    if (result && result.result) {
      pageContext = result.result;
      chatMessages.innerHTML = '';
      addChatMessage(`Ready to answer questions about "${pageContext.title}"`, 'system');
    } else {
      chatMessages.innerHTML = '';
      addChatMessage('Could not read page content. The page may be restricted.', 'error');
    }
  } catch (err) {
    chatMessages.innerHTML = '';
    addChatMessage('Could not access this page. It may be a protected browser page.', 'error');
    pageContext = { url: tab.url, title: tab.title, text: '', description: '', headings: [] };
  }

  chatInput.focus();
};

function showChat(title, url) {
  mainScreen.style.display = 'none';
  chatScreen.style.display = 'flex';
  chatScreen.classList.add('active');
  chatPageTitle.textContent = title;
  try { chatPageUrl.textContent = new URL(url).hostname; } catch(e) { chatPageUrl.textContent = url; }
}

chatBackBtn.onclick = () => {
  chatScreen.style.display = 'none';
  chatScreen.classList.remove('active');
  mainScreen.style.display = 'flex';
  pageContext = null;
  isSending = false;
};

function addChatMessage(text, type) {
  const div = document.createElement('div');
  div.className = `chat-msg ${type}`;
  div.textContent = text;
  chatMessages.appendChild(div);
  chatMessages.scrollTop = chatMessages.scrollHeight;
  return div;
}

function normalizeQuestion(input) {
  return String(input || '').replace(/\s+/g, ' ').trim().slice(0, 1200);
}

function showTyping() {
  const div = document.createElement('div');
  div.className = 'typing-indicator';
  div.id = 'typingIndicator';
  div.innerHTML = '<div class="typing-dot"></div><div class="typing-dot"></div><div class="typing-dot"></div>';
  chatMessages.appendChild(div);
  chatMessages.scrollTop = chatMessages.scrollHeight;
}

function hideTyping() {
  const el = document.getElementById('typingIndicator');
  if (el) el.remove();
}

async function sendMessage(text) {
  const normalizedQuestion = normalizeQuestion(text);
  if (!normalizedQuestion || isSending) return;
  if (!pageContext) {
    addChatMessage('No page content available. Go back and try again on a website.', 'error');
    return;
  }

  isSending = true;
  chatSendBtn.disabled = true;
  chatInput.disabled = true;
  quickPrompts.style.display = 'none';

  addChatMessage(normalizedQuestion, 'user');
  showTyping();

  const timeoutId = setTimeout(() => {
    hideTyping();
    addChatMessage('The request is taking longer than expected. The AI engine may still be loading — please try again.', 'error');
    isSending = false;
    chatSendBtn.disabled = false;
    chatInput.disabled = false;
  }, 30000);

  chrome.runtime.sendMessage({
    type: 'GEMINI_CHAT_REQUEST',
    payload: {
      contents: normalizedQuestion,
      page: {
        url: pageContext.url,
        title: pageContext.title,
        text: pageContext.text,
        description: pageContext.description,
        headings: pageContext.headings
      }
    }
  }, (response) => {
    clearTimeout(timeoutId);
    hideTyping();
    isSending = false;
    chatSendBtn.disabled = false;
    chatInput.disabled = false;

    if (chrome.runtime.lastError) {
      addChatMessage('Connection error. Please try again in a moment.', 'error');
      return;
    }

    if (response && response.text) {
      addChatMessage(response.text, 'bot');
    } else {
      addChatMessage('No response received. Please try again.', 'error');
    }

    chatInput.focus();
  });

  chatInput.value = '';
}

chatSendBtn.onclick = () => sendMessage(chatInput.value);

chatInput.onkeydown = (e) => {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    sendMessage(chatInput.value);
  }
};

document.querySelectorAll('.quick-prompt').forEach(btn => {
  btn.onclick = () => sendMessage(btn.dataset.prompt);
});

dashBtn.onclick = async () => {
  const tabs = await chrome.tabs.query({});
  const dashTab = tabs.find(t => 
    (t.url && (t.url.includes("localhost") || t.url.includes("guardiapass") || t.url.includes("replit"))) || 
    (t.title && t.title.includes("GuardiaPass"))
  );
  if (dashTab) {
    chrome.tabs.update(dashTab.id, { active: true });
  } else {
    chrome.tabs.create({ url: 'https://guardiapass.replit.app' });
  }
  window.close();
};
