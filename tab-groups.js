// Importar categorías
let SITE_CATEGORIES, categorizeDomain;

// Cargar el script de categorías
async function loadCategories() {
  return new Promise((resolve) => {
    const script = document.createElement('script');
    script.src = 'categories.js';
    script.onload = () => {
      SITE_CATEGORIES = window.SITE_CATEGORIES;
      categorizeDomain = window.categorizeDomain;
      resolve();
    };
    document.head.appendChild(script);
  });
}

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
  
  // Obtener todos los tabs
  const tabs = await chrome.tabs.query({ currentWindow: true });
  currentTabs = tabs;
  
  // Obtener grupos existentes
  const groups = await chrome.tabGroups.query({ windowId: chrome.windows.WINDOW_ID_CURRENT });
  currentGroups = groups;
  
  // Categorizar tabs
  const categorized = {};
  const ungrouped = [];
  
  for (const tab of tabs) {
    if (!tab.url || tab.url.startsWith('chrome://')) continue;
    
    const domain = getDomain(tab.url);
    if (!domain) continue;
    
    const category = categorizeDomain(domain);
    
    // Si el tab no está en un grupo
    if (tab.groupId === chrome.tabGroups.TAB_GROUP_ID_NONE) {
      if (!categorized[category.id]) {
        categorized[category.id] = {
          category: category,
          tabs: []
        };
      }
      categorized[category.id].tabs.push(tab);
      ungrouped.push(tab);
    }
  }
  
  // Filtrar solo categorías con 2+ tabs
  suggestions = {};
  for (const [categoryId, data] of Object.entries(categorized)) {
    if (data.tabs.length >= 2) {
      suggestions[categoryId] = data;
    }
  }
  
  showLoading(false);
  updateUI();
}

// Crear grupo para una categoría
async function createGroupForCategory(categoryId) {
  const suggestion = suggestions[categoryId];
  if (!suggestion) return;
  
  const tabIds = suggestion.tabs.map(t => t.id);
  
  // Crear el grupo
  const groupId = await chrome.tabs.group({ tabIds });
  
  // Configurar el grupo
  await chrome.tabGroups.update(groupId, {
    title: suggestion.category.name,
    color: CATEGORY_COLORS[categoryId] || 'grey',
    collapsed: false
  });
  
  // Reanalizar
  await analyzeTabs();
}

// Agrupar todos automáticamente
async function autoGroupAll() {
  for (const categoryId of Object.keys(suggestions)) {
    await createGroupForCategory(categoryId);
  }
}

// Desagrupar todos los grupos
async function ungroupAll() {
  const groups = await chrome.tabGroups.query({ windowId: chrome.windows.WINDOW_ID_CURRENT });
  
  for (const group of groups) {
    await chrome.tabs.ungroup(group.id);
  }
  
  await analyzeTabs();
}

// Desagrupar un grupo específico
async function ungroupSpecific(groupId) {
  const tabs = await chrome.tabs.query({ groupId });
  const tabIds = tabs.map(t => t.id);
  await chrome.tabs.ungroup(tabIds);
  await analyzeTabs();
}

// Cerrar grupo
async function closeGroup(groupId) {
  const tabs = await chrome.tabs.query({ groupId });
  const tabIds = tabs.map(t => t.id);
  await chrome.tabs.remove(tabIds);
  await analyzeTabs();
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
  
  // Calcular tabs zombies (tabs inactivos)
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
        <button class="btn btn-success btn-small" onclick="createGroupForCategory('${categoryId}')">
          ✨ Crear Grupo
        </button>
        <button class="btn btn-secondary btn-small" onclick="ignoreCategory('${categoryId}')">
          ❌ Ignorar
        </button>
      </div>
    `;
    
    suggestionsList.appendChild(card);
  }
}

// Actualizar tabs sin agrupar
function updateUngroupedTabs() {
  const ungroupedSection = document.getElementById('ungroupedSection');
  const ungroupedList = document.getElementById('ungroupedList');
  
  const ungroupedTabs = currentTabs.filter(
    tab => tab.groupId === chrome.tabGroups.TAB_GROUP_ID_NONE
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
    if (!tab.url || tab.url.startsWith('chrome://')) continue;
    
    const domain = getDomain(tab.url);
    if (!domain) continue;
    
    const category = categorizeDomain(domain);
    
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
  
  for (const group of currentGroups) {
    const tabs = await chrome.tabs.query({ groupId: group.id });
    
    const groupItem = document.createElement('div');
    groupItem.className = 'group-item';
    
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
          <button class="btn-icon" onclick="ungroupSpecific(${group.id})" title="Desagrupar">
            🗂️
          </button>
          <button class="btn-icon" onclick="closeGroup(${group.id})" title="Cerrar grupo">
            ❌
          </button>
        </div>
      </div>
      <div class="group-tabs">
        ${tabsHTML}
      </div>
    `;
    
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

// Event Listeners
document.getElementById('analyzeBtn').addEventListener('click', analyzeTabs);
document.getElementById('autoGroupBtn').addEventListener('click', autoGroupAll);
document.getElementById('ungroupAllBtn').addEventListener('click', ungroupAll);

// Inicializar
(async function init() {
  await loadCategories();
  await analyzeTabs();
})();

// Escuchar cambios en tabs
chrome.tabs.onCreated.addListener(() => setTimeout(analyzeTabs, 500));
chrome.tabs.onRemoved.addListener(() => setTimeout(analyzeTabs, 500));
chrome.tabs.onUpdated.addListener(() => setTimeout(analyzeTabs, 1000));