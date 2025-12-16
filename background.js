// Logica para trackear navegacion

// Estado para trackear el tiempo
let currentTabId = null;
let currentUrl = null;
let startTime = null;

// Inicializar o cargar datos existentes
async function initializeStorage() {
  const result = await chrome.storage.local.get(['siteStats']);
  if (!result.siteStats) {
    await chrome.storage.local.set({ siteStats: {} });
  }
}

// Extraer dominio limpio de una URL
function getDomain(url) {
  try {
    const urlObj = new URL(url);
    return urlObj.hostname.replace('www.', '');
  } catch {
    return null;
  }
}

// Guardar tiempo gastado en un sitio
async function saveTimeSpent(url, timeSpent) {
  const domain = getDomain(url);
  if (!domain || domain === 'newtab' || domain === '') return;

  const result = await chrome.storage.local.get(['siteStats']);
  const siteStats = result.siteStats || {};

  if (!siteStats[domain]) {
    siteStats[domain] = {
      domain: domain,
      visits: 0,
      totalTime: 0,
      lastVisit: Date.now()
    };
  }

  siteStats[domain].visits += 1;
  siteStats[domain].totalTime += timeSpent;
  siteStats[domain].lastVisit = Date.now();

  await chrome.storage.local.set({ siteStats });
}

// Cuando el usuario cambia de tab
chrome.tabs.onActivated.addListener(async (activeInfo) => {
  // Guardar tiempo del tab anterior
  if (currentUrl && startTime) {
    const timeSpent = Date.now() - startTime;
    await saveTimeSpent(currentUrl, timeSpent);
  }

  // Obtener info del nuevo tab
  const tab = await chrome.tabs.get(activeInfo.tabId);
  currentTabId = activeInfo.tabId;
  currentUrl = tab.url;
  startTime = Date.now();
});

// Cuando se actualiza un tab (cambio de URL)
chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  if (tabId === currentTabId && changeInfo.url) {
    // Guardar tiempo del URL anterior
    if (currentUrl && startTime) {
      const timeSpent = Date.now() - startTime;
      await saveTimeSpent(currentUrl, timeSpent);
    }

    // Nuevo URL
    currentUrl = changeInfo.url;
    startTime = Date.now();
  }
});

// Cuando se cierra una ventana o el navegador
chrome.windows.onRemoved.addListener(async () => {
  if (currentUrl && startTime) {
    const timeSpent = Date.now() - startTime;
    await saveTimeSpent(currentUrl, timeSpent);
  }
});

// Inicializar cuando se instala la extension
chrome.runtime.onInstalled.addListener(() => {
  initializeStorage();
  console.log('BrowserRewind instalado! 🎉');
});

// Inicializar al cargar
initializeStorage();