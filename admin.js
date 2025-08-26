document.addEventListener('DOMContentLoaded', () => {
    // --- ПРОСТАЯ ЗАЩИТА ПАРОЛЕМ ---
    const ADMIN_PASSWORD = "150278"; // Можете поменять на свой пароль
    const password = prompt("Введите пароль администратора:");

    if (password !== ADMIN_PASSWORD) {
        alert("Неверный пароль!");
        document.body.innerHTML = "<h1>Доступ запрещен</h1>";
        return;
    }

    document.getElementById('admin-content').classList.remove('hidden');

    // --- Настройка Firebase ---
    const productsCollectionRef = db.collection('products');

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

            item.querySelector('.delete-btn').addEventListener('click', () => deleteProduct(product.id));
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

        if (id) {
            // Обновляем существующий товар
            await productsCollectionRef.doc(id).update(productData);
        } else {
            // Добавляем новый товар
            await productsCollectionRef.add(productData);
        }

        // Очищаем форму и перезагружаем список
        productNameInput.value = '';
        productPointsInput.value = '';
        productIdInput.value = '';
        formTitle.textContent = 'Добавить товар';
        loadProducts();
    }

    async function deleteProduct(id) {
        if (confirm("Вы уверены, что хотите удалить этот товар?")) {
            await productsCollectionRef.doc(id).delete();
            loadProducts();
        }
    }

    function editProduct(product) {
        formTitle.textContent = 'Редактировать товар';
        productNameInput.value = product.name;
        productPointsInput.value = product.points;
        productIdInput.value = product.id;
        window.scrollTo(0, 0); // Прокручиваем наверх к форме
    }

    // --- Инициализация ---
    saveButton.addEventListener('click', saveProduct);
    loadProducts();
});
