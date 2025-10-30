// Sistema de Administración para Producto Nacional
import db from '../api/database.js';
import api from '../api/server.js';
import ws from '../api/websocket.js';

// Estado global
let currentSection = 'dashboard';
let products = [];
let orders = [];
let tables = [];
let stats = {};

// Inicialización
document.addEventListener('DOMContentLoaded', function() {
    initializeAdmin();
});

async function initializeAdmin() {
    try {
        // Verificar autenticación
        const isAuthenticated = await checkAuthentication();
        if (!isAuthenticated) {
            showLoginModal();
            return;
        }
        
        // Conectar WebSocket
        ws.connect();
        ws.joinRoom('admin');
        
        // Cargar datos iniciales
        await loadDashboardData();
        
        // Configurar listeners
        setupWebSocketListeners();
        
        // Mostrar sección inicial
        showSection('dashboard');
        
        console.log('Sistema de administración inicializado');
        
    } catch (error) {
        console.error('Error inicializando admin:', error);
        showError('Error al conectar con el sistema');
    }
}

async function checkAuthentication() {
    // Simular verificación de autenticación
    // En producción, esto verificaría un token JWT
    const adminToken = localStorage.getItem('pn_admin_token');
    return adminToken === 'admin-authenticated';
}

function showLoginModal() {
    // Crear modal de login
    const modal = document.createElement('div');
    modal.className = 'fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50';
    modal.innerHTML = `
        <div class="bg-white rounded-2xl p-8 w-full max-w-md">
            <div class="text-center mb-6">
                <div class="w-16 h-16 gradient-gold rounded-full flex items-center justify-center mx-auto mb-4">
                    <i class="fas fa-crown text-white text-2xl"></i>
                </div>
                <h2 class="font-display text-2xl font-bold text-gray-800">Administrador</h2>
                <p class="text-gray-600">Inicia sesión para continuar</p>
            </div>
            
            <form onsubmit="handleLogin(event)">
                <div class="space-y-4">
                    <div>
                        <label class="block text-sm font-medium text-gray-700 mb-2">Email</label>
                        <input type="email" id="login-email" required 
                               class="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-500"
                               placeholder="admin@productonacional.mx">
                    </div>
                    <div>
                        <label class="block text-sm font-medium text-gray-700 mb-2">Contraseña</label>
                        <input type="password" id="login-password" required 
                               class="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-500"
                               placeholder="••••••••">
                    </div>
                </div>
                
                <button type="submit" class="w-full gradient-gold text-white py-3 rounded-xl font-semibold mt-6 hover:shadow-lg transition-all">
                    Iniciar Sesión
                </button>
            </form>
        </div>
    `;
    
    document.body.appendChild(modal);
}

async function handleLogin(event) {
    event.preventDefault();
    
    const email = document.getElementById('login-email').value;
    const password = document.getElementById('login-password').value;
    
    try {
        const response = await api.request('/auth/login', 'POST', { email, password });
        
        if (response.success && response.data.user.role === 'admin') {
            localStorage.setItem('pn_admin_token', 'admin-authenticated');
            document.body.removeChild(document.querySelector('.fixed.inset-0.z-50'));
            
            showToast('Bienvenido Administrador', 'success');
            await loadDashboardData();
            showSection('dashboard');
        } else {
            showToast('Credenciales inválidas', 'error');
        }
    } catch (error) {
        console.error('Login error:', error);
        showToast('Error al iniciar sesión', 'error');
    }
}

function logout() {
    localStorage.removeItem('pn_admin_token');
    location.reload();
}

async function loadDashboardData() {
    try {
        // Cargar todos los datos necesarios
        const [productsRes, ordersRes, tablesRes, statsRes] = await Promise.all([
            api.request('/products'),
            api.request('/orders'),
            api.request('/tables'),
            api.request('/stats')
        ]);
        
        if (productsRes.success) products = productsRes.data;
        if (ordersRes.success) orders = ordersRes.data;
        if (tablesRes.success) tables = tablesRes.data;
        if (statsRes.success) stats = statsRes.data;
        
        updateLastUpdateTime();
        
    } catch (error) {
        console.error('Error loading dashboard data:', error);
        // Use fallback data
        products = db.getProducts();
        orders = db.getOrders();
        tables = db.getTables();
        stats = db.getStats();
    }
}

function setupWebSocketListeners() {
    // Escuchar actualizaciones en tiempo real
    ws.on('admin_order', (data) => {
        console.log('New order for admin:', data);
        refreshData();
    });

    ws.on('payment_received', (data) => {
        console.log('Payment received:', data);
        refreshData();
    });

    ws.on('order_status_change', (data) => {
        console.log('Order status changed:', data);
        refreshData();
    });
}

