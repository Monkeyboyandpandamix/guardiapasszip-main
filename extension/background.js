let visitCache = [];
const pendingRequests = new Map();
const READ_ALOUD_MENU_ID = 'gp_read_aloud';
const ELEVENLABS_ENDPOINT_PATH = '/api/tts/elevenlabs';

const hunterQueue = [];
const hunterPending = new Map();
let hunterProcessing = false;

async function processHunterQueue() {
  if (hunterProcessing || hunterQueue.length === 0) return;
  hunterProcessing = true;

  while (hunterQueue.length > 0) {
    const item = hunterQueue.shift();
    hunterPending.set(item.correlationId, item);

    setTimeout(() => {
      if (hunterPending.has(item.correlationId)) {
        hunterPending.delete(item.correlationId);
        try { item.sendResponse({ result: null, error: 'Timeout' }); } catch(e) {}
      }
    }, 15000);

    const dash = await findDashboardTab();
    if (dash) {
      chrome.tabs.sendMessage(dash.id, {
        source: 'guardiapass_extension',
        type: 'HUNTER_VERIFY_REQUEST',
        payload: item.payload,
        correlationId: item.correlationId,
        traceId: item.traceId
      }).catch(() => {
        hunterPending.delete(item.correlationId);
        try { item.sendResponse({ result: null, error: 'Bridge failed' }); } catch(e) {}
      });
    } else {
      hunterPending.delete(item.correlationId);
      try { item.sendResponse({ result: null, error: 'Dashboard not open' }); } catch(e) {}
    }

    await new Promise(r => setTimeout(r, 150));
  }

  hunterProcessing = false;
}

let lastKnownDashUrl = null;

function guessApiOrigins() {
  const origins = [];
  if (lastKnownDashUrl) {
    try {
      origins.push(new URL(lastKnownDashUrl).origin);
    } catch (e) {}
  }
  origins.push('http://localhost:5000');
  origins.push('http://localhost:3001');
  origins.push('https://guardiapass.replit.app');
  return Array.from(new Set(origins));
}

async function resolveApiOrigins() {
  const origins = new Set(guessApiOrigins());
  try {
    const dash = await findDashboardTab();
    if (dash?.url) {
      origins.add(new URL(dash.url).origin);
    }
  } catch (e) {}
  return Array.from(origins);
}

