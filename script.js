document.addEventListener('DOMContentLoaded', () => {
    const tg = window.Telegram.WebApp;
    tg.ready();
    tg.expand();

    // --- Элементы UI ---
    const progressTextEl = document.getElementById('progressText');
    const progressBarEl = document.getElementById('progressBar');
    const goalStatusEl = document.getElementById('goalStatus');
    const reservePointsEl = document.getElementById('reservePoints');
    const productListEl = document.getElementById('productList');

    // --- Каталог товаров ---
    const products = [
        { id: 1, name: 'Батарея Dyson', points: 5 },
        { id: 2, name: 'Main Body Dyson', points: 10 },
        { id: 3, name: 'Наушники Shokz', points: 10 },
        { id: 4, name: 'Аппарат Cefaly', points: 45 },
        { id: 5, name: 'Фильтр Dyson', points: 3 },
        { id: 6, name: 'Стайлер Dyson', points: 20 },
    ];

    // --- Состояние приложения ---
    let state = {
        dailyGoal: 100,
        currentPoints: 0,
        reservePoints: 0,
    };
    
    // Создаем уникальный ID пользователя из данных Telegram
    const userId = tg.initDataUnsafe?.user?.id ? String(tg.initDataUnsafe.user.id) : 'test-user-id';
    // Получаем ссылку на "документ" пользователя в базе данных
    const userDocRef = db.collection('users').doc(userId);

    // --- Функции ---

    // ЗАГРУЗКА данных из Firebase
    async function loadState() {
        try {
            const doc = await userDocRef.get();
            if (doc.exists) {
                const data = doc.data();
                const today = new Date().toDateString();
                // Проверяем, когда данные обновлялись в последний раз
                const lastUpdate = data.lastUpdate ? new Date(data.lastUpdate).toDateString() : null;

                // Если наступил новый день, сбрасываем дневной прогресс
                if (today !== lastUpdate) {
                    state.currentPoints = 0;
                    state.reservePoints = data.reservePoints || 0;
                    // Сохраняем сброшенный прогресс в базу
                    await saveData({ currentPoints: 0, lastUpdate: new Date().toISOString() });
                } else {
                    // Если день тот же, просто загружаем данные
                    state.currentPoints = data.currentPoints || 0;
                    state.reservePoints = data.reservePoints || 0;
                }
            } else {
                // Если пользователь зашел впервые, создаем для него запись в базе
                await saveData({
                    currentPoints: 0,
                    reservePoints: 0,
                    lastUpdate: new Date().toISOString(),
                    telegramUsername: tg.initDataUnsafe?.user?.username || 'unknown'
                });
            }
        } catch (error) {
            console.error("Ошибка загрузки данных из Firebase:", error);
            alert("Не удалось подключиться к базе данных. Проверьте подключение к интернету.");
        }
        updateUI(); // Обновляем интерфейс после загрузки
    }

    // СОХРАНЕНИЕ данных в Firebase
    async function saveData(dataToSave) {
        try {
            // Метод set с { merge: true } обновляет только указанные поля, не стирая остальные
            await userDocRef.set(dataToSave, { merge: true });
        } catch (error) {
            console.error("Ошибка сохранения данных в Firebase:", error);
        }
    }

    // Обновление всех элементов интерфейса
    function updateUI() {
        progressTextEl.textContent = `${state.currentPoints} / ${state.dailyGoal}`;
        reservePointsEl.textContent = state.reservePoints;
        const progressPercent = Math.min(100, (state.currentPoints / state.dailyGoal) * 100);
        progressBarEl.style.width = `${progressPercent}%`;

        if (state.currentPoints >= state.dailyGoal) {
            goalStatusEl.textContent = '🔥 План выполнен!';
            goalStatusEl.style.color = 'green';
        } else {
            goalStatusEl.textContent = '';
        }
    }

    // Рендеринг списка товаров
    function renderProductList() {
        productListEl.innerHTML = '';
        products.forEach(product => {
            const item = document.createElement('div');
            item.className = 'product-item';
            item.innerHTML = `
                <div>
                    <div class="product-info">${product.name}</div>
                    <div class="product-points">+${product.points} очков</div>
                </div>
                <div class="add-button">+</div>
            `;
            item.addEventListener('click', () => addProduct(product));
            productListEl.appendChild(item);
        });
    }

    // Логика добавления продукта (теперь она асинхронная)
    async function addProduct(product) {
        const previousPoints = state.currentPoints;
        state.currentPoints += product.points;

        let newReservePoints = state.reservePoints;
        if (previousPoints < state.dailyGoal && state.currentPoints >= state.dailyGoal) {
            const overflow = state.currentPoints - state.dailyGoal;
            newReservePoints += overflow;
            tg.HapticFeedback.notificationOccurred('success');
        } else if (state.currentPoints > state.dailyGoal) {
            newReservePoints += product.points;
        }
        state.reservePoints = newReservePoints;
        
        // Обновляем UI сразу для отзывчивости
        updateUI();

        // Отправляем данные в Firebase на сохранение
        await saveData({ 
            currentPoints: state.currentPoints, 
            reservePoints: state.reservePoints,
            lastUpdate: new Date().toISOString()
        });

        // Отправляем данные боту для подтверждения
        tg.sendData(JSON.stringify({ name: product.name, points: product.points }));
    }

    // --- Инициализация приложения ---
    renderProductList();
    loadState(); // Запускаем загрузку данных из облака
});
