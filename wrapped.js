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
  try {
    const loadingTitle = document.querySelector('.loading-title');
    const loadingSubtitle = document.querySelector('.loading-subtitle');
    
    // Verificar si hay análisis en curso
    loadingSubtitle.textContent = 'Verificando datos...';
    const statusResponse = await chrome.runtime.sendMessage({ action: 'getAnalysisStatus' });
    
    if (statusResponse.isAnalyzing) {
      loadingSubtitle.textContent = 'Análisis en curso, esperando...';
      console.log('Análisis en curso, esperando...');
      
      // Esperar hasta que termine (máximo 30 segundos)
      let waitTime = 0;
      while (statusResponse.isAnalyzing && waitTime < 30000) {
        await new Promise(resolve => setTimeout(resolve, 1000));
        waitTime += 1000;
        const newStatus = await chrome.runtime.sendMessage({ action: 'getAnalysisStatus' });
        if (!newStatus.isAnalyzing) break;
      }
    }
    
    // Revisar estado de los datos
    loadingSubtitle.textContent = 'Revisando historial...';
    const quickCheck = await chrome.storage.local.get(['siteStats', 'lastHistorySync']);
    const siteCount = Object.keys(quickCheck.siteStats || {}).length;
    const lastSync = quickCheck.lastHistorySync || 0;
    const hoursSinceSync = (Date.now() - lastSync) / (1000 * 60 * 60);
    
    console.log(`Sitios en cache: ${siteCount}, última sincronización hace ${hoursSinceSync.toFixed(1)} horas`);
    
    // Si necesitamos sincronizar
    if (siteCount < 50 || lastSync === 0) {
      loadingTitle.textContent = 'Analizando tu historial...';
      loadingSubtitle.textContent = 'Esto puede tomar unos segundos ☕';
      console.log('Iniciando análisis del historial...');
      
      const analyzeResult = await chrome.runtime.sendMessage({ action: 'analyzeHistory' });
      console.log('Resultado del análisis:', analyzeResult);
      
      if (analyzeResult.success) {
        loadingSubtitle.textContent = `✅ ${analyzeResult.processed || 'Muchos'} sitios procesados!`;
        await new Promise(resolve => setTimeout(resolve, 1500));
      } else {
        console.warn('Análisis falló:', analyzeResult.reason);
      }
    }
    
    // Analizar bookmarks también
    loadingSubtitle.textContent = 'Analizando bookmarks...';
    await chrome.runtime.sendMessage({ action: 'analyzeBookmarks' });
    
    // Cargar todos los datos finales
    loadingSubtitle.textContent = 'Preparando tu Wrapped...';
    const result = await chrome.storage.local.get([
      'siteStats',
      'categoryStats',
      'hourlyActivity',
      'bookmarkStats',
      'tabStats',
      'dailyStats'
    ]);
    
    stats = result;
    
    console.log('Datos finales cargados:', {
      sitios: Object.keys(stats.siteStats || {}).length,
      categorías: Object.keys(stats.categoryStats || {}).length,
      días: Object.keys(stats.dailyStats || {}).length,
      bookmarks: Object.keys(stats.bookmarkStats || {}).length
    });
    
    // Esperar un poco para efecto dramático
    await new Promise(resolve => setTimeout(resolve, 1500));
    
    hideLoading();
    showSlide(1);
    
  } catch (error) {
    console.error('Error cargando datos:', error);
    document.querySelector('.loading-title').textContent = 'Error cargando datos';
    document.querySelector('.loading-subtitle').textContent = 'Por favor, recarga la página';
  }
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
    case 1: // Bienvenida - actualizar año dinámicamente
      const welcomeYear = new Date().getFullYear();
      document.getElementById('currentYear').textContent = welcomeYear;
      break;
    case 2: // Tiempo total
      const sitesArray = Object.values(siteStats);
      const totalTime = sitesArray.reduce((sum, site) => sum + site.totalTime, 0);
      const hours = Math.floor(totalTime / (1000 * 60 * 60));
      
      // Si no hay tiempo real, estimarlo por visitas (promedio 2 min por visita)
      let displayHours = hours;
      if (hours === 0) {
        const totalVisits = sitesArray.reduce((sum, site) => sum + site.visits, 0);
        displayHours = Math.floor((totalVisits * 2) / 60); // 2 minutos por visita
      }
      
      document.getElementById('totalTimeWrapped').textContent = `${formatNumber(displayHours)} horas`;
      
      let timeComment = '';
      if (displayHours > 100) timeComment = '¡Eso es muchísimo tiempo! 🤯';
      else if (displayHours > 50) timeComment = '¡Has estado ocupado! 💪';
      else if (displayHours > 20) timeComment = 'Un buen balance 😊';
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
      
    case 4: // Top 5 sitios - ARREGLADO: Ordenar por VISITAS, no por tiempo
      const topSites = Object.values(siteStats)
        .filter(site => !site.domain.includes('extension://') && site.domain !== '127.0.0.1')
        .sort((a, b) => b.visits - a.visits) // ORDENAR POR VISITAS
        .slice(0, 5);
      
      const topSitesHTML = topSites.map((site, index) => {
        const emoji = ['🥇', '🥈', '🥉', '🏅', '🏅'][index];
        
        // Mejorar formato de tiempo
        let time = '';
        if (site.totalTime > 0) {
          time = formatTime(site.totalTime);
        } else {
          // Estimar: 1.5 min por visita, con formato bonito
          const estimatedMinutes = Math.floor(site.visits * 1.5);
          const estimatedHours = Math.floor(estimatedMinutes / 60);
          if (estimatedHours > 0) {
            time = `~${estimatedHours}h`;
          } else {
            time = `~${estimatedMinutes}m`;
          }
        }
        
        return `
          <div class="top-item">
            <div class="top-rank">${emoji}</div>
            <div class="top-info">
              <div class="top-domain">${site.domain}</div>
              <div class="top-stats">${site.categoryEmoji} ${formatNumber(site.visits)} visitas</div>
            </div>
            <div class="top-time">${time}</div>
          </div>
        `;
      }).join('');
      
      document.getElementById('topSitesWrapped').innerHTML = topSitesHTML;
      break;
      
    case 5: // Categoría favorita - ARREGLADO: Ordenar por VISITAS
      const categories = Object.entries(categoryStats)
        .filter(([id, cat]) => id !== 'other')
        .sort((a, b) => b[1].visits - a[1].visits); // ORDENAR POR VISITAS
      
      if (categories.length > 0) {
        const topCat = categories[0][1];
        
        // Mejorar formato de tiempo
        let time = '';
        if (topCat.totalTime > 0) {
          time = formatTime(topCat.totalTime);
        } else {
          const estimatedMinutes = Math.floor(topCat.visits * 1.5);
          const estimatedHours = Math.floor(estimatedMinutes / 60);
          if (estimatedHours > 0) {
            time = `~${estimatedHours}h`;
          } else {
            time = `~${estimatedMinutes}m`;
          }
        }
        
        document.getElementById('topCategory').textContent = `${topCat.emoji} ${topCat.name}`;
        document.getElementById('categoryTime').textContent = `con ${formatNumber(topCat.visits)} visitas (${time})`;
        
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
      
    case 7: // Cementerio de bookmarks - MEJORADO: Mostrar lista
      const unreadBookmarks = Object.entries(bookmarkStats)
        .filter(([domain, data]) => data.neverOpened);
      
      document.getElementById('unreadBookmarks').textContent = formatNumber(unreadBookmarks.length);
      
      // Crear lista desplegable con los bookmarks sin abrir
      const bookmarksList = unreadBookmarks.slice(0, 10).map(([domain, data]) => 
        `<div class="mini-item">📚 ${domain} (${data.count} guardados)</div>`
      ).join('');
      
      if (unreadBookmarks.length > 0) {
        const existingComment = document.querySelector('.slide[data-slide="7"] .slide-comment');
        existingComment.innerHTML = `
          <details style="margin-top: 20px; text-align: left; max-width: 600px; margin-left: auto; margin-right: auto;">
            <summary style="cursor: pointer; padding: 10px; background: rgba(255,255,255,0.1); border-radius: 8px;">
              Ver lista (${unreadBookmarks.length > 10 ? 'primeros 10' : 'todos'})
            </summary>
            <div style="margin-top: 10px; padding: 10px; background: rgba(255,255,255,0.05); border-radius: 8px; max-height: 300px; overflow-y: auto;">
              ${bookmarksList}
              ${unreadBookmarks.length > 10 ? `<div class="mini-item">...y ${unreadBookmarks.length - 10} más</div>` : ''}
            </div>
          </details>
        `;
      }
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
      
    case 9: // Racha más larga - ARREGLADO: Días totales navegados
      const totalDays = Object.keys(dailyStats).length;
      const currentYear = new Date().getFullYear();
      
      // Actualizar título con año actual
      document.getElementById('streakTitle').textContent = `🔥 Días navegados en ${currentYear}`;
      document.getElementById('longestStreak').textContent = `${totalDays} días`;
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

// Generar resumen de texto para compartir
function generateShareText() {
  const siteStats = stats.siteStats || {};
  const categoryStats = stats.categoryStats || {};
  const dailyStats = stats.dailyStats || {};
  
  const sitesArray = Object.values(siteStats);
  const totalTime = sitesArray.reduce((sum, site) => sum + site.totalTime, 0);
  const hours = Math.floor(totalTime / (1000 * 60 * 60));
  const totalSites = sitesArray.length;
  const totalDays = Object.keys(dailyStats).length;
  
  const topSites = sitesArray
    .filter(site => !site.domain.includes('extension://') && site.domain !== '127.0.0.1')
    .sort((a, b) => b.visits - a.visits)
    .slice(0, 3);
  
  const topCategory = Object.entries(categoryStats)
    .filter(([id]) => id !== 'other')
    .sort((a, b) => b[1].visits - a[1].visits)[0];
  
  const year = new Date().getFullYear();
  
  let text = `🎵 Mi ${year} en BrowserRewind 🎵\n\n`;
  text += `⏰ ${hours}h navegando\n`;
  text += `🌐 ${totalSites} sitios únicos visitados\n`;
  text += `📅 ${totalDays} días activos\n\n`;
  text += `🏆 Top 3 Sitios:\n`;
  
  topSites.forEach((site, i) => {
    text += `${i + 1}. ${site.domain} (${formatNumber(site.visits)} visitas)\n`;
  });
  
  if (topCategory) {
    text += `\n${topCategory[1].emoji} Categoría favorita: ${topCategory[1].name}\n`;
  }
  
  text += `\n✨ Creado con BrowserRewind`;
  
  return text;
}

// Inicializar cuando el DOM esté listo
document.addEventListener('DOMContentLoaded', () => {
  console.log('🚀 DOM cargado, inicializando event listeners...');
  
  // Event listeners de navegación
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

  // Abrir modal de compartir
  document.getElementById('shareWrapped').addEventListener('click', () => {
    console.log('Abriendo modal de compartir');
    document.getElementById('shareModal').style.display = 'flex';
  });

  // Cerrar modal
  document.getElementById('closeShareModal').addEventListener('click', () => {
    document.getElementById('shareModal').style.display = 'none';
    document.getElementById('sharePreview').style.display = 'none';
  });

  // Cerrar al hacer click fuera del modal
  document.getElementById('shareModal').addEventListener('click', (e) => {
    if (e.target.id === 'shareModal') {
      document.getElementById('shareModal').style.display = 'none';
      document.getElementById('sharePreview').style.display = 'none';
    }
  });

  // Opción: Screenshot
  document.getElementById('shareScreenshot').addEventListener('click', async () => {
    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: { mediaSource: 'screen' }
      });
      
      const video = document.createElement('video');
      video.srcObject = stream;
      video.play();
      
      video.onloadedmetadata = () => {
        const canvas = document.createElement('canvas');
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        
        const ctx = canvas.getContext('2d');
        ctx.drawImage(video, 0, 0);
        
        stream.getTracks().forEach(track => track.stop());
        
        canvas.toBlob(blob => {
          const url = URL.createObjectURL(blob);
          const link = document.createElement('a');
          link.download = `browser-rewind-${new Date().getTime()}.png`;
          link.href = url;
          link.click();
          URL.revokeObjectURL(url);
        });
      };
      
      document.getElementById('shareModal').style.display = 'none';
    } catch (error) {
      console.error('Error capturando pantalla:', error);
      alert('💡 Tip: Usa las teclas de tu sistema para hacer screenshot:\n\nWindows: Win + Shift + S\nmacOS: Cmd + Shift + 4\nLinux: Print Screen');
    }
  });

  // Opción: Copiar texto
  document.getElementById('shareText').addEventListener('click', () => {
    const shareText = generateShareText();
    document.getElementById('shareTextContent').value = shareText;
    document.getElementById('sharePreview').style.display = 'block';
  });

  // Copiar texto al clipboard
  document.getElementById('copyShareText').addEventListener('click', async () => {
    const text = document.getElementById('shareTextContent').value;
    
    try {
      await navigator.clipboard.writeText(text);
      const btn = document.getElementById('copyShareText');
      btn.textContent = '✅ Copiado!';
      setTimeout(() => {
        btn.textContent = '📋 Copiar';
      }, 2000);
    } catch (error) {
      console.error('Error copiando:', error);
      alert('No se pudo copiar automáticamente. Por favor selecciona y copia el texto manualmente.');
    }
  });

  // Opción: Compartir en Twitter/X
  document.getElementById('shareTwitter').addEventListener('click', () => {
    const shareText = generateShareText();
    const tweetText = encodeURIComponent(shareText.substring(0, 280));
    const tweetUrl = `https://twitter.com/intent/tweet?text=${tweetText}`;
    window.open(tweetUrl, '_blank');
    document.getElementById('shareModal').style.display = 'none';
  });

  // Reiniciar
  document.getElementById('restartWrapped').addEventListener('click', () => {
    showSlide(1);
  });

  console.log('✅ Event listeners inicializados');
  
  // Cargar datos al iniciar
  loadData();
});