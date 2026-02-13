// ===== GOOGLE DRIVE МЕНЕДЖЕР =====
class GoogleDriveManager {
    constructor() {
        this.tokenClient = null;
        this.accessToken = null;
        this.folderId = null;
        this.isInitialized = false;
    }

    // Инициализация
    async initialize() {
        try {
            await this.loadGapi();
            await this.loadGis();
            
            // Пытаемся восстановить токен
            await this.restoreToken();
            
            await this.findOrCreateFolder();
            this.isInitialized = true;
            console.log('✅ Google Drive инициализирован, папка:', this.folderId);
            this.updateDriveStatus(true);
            return true;
        } catch (error) {
            console.error('❌ Ошибка инициализации:', error);
            this.updateDriveStatus(false);
            return false;
        }
    }

    // Обновление статуса
    updateDriveStatus(connected) {
        const statusEl = document.getElementById('driveStatus');
        if (!statusEl) return;
        
        const indicator = statusEl.querySelector('.status-indicator');
        const text = statusEl.querySelector('span:last-child');
        
        if (connected) {
            indicator.classList.add('connected');
            text.textContent = 'Google Drive подключён';
        } else {
            indicator.classList.remove('connected');
            text.textContent = 'Ошибка подключения к Drive';
        }
    }

    // Загрузка GAPI
    loadGapi() {
        return new Promise((resolve, reject) => {
            if (window.gapi) {
                this.initGapiClient().then(resolve);
                return;
            }
            
            const script = document.createElement('script');
            script.src = 'https://apis.google.com/js/api.js';
            script.onload = () => this.initGapiClient().then(resolve);
            script.onerror = reject;
            document.head.appendChild(script);
        });
    }

    // Инициализация GAPI
    async initGapiClient() {
        await new Promise((resolve) => {
            gapi.load('client', resolve);
        });
        
        await gapi.client.init({
            apiKey: CONFIG.DRIVE.API_KEY,
            discoveryDocs: CONFIG.DRIVE.DISCOVERY_DOCS
        });
    }

    // Загрузка GIS
    loadGis() {
        return new Promise((resolve, reject) => {
            if (window.google?.accounts) {
                this.initTokenClient();
                resolve();
                return;
            }
            
            const script = document.createElement('script');
            script.src = 'https://accounts.google.com/gsi/client';
            script.onload = () => {
                this.initTokenClient();
                resolve();
            };
            script.onerror = reject;
            document.head.appendChild(script);
        });
    }

    // Инициализация токен клиента
    initTokenClient() {
        this.tokenClient = google.accounts.oauth2.initTokenClient({
            client_id: CONFIG.DRIVE.CLIENT_ID,
            scope: CONFIG.DRIVE.SCOPES.join(' '),
            callback: (response) => {
                if (response.access_token) {
                    this.accessToken = response.access_token;
                    gapi.client.setToken({ access_token: response.access_token });
                    
                    // Сохраняем токен с временем жизни
                    const tokenData = {
                        token: response.access_token,
                        expires_in: response.expires_in || 3600,
                        timestamp: Date.now()
                    };
                    localStorage.setItem('gdrive_token', JSON.stringify(tokenData));
                    
                    console.log('✅ Токен сохранён, истекает через:', tokenData.expires_in, 'секунд');
                }
            },
        });
    }

    // Восстановление токена
    async restoreToken() {
        const saved = localStorage.getItem('gdrive_token');
        if (!saved) return false;
        
        try {
            const tokenData = JSON.parse(saved);
            const age = (Date.now() - tokenData.timestamp) / 1000;
            
            if (age < tokenData.expires_in) {
                gapi.client.setToken({ access_token: tokenData.token });
                console.log('✅ Токен восстановлен, возраст:', Math.round(age), 'сек');
                return true;
            } else {
                console.log('⏰ Токен истёк, возраст:', Math.round(age), 'сек');
                localStorage.removeItem('gdrive_token');
                return false;
            }
        } catch (e) {
            console.error('❌ Ошибка восстановления токена:', e);
            localStorage.removeItem('gdrive_token');
            return false;
        }
    }

