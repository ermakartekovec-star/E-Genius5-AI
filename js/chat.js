// ===== ЧАТ ЛОГИКА =====
let messages = [];
let lastMessageId = null;
let dailyCount = 0;
let pollingInterval = null;
let isSending = false;

// Инициализация чата (вызывается из core.js)
window.initializeChat = async function(role) {
    currentRole = role;
    
    // Обновляем интерфейс согласно роли
    updateUIForRole(role);
    
    // Загружаем историю
    await loadChatHistory();
    
    // Загружаем дневную статистику
    await loadDailyStats();
    
    // Прокручиваем вниз
    scrollToBottom();
    
    // Фокусируем поле ввода
    document.getElementById('messageInput').focus();
    
    // Запускаем автообновление
    startMessagePolling();
};

// Обновление интерфейса под роль
function updateUIForRole(role) {
    const roleIcon = document.getElementById('roleIcon');
    const roleText = document.getElementById('roleText');
    const chatTitle = document.getElementById('chatTitle');
    const aiBadge = document.getElementById('aiBadge');
    const dailyCounter = document.getElementById('dailyCounter');
    
    if (role === 'deputy') {
        roleIcon.textContent = '👤';
        roleText.textContent = 'Заместитель';
        chatTitle.innerHTML = 'E-Genius5 AI';
        aiBadge.style.display = 'inline';
        dailyCounter.style.display = 'flex';
    } else {
        roleIcon.textContent = '👥';
        roleText.textContent = 'Персонал';
        chatTitle.textContent = 'E-Genius5 AI · Чат';
        aiBadge.style.display = 'none';
        dailyCounter.style.display = 'none';
    }
}

// Загрузка истории чата
async function loadChatHistory() {
    try {
        const data = await driveManager.loadJSONFile('chat_history.json');
        
        if (data && data.messages) {
            messages = data.messages;
            displayMessages(messages);
            lastMessageId = messages.length > 0 ? messages[messages.length - 1].id : null;
        }
    } catch (error) {
        console.error('Ошибка загрузки истории:', error);
    }
}

// Загрузка дневной статистики
async function loadDailyStats() {
    try {
        const data = await driveManager.loadJSONFile('chat_history.json');
        
        if (data && data.daily_stats) {
            const today = new Date().toISOString().split('T')[0];
            
            if (data.daily_stats.date === today) {
                dailyCount = data.daily_stats.ai_requests || 0;
            } else {
                dailyCount = 0;
            }
            
            updateDailyCounter();
        }
    } catch (error) {
        console.error('Ошибка загрузки статистики:', error);
    }
}

// Обновление счётчика
function updateDailyCounter() {
    const counterText = document.getElementById('counterText');
    const progressBar = document.getElementById('progressBar');
    
    if (counterText && progressBar) {
        counterText.textContent = `${dailyCount}/${CONFIG.AI.DAILY_LIMIT}`;
        const percent = (dailyCount / CONFIG.AI.DAILY_LIMIT) * 100;
        progressBar.style.width = `${Math.min(percent, 100)}%`;
    }
}

// Отображение сообщений
function displayMessages(messagesToShow) {
    const container = document.getElementById('messagesContainer');
    if (!container) return;
    
    container.innerHTML = '';
    
    // Группируем по дням
    const groups = {};
    messagesToShow.forEach(msg => {
        const date = new Date(msg.timestamp).toLocaleDateString('ru-RU', {
            day: 'numeric', month: 'long', year: 'numeric'
        });
        if (!groups[date]) groups[date] = [];
        groups[date].push(msg);
    });
    
    // Отображаем
    Object.entries(groups).forEach(([date, dayMessages]) => {
        container.appendChild(createDayDivider(date));
        dayMessages.forEach(msg => container.appendChild(createMessageElement(msg)));
    });
}

// Создание разделителя дня
function createDayDivider(date) {
    const div = document.createElement('div');
    div.className = 'day-divider';
    div.innerHTML = `<span>${date}</span>`;
    return div;
}

