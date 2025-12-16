let currentSlide = 0;
let totalSlides = 11; // 10 slides + loading
let stats = {};

// Formatear tiempo
function formatTime(milliseconds) {
  const hours = Math.floor(milliseconds / (1000 * 60 * 60));
  const minutes = Math.floor((milliseconds % (1000 * 60 * 60)) / (1000 * 60));
  
  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }
  return `${minutes}m`;
}

// Formatear número
function formatNumber(num) {
  return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

// Cargar datos
async function loadData() {
  const result = await chrome.storage.local.get([
    'siteStats',
    'categoryStats',
    'hourlyActivity',
    'bookmarkStats',
    'tabStats',
    'dailyStats'
  ]);
  
  stats = result;
  
  // Simular tiempo de carga
  setTimeout(() => {
    hideLoading();
    showSlide(1);
  }, 2000);
}

// Ocultar loading
function hideLoading() {
  document.getElementById('loadingScreen').classList.remove('active');
}

// Mostrar slide
function showSlide(index) {
  const slides = document.querySelectorAll('.slide');
  
  slides.forEach((slide, i) => {
    slide.classList.remove('active', 'prev');
    
    if (i + 1 === index) {
      slide.classList.add('active');
      populateSlide(index);
    } else if (i + 1 < index) {
      slide.classList.add('prev');
    }
  });
  
  currentSlide = index;
  updateNavigation();
  updateProgressBar();
}

// Poblar slide con datos
function populateSlide(slideNum) {
  const siteStats = stats.siteStats || {};
  const categoryStats = stats.categoryStats || {};
  const hourlyActivity = stats.hourlyActivity || Array(24).fill(0);
  const bookmarkStats = stats.bookmarkStats || {};
  const tabStats = stats.tabStats || {};
  const dailyStats = stats.dailyStats || {};
  
  switch(slideNum) {
    case 2: // Tiempo total
      const sitesArray = Object.values(siteStats);
      const totalTime = sitesArray.reduce((sum, site) => sum + site.totalTime, 0);
      const hours = Math.floor(totalTime / (1000 * 60 * 60));
      
      document.getElementById('totalTimeWrapped').textContent = `${formatNumber(hours)} horas`;
      
      let timeComment = '';
      if (hours > 100) timeComment = '¡Eso es muchísimo tiempo! 🤯';
      else if (hours > 50) timeComment = '¡Has estado ocupado! 💪';
      else if (hours > 20) timeComment = 'Un buen balance 😊';
      else timeComment = 'Aún hay tiempo para más 🚀';
      
      document.getElementById('timeComment').textContent = timeComment;
      break;
      
    case 3: // Sitios visitados
      const totalSites = Object.keys(siteStats).length;
      document.getElementById('totalVisitsWrapped').textContent = formatNumber(totalSites);
      
      let sitesComment = '';
      if (totalSites > 200) sitesComment = 'Eres todo un explorador digital 🌍';
      else if (totalSites > 100) sitesComment = '¡Tienes curiosidad por todo! 🔍';
      else if (totalSites > 50) sitesComment = 'Navegas con variedad 🎯';
      else sitesComment = 'Eres selectivo con tus sitios 👌';
      
      document.getElementById('sitesComment').textContent = sitesComment;
      break;
      
    case 4: // Top 5 sitios
      const topSites = Object.values(siteStats)
        .sort((a, b) => b.totalTime - a.totalTime)
        .slice(0, 5);
      
      const topSitesHTML = topSites.map((site, index) => {
        const emoji = ['🥇', '🥈', '🥉', '🏅', '🏅'][index];
        return `
          <div class="top-item">
            <div class="top-rank">${emoji}</div>
            <div class="top-info">
              <div class="top-domain">${site.domain}</div>
              <div class="top-stats">${site.categoryEmoji} ${formatNumber(site.visits)} visitas</div>
            </div>
            <div class="top-time">${formatTime(site.totalTime)}</div>
          </div>
        `;
      }).join('');
      
      document.getElementById('topSitesWrapped').innerHTML = topSitesHTML;
      break;
      
    case 5: // Categoría favorita
      const categories = Object.entries(categoryStats)
        .sort((a, b) => b[1].totalTime - a[1].totalTime);
      
      if (categories.length > 0) {
        const topCat = categories[0][1];
        document.getElementById('topCategory').textContent = `${topCat.emoji} ${topCat.name}`;
        document.getElementById('categoryTime').textContent = `con ${formatTime(topCat.totalTime)}`;
        
        const comments = {
          development: '¡Sigue así campeón! 💻',
          social: '¡Eres muy social! 👥',
          video: '¡Te encanta el contenido visual! 🎬',
          productivity: '¡Productividad al máximo! 📊',
          education: '¡Nunca dejes de aprender! 📚',
          shopping: '¡El shopping online te llama! 🛒',
          gaming: '¡GG! 🎮',
          music: '¡La música es vida! 🎵'
        };
        
        document.getElementById('categoryComment').textContent = 
          comments[categories[0][0]] || '¡Excelente elección! ✨';
      }
      break;
      
    case 6: // Hora pico
      const peakHourIndex = hourlyActivity.indexOf(Math.max(...hourlyActivity));
      const peakHour = peakHourIndex === 0 ? '12 AM' : 
                       peakHourIndex < 12 ? `${peakHourIndex} AM` : 
                       peakHourIndex === 12 ? '12 PM' : 
                       `${peakHourIndex - 12} PM`;
      
      document.getElementById('peakHour').textContent = peakHour;
      
      let hourComment = '';
      if (peakHourIndex >= 22 || peakHourIndex <= 5) {
        hourComment = '¡Eres un búho nocturno! 🦉';
      } else if (peakHourIndex >= 6 && peakHourIndex <= 11) {
        hourComment = '¡Mañanero productivo! ☀️';
      } else if (peakHourIndex >= 12 && peakHourIndex <= 17) {
        hourComment = '¡Las tardes son tuyas! ☕';
      } else {
        hourComment = '¡Noches productivas! 🌙';
      }
      
      document.getElementById('hourComment').textContent = hourComment;
      break;
      
    case 7: // Cementerio de bookmarks
      const unreadBookmarks = Object.values(bookmarkStats)
        .filter(b => b.neverOpened).length;
      
      document.getElementById('unreadBookmarks').textContent = formatNumber(unreadBookmarks);
      break;
      
    case 8: // Tabs zombies
      const zombieCount = tabStats.zombieTabs?.length || 0;
      document.getElementById('zombieTabsCount').textContent = formatNumber(zombieCount);
      
      let tabsComment = '';
      if (zombieCount > 20) tabsComment = '¡Hora de una limpieza seria! 🧹';
      else if (zombieCount > 10) tabsComment = '¡Algunos tabs merecen descansar! 😴';
      else if (zombieCount > 5) tabsComment = '¡No está mal! 👍';
      else tabsComment = '¡Mantienes todo ordenado! ✨';
      
      document.getElementById('tabsComment').textContent = tabsComment;
      break;
      
    case 9: // Racha más larga
      const days = Object.keys(dailyStats).length;
      document.getElementById('longestStreak').textContent = `${days} días`;
      break;
  }
}

// Actualizar navegación
function updateNavigation() {
  const prevBtn = document.getElementById('prevSlide');
  const nextBtn = document.getElementById('nextSlide');
  
  prevBtn.disabled = currentSlide === 1;
  nextBtn.disabled = currentSlide === totalSlides - 1;
  
  // Actualizar dots
  const dotsContainer = document.getElementById('progressDots');
  dotsContainer.innerHTML = '';
  
  for (let i = 1; i < totalSlides; i++) {
    const dot = document.createElement('div');
    dot.className = 'dot';
    if (i === currentSlide) dot.classList.add('active');
    dot.addEventListener('click', () => showSlide(i));
    dotsContainer.appendChild(dot);
  }
}

// Actualizar barra de progreso
function updateProgressBar() {
  const progress = ((currentSlide - 1) / (totalSlides - 2)) * 100;
  document.getElementById('progressFill').style.width = `${progress}%`;
}

// Event listeners
document.getElementById('prevSlide').addEventListener('click', () => {
  if (currentSlide > 1) {
    showSlide(currentSlide - 1);
  }
});

document.getElementById('nextSlide').addEventListener('click', () => {
  if (currentSlide < totalSlides - 1) {
    showSlide(currentSlide + 1);
  }
});

// Navegación con teclado
document.addEventListener('keydown', (e) => {
  if (e.key === 'ArrowRight' && currentSlide < totalSlides - 1) {
    showSlide(currentSlide + 1);
  } else if (e.key === 'ArrowLeft' && currentSlide > 1) {
    showSlide(currentSlide - 1);
  }
});

// Compartir (screenshot simulado)
document.getElementById('shareWrapped').addEventListener('click', () => {
  alert('🎉 ¡Funcionalidad de compartir próximamente! Por ahora puedes hacer screenshot.');
});

// Reiniciar
document.getElementById('restartWrapped').addEventListener('click', () => {
  showSlide(1);
});

// Cargar datos al iniciar
loadData();