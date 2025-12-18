// Las categorías ya están cargadas desde categories.js en el HTML
// Están disponibles como window.SITE_CATEGORIES y window.categorizeDomain

// Colores para grupos según categoría
const CATEGORY_COLORS = {
  development: 'blue',
  social: 'pink',
  video: 'red',
  music: 'green',
  news: 'orange',
  shopping: 'purple',
  productivity: 'cyan',
  education: 'yellow',
  email: 'grey',
  gaming: 'purple',
  finance: 'green',
  other: 'grey'
};

// Estado
let currentTabs = [];
let currentGroups = [];
let suggestions = {};

// Obtener dominio de URL
function getDomain(url) {
  try {
    const urlObj = new URL(url);
    return urlObj.hostname.replace('www.', '');
  } catch {
    return null;
  }
}

// Analizar tabs abiertos
async function analyzeTabs() {
  showLoading(true);
  
  try {
    // Obtener todos los tabs de la ventana actual
    const windows = await chrome.windows.getCurrent();
    const tabs = await chrome.tabs.query({ windowId: windows.id });
    currentTabs = tabs;
    
    // Obtener grupos existentes
    const groups = await chrome.tabGroups.query({ windowId: windows.id });
    currentGroups = groups;
    
    // Categorizar tabs
    const categorized = {};
    
    for (const tab of tabs) {
      if (!tab.url || tab.url.startsWith('chrome://') || tab.url.startsWith('chrome-extension://')) continue;
      
      const domain = getDomain(tab.url);
      if (!domain) continue;
      
      const category = window.categorizeDomain(domain);
      
      // Si el tab no está en un grupo
      if (tab.groupId === chrome.tabGroups.TAB_GROUP_ID_NONE || tab.groupId === -1) {
        if (!categorized[category.id]) {
          categorized[category.id] = {
            category: category,
            tabs: []
          };
        }
        categorized[category.id].tabs.push(tab);
      }
    }
    
    // Filtrar solo categorías con 2+ tabs
    suggestions = {};
    for (const [categoryId, data] of Object.entries(categorized)) {
      if (data.tabs.length >= 2) {
        suggestions[categoryId] = data;
      }
    }
    
    console.log('📊 Análisis completado:', {
      totalTabs: currentTabs.length,
      grupos: currentGroups.length,
      sugerencias: Object.keys(suggestions).length
    });
    
  } catch (error) {
    console.error('❌ Error analizando tabs:', error);
  } finally {
    showLoading(false);
    updateUI();
  }
}

// Crear grupo para una categoría
async function createGroupForCategory(categoryId) {
  try {
    const suggestion = suggestions[categoryId];
    if (!suggestion) return;
    
    const tabIds = suggestion.tabs.map(t => t.id);
    
    console.log(`Creando grupo para ${suggestion.category.name} con ${tabIds.length} tabs`);
    
    // Crear el grupo
    const groupId = await chrome.tabs.group({ tabIds });
    
    // Configurar el grupo
    await chrome.tabGroups.update(groupId, {
      title: suggestion.category.name,
      color: CATEGORY_COLORS[categoryId] || 'grey',
      collapsed: false
    });
    
    console.log('✅ Grupo creado exitosamente');
    
    // Reanalizar después de un momento
    setTimeout(() => analyzeTabs(), 500);
    
  } catch (error) {
    console.error('❌ Error creando grupo:', error);
    alert('Error creando el grupo: ' + error.message);
  }
}

// Agrupar todos automáticamente
async function autoGroupAll() {
  showLoading(true);
  
  try {
    const categoryIds = Object.keys(suggestions);
    console.log(`Agrupando ${categoryIds.length} categorías...`);
    
    for (const categoryId of categoryIds) {
      await createGroupForCategory(categoryId);
      // Pequeña pausa entre grupos para evitar problemas
      await new Promise(resolve => setTimeout(resolve, 300));
    }
    
    console.log('✅ Todos los grupos creados');
  } catch (error) {
    console.error('❌ Error agrupando todo:', error);
  } finally {
    showLoading(false);
    setTimeout(() => analyzeTabs(), 500);
  }
}

// Desagrupar todos los grupos
async function ungroupAll() {
  try {
    const windows = await chrome.windows.getCurrent();
    const groups = await chrome.tabGroups.query({ windowId: windows.id });
    
    console.log(`Desagrupando ${groups.length} grupos...`);
    
    for (const group of groups) {
      const tabs = await chrome.tabs.query({ groupId: group.id });
      const tabIds = tabs.map(t => t.id);
      await chrome.tabs.ungroup(tabIds);
    }
    
    console.log('✅ Todos los grupos desagrupados');
    setTimeout(() => analyzeTabs(), 500);
    
  } catch (error) {
    console.error('❌ Error desagrupando:', error);
  }
}

