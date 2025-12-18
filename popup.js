// Logica del popup
// Formatear tiempo en formato legible
function formatTime(milliseconds) {
  const seconds = Math.floor(milliseconds / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);

  if (hours > 0) {
    return `${hours}h ${minutes % 60}m`;
  } else if (minutes > 0) {
    return `${minutes}m`;
  } else {
    return `${seconds}s`;
  }
}

// Formatear número con separadores de miles
function formatNumber(num) {
  return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

// Cargar y mostrar estadísticas
async function loadStats() {
  const result = await chrome.storage.local.get(['siteStats']);
  const siteStats = result.siteStats || {};

  // Convertir a array y ordenar por tiempo total
  const sitesArray = Object.values(siteStats);
  
  if (sitesArray.length === 0) {
    document.getElementById('noData').style.display = 'block';
    document.querySelector('.stats-summary').style.display = 'none';
    document.querySelector('.top-sites-section').style.display = 'none';
    return;
  }

  // Ordenar por tiempo total
  sitesArray.sort((a, b) => b.totalTime - a.totalTime);

  // Calcular totales
  const totalSites = sitesArray.length;
  const totalVisits = sitesArray.reduce((sum, site) => sum + site.visits, 0);
  const totalTime = sitesArray.reduce((sum, site) => sum + site.totalTime, 0);

  // Actualizar summary cards
  document.getElementById('totalSites').textContent = formatNumber(totalSites);
  document.getElementById('totalVisits').textContent = formatNumber(totalVisits);
  document.getElementById('totalTime').textContent = formatTime(totalTime);

  // Mostrar top 10
  const top10 = sitesArray.slice(0, 10);
  const topSitesList = document.getElementById('topSitesList');
  topSitesList.innerHTML = '';

  top10.forEach((site, index) => {
    const siteItem = document.createElement('div');
    siteItem.className = 'site-item';
    
    const emoji = ['🥇', '🥈', '🥉'][index] || '🏅';
    
    siteItem.innerHTML = `
      <div class="site-rank">${emoji}</div>
      <div class="site-info">
        <div class="site-domain">${site.domain}</div>
        <div class="site-stats">${formatNumber(site.visits)} visitas</div>
      </div>
      <div class="site-time">${formatTime(site.totalTime)}</div>
    `;
    
    topSitesList.appendChild(siteItem);
  });
}

// Limpiar todos los datos
async function clearAllData() {
  if (confirm('¿Estás seguro de que quieres borrar todos los datos? Esta acción no se puede deshacer.')) {
    await chrome.storage.local.set({ siteStats: {} });
    loadStats();
  }
}

// Exportar datos como JSON
async function exportData() {
  const result = await chrome.storage.local.get(['siteStats']);
  const siteStats = result.siteStats || {};
  
  const dataStr = JSON.stringify(siteStats, null, 2);
  const dataBlob = new Blob([dataStr], { type: 'application/json' });
  const url = URL.createObjectURL(dataBlob);
  
  const link = document.createElement('a');
  link.href = url;
  link.download = `browser-rewind-${new Date().toISOString().split('T')[0]}.json`;
  link.click();
  
  URL.revokeObjectURL(url);
}

// Event listeners
document.getElementById('clearData').addEventListener('click', clearAllData);
document.getElementById('exportData').addEventListener('click', exportData);

// Cargar stats al abrir el popup
loadStats();

// Abrir el Wrapped completo
document.getElementById('openWrapped').addEventListener('click', () => {
  chrome.tabs.create({ url: 'wrapped.html' });
});

// Abrir la página de organización de tabs
document.getElementById('openTabGroups').addEventListener('click', () => {
  chrome.tabs.create({ url: 'tab-groups.html' });
});

// Sincronizar historial
document.getElementById('syncHistory').addEventListener('click', async () => {
  const btn = document.getElementById('syncHistory');
  const status = document.getElementById('syncStatus');
  
  btn.disabled = true;
  btn.textContent = '🔄 Sincronizando...';
  status.textContent = 'Esto puede tomar unos segundos...';
  
  try {
    const result = await chrome.runtime.sendMessage({ action: 'analyzeHistory' });
    
    if (result.success) {
      status.textContent = `✅ ${result.processed || 'Varios'} sitios procesados`;
      setTimeout(loadStats, 1000); // Recargar stats
    } else {
      status.textContent = `⚠️ ${result.reason || 'Error desconocido'}`;
    }
  } catch (error) {
    status.textContent = '❌ Error: ' + error.message;
  } finally {
    btn.disabled = false;
    btn.textContent = '🔄 Sincronizar Historial';
  }
});

// Mostrar última sincronización al cargar
chrome.storage.local.get(['lastHistorySync'], (result) => {
  const lastSync = result.lastHistorySync || 0;
  if (lastSync > 0) {
    const hours = Math.floor((Date.now() - lastSync) / (1000 * 60 * 60));
    const status = document.getElementById('syncStatus');
    if (hours < 1) {
      status.textContent = 'Sincronizado recientemente';
    } else {
      status.textContent = `Última sincronización hace ${hours}h`;
    }
  }
});