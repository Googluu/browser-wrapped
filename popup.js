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