function showSection(sectionName) {
    // Hide all sections
    document.querySelectorAll('.section-content').forEach(section => {
        section.classList.add('hidden');
    });
    
    // Show selected section
    document.getElementById(`${sectionName}-section`).classList.remove('hidden');
    
    // Update navigation
    document.querySelectorAll('.nav-item').forEach(item => {
        item.classList.remove('active');
    });
    event.target.classList.add('active');
    
    // Update page title
    const titles = {
        dashboard: 'Dashboard',
        products: 'Productos',
        orders: 'Órdenes',
        tables: 'Mesas',
        reports: 'Reportes',
        staff: 'Personal'
    };
    
    document.getElementById('page-title').textContent = titles[sectionName];
    document.getElementById('page-subtitle').textContent = getSectionSubtitle(sectionName);
    
    currentSection = sectionName;
    
    // Load section-specific data
    loadSectionData(sectionName);
}

function getSectionSubtitle(sectionName) {
    const subtitles = {
        dashboard: 'Panel de control general',
        products: 'Gestión de productos y menú',
        orders: 'Historial y estado de órdenes',
        tables: 'Administración de mesas',
        reports: 'Análisis y reportes',
        staff: 'Gestión de personal'
    };
    return subtitles[sectionName];
}

function loadSectionData(sectionName) {
    switch (sectionName) {
        case 'dashboard':
            updateDashboard();
            break;
        case 'products':
            loadProductsSection();
            break;
        case 'orders':
            loadOrdersSection();
            break;
        // Add other cases as needed
    }
}

async function updateDashboard() {
    try {
        // Update stats cards
        document.getElementById('today-sales').textContent = `$${stats.todayRevenue || 0}`;
        document.getElementById('today-orders').textContent = `${stats.todayOrders || 0} órdenes`;
        document.getElementById('active-orders').textContent = stats.pendingOrders || 0;
        document.getElementById('pending-orders').textContent = `${stats.preparingOrders || 0} en preparación`;
        document.getElementById('occupied-tables').textContent = tables.filter(t => t.status === 'occupied').length;
        document.getElementById('total-tables').textContent = `de ${tables.length} mesas`;
        document.getElementById('total-products').textContent = products.length;
        document.getElementById('available-products').textContent = `${products.filter(p => p.available).length} disponibles`;
        
        // Create charts
        createHourlyChart();
        createProductsChart();
        createPaymentChart();
        
    } catch (error) {
        console.error('Error updating dashboard:', error);
    }
}

function createHourlyChart() {
    // Generate sample hourly data
    const hours = Array.from({ length: 24 }, (_, i) => i);
    const sales = hours.map(hour => {
        // Simulate sales data with peaks at lunch and dinner
        if (hour >= 11 && hour <= 15) return Math.random() * 2000 + 1000; // Lunch peak
        if (hour >= 18 && hour <= 22) return Math.random() * 2500 + 1500; // Dinner peak
        return Math.random() * 500 + 100; // Low sales
    });
    
    const data = [{
        x: hours.map(h => `${h}:00`),
        y: sales,
        type: 'scatter',
        mode: 'lines+markers',
        name: 'Ventas',
        line: {
            color: '#d4a574',
            width: 3
        },
        marker: {
            color: '#d4a574',
            size: 8
        }
    }];
    
    const layout = {
        title: '',
        xaxis: { title: 'Hora' },
        yaxis: { title: 'Ventas ($)' },
        margin: { t: 20, r: 20, b: 50, l: 50 },
        plot_bgcolor: 'rgba(0,0,0,0)',
        paper_bgcolor: 'rgba(0,0,0,0)'
    };
    
    Plotly.newPlot('hourly-chart', data, layout, { responsive: true });
}

function createProductsChart() {
    // Get top products by sales
    const productSales = {};
    orders.forEach(order => {
        if (order.status === 'paid') {
            order.items.forEach(item => {
                productSales[item.productId] = (productSales[item.productId] || 0) + item.quantity;
            });
        }
    });
    
    // Sort and get top 8
    const topProducts = Object.entries(productSales)
        .sort(([,a], [,b]) => b - a)
        .slice(0, 8)
        .map(([productId, quantity]) => {
            const product = products.find(p => p.id === productId);
            return {
                name: product ? product.name : 'Producto desconocido',
                quantity: quantity
            };
        });
    
    const data = [{
        x: topProducts.map(p => p.name),
        y: topProducts.map(p => p.quantity),
        type: 'bar',
        marker: {
            color: '#d4a574'
        }
    }];
    
    const layout = {
        title: '',
        xaxis: { title: 'Productos' },
        yaxis: { title: 'Cantidad vendida' },
        margin: { t: 20, r: 20, b: 80, l: 50 },
        plot_bgcolor: 'rgba(0,0,0,0)',
        paper_bgcolor: 'rgba(0,0,0,0)'
    };
    
    Plotly.newPlot('products-chart', data, layout, { responsive: true });
}