// Создание элемента сообщения
function createMessageElement(message) {
    const div = document.createElement('div');
    div.className = `message message-${message.sender === currentRole ? 'own' : 'other'}`;
    
    if (message.sender === 'ai') {
        div.classList.add('message-ai');
    }
    
    const time = new Date(message.timestamp).toLocaleTimeString('ru-RU', {
        hour: '2-digit', minute: '2-digit'
    });
    
    let senderName = '';
    if (message.sender === 'deputy') senderName = 'Заместитель';
    else if (message.sender === 'staff') senderName = 'Персонал';
    else if (message.sender === 'ai') senderName = 'E-Genius AI';
    
    div.innerHTML = `
        <div class="message-bubble">
            <div class="message-content">${escapeHtml(message.content)}</div>
            <div class="message-meta">
                <span class="message-sender">${senderName}</span>
                <span class="message-time">${time}</span>
            </div>
        </div>
    `;
    
    return div;
}

// Экранирование HTML
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// Автоизменение размера textarea
window.autoResize = function(textarea) {
    textarea.style.height = 'auto';
    textarea.style.height = (textarea.scrollHeight) + 'px';
};

// Прокрутка вниз
function scrollToBottom(animated = false) {
    const container = document.getElementById('messagesContainer');
    if (animated) {
        container.scrollTo({ top: container.scrollHeight, behavior: 'smooth' });
    } else {
        container.scrollTop = container.scrollHeight;
    }
}

// Генерация ID сообщения
function generateMessageId() {
    return 'msg_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
}

// Показать индикатор набора
function showTypingIndicator() {
    document.getElementById('typingIndicator').classList.remove('hidden');
}

// Скрыть индикатор набора
function hideTypingIndicator() {
    document.getElementById('typingIndicator').classList.add('hidden');
}

// Показать баннер лимита
function showLimitBanner() {
    document.getElementById('limitBanner').classList.remove('hidden');
}

// Скрыть баннер лимита
window.hideLimitBanner = function() {
    document.getElementById('limitBanner').classList.add('hidden');
};

// Показать ошибку в модальном окне
function showErrorModal(text) {
    document.getElementById('errorModalText').textContent = text;
    document.getElementById('errorModal').classList.add('show');
}

// Закрыть ошибку
window.closeErrorModal = function() {
    document.getElementById('errorModal').classList.remove('show');
};

// Отправка сообщения
window.sendMessage = async function() {
    if (isSending) return;
    
    const input = document.getElementById('messageInput');
    const messageText = input.value.trim();
    
    if (!messageText) return;
    
    isSending = true;
    
    try {
        // Сообщение пользователя
        const userMessage = {
            id: generateMessageId(),
            role: currentRole === 'deputy' ? 'user' : 'staff',
            content: messageText,
            sender: currentRole,
            timestamp: new Date().toISOString()
        };
        
        messages.push(userMessage);
        input.value = '';
        autoResize(input);
        
        // Добавляем в DOM
        document.getElementById('messagesContainer').appendChild(createMessageElement(userMessage));
        
        // Сохраняем
        await saveMessagesToDrive();
        
        // Если заместитель - отправляем в ИИ
        if (currentRole === 'deputy') {
            await sendToAI(messageText);
        }
        
        scrollToBottom();
        
    } catch (error) {
        console.error('Ошибка отправки:', error);
        showErrorModal('Ошибка при отправке сообщения');
    } finally {
        isSending = false;
    }
};