    // Запрос токена
    async requestAccessToken(force = false) {
        if (!force) {
            const restored = await this.restoreToken();
            if (restored) return true;
        }
        
        return new Promise((resolve, reject) => {
            this.tokenClient.callback = (response) => {
                if (response.error) {
                    reject(response);
                } else {
                    gapi.client.setToken({ access_token: response.access_token });
                    
                    const tokenData = {
                        token: response.access_token,
                        expires_in: response.expires_in || 3600,
                        timestamp: Date.now()
                    };
                    localStorage.setItem('gdrive_token', JSON.stringify(tokenData));
                    
                    resolve(response);
                }
            };
            
            this.tokenClient.requestAccessToken({ prompt: force ? 'consent' : '' });
        });
    }

    // Поиск папки
    async findFolderByName(folderName) {
        try {
            const response = await gapi.client.drive.files.list({
                q: `name='${folderName}' and mimeType='application/vnd.google-apps.folder' and trashed=false`,
                fields: 'files(id, name)',
                spaces: 'drive'
            });
            
            return response.result.files[0] || null;
        } catch (error) {
            console.error('Ошибка поиска папки:', error);
            return null;
        }
    }

    // Создание папки
    async createFolder(folderName) {
        try {
            const response = await gapi.client.drive.files.create({
                resource: {
                    name: folderName,
                    mimeType: 'application/vnd.google-apps.folder'
                },
                fields: 'id'
            });
            
            return response.result;
        } catch (error) {
            console.error('Ошибка создания папки:', error);
            throw error;
        }
    }

    // Поиск или создание папки
    async findOrCreateFolder() {
        try {
            if (!gapi.client.getToken()) {
                await this.requestAccessToken();
            }
            
            const folder = await this.findFolderByName('E-Genius5 AI');
            
            if (folder) {
                this.folderId = folder.id;
                console.log('📁 Найдена папка:', folder.id);
                return folder.id;
            }
            
            const newFolder = await this.createFolder('E-Genius5 AI');
            this.folderId = newFolder.id;
            console.log('📁 Создана папка:', newFolder.id);
            return newFolder.id;
        } catch (error) {
            console.error('Ошибка:', error);
            throw error;
        }
    }

    // Загрузка JSON файла
    async loadJSONFile(fileName) {
        try {
            if (!this.folderId) await this.findOrCreateFolder();
            
            const response = await gapi.client.drive.files.list({
                q: `name='${fileName}' and '${this.folderId}' in parents and trashed=false`,
                fields: 'files(id)'
            });
            
            const files = response.result.files;
            if (!files.length) return null;
            
            const contentResponse = await gapi.client.drive.files.get({
                fileId: files[0].id,
                alt: 'media'
            });
            
            return contentResponse.result;
        } catch (error) {
            console.error(`Ошибка загрузки ${fileName}:`, error);
            return null;
        }
    }

    // Сохранение JSON файла
    async saveJSONFile(fileName, data) {
        try {
            if (!this.folderId) await this.findOrCreateFolder();
            
            const searchResponse = await gapi.client.drive.files.list({
                q: `name='${fileName}' and '${this.folderId}' in parents and trashed=false`,
                fields: 'files(id)'
            });
            
            const existingFiles = searchResponse.result.files;
            const jsonContent = JSON.stringify(data, null, 2);
            const blob = new Blob([jsonContent], { type: 'application/json' });
            const metadata = {
                name: fileName,
                mimeType: 'application/json',
                parents: [this.folderId]
            };
            
            const form = new FormData();
            form.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
            form.append('file', blob);
            
            const token = gapi.client.getToken().access_token;
            
            if (existingFiles.length) {
                await fetch(`https://www.googleapis.com/upload/drive/v3/files/${existingFiles[0].id}?uploadType=multipart`, {
                    method: 'PATCH',
                    headers: { 'Authorization': `Bearer ${token}` },
                    body: form
                });
            } else {
                await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart', {
                    method: 'POST',
                    headers: { 'Authorization': `Bearer ${token}` },
                    body: form
                });
            }
            
            console.log(`✅ Файл ${fileName} сохранён`);
        } catch (error) {
            console.error(`Ошибка сохранения ${fileName}:`, error);
            throw error;
        }
    }
}

// ===== АВТОРИЗАЦИЯ И СЕССИИ =====
const driveManager = new GoogleDriveManager();
let currentRole = null;

const SESSION_KEY = 'egenius_session';

// Проверка сессии
async function checkSession() {
    const sessionData = localStorage.getItem(SESSION_KEY);
    if (!sessionData) return null;
    
    try {
        const session = JSON.parse(sessionData);
        if (Date.now() > session.expiry) {
            localStorage.removeItem(SESSION_KEY);
            return null;
        }
        return session.role;
    } catch {
        localStorage.removeItem(SESSION_KEY);
        return null;
    }
}

// Показать модальное окно
function showPasswordModal(role) {
    currentRole = role;
    document.getElementById('modalTitle').textContent = 
        role === 'deputy' ? 'Вход для заместителя' : 'Вход для персонала';
    document.getElementById('passwordModal').classList.add('show');
    document.getElementById('passwordInput').focus();
}

// Закрыть модальное окно
function closeModal() {
    document.getElementById('passwordModal').classList.remove('show');
    document.getElementById('passwordInput').value = '';
    document.getElementById('errorMessage').classList.add('hidden');
}

// Показать/скрыть пароль
function togglePassword() {
    const input = document.getElementById('passwordInput');
    input.type = input.type === 'password' ? 'text' : 'password';
}

// Показать ошибку
function showError(message) {
    const errorEl = document.getElementById('errorMessage');
    errorEl.textContent = message;
    errorEl.classList.remove('hidden');
    setTimeout(() => errorEl.classList.add('hidden'), 3000);
}

// Показать загрузку
function showLoading() {
    document.getElementById('loadingModal').classList.add('show');
}

// Скрыть загрузку
function hideLoading() {
    document.getElementById('loadingModal').classList.remove('show');
}

// Создание конфига по умолчанию
async function createDefaultConfig() {
    // ⚠️ ПУСТЫЕ ЗНАЧЕНИЯ - пользователь сам введёт их в Google Drive
    const defaultConfig = {
        passwords: {
            deputy: "",  // Пароль заместителя (нужно ввести вручную в Google Drive)
            staff: ""    // Пароль персонала (нужно ввести вручную в Google Drive)
        },
        openrouter_key: "",  // Ключ OpenRouter (нужно ввести вручную в Google Drive)
        ai_model: CONFIG.AI.MODEL,
        daily_limit: CONFIG.AI.DAILY_LIMIT,
        session_duration_days: CONFIG.APP.SESSION_DAYS,
        created_at: new Date().toISOString()
    };
    
    await driveManager.saveJSONFile('config.json', defaultConfig);
    console.log('📄 Создан файл config.json. Заполните его в Google Drive!');
}

// Обработка входа
async function handleLogin() {
    const password = document.getElementById('passwordInput').value;
    if (!password) {
        showError('Введите пароль');
        return;
    }
    
    showLoading();
    
    try {
        if (!driveManager.isInitialized) {
            await driveManager.initialize();
        }
        
        let config = await driveManager.loadJSONFile('config.json');
        
        if (!config) {
            await createDefaultConfig();
            config = await driveManager.loadJSONFile('config.json');
            
            if (!config.passwords.deputy || !config.passwords.staff) {
                showError('Сначала заполните config.json в Google Drive!');
                hideLoading();
                return;
            }
        }
        
        if (!config.passwords || !config.passwords.deputy || !config.passwords.staff) {
            showError('Пароли не заполнены в config.json на Google Drive');
            hideLoading();
            return;
        }
        
        const expectedPassword = currentRole === 'deputy' 
            ? config.passwords.deputy 
            : config.passwords.staff;
        
        if (password === expectedPassword) {
            const sessionDuration = config.session_duration_days || CONFIG.APP.SESSION_DAYS;
            const session = {
                role: currentRole,
                loginTime: Date.now(),
                expiry: Date.now() + sessionDuration * 24 * 60 * 60 * 1000
            };
            
            localStorage.setItem(SESSION_KEY, JSON.stringify(session));
            
            document.body.style.opacity = '0';
            setTimeout(() => {
                window.location.href = 'chat.html';
            }, 500);
        } else {
            showError('Неверный пароль');
        }
    } catch (error) {
        console.error('Ошибка входа:', error);
        showError('Ошибка подключения к Google Drive');
    } finally {
        hideLoading();
    }
}

// Инициализация при загрузке страницы
document.addEventListener('DOMContentLoaded', async () => {
    setTimeout(async () => {
        await driveManager.initialize();
    }, 1000);
    
    if (window.location.pathname.includes('chat.html')) {
        const role = await checkSession();
        if (!role) {
            window.location.href = 'index.html';
        } else {
            currentRole = role;
            if (window.initializeChat) {
                window.initializeChat(role);
            }
        }
    }
});
