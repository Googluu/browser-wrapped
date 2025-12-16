// Importar categorías (en service worker necesitamos importScripts)
importScripts('categories.js');

// Estado para trackear el tiempo
let currentTabId = null;
let currentUrl = null;
let startTime = null;
let openTabs = new Map(); // Trackear tabs abiertos

// Inicializar o cargar datos existentes
async function initializeStorage() {
  const result = await chrome.storage.local.get([
    'siteStats',
    'dailyStats',
    'weeklyStats', 
    'monthlyStats',
    'yearlyStats',
    'categoryStats',
    'hourlyActivity',
    'bookmarkStats',
    'tabStats',
    'firstInstallDate'
  ]);
  
  if (!result.siteStats) await chrome.storage.local.set({ siteStats: {} });
  if (!result.dailyStats) await chrome.storage.local.set({ dailyStats: {} });
  if (!result.weeklyStats) await chrome.storage.local.set({ weeklyStats: {} });
  if (!result.monthlyStats) await chrome.storage.local.set({ monthlyStats: {} });
  if (!result.yearlyStats) await chrome.storage.local.set({ yearlyStats: {} });
  if (!result.categoryStats) await chrome.storage.local.set({ categoryStats: {} });
  if (!result.hourlyActivity) await chrome.storage.local.set({ hourlyActivity: Array(24).fill(0) });
  if (!result.bookmarkStats) await chrome.storage.local.set({ bookmarkStats: {} });
  if (!result.tabStats) await chrome.storage.local.set({ tabStats: { maxTabsOpen: 0, zombieTabs: [] } });
  if (!result.firstInstallDate) await chrome.storage.local.set({ firstInstallDate: Date.now() });
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

// Obtener fecha en formato YYYY-MM-DD
function getDateKey(timestamp = Date.now()) {
  const date = new Date(timestamp);
  return date.toISOString().split('T')[0];
}

// Obtener semana del año
function getWeekKey(timestamp = Date.now()) {
  const date = new Date(timestamp);
  const firstDayOfYear = new Date(date.getFullYear(), 0, 1);
  const pastDaysOfYear = (date - firstDayOfYear) / 86400000;
  const weekNum = Math.ceil((pastDaysOfYear + firstDayOfYear.getDay() + 1) / 7);
  return `${date.getFullYear()}-W${weekNum}`;
}

// Obtener mes en formato YYYY-MM
function getMonthKey(timestamp = Date.now()) {
  const date = new Date(timestamp);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

// Obtener año
function getYearKey(timestamp = Date.now()) {
  return new Date(timestamp).getFullYear().toString();
}

// Obtener hora del día (0-23)
function getHourOfDay(timestamp = Date.now()) {
  return new Date(timestamp).getHours();
}

// Guardar tiempo gastado en un sitio con todas las métricas
async function saveTimeSpent(url, timeSpent) {
  const domain = getDomain(url);
  if (!domain || domain === 'newtab' || domain === '') return;

  const now = Date.now();
  const dateKey = getDateKey(now);
  const weekKey = getWeekKey(now);
  const monthKey = getMonthKey(now);
  const yearKey = getYearKey(now);
  const hour = getHourOfDay(now);
  
  // Categorizar el sitio
  const category = categorizeDomain(domain);

  const result = await chrome.storage.local.get([
    'siteStats',
    'dailyStats',
    'weeklyStats',
    'monthlyStats',
    'yearlyStats',
    'categoryStats',
    'hourlyActivity'
  ]);

  // Actualizar stats generales del sitio
  const siteStats = result.siteStats || {};
  if (!siteStats[domain]) {
    siteStats[domain] = {
      domain: domain,
      visits: 0,
      totalTime: 0,
      lastVisit: now,
      category: category.id,
      categoryName: category.name,
      categoryEmoji: category.emoji
    };
  }
  siteStats[domain].visits += 1;
  siteStats[domain].totalTime += timeSpent;
  siteStats[domain].lastVisit = now;

  // Actualizar stats diarias
  const dailyStats = result.dailyStats || {};
  if (!dailyStats[dateKey]) dailyStats[dateKey] = { sites: {}, totalTime: 0, visits: 0 };
  if (!dailyStats[dateKey].sites[domain]) {
    dailyStats[dateKey].sites[domain] = { visits: 0, time: 0 };
  }
  dailyStats[dateKey].sites[domain].visits += 1;
  dailyStats[dateKey].sites[domain].time += timeSpent;
  dailyStats[dateKey].totalTime += timeSpent;
  dailyStats[dateKey].visits += 1;

  // Actualizar stats semanales
  const weeklyStats = result.weeklyStats || {};
  if (!weeklyStats[weekKey]) weeklyStats[weekKey] = { sites: {}, totalTime: 0, visits: 0 };
  if (!weeklyStats[weekKey].sites[domain]) {
    weeklyStats[weekKey].sites[domain] = { visits: 0, time: 0 };
  }
  weeklyStats[weekKey].sites[domain].visits += 1;
  weeklyStats[weekKey].sites[domain].time += timeSpent;
  weeklyStats[weekKey].totalTime += timeSpent;
  weeklyStats[weekKey].visits += 1;

  // Actualizar stats mensuales
  const monthlyStats = result.monthlyStats || {};
  if (!monthlyStats[monthKey]) monthlyStats[monthKey] = { sites: {}, totalTime: 0, visits: 0 };
  if (!monthlyStats[monthKey].sites[domain]) {
    monthlyStats[monthKey].sites[domain] = { visits: 0, time: 0 };
  }
  monthlyStats[monthKey].sites[domain].visits += 1;
  monthlyStats[monthKey].sites[domain].time += timeSpent;
  monthlyStats[monthKey].totalTime += timeSpent;
  monthlyStats[monthKey].visits += 1;

  // Actualizar stats anuales
  const yearlyStats = result.yearlyStats || {};
  if (!yearlyStats[yearKey]) yearlyStats[yearKey] = { sites: {}, totalTime: 0, visits: 0 };
  if (!yearlyStats[yearKey].sites[domain]) {
    yearlyStats[yearKey].sites[domain] = { visits: 0, time: 0 };
  }
  yearlyStats[yearKey].sites[domain].visits += 1;
  yearlyStats[yearKey].sites[domain].time += timeSpent;
  yearlyStats[yearKey].totalTime += timeSpent;
  yearlyStats[yearKey].visits += 1;

  // Actualizar stats por categoría
  const categoryStats = result.categoryStats || {};
  if (!categoryStats[category.id]) {
    categoryStats[category.id] = {
      name: category.name,
      emoji: category.emoji,
      totalTime: 0,
      visits: 0,
      sites: []
    };
  }
  categoryStats[category.id].totalTime += timeSpent;
  categoryStats[category.id].visits += 1;
  if (!categoryStats[category.id].sites.includes(domain)) {
    categoryStats[category.id].sites.push(domain);
  }

  // Actualizar actividad por hora
  const hourlyActivity = result.hourlyActivity || Array(24).fill(0);
  hourlyActivity[hour] += timeSpent;

  // Guardar todo
  await chrome.storage.local.set({
    siteStats,
    dailyStats,
    weeklyStats,
    monthlyStats,
    yearlyStats,
    categoryStats,
    hourlyActivity
  });
}

// Analizar el historial del navegador (ejecutar al instalar)
async function analyzeHistory() {
  console.log('Analizando historial del navegador...');
  
  // Obtener historial de los últimos 90 días
  const ninetyDaysAgo = Date.now() - (90 * 24 * 60 * 60 * 1000);
  
  const historyItems = await chrome.history.search({
    text: '',
    startTime: ninetyDaysAgo,
    maxResults: 10000
  });

  console.log(`Procesando ${historyItems.length} items del historial...`);

  for (const item of historyItems) {
    if (!item.url) continue;
    
    const domain = getDomain(item.url);
    if (!domain || domain === 'newtab' || domain === '') continue;

    const result = await chrome.storage.local.get(['siteStats']);
    const siteStats = result.siteStats || {};

    if (!siteStats[domain]) {
      const category = categorizeDomain(domain);
      siteStats[domain] = {
        domain: domain,
        visits: 0,
        totalTime: 0,
        lastVisit: item.lastVisitTime || Date.now(),
        category: category.id,
        categoryName: category.name,
        categoryEmoji: category.emoji,
        fromHistory: true
      };
    }

    siteStats[domain].visits += item.visitCount || 1;
    
    await chrome.storage.local.set({ siteStats });
  }

  console.log('Historial analizado!');
}

// Analizar bookmarks
async function analyzeBookmarks() {
  console.log('Analizando bookmarks...');
  
  const bookmarkTree = await chrome.bookmarks.getTree();
  const bookmarks = [];
  
  function traverse(nodes) {
    for (const node of nodes) {
      if (node.url) {
        bookmarks.push({
          url: node.url,
          title: node.title,
          dateAdded: node.dateAdded
        });
      }
      if (node.children) {
        traverse(node.children);
      }
    }
  }
  
  traverse(bookmarkTree);
  
  // Guardar stats de bookmarks
  const bookmarkStats = {};
  
  for (const bookmark of bookmarks) {
    const domain = getDomain(bookmark.url);
    if (!domain) continue;
    
    if (!bookmarkStats[domain]) {
      bookmarkStats[domain] = {
        domain: domain,
        count: 0,
        lastOpened: null,
        neverOpened: true
      };
    }
    bookmarkStats[domain].count += 1;
  }
  
  // Cruzar con historial para ver cuáles se han abierto
  const result = await chrome.storage.local.get(['siteStats']);
  const siteStats = result.siteStats || {};
  
  for (const domain in bookmarkStats) {
    if (siteStats[domain]) {
      bookmarkStats[domain].neverOpened = false;
      bookmarkStats[domain].lastOpened = siteStats[domain].lastVisit;
    }
  }
  
  await chrome.storage.local.set({ bookmarkStats });
  console.log(`${bookmarks.length} bookmarks analizados!`);
}

// Trackear tabs abiertos (tabs zombies)
async function updateTabStats() {
  const tabs = await chrome.tabs.query({});
  const now = Date.now();
  
  // Actualizar map de tabs abiertos
  for (const tab of tabs) {
    if (!openTabs.has(tab.id)) {
      openTabs.set(tab.id, {
        url: tab.url,
        openedAt: now,
        lastActive: tab.active ? now : openTabs.get(tab.id)?.lastActive || now
      });
    } else if (tab.active) {
      const tabInfo = openTabs.get(tab.id);
      tabInfo.lastActive = now;
    }
  }
  
  // Eliminar tabs cerrados
  const openTabIds = new Set(tabs.map(t => t.id));
  for (const tabId of openTabs.keys()) {
    if (!openTabIds.has(tabId)) {
      openTabs.delete(tabId);
    }
  }
  
  // Identificar tabs zombies (abiertos más de 1 hora sin uso)
  const oneHour = 60 * 60 * 1000;
  const zombieTabs = [];
  
  for (const [tabId, tabInfo] of openTabs.entries()) {
    const timeSinceActive = now - tabInfo.lastActive;
    if (timeSinceActive > oneHour) {
      zombieTabs.push({
        domain: getDomain(tabInfo.url),
        openTime: now - tabInfo.openedAt,
        inactiveTime: timeSinceActive
      });
    }
  }
  
  const result = await chrome.storage.local.get(['tabStats']);
  const tabStats = result.tabStats || { maxTabsOpen: 0, zombieTabs: [] };
  
  tabStats.maxTabsOpen = Math.max(tabStats.maxTabsOpen, tabs.length);
  tabStats.currentTabsOpen = tabs.length;
  tabStats.zombieTabs = zombieTabs;
  
  await chrome.storage.local.set({ tabStats });
}

// Event listeners
chrome.tabs.onActivated.addListener(async (activeInfo) => {
  if (currentUrl && startTime) {
    const timeSpent = Date.now() - startTime;
    await saveTimeSpent(currentUrl, timeSpent);
  }

  const tab = await chrome.tabs.get(activeInfo.tabId);
  currentTabId = activeInfo.tabId;
  currentUrl = tab.url;
  startTime = Date.now();
  
  // Actualizar stats de tabs
  await updateTabStats();
});

chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  if (tabId === currentTabId && changeInfo.url) {
    if (currentUrl && startTime) {
      const timeSpent = Date.now() - startTime;
      await saveTimeSpent(currentUrl, timeSpent);
    }

    currentUrl = changeInfo.url;
    startTime = Date.now();
  }
});

chrome.tabs.onRemoved.addListener(async (tabId) => {
  if (tabId === currentTabId && currentUrl && startTime) {
    const timeSpent = Date.now() - startTime;
    await saveTimeSpent(currentUrl, timeSpent);
  }
  
  openTabs.delete(tabId);
  await updateTabStats();
});

chrome.windows.onRemoved.addListener(async () => {
  if (currentUrl && startTime) {
    const timeSpent = Date.now() - startTime;
    await saveTimeSpent(currentUrl, timeSpent);
  }
});

// Actualizar stats de tabs cada 5 minutos
setInterval(updateTabStats, 5 * 60 * 1000);

// Inicializar cuando se instala la extensión
chrome.runtime.onInstalled.addListener(async (details) => {
  await initializeStorage();
  
  if (details.reason === 'install') {
    console.log('BrowserRewind instalado! 🎉');
    // Analizar historial y bookmarks en background
    setTimeout(analyzeHistory, 5000);
    setTimeout(analyzeBookmarks, 10000);
  }
  
  await updateTabStats();
});

// Inicializar al cargar
initializeStorage();
updateTabStats();