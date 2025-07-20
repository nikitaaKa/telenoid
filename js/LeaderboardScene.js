class LeaderboardScene extends Phaser.Scene {
    constructor() {
        super({ key: 'LeaderboardScene' });
    }

    create() {
        const { width, height } = this.cameras.main;

        // Заголовок
        this.add.text(width / 2, 50, 'Таблица Лидеров', { fontSize: '40px', color: '#fff' }).setOrigin(0.5);

        // Кнопка "Назад"
        const backButton = this.add.text(width - 20, 20, 'Назад', { fontSize: '24px', color: '#fff' }).setOrigin(1, 0).setInteractive();
        backButton.on('pointerdown', () => {
            this.scene.start('MainMenuScene');
        });

        // Кнопка "Поделиться"
        const shareButton = this.add.text(20, 20, 'Поделиться', { fontSize: '24px', color: '#fff' }).setOrigin(0, 0).setInteractive();
        shareButton.on('pointerdown', () => {
            const bot_username = '@tele_noid_bot'; // <-- ЗАМЕНИ НА НИК ТВОЕГО БОТА
            const text = `Я играю в Арканоид прямо в телеграме! Присоединяйся!`;
            const url = `https://t.me/${bot_username}`;
            tg.openTelegramLink(`https://t.me/share/url?url=${encodeURIComponent(url)}&text=${encodeURIComponent(text)}`);
        });

        // Текст загрузки
        const loadingText = this.add.text(width / 2, height / 2, 'Загрузка...', { fontSize: '32px', color: '#fff' }).setOrigin(0.5);

        // Запрашиваем данные из Supabase
        this.fetchLeaderboard(loadingText);
    }

    async fetchLeaderboard(loadingText) {
        try {
            // --- 1. Проверяем, существует ли еще объект loadingText ---
            // Если его нет, значит, сцена была закрыта, и нам не нужно ничего делать.
            if (!loadingText || !loadingText.scene) {
                return;
            }

            const { data, error } = await supabaseClient // Убедись, что используешь supabaseClient
                .from('leaderboards')
                .select('username, score')
                .order('score', { ascending: false })
                .limit(10);

            if (error) throw error;

            // --- 2. Снова проверяем перед тем, как что-то делать ---
            if (loadingText && loadingText.active) {
                loadingText.destroy();
                // И проверяем, что сама сцена все еще активна
                if (this.scene.isActive(this.sys.settings.key)) {
                    this.displayScores(data);
                }
            }

        } catch (error) {
            console.error('Error fetching leaderboard:', error);

            // --- 3. И здесь тоже проверяем ---
            if (loadingText && loadingText.active) {
                loadingText.setText('Ошибка загрузки');
            }
        }
    }

    displayScores(scores) {
        const { width, height } = this.cameras.main;
        let yPos = 120;

        scores.forEach((entry, index) => {
            const rank = `${index + 1}.`;
            const name = entry.username || 'Аноним';
            const score = entry.score;

            this.add.text(width * 0.1, yPos, rank, { fontSize: '28px', color: '#fff' }).setOrigin(0, 0.5);
            this.add.text(width * 0.2, yPos, name, { fontSize: '28px', color: '#fff' }).setOrigin(0, 0.5);
            this.add.text(width * 0.9, yPos, score, { fontSize: '28px', color: '#fff' }).setOrigin(1, 0.5);

            yPos += 50;
        });
    }
}