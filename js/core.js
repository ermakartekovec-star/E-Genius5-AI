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
            
            // ✅ ПРОВЕРЯЕМ СОХРАНЁННЫЙ ТОКЕН
            const hasToken = this.checkSavedToken();
            
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

    // Обновление статуса на странице
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
                    
                    // ✅ СОХРАНЯЕМ ТОКЕН
                    localStorage.setItem('gdrive_token', JSON.stringify({
                        token: response.access_token,
                        expires_in: response.expires_in || 3600,
                        timestamp: Date.now()
                    }));
                    
                    console.log('✅ Токен сохранён');
                }
            },
        });
    }

    // ✅ ПРОВЕРКА СОХРАНЁННОГО ТОКЕНА
    checkSavedToken() {
        const saved = localStorage.getItem('gdrive_token');
        if (saved) {
            try {
                const tokenData = JSON.parse(saved);
                // Проверяем, не истёк ли токен (обычно живёт 1 час = 3600 секунд)
                const expiresIn = tokenData.expires_in * 1000;
                const age = Date.now() - tokenData.timestamp;
                
                if (age < expiresIn) {
                    gapi.client.setToken({ access_token: tokenData.token });
                    console.log('✅ Используем сохранённый токен');
                    return true;
                } else {
                    console.log('⏰ Токен истёк, нужно обновить');
                    localStorage.removeItem('gdrive_token');
                }
            } catch (e) {
                console.error('Ошибка загрузки токена', e);
                localStorage.removeItem('gdrive_token');
            }
        }
        return false;
    }

    // Запрос токена
    requestAccessToken() {
        return new Promise((resolve, reject) => {
            // Проверяем, может уже есть сохранённый токен
            if (this.checkSavedToken()) {
                resolve({ access_token: JSON.parse(localStorage.getItem('gdrive_token')).token });
                return;
            }
            
            this.tokenClient.callback = (response) => {
                if (response.error) {
                    reject(response);
                } else {
                    gapi.client.setToken({ access_token: response.access_token });
                    
                    // ✅ СОХРАНЯЕМ ТОКЕН
                    localStorage.setItem('gdrive_token', JSON.stringify({
                        token: response.access_token,
                        expires_in: response.expires_in || 3600,
                        timestamp: Date.now()
                    }));
                    
                    resolve(response);
                }
            };
            
            // Запрашиваем токен без prompt, если есть сохранённая сессия
            this.tokenClient.requestAccessToken({ prompt: '' });
        });
    }

    // Поиск папки по имени
    async findFolderByName(folderName) {
        try {
            if (!gapi.client.getToken()) {
                await this.requestAccessToken();
            }
            
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
            if (!gapi.client.getToken()) {
                await this.requestAccessToken();
            }
            
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
            // Если нет токена - проверяем сохранённый или запрашиваем
            if (!gapi.client.getToken()) {
                const hasToken = this.checkSavedToken();
                if (!hasToken) {
                    await this.requestAccessToken();
                }
            }
            
            const folder = await this.findFolderByName('E-Genius5 AI');
            
            if (folder) {
                this.folderId = folder.id;
                return folder.id;
            }
            
            const newFolder = await this.createFolder('E-Genius5 AI');
            this.folderId = newFolder.id;
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
            if (!gapi.client.getToken()) await this.requestAccessToken();
            
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
            if (!gapi.client.getToken()) await this.requestAccessToken();
            
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
            
            const accessToken = gapi.client.getToken().access_token;
            
            if (existingFiles.length) {
                await fetch(`https://www.googleapis.com/upload/drive/v3/files/${existingFiles[0].id}?uploadType=multipart`, {
                    method: 'PATCH',
                    headers: { 'Authorization': `Bearer ${accessToken}` },
                    body: form
                });
            } else {
                await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart', {
                    method: 'POST',
                    headers: { 'Authorization': `Bearer ${accessToken}` },
                    body: form
                });
            }
        } catch (error) {
            console.error(`Ошибка сохранения ${fileName}:`, error);
            throw error;
        }
    }

    // Проверка существования файла
    async fileExists(fileName) {
        try {
            if (!this.folderId) await this.findOrCreateFolder();
            
            const response = await gapi.client.drive.files.list({
                q: `name='${fileName}' and '${this.folderId}' in parents and trashed=false`,
                fields: 'files(id)'
            });
            
            return response.result.files.length > 0;
        } catch (error) {
            return false;
        }
    }
}

// ===== АВТОРИЗАЦИЯ И СЕССИИ =====
const driveManager = new GoogleDriveManager();
let currentRole = null;

// Константы сессии
const SESSION_KEY = 'egenius_session';

// Проверка сессии при загрузке
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

// Показать модальное окно ввода пароля
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
            
            // Если только что создали конфиг - паролей ещё нет
            if (!config.passwords.deputy || !config.passwords.staff) {
                showError('Сначала заполните config.json в Google Drive!');
                hideLoading();
                return;
            }
        }
        
        // Проверяем, заполнены ли пароли
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
            
            // Плавный переход
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
    // Показываем статус подключения
    setTimeout(async () => {
        await driveManager.initialize();
    }, 1000);
    
    // Если мы на chat.html, проверяем сессию
    if (window.location.pathname.includes('chat.html')) {
        const role = await checkSession();
        if (!role) {
            window.location.href = 'index.html';
        } else {
            currentRole = role;
            // Функция инициализации чата будет вызвана из chat.js
            if (window.initializeChat) {
                window.initializeChat(role);
            }
        }
    }
});