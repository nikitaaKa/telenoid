// --- Supabase настройка ---
const SUPABASE_URL = 'https://qvjsbjchbhwyxbiniyag.supabase.co'; // <-- Вставь сюда свой URL из Supabase
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InF2anNiamNoYmh3eXhiaW5peWFnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTI4NTU5ODgsImV4cCI6MjA2ODQzMTk4OH0.f-oXoe6nLPtBF2K9qOVT2SxdEb7fxIEgutuF19F-iVk';   // <-- Вставь сюда свой ключ из Supabase
const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

// --- Telegram настройка ---
const tg = window.Telegram.WebApp;
tg.ready(); // Сообщаем Telegram, что приложение готово

// --- Phaser конфигурация ---
const config = {
    type: Phaser.AUTO,
    width: window.innerWidth,
    height: window.innerHeight,
    backgroundColor: '#1d212d',
    physics: {
        default: 'arcade',
        arcade: {
            gravity: { y: 0 },
        }
    },
    // Регистрируем все наши сцены
    scene: [MainMenuScene, GameScene, LeaderboardScene]
};

// Запускаем игру
const game = new Phaser.Game(config);