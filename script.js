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
    const mainScreen = document.getElementById('mainScreen');
    const statsScreen = document.getElementById('statsScreen');
    const navMainBtn = document.getElementById('navMain');
    const navStatsBtn = document.getElementById('navStats');
    const streakCountEl = document.getElementById('streakCount');
    const monthYearEl = document.getElementById('monthYear');
    const calendarGridEl = document.getElementById('calendarGrid');
    const prevMonthBtn = document.getElementById('prevMonthBtn');
    const nextMonthBtn = document.getElementById('nextMonthBtn');

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
    let currentMonthDate = new Date();
    
    // --- Настройка Firebase ---
    const userId = tg.initDataUnsafe?.user?.id ? String(tg.initDataUnsafe.user.id) : 'test-user-id';
    const userDocRef = db.collection('users').doc(userId);
    const dailyProgressCollectionRef = userDocRef.collection('daily_progress');

    // --- Функции ---

    async function loadState() {
        try {
            const userDoc = await userDocRef.get();
            if (userDoc.exists) {
                state.reservePoints = userDoc.data().reservePoints || 0;
            }

            const todayId = new Date().toISOString().split('T')[0]; // Формат YYYY-MM-DD
            const todayDoc = await dailyProgressCollectionRef.doc(todayId).get();
            if (todayDoc.exists) {
                state.currentPoints = todayDoc.data().points || 0;
            } else {
                state.currentPoints = 0;
            }
        } catch (error) {
            console.error("Ошибка загрузки данных:", error);
            alert("Не удалось загрузить данные. Проверьте соединение.");
        }
        updateUI();
    }

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
        
        updateUI();

        const todayId = new Date().toISOString().split('T')[0];
        await dailyProgressCollectionRef.doc(todayId).set({ points: state.currentPoints, goal: state.dailyGoal }, { merge: true });
        await userDocRef.set({ reservePoints: state.reservePoints }, { merge: true });

        tg.sendData(JSON.stringify({ name: product.name, points: product.points }));
    }

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

    // --- Логика навигации и статистики ---

    navMainBtn.addEventListener('click', () => {
        mainScreen.classList.remove('hidden');
        statsScreen.classList.add('hidden');
        navMainBtn.classList.add('active');
        navStatsBtn.classList.remove('active');
    });

    navStatsBtn.addEventListener('click', () => {
        mainScreen.classList.add('hidden');
        statsScreen.classList.remove('hidden');
        navMainBtn.classList.remove('active');
        navStatsBtn.classList.add('active');
        loadStats();
    });
    
    prevMonthBtn.addEventListener('click', () => {
        currentMonthDate.setMonth(currentMonthDate.getMonth() - 1);
        loadStats();
    });
    
    nextMonthBtn.addEventListener('click', () => {
        currentMonthDate.setMonth(currentMonthDate.getMonth() + 1);
        loadStats();
    });

    async function loadStats() {
        try {
            const dailyDocs = await dailyProgressCollectionRef.get();
            const dailyData = {};
            dailyDocs.forEach(doc => {
                dailyData[doc.id] = doc.data();
            });
            calculateStreak(dailyData);
            renderCalendar(currentMonthDate, dailyData);
        } catch (error) {
            console.error("Ошибка загрузки статистики:", error);
        }
    }

    function calculateStreak(dailyData) {
        let streak = 0;
        let today = new Date();
        
        while (true) {
            const dateStr = today.toISOString().split('T')[0];
            if (dailyData[dateStr] && dailyData[dateStr].points >= (dailyData[dateStr].goal || state.dailyGoal)) {
                streak++;
                today.setDate(today.getDate() - 1);
            } else {
                break;
            }
        }
        streakCountEl.textContent = streak;
    }

    function renderCalendar(date, dailyData) {
        calendarGridEl.innerHTML = '';
        const year = date.getFullYear();
        const month = date.getMonth();
        monthYearEl.textContent = date.toLocaleDateString('ru-RU', { month: 'long', year: 'numeric' });

        const firstDayOfMonth = new Date(year, month, 1).getDay();
        const daysInMonth = new Date(year, month + 1, 0).getDate();
        
        const dayHeaders = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];
        dayHeaders.forEach(header => {
            const dayEl = document.createElement('div');
            dayEl.className = 'day-header';
            dayEl.textContent = header;
            calendarGridEl.appendChild(dayEl);
        });
        
        let startDay = (firstDayOfMonth === 0) ? 6 : firstDayOfMonth - 1; // Понедельник = 0

        for (let i = 0; i < startDay; i++) {
            calendarGridEl.appendChild(document.createElement('div'));
        }

        for (let i = 1; i <= daysInMonth; i++) {
            const dayEl = document.createElement('div');
            dayEl.className = 'calendar-day';
            dayEl.textContent = i;
            
            const dateStr = new Date(year, month, i).toISOString().split('T')[0];
            if (dailyData[dateStr] && dailyData[dateStr].points >= (dailyData[dateStr].goal || state.dailyGoal)) {
                dayEl.classList.add('day-goal-met');
            }
            
            calendarGridEl.appendChild(dayEl);
        }
    }

    // --- Инициализация ---
    renderProductList();
    loadState();
});