// Отправка в ИИ
async function sendToAI(userMessage) {
    if (dailyCount >= CONFIG.AI.DAILY_LIMIT) {
        showLimitBanner();
        return;
    }
    
    showTypingIndicator();
    
    try {
        const config = await driveManager.loadJSONFile('config.json');
        
        if (!config || !config.openrouter_key) {
            throw new Error('Ключ OpenRouter не найден');
        }
        
        const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${config.openrouter_key}`,
                'Content-Type': 'application/json',
                'HTTP-Referer': window.location.origin,
                'X-Title': CONFIG.APP.NAME
            },
            body: JSON.stringify({
                model: config.ai_model || CONFIG.AI.MODEL,
                messages: [
                    {
                        role: 'system',
                        content: 'Ты полезный ассистент для заместителя. Отвечай кратко и по делу.'
                    },
                    {
                        role: 'user',
                        content: userMessage
                    }
                ]
            })
        });
        
        hideTypingIndicator();
        
        if (response.status === 429) {
            showLimitBanner();
            return;
        }
        
        if (!response.ok) {
            throw new Error(`API error: ${response.status}`);
        }
        
        const data = await response.json();
        const aiResponse = data.choices[0].message.content;
        
        const aiMessage = {
            id: generateMessageId(),
            role: 'assistant',
            content: aiResponse,
            sender: 'ai',
            timestamp: new Date().toISOString()
        };
        
        messages.push(aiMessage);
        dailyCount++;
        updateDailyCounter();
        
        // Добавляем в DOM
        document.getElementById('messagesContainer').appendChild(createMessageElement(aiMessage));
        
        // Сохраняем статистику
        await updateDailyStats();
        await saveMessagesToDrive();
        
        scrollToBottom();
        
    } catch (error) {
        console.error('AI error:', error);
        hideTypingIndicator();
        
        const errorMessage = {
            id: generateMessageId(),
            role: 'assistant',
            content: '⚠️ Ошибка подключения к ИИ. Попробуйте позже.',
            sender: 'ai',
            timestamp: new Date().toISOString(),
            isError: true
        };
        
        messages.push(errorMessage);
        document.getElementById('messagesContainer').appendChild(createMessageElement(errorMessage));
        await saveMessagesToDrive();
    }
}

// Обновление дневной статистики
async function updateDailyStats() {
    try {
        const data = await driveManager.loadJSONFile('chat_history.json') || { messages: [] };
        const today = new Date().toISOString().split('T')[0];
        
        data.daily_stats = {
            date: today,
            ai_requests: dailyCount
        };
        
        await driveManager.saveJSONFile('chat_history.json', data);
    } catch (error) {
        console.error('Ошибка обновления статистики:', error);
    }
}

// Сохранение сообщений
async function saveMessagesToDrive() {
    try {
        const data = {
            messages: messages,
            daily_stats: {
                date: new Date().toISOString().split('T')[0],
                ai_requests: dailyCount
            },
            last_updated: new Date().toISOString()
        };
        
        await driveManager.saveJSONFile('chat_history.json', data);
    } catch (error) {
        console.error('Ошибка сохранения:', error);
    }
}

// Автообновление сообщений
function startMessagePolling() {
    pollingInterval = setInterval(async () => {
        try {
            const data = await driveManager.loadJSONFile('chat_history.json');
            
            if (data && data.messages && data.messages.length > 0) {
                const lastMessage = data.messages[data.messages.length - 1];
                
                if (lastMessage.id !== lastMessageId) {
                    const newMessages = data.messages.filter(m => 
                        !messages.some(oldM => oldM.id === m.id)
                    );
                    
                    newMessages.forEach(msg => {
                        messages.push(msg);
                        document.getElementById('messagesContainer').appendChild(createMessageElement(msg));
                    });
                    
                    lastMessageId = lastMessage.id;
                    scrollToBottom();
                }
            }
        } catch (error) {
            console.error('Polling error:', error);
        }
    }, CONFIG.APP.POLLING_INTERVAL);
}

// Обработка нажатия клавиш
window.handleKeyDown = function(event) {
    if (event.key === 'Enter' && !event.shiftKey) {
        event.preventDefault();
        sendMessage();
    }
};

// Заглушки для функций (чтобы не было ошибок)
window.showAttachMenu = function() {
    showErrorModal('Функция прикрепления файлов в разработке');
};

window.showEmojiPicker = function() {
    showErrorModal('Выбор эмодзи в разработке');
};