function createPaymentChart() {
    // Count payment methods
    const paymentMethods = {};
    orders.forEach(order => {
        if (order.paymentMethod && order.status === 'paid') {
            paymentMethods[order.paymentMethod] = (paymentMethods[order.paymentMethod] || 0) + 1;
        }
    });
    
    const data = [{
        values: Object.values(paymentMethods),
        labels: Object.keys(paymentMethods).map(method => {
            const labels = {
                cash: 'Efectivo',
                card: 'Tarjeta',
                transfer: 'Transferencia',
                'open-tab': 'Cuenta abierta'
            };
            return labels[method] || method;
        }),
        type: 'pie',
        marker: {
            colors: ['#d4a574', '#3b82f6', '#10b981', '#f59e0b']
        }
    }];
    
    const layout = {
        title: '',
        margin: { t: 20, r: 20, b: 20, l: 20 },
        plot_bgcolor: 'rgba(0,0,0,0)',
        paper_bgcolor: 'rgba(0,0,0,0)'
    };
    
    Plotly.newPlot('payment-chart', data, layout, { responsive: true });
}

function loadProductsSection() {
    const tbody = document.getElementById('products-table-body');
    
    tbody.innerHTML = products.map(product => `
        <tr class="border-b border-gray-100 hover:bg-gray-50">
            <td class="px-6 py-4">
                <div class="flex items-center">
                    <img src="${product.image}" alt="${product.name}" 
                         class="w-10 h-10 rounded-lg object-cover mr-3">
                    <div>
                        <div class="font-semibold text-gray-800">${product.name}</div>
                        <div class="text-sm text-gray-500">${product.description.substring(0, 50)}...</div>
                    </div>
                </div>
            </td>
            <td class="px-6 py-4">
                <span class="px-2 py-1 bg-amber-100 text-amber-800 text-xs rounded-full">
                    ${product.category}
                </span>
            </td>
            <td class="px-6 py-4 font-semibold text-gold">$${product.price}</td>
            <td class="px-6 py-4">
                <span class="px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded-full">
                    ${product.station}
                </span>
            </td>
            <td class="px-6 py-4">
                <label class="relative inline-flex items-center cursor-pointer">
                    <input type="checkbox" ${product.available ? 'checked' : ''} 
                           onchange="toggleProductAvailability('${product.id}')"
                           class="sr-only peer">
                    <div class="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-amber-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-amber-500"></div>
                </label>
            </td>
            <td class="px-6 py-4">
                <div class="flex space-x-2">
                    <button onclick="editProduct('${product.id}')" 
                            class="text-blue-600 hover:text-blue-800">
                        <i class="fas fa-edit"></i>
                    </button>
                    <button onclick="deleteProduct('${product.id}')" 
                            class="text-red-600 hover:text-red-800">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
            </td>
        </tr>
    `).join('');
}

async function toggleProductAvailability(productId) {
    try {
        const product = products.find(p => p.id === productId);
        if (!product) return;
        
        const response = await api.request('/products/availability', 'PUT', {
            productId: productId,
            available: !product.available
        });
        
        if (response.success) {
            product.available = !product.available;
            showToast(`Producto ${product.available ? 'activado' : 'desactivado'}`, 'success');
            loadProductsSection();
        }
    } catch (error) {
        console.error('Error toggling product availability:', error);
        showToast('Error al cambiar disponibilidad', 'error');
    }
}

function addProduct() {
    showToast('Función de agregar producto no implementada', 'info');
}

function editProduct(productId) {
    showToast('Función de editar producto no implementada', 'info');
}

function deleteProduct(productId) {
    if (confirm('¿Estás seguro de eliminar este producto?')) {
        showToast('Función de eliminar producto no implementada', 'info');
    }
}

function loadOrdersSection() {
    // Implementation for orders section
    showToast('Sección de órdenes no implementada', 'info');
}

async function refreshData() {
    try {
        await loadDashboardData();
        loadSectionData(currentSection);
        updateLastUpdateTime();
        showToast('Datos actualizados', 'success');
    } catch (error) {
        console.error('Error refreshing data:', error);
        showToast('Error al actualizar datos', 'error');
    }
}

function updateLastUpdateTime() {
    const now = new Date();
    const timeString = now.toLocaleTimeString('es-MX', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
    });
    document.getElementById('last-update').textContent = timeString;
}

function showToast(message, type = 'info') {
    const toast = document.createElement('div');
    toast.className = `fixed top-4 right-4 z-50 px-4 py-3 rounded-lg shadow-lg text-white font-medium ${
        type === 'success' ? 'bg-green-500' :
        type === 'error' ? 'bg-red-500' :
        type === 'warning' ? 'bg-yellow-500' :
        'bg-blue-500'
    }`;
    toast.textContent = message;
    
    document.body.appendChild(toast);
    
    anime({
        targets: toast,
        translateX: [300, 0],
        opacity: [0, 1],
        duration: 300,
        easing: 'easeOutQuart'
    });
    
    setTimeout(() => {
        anime({
            targets: toast,
            translateX: [0, 300],
            opacity: [1, 0],
            duration: 300,
            easing: 'easeInQuart',
            complete: () => toast.remove()
        });
    }, 3000);
}

// Global functions
window.showSection = showSection;
window.toggleProductAvailability = toggleProductAvailability;
window.addProduct = addProduct;
window.editProduct = editProduct;
window.deleteProduct = deleteProduct;
window.refreshData = refreshData;
window.handleLogin = handleLogin;
window.logout = logout;