// ===== УПРАВЛЕНИЕ ТЕМАМИ =====
function toggleTheme() {
    const body = document.body;
    const themeStyle = document.getElementById('theme-style');
    
    if (body.classList.contains('light-theme')) {
        body.classList.remove('light-theme');
        body.classList.add('dark-theme');
        localStorage.setItem('theme', 'dark');
        updateThemeMeta('dark');
    } else {
        body.classList.remove('dark-theme');
        body.classList.add('light-theme');
        localStorage.setItem('theme', 'light');
        updateThemeMeta('light');
    }
}

function updateThemeMeta(theme) {
    const metaThemeColor = document.getElementById('theme-color');
    if (theme === 'dark') {
        metaThemeColor.setAttribute('content', '#1a1a2e');
    } else {
        metaThemeColor.setAttribute('content', '#667eea');
    }
}

// Загрузка сохранённой темы
function loadTheme() {
    const savedTheme = localStorage.getItem('theme') || 'light';
    const body = document.body;
    const themeStyle = document.getElementById('theme-style');
    
    body.classList.remove('light-theme', 'dark-theme');
    body.classList.add(savedTheme + '-theme');
    updateThemeMeta(savedTheme);
}

// Запуск при загрузке
document.addEventListener('DOMContentLoaded', loadTheme);