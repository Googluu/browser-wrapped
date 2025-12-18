// Categorización automática de sitios web
const SITE_CATEGORIES = {
  development: {
    name: 'Desarrollo',
    emoji: '💻',
    color: '#3b82f6',
    keywords: ['github', 'stackoverflow', 'gitlab', 'bitbucket', 'codepen', 'jsfiddle', 
               'dev.to', 'medium.com/tag/programming', 'hackernoon', 'freecodecamp',
               'leetcode', 'hackerrank', 'codesandbox', 'replit', 'vercel', 'netlify',
               'firebase', 'aws.amazon', 'cloud.google', 'heroku', 'docker', 'kubernetes',
               'npm', 'pypi', 'maven', 'packagist']
  },
  
  social: {
    name: 'Redes Sociales',
    emoji: '👥',
    color: '#ec4899',
    keywords: ['facebook', 'twitter', 'instagram', 'linkedin', 'tiktok', 'snapchat',
               'reddit', 'pinterest', 'tumblr', 'whatsapp', 'telegram', 'discord',
               'slack.com/messages', 'teams.microsoft']
  },
  
  video: {
    name: 'Videos',
    emoji: '🎬',
    color: '#ef4444',
    keywords: ['youtube', 'netflix', 'twitch', 'vimeo', 'dailymotion', 'hulu',
               'disneyplus', 'primevideo', 'hbomax', 'crunchyroll']
  },
  
  music: {
    name: 'Música',
    emoji: '🎵',
    color: '#10b981',
    keywords: ['spotify', 'soundcloud', 'youtube.com/music', 'apple.com/music',
               'deezer', 'tidal', 'pandora', 'bandcamp']
  },
  
  news: {
    name: 'Noticias',
    emoji: '📰',
    color: '#f59e0b',
    keywords: ['bbc', 'cnn', 'nytimes', 'theguardian', 'reuters', 'bloomberg',
               'eltiempo', 'elespectador', 'semana', 'portafolio', 'news', 'noticias']
  },
  
  shopping: {
    name: 'Compras',
    emoji: '🛒',
    color: '#8b5cf6',
    keywords: ['amazon', 'ebay', 'mercadolibre', 'aliexpress', 'etsy', 'walmart',
               'target', 'bestbuy', 'falabella', 'exito', 'linio', 'shopify']
  },
  
  productivity: {
    name: 'Productividad',
    emoji: '📊',
    color: '#06b6d4',
    keywords: ['notion', 'trello', 'asana', 'jira', 'monday', 'clickup',
               'google.com/drive', 'docs.google', 'sheets.google', 'slides.google',
               'office.com', 'onedrive', 'dropbox', 'evernote', 'todoist']
  },
  
  education: {
    name: 'Educación',
    emoji: '📚',
    color: '#84cc16',
    keywords: ['coursera', 'udemy', 'edx', 'khanacademy', 'duolingo', 'platzi',
               'skillshare', 'linkedin.com/learning', 'youtube.com/watch', 'wikipedia',
               'wikihow', 'quora']
  },
  
  email: {
    name: 'Email',
    emoji: '📧',
    color: '#64748b',
    keywords: ['gmail', 'outlook', 'yahoo.com/mail', 'protonmail', 'mail.google']
  },
  
  gaming: {
    name: 'Gaming',
    emoji: '🎮',
    color: '#a855f7',
    keywords: ['steam', 'epicgames', 'ea.com', 'blizzard', 'riotgames', 'chess.com',
               'lichess', 'miniclip', 'poki', 'crazygames']
  },
  
  finance: {
    name: 'Finanzas',
    emoji: '💰',
    color: '#22c55e',
    keywords: ['paypal', 'stripe', 'bancolombia', 'davivienda', 'nequi', 'daviplata',
               'coinbase', 'binance', 'robinhood', 'etrade', 'investing.com']
  },
  
  other: {
    name: 'Otros',
    emoji: '🌐',
    color: '#6b7280',
    keywords: []
  }
};

// Función para categorizar un dominio
function categorizeDomain(domain) {
  const lowerDomain = domain.toLowerCase();
  
  for (const [key, category] of Object.entries(SITE_CATEGORIES)) {
    if (key === 'other') continue;
    
    for (const keyword of category.keywords) {
      if (lowerDomain.includes(keyword)) {
        return {
          id: key,
          ...category
        };
      }
    }
  }
  
  return {
    id: 'other',
    ...SITE_CATEGORIES.other
  };
}

// CRÍTICO: Exportar al objeto window para uso en el navegador
if (typeof window !== 'undefined') {
  window.SITE_CATEGORIES = SITE_CATEGORIES;
  window.categorizeDomain = categorizeDomain;
}

// Exportar para uso en service workers (background.js)
if (typeof self !== 'undefined' && self.importScripts) {
  self.SITE_CATEGORIES = SITE_CATEGORIES;
  self.categorizeDomain = categorizeDomain;
}

// Exportar para uso en Node.js (si aplica)
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { SITE_CATEGORIES, categorizeDomain };
}