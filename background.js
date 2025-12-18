// Importar categorías (en service worker necesitamos importScripts)
importScripts('categories.js');

// Estado para trackear el tiempo
let currentTabId = null;
let currentUrl = null;
let startTime = null;
let openTabs = new Map();
let isAnalyzing = false;

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
    'firstInstallDate',
    'lastHistorySync'
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
  if (!result.lastHistorySync) await chrome.storage.local.set({ lastHistorySync: 0 });
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

// MEJORADO: Analizar el historial del navegador
async function analyzeHistory(forceSync = false) {
  if (isAnalyzing) {
    console.log('Ya hay un análisis en curso...');
    return { success: false, reason: 'already_analyzing' };
  }

  isAnalyzing = true;
  console.log('🔍 Iniciando análisis del historial...');

  try {
    const result = await chrome.storage.local.get(['lastHistorySync', 'siteStats', 'dailyStats', 'monthlyStats', 'yearlyStats', 'categoryStats']);
    const lastSync = result.lastHistorySync || 0;
    
    // Si no es forzado y ya sincronizamos hace menos de 1 hora, skip
    if (!forceSync && (Date.now() - lastSync) < (60 * 60 * 1000)) {
      console.log('⏭️ Historial ya sincronizado recientemente');
      isAnalyzing = false;
      return { success: true, reason: 'recently_synced' };
    }

    // Obtener historial de los últimos 90 días
    const ninetyDaysAgo = Date.now() - (90 * 24 * 60 * 60 * 1000);
    
    console.log('📚 Obteniendo historial desde:', new Date(ninetyDaysAgo).toLocaleDateString());
    
    const historyItems = await chrome.history.search({
      text: '',
      startTime: ninetyDaysAgo,
      maxResults: 10000
    });

    console.log(`📊 Procesando ${historyItems.length} items del historial...`);

    if (historyItems.length === 0) {
      console.log('⚠️ No se encontraron items en el historial');
      isAnalyzing = false;
      return { success: false, reason: 'no_history' };
    }

    let siteStats = result.siteStats || {};
    let dailyStats = result.dailyStats || {};
    let monthlyStats = result.monthlyStats || {};
    let yearlyStats = result.yearlyStats || {};
    let categoryStats = result.categoryStats || {};

    let processedCount = 0;

    for (const item of historyItems) {
      if (!item.url) continue;
      
      const domain = getDomain(item.url);
      if (!domain || domain === 'newtab' || domain === '' || domain.startsWith('chrome')) continue;

      const category = categorizeDomain(domain);
      const visitTime = item.lastVisitTime || Date.now();
      const dateKey = getDateKey(visitTime);
      const monthKey = getMonthKey(visitTime);
      const yearKey = getYearKey(visitTime);

      // Stats generales del sitio
      if (!siteStats[domain]) {
        siteStats[domain] = {
          domain: domain,
          visits: 0,
          totalTime: 0,
          lastVisit: visitTime,
          category: category.id,
          categoryName: category.name,
          categoryEmoji: category.emoji,
          fromHistory: true
        };
      }

      siteStats[domain].visits += (item.visitCount || 1);
      siteStats[domain].lastVisit = Math.max(siteStats[domain].lastVisit, visitTime);

      // Stats diarias
      if (!dailyStats[dateKey]) dailyStats[dateKey] = { sites: {}, totalTime: 0, visits: 0 };
      if (!dailyStats[dateKey].sites[domain]) {
        dailyStats[dateKey].sites[domain] = { visits: 0, time: 0 };
      }
      dailyStats[dateKey].sites[domain].visits += (item.visitCount || 1);
      dailyStats[dateKey].visits += (item.visitCount || 1);

      // Stats mensuales
      if (!monthlyStats[monthKey]) monthlyStats[monthKey] = { sites: {}, totalTime: 0, visits: 0 };
      if (!monthlyStats[monthKey].sites[domain]) {
        monthlyStats[monthKey].sites[domain] = { visits: 0, time: 0 };
      }
      monthlyStats[monthKey].sites[domain].visits += (item.visitCount || 1);
      monthlyStats[monthKey].visits += (item.visitCount || 1);

      // Stats anuales
      if (!yearlyStats[yearKey]) yearlyStats[yearKey] = { sites: {}, totalTime: 0, visits: 0 };
      if (!yearlyStats[yearKey].sites[domain]) {
        yearlyStats[yearKey].sites[domain] = { visits: 0, time: 0 };
      }
      yearlyStats[yearKey].sites[domain].visits += (item.visitCount || 1);
      yearlyStats[yearKey].visits += (item.visitCount || 1);

      // Stats por categoría
      if (!categoryStats[category.id]) {
        categoryStats[category.id] = {
          name: category.name,
          emoji: category.emoji,
          totalTime: 0,
          visits: 0,
          sites: []
        };
      }
      categoryStats[category.id].visits += (item.visitCount || 1);
      if (!categoryStats[category.id].sites.includes(domain)) {
        categoryStats[category.id].sites.push(domain);
      }

      processedCount++;

      // Guardar en batches de 100
      if (processedCount % 100 === 0) {
        await chrome.storage.local.set({
          siteStats,
          dailyStats,
          monthlyStats,
          yearlyStats,
          categoryStats
        });
        console.log(`💾 Guardado progreso: ${processedCount}/${historyItems.length}`);
      }
    }

    // Guardar final
    await chrome.storage.local.set({
      siteStats,
      dailyStats,
      monthlyStats,
      yearlyStats,
      categoryStats,
      lastHistorySync: Date.now()
    });

    console.log(`✅ Historial analizado! ${processedCount} sitios procesados`);
    isAnalyzing = false;
    return { success: true, processed: processedCount };

  } catch (error) {
    console.error('❌ Error analizando historial:', error);
    isAnalyzing = false;
    return { success: false, error: error.message };
  }
}

