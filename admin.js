document.addEventListener('DOMContentLoaded', () => {
    // --- ПРОСТАЯ ЗАЩИТА ПАРОЛЕМ ---
    const ADMIN_PASSWORD = "admin"; // Можете поменять на свой пароль
    
    function checkAuth() {
        const isAuthenticated = sessionStorage.getItem('isAdminAuthenticated');
        if (isAuthenticated) {
            document.getElementById('admin-content').classList.remove('hidden');
            initializeAdminPanel();
        } else {
            const password = prompt("Введите пароль администратора:");
            if (password === ADMIN_PASSWORD) {
                sessionStorage.setItem('isAdminAuthenticated', 'true');
                document.getElementById('admin-content').classList.remove('hidden');
                initializeAdminPanel();
            } else {
                alert("Неверный пароль!");
                document.body.innerHTML = "<h1>Доступ запрещен</h1>";
            }
        }
    }

    // --- Настройка Firebase ---
    const productsCollectionRef = db.collection('products');

    function initializeAdminPanel() {
        // --- Элементы UI ---
        const adminProductListEl = document.getElementById('adminProductList');
        const saveButton = document.getElementById('saveButton');
        const productNameInput = document.getElementById('productName');
        const productPointsInput = document.getElementById('productPoints');
        const productIdInput = document.getElementById('productId');
        const formTitle = document.getElementById('form-title');

        // --- Функции ---

        async function loadProducts() {
            adminProductListEl.innerHTML = '<p>Загрузка...</p>';
            const snapshot = await productsCollectionRef.orderBy("name").get();
            adminProductListEl.innerHTML = '';
            
            snapshot.forEach(doc => {
                const product = { id: doc.id, ...doc.data() };
                const item = document.createElement('div');
                item.className = 'product-item';
                item.innerHTML = `
                    <div>
                        <div class="product-info">${product.name}</div>
                        <div class="product-points">${product.points} очков</div>
                    </div>
                    <div>
                        <button class="edit-btn">✏️</button>
                        <button class="delete-btn">❌</button>
                    </div>
                `;
                
                item.querySelector('.delete-btn').addEventListener('click', () => deleteProduct(product.id, product.name));
                item.querySelector('.edit-btn').addEventListener('click', () => editProduct(product));

                adminProductListEl.appendChild(item);
            });
        }

        async function saveProduct() {
            const name = productNameInput.value.trim();
            const points = parseInt(productPointsInput.value, 10);
            const id = productIdInput.value;

            if (!name || isNaN(points)) {
                alert("Пожалуйста, заполните все поля корректно.");
                return;
            }

            const productData = { name, points };

            saveButton.disabled = true;
            saveButton.textContent = 'Сохранение...';

            try {
                if (id) {
                    await productsCollectionRef.doc(id).update(productData);
                } else {
                    await productsCollectionRef.add(productData);
                }
            } catch (error) {
                console.error("Ошибка сохранения: ", error);
                alert("Не удалось сохранить товар.");
            }

            productNameInput.value = '';
            productPointsInput.value = '';
            productIdInput.value = '';
            formTitle.textContent = 'Добавить товар';
            saveButton.disabled = false;
            saveButton.textContent = 'Сохранить';
            loadProducts();
        }

        async function deleteProduct(id, name) {
            if (confirm(`Вы уверены, что хотите удалить "${name}"?`)) {
                await productsCollectionRef.doc(id).delete();
                loadProducts();
            }
        }
        
        function editProduct(product) {
            formTitle.textContent = 'Редактировать товар';
            productNameInput.value = product.name;
            productPointsInput.value = product.points;
            productIdInput.value = product.id;
            window.scrollTo(0, 0);
        }

        // --- Инициализация ---
        saveButton.addEventListener('click', saveProduct);
        loadProducts();
    }
    
    checkAuth();
});