async function fetchTtsAudioBase64(text) {
  const origins = await resolveApiOrigins();
  let lastErr = null;
  for (const origin of origins) {
    try {
      const response = await fetch(`${origin}${ELEVENLABS_ENDPOINT_PATH}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text }),
      });
      if (!response.ok) {
        const errorText = await response.text().catch(() => '');
        throw new Error(errorText || `TTS request failed (${response.status})`);
      }
      const payload = await response.json();
      if (!payload?.audioBase64) throw new Error('Invalid TTS response payload');
      return payload;
    } catch (err) {
      lastErr = err;
    }
  }
  throw lastErr || new Error('No reachable API origin for TTS');
}

function ensureReadAloudMenu() {
  chrome.contextMenus.removeAll(() => {
    chrome.contextMenus.create({
      id: READ_ALOUD_MENU_ID,
      title: 'Read Aloud with GuardiaPass',
      contexts: ['selection'],
    });
  });
}

ensureReadAloudMenu();

chrome.runtime.onInstalled.addListener(() => {
  ensureReadAloudMenu();
});

chrome.runtime.onStartup.addListener(() => {
  ensureReadAloudMenu();
});

chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (info.menuItemId !== READ_ALOUD_MENU_ID) return;
  const selectedText = (info.selectionText || '').trim();
  if (!selectedText || !tab?.id) return;

  try {
    const result = await fetchTtsAudioBase64(selectedText.slice(0, 1200));
    chrome.tabs.sendMessage(tab.id, {
      type: 'PLAY_TTS_AUDIO',
      payload: {
        audioBase64: result.audioBase64,
        mimeType: result.mimeType || 'audio/mpeg',
        text: selectedText.slice(0, 280),
      },
    }).catch(() => {});
  } catch (err) {
    chrome.tabs.sendMessage(tab.id, {
      type: 'PLAY_TTS_FALLBACK',
      payload: {
        text: selectedText.slice(0, 1200),
        reason: (err && err.message) ? err.message : 'ElevenLabs unavailable'
      },
    }).catch(() => {});
    chrome.tabs.sendMessage(tab.id, {
      type: 'TTS_ERROR',
      payload: { message: `ElevenLabs unavailable. Switched to local voice. ${(err && err.message) ? err.message : ''}`.trim(), text: selectedText.slice(0, 1200) },
    }).catch(() => {});
  }
});

async function findDashboardTab() {
  const tabs = await chrome.tabs.query({});
  const found = tabs.find(t => 
    (t.url && (t.url.includes("localhost") || t.url.includes("127.0.0.1") || t.url.includes("guardiapass") || t.url.includes("replit"))) || 
    (t.title && t.title.includes("GuardiaPass"))
  );
  if (found && found.url) lastKnownDashUrl = found.url;
  return found;
}

async function ensureDashboardOpen() {
  let dash = await findDashboardTab();
  if (dash) {
    lastKnownDashUrl = dash.url;
    return dash;
  }

  const candidates = [];
  if (lastKnownDashUrl) candidates.push(lastKnownDashUrl);
  candidates.push('https://guardiapass.replit.app');
  candidates.push('http://localhost:5000');

  for (const url of candidates) {
    try {
      const tab = await chrome.tabs.create({ url, active: false });

      for (let i = 0; i < 15; i++) {
        await new Promise(r => setTimeout(r, 1000));
        try {
          const updatedTab = await chrome.tabs.get(tab.id);
          if (updatedTab.status === 'complete') {
            await new Promise(r => setTimeout(r, 2500));
            const verifiedDash = await findDashboardTab();
            if (verifiedDash) {
              lastKnownDashUrl = verifiedDash.url;
              return verifiedDash;
            }
            return updatedTab;
          }
        } catch(e) {
          break;
        }
      }
    } catch(e) {
      continue;
    }
  }

  return null;
}

setInterval(async () => {
  if (visitCache.length === 0) return;
  const dash = await findDashboardTab();
  if (dash) {
    chrome.tabs.sendMessage(dash.id, { 
      source: 'guardiapass_extension', 
      type: 'VISIT_BATCH', 
      payload: visitCache,
      traceId: Math.random().toString(36).substr(2, 5)
    }).catch(() => {});
    visitCache = [];
  }
}, 2000);

chrome.webNavigation.onCompleted.addListener((details) => {
  if (details.frameId !== 0) return;
  try {
    const url = new URL(details.url);
    if (url.protocol === 'chrome:' || url.protocol === 'chrome-extension:') return;
    
    const brands = ['google', 'paypal', 'facebook', 'amazon', 'microsoft', 'apple', 'netflix'];
    const hostname = url.hostname.toLowerCase();
    const isSuspicious = brands.some(brand => 
      hostname.includes(brand) && 
      !hostname.endsWith(brand + ".com") && 
      !hostname.endsWith(brand + ".org") && 
      !hostname.includes("." + brand + ".")
    );

    visitCache.push({
      id: Math.random().toString(36).substr(2, 8),
      url: details.url,
      timestamp: Date.now(),
      isThreat: isSuspicious
    });

    if (isSuspicious) {
      chrome.tabs.update(details.tabId, { 
        url: chrome.runtime.getURL('blocked.html') 
      });
    }
  } catch (e) {}
});

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  const traceId = Math.random().toString(36).substr(2, 5);

  if (request.type === 'AUTOFILL_TRIGGER') {
    findDashboardTab().then(dash => {
      if (dash) {
        chrome.tabs.sendMessage(dash.id, { 
          source: 'guardiapass_extension', 
          type: 'REQUEST_DECRYPT_FOR_AUTOFILL', 
          payload: request.payload,
          targetTabId: request.tabId,
          traceId
        });
        sendResponse({ status: 'relayed', traceId });
      } else {
        sendResponse({ status: 'error', msg: 'Dashboard not open' });
      }
    });
    return true;
  }

  if (request.type === 'SAVE_CREDENTIAL') {
    findDashboardTab().then(dash => {
      if (dash) {
        chrome.tabs.sendMessage(dash.id, { 
          source: 'guardiapass_extension', 
          type: 'SAVE_CREDENTIAL', 
          payload: request.payload,
          traceId
        });
        sendResponse({ status: 'saved', traceId });
      } else {
        chrome.storage.local.get(['pendingCredentials'], (res) => {
          const pending = res.pendingCredentials || [];
          pending.push(request.payload);
          chrome.storage.local.set({ pendingCredentials: pending });
          sendResponse({ status: 'queued', traceId });
        });
      }
    });
    return true;
  }

  if (request.type === 'DECRYPTED_DATA_REPLY') {
    if (request.targetTabId) {
      chrome.tabs.sendMessage(request.targetTabId, {
        type: 'AUTOFILL_EXECUTE_FINAL',
        payload: request.payload,
        traceId: request.traceId
      });
    }
    return false;
  }

  if (request.type === 'HUNTER_VERIFY_REQUEST') {
    const correlationId = request.correlationId || request.payload.email;
    const senderTabId = sender.tab?.id;
    
    hunterQueue.push({ payload: request.payload, correlationId, traceId, senderTabId, sendResponse });
    processHunterQueue();
    return true;
  }

  if (request.type === 'HUNTER_RESULT_RELAY') {
    const queued = hunterPending.get(request.correlationId);
    if (queued) {
      hunterPending.delete(request.correlationId);
      if (queued.sendResponse) {
        try { queued.sendResponse({ result: request.payload }); } catch(e) {}
      }
      if (queued.senderTabId) {
        chrome.tabs.sendMessage(queued.senderTabId, {
          type: 'HUNTER_VERIFY_RESPONSE',
          payload: request.payload,
          correlationId: request.correlationId
        }).catch(() => {});
      }
    }
    return false;
  }

  if (request.type === 'GEMINI_CHAT_REQUEST') {
    const correlationId = request.correlationId || Math.random().toString(36).substr(2, 5);
    pendingRequests.set(correlationId, sendResponse);
    
    findDashboardTab().then(async (dash) => {
      if (!dash) {
        dash = await ensureDashboardOpen();
      }
      if (dash) {
        const sendWithRetry = async (attempts) => {
          for (let i = 0; i < attempts; i++) {
            try {
              await chrome.tabs.sendMessage(dash.id, { ...request, correlationId, traceId, source: 'guardiapass_extension' });
              return true;
            } catch(e) {
              if (i < attempts - 1) await new Promise(r => setTimeout(r, 2000));
            }
          }
          return false;
        };
        const sent = await sendWithRetry(3);
        if (!sent) {
          const responder = pendingRequests.get(correlationId);
          if (responder) {
            responder({ text: "Could not connect to the AI engine. Please try again in a moment." });
            pendingRequests.delete(correlationId);
          }
        }
      } else {
        const responder = pendingRequests.get(correlationId);
        if (responder) {
           responder({ text: "Could not start the AI engine. Please open the GuardiaPass Dashboard and try again." });
           pendingRequests.delete(correlationId);
        }
      }
    });
    return true;
  }

  if (request.type === 'PAGE_CONTENT_FOR_ADVISOR') {
    findDashboardTab().then(dash => {
      if (dash) {
        chrome.tabs.sendMessage(dash.id, {
          source: 'guardiapass_extension',
          type: 'PAGE_CONTENT_FOR_ADVISOR',
          payload: request.payload,
          traceId
        });
        sendResponse({ status: 'sent' });
      } else {
        sendResponse({ status: 'error', msg: 'Dashboard not open' });
      }
    });
    return true;
  }

  if (request.type === 'AI_RESPONSE_RELAY') {
    const responder = pendingRequests.get(request.correlationId);
    if (responder) {
      responder({ text: request.text });
      pendingRequests.delete(request.correlationId);
    }
    return false;
  }

  if (request.type === 'REQUEST_VAULT_SYNC') {
    findDashboardTab().then(async (dash) => {
      if (!dash) dash = await ensureDashboardOpen();
      if (dash) {
        chrome.tabs.sendMessage(dash.id, {
          source: 'guardiapass_extension',
          type: 'REQUEST_VAULT_SNAPSHOT',
          traceId
        }).catch(() => {});
        sendResponse({ status: 'requested', traceId });
      } else {
        sendResponse({ status: 'error', msg: 'Dashboard not open' });
      }
    });
    return true;
  }

  if (request.type === 'REQUEST_UI_SETTINGS') {
    findDashboardTab().then(async (dash) => {
      if (!dash) dash = await ensureDashboardOpen();
      if (dash) {
        chrome.tabs.sendMessage(dash.id, {
          source: 'guardiapass_extension',
          type: 'REQUEST_UI_SETTINGS',
          traceId
        }).catch(() => {});
        sendResponse({ status: 'requested', traceId });
      } else {
        sendResponse({ status: 'error', msg: 'Dashboard not open' });
      }
    });
    return true;
  }
});