// Analizar bookmarks
async function analyzeBookmarks() {
  console.log('📚 Analizando bookmarks...');
  
  try {
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
    console.log(`✅ ${bookmarks.length} bookmarks analizados!`);
    return { success: true, count: bookmarks.length };

  } catch (error) {
    console.error('❌ Error analizando bookmarks:', error);
    return { success: false, error: error.message };
  }
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

// NUEVO: Listener para mensajes desde popup/páginas
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'analyzeHistory') {
    analyzeHistory(true).then(result => {
      sendResponse(result);
    });
    return true; // Mantener el canal abierto para respuesta asíncrona
  }
  
  if (request.action === 'analyzeBookmarks') {
    analyzeBookmarks().then(result => {
      sendResponse(result);
    });
    return true;
  }
  
  if (request.action === 'getAnalysisStatus') {
    sendResponse({ isAnalyzing });
    return true;
  }
});

// Event listeners para tracking en tiempo real
chrome.tabs.onActivated.addListener(async (activeInfo) => {
  if (currentUrl && startTime) {
    const timeSpent = Date.now() - startTime;
    await saveTimeSpent(currentUrl, timeSpent);
  }

  const tab = await chrome.tabs.get(activeInfo.tabId);
  currentTabId = activeInfo.tabId;
  currentUrl = tab.url;
  startTime = Date.now();
  
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

// Sincronizar historial cada 6 horas automáticamente
setInterval(() => {
  analyzeHistory(false);
}, 6 * 60 * 60 * 1000);

// Inicializar cuando se instala la extensión
chrome.runtime.onInstalled.addListener(async (details) => {
  await initializeStorage();
  
  console.log('🎉 BrowserRewind instalado!');
  
  // Analizar historial inmediatamente (pero sin bloquear)
  setTimeout(() => analyzeHistory(true), 2000);
  setTimeout(() => analyzeBookmarks(), 5000);
  
  await updateTabStats();
});

// Inicializar al cargar el service worker
initializeStorage();
updateTabStats();

// Sincronizar historial al iniciar si han pasado más de 6 horas
chrome.storage.local.get(['lastHistorySync'], (result) => {
  const lastSync = result.lastHistorySync || 0;
  if (Date.now() - lastSync > 6 * 60 * 60 * 1000) {
    setTimeout(() => analyzeHistory(false), 5000);
  }
});

console.log('🚀 BrowserRewind background script cargado');