// Desagrupar un grupo específico
async function ungroupSpecific(groupId) {
  try {
    const tabs = await chrome.tabs.query({ groupId });
    const tabIds = tabs.map(t => t.id);
    await chrome.tabs.ungroup(tabIds);
    
    console.log('✅ Grupo desagrupado');
    setTimeout(() => analyzeTabs(), 500);
    
  } catch (error) {
    console.error('❌ Error desagrupando grupo:', error);
  }
}

// Cerrar grupo
async function closeGroup(groupId) {
  try {
    if (!confirm('¿Estás seguro de que quieres cerrar todos los tabs de este grupo?')) {
      return;
    }
    
    const tabs = await chrome.tabs.query({ groupId });
    const tabIds = tabs.map(t => t.id);
    await chrome.tabs.remove(tabIds);
    
    console.log('✅ Grupo cerrado');
    setTimeout(() => analyzeTabs(), 500);
    
  } catch (error) {
    console.error('❌ Error cerrando grupo:', error);
  }
}

// Actualizar UI
function updateUI() {
  updateStats();
  updateSuggestions();
  updateUngroupedTabs();
  updateExistingGroups();
}

// Actualizar stats
function updateStats() {
  document.getElementById('totalTabs').textContent = currentTabs.length;
  document.getElementById('totalGroups').textContent = currentGroups.length;
  
  // Calcular tabs zombies
  chrome.storage.local.get(['tabStats'], (result) => {
    const zombieCount = result.tabStats?.zombieTabs?.length || 0;
    document.getElementById('zombieTabs').textContent = zombieCount;
  });
}

// Actualizar sugerencias
function updateSuggestions() {
  const suggestionsSection = document.getElementById('suggestionsSection');
  const suggestionsList = document.getElementById('suggestionsList');
  
  const suggestionCount = Object.keys(suggestions).length;
  
  if (suggestionCount === 0) {
    suggestionsSection.style.display = 'none';
    return;
  }
  
  suggestionsSection.style.display = 'block';
  suggestionsList.innerHTML = '';
  
  for (const [categoryId, data] of Object.entries(suggestions)) {
    const card = document.createElement('div');
    card.className = 'suggestion-card';
    
    const tabsHTML = data.tabs.slice(0, 3).map(tab => `
      <div class="mini-tab">
        <div class="mini-tab-favicon"></div>
        <div class="mini-tab-title">${tab.title || getDomain(tab.url)}</div>
      </div>
    `).join('');
    
    const moreText = data.tabs.length > 3 ? 
      `<div class="mini-tab">Y ${data.tabs.length - 3} más...</div>` : '';
    
    card.innerHTML = `
      <div class="suggestion-header">
        <div class="suggestion-title">
          <span class="category-emoji">${data.category.emoji}</span>
          <span>${data.category.name}</span>
        </div>
        <div class="suggestion-count">${data.tabs.length} tabs</div>
      </div>
      <div class="suggestion-tabs">
        ${tabsHTML}
        ${moreText}
      </div>
      <div class="suggestion-actions">
        <button class="btn btn-success btn-small" data-category="${categoryId}">
          ✨ Crear Grupo
        </button>
        <button class="btn btn-secondary btn-small" data-category-ignore="${categoryId}">
          ❌ Ignorar
        </button>
      </div>
    `;
    
    // Event listeners para los botones
    const createBtn = card.querySelector('[data-category]');
    createBtn.addEventListener('click', () => createGroupForCategory(categoryId));
    
    const ignoreBtn = card.querySelector('[data-category-ignore]');
    ignoreBtn.addEventListener('click', () => ignoreCategory(categoryId));
    
    suggestionsList.appendChild(card);
  }
}

