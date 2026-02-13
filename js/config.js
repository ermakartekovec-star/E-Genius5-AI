// ===== КОНФИГУРАЦИЯ E-GENIUS5 AI =====
const CONFIG = {
    // Google Drive
    DRIVE: {
        // ВАШ CLIENT ID
        CLIENT_ID: '453694345708-lq3l4fbdfhjtc9bfnsqv475gfagr93q1.apps.googleusercontent.com',
        
        // ВАШ CLIENT SECRET
        CLIENT_SECRET: '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',
        
        // ВАШ API KEY
        API_KEY: 'AIzaSyBgVlVDEnwnPlDuN43WDYG2OjmD5e32ZDY',
        
        // Права доступа
        SCOPES: ['https://www.googleapis.com/auth/drive'],
        DISCOVERY_DOCS: ['https://www.googleapis.com/discovery/v1/apis/drive/v3/rest'],
        PROJECT_ID: 'e-genius5-ai'
    },
    
    // Настройки приложения
    APP: {
        NAME: 'E-Genius5 AI',
        SESSION_DAYS: 30,
        POLLING_INTERVAL: 3000,
        REDIRECT_URIS: ['https://ermakartekovec-star.github.io'],
        JAVASCRIPT_ORIGINS: ['https://ermakartekovec-star.github.io']
    },
    
    // OpenRouter AI
    AI: {
        MODEL: 'arcee-ai/trinity-large-preview-free',
        DAILY_LIMIT: 50
    }
};

console.log('✅ Конфигурация загружена');
console.log('🔑 API Key:', CONFIG.DRIVE.API_KEY);