// Actualizar tabs sin agrupar
function updateUngroupedTabs() {
  const ungroupedList = document.getElementById('ungroupedList');
  
  const ungroupedTabs = currentTabs.filter(
    tab => tab.groupId === chrome.tabGroups.TAB_GROUP_ID_NONE || tab.groupId === -1
  );
  
  if (ungroupedTabs.length === 0) {
    ungroupedList.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon">🎉</div>
        <div class="empty-state-text">¡Todos los tabs están organizados!</div>
      </div>
    `;
    return;
  }
  
  ungroupedList.innerHTML = '';
  
  for (const tab of ungroupedTabs) {
    if (!tab.url || tab.url.startsWith('chrome://') || tab.url.startsWith('chrome-extension://')) continue;
    
    const domain = getDomain(tab.url);
    if (!domain) continue;
    
    const category = window.categorizeDomain(domain);
    
    const item = document.createElement('div');
    item.className = 'tab-item';
    item.innerHTML = `
      <div class="tab-favicon"></div>
      <div class="tab-info">
        <div class="tab-title">${tab.title || 'Sin título'}</div>
        <div class="tab-url">${domain}</div>
      </div>
      <div class="tab-category">${category.emoji}</div>
    `;
    
    ungroupedList.appendChild(item);
  }
}

// Actualizar grupos existentes
async function updateExistingGroups() {
  const groupsSection = document.getElementById('groupsSection');
  const groupsList = document.getElementById('groupsList');
  
  if (currentGroups.length === 0) {
    groupsSection.style.display = 'none';
    return;
  }
  
  groupsSection.style.display = 'block';
  groupsList.innerHTML = '';
  
  const colorMap = {
    grey: '#888',
    blue: '#4285f4',
    red: '#ea4335',
    yellow: '#fbbc04',
    green: '#34a853',
    pink: '#ff6d9e',
    purple: '#9334e6',
    cyan: '#00acc1',
    orange: '#ff6f00'
  };
  
  for (const group of currentGroups) {
    const tabs = await chrome.tabs.query({ groupId: group.id });
    
    const groupItem = document.createElement('div');
    groupItem.className = 'group-item';
    
    const tabsHTML = tabs.map(tab => {
      const domain = getDomain(tab.url);
      return `
        <div class="tab-item">
          <div class="tab-favicon"></div>
          <div class="tab-info">
            <div class="tab-title">${tab.title || 'Sin título'}</div>
            <div class="tab-url">${domain || tab.url}</div>
          </div>
        </div>
      `;
    }).join('');
    
    groupItem.innerHTML = `
      <div class="group-header">
        <div class="group-title">
          <div class="group-color" style="background: ${colorMap[group.color] || '#888'}"></div>
          <span>${group.title || 'Grupo sin nombre'}</span>
          <span class="suggestion-count">${tabs.length} tabs</span>
        </div>
        <div class="group-actions">
          <button class="btn-icon" data-ungroup="${group.id}" title="Desagrupar">
            🗂️
          </button>
          <button class="btn-icon" data-close="${group.id}" title="Cerrar grupo">
            ❌
          </button>
        </div>
      </div>
      <div class="group-tabs">
        ${tabsHTML}
      </div>
    `;
    
    // Event listeners
    const ungroupBtn = groupItem.querySelector(`[data-ungroup="${group.id}"]`);
    ungroupBtn.addEventListener('click', () => ungroupSpecific(group.id));
    
    const closeBtn = groupItem.querySelector(`[data-close="${group.id}"]`);
    closeBtn.addEventListener('click', () => closeGroup(group.id));
    
    groupsList.appendChild(groupItem);
  }
}

// Ignorar categoría
function ignoreCategory(categoryId) {
  delete suggestions[categoryId];
  updateSuggestions();
}

// Loading
function showLoading(show) {
  document.getElementById('loading').style.display = show ? 'block' : 'none';
}

// Event Listeners principales
document.getElementById('analyzeBtn').addEventListener('click', analyzeTabs);
document.getElementById('autoGroupBtn').addEventListener('click', autoGroupAll);
document.getElementById('ungroupAllBtn').addEventListener('click', ungroupAll);

// Inicializar
(async function init() {
  console.log('🚀 Inicializando Tab Groups...');
  
  // Verificar que las categorías estén cargadas
  if (!window.SITE_CATEGORIES || !window.categorizeDomain) {
    console.error('❌ Las categorías no están disponibles');
    alert('Error: No se pudieron cargar las categorías. Por favor recarga la página.');
    return;
  }
  
  console.log('✅ Categorías disponibles:', Object.keys(window.SITE_CATEGORIES).length);
  
  await analyzeTabs();
  
  console.log('✅ Tab Groups inicializado correctamente');
})();

// Escuchar cambios en tabs para actualizar en tiempo real
chrome.tabs.onCreated.addListener(() => {
  console.log('Tab creado, reanalizando...');
  setTimeout(analyzeTabs, 500);
});

chrome.tabs.onRemoved.addListener(() => {
  console.log('Tab removido, reanalizando...');
  setTimeout(analyzeTabs, 500);
});

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.url) {
    console.log('Tab actualizado, reanalizando...');
    setTimeout(analyzeTabs, 1000);
  }
});