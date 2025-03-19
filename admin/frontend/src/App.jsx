import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import Dashboard from './pages/Dashboard';
import GoodsPage from './pages/GoodsPage';
import CreateGoods from './pages/CreateGoods';
import EditGoods from './pages/EditGoods';
import { useTelegram } from './hooks/useTelegram';
import { useEffect } from 'react';
import Catalog from './pages/Catalog';
import GoodsDetail from './pages/GoodsDetail';
import AdminLogin from './pages/AdminLogin';
import ProtectedRoute from './components/ProtectedRoute';
import AllReservations from './pages/AllReservations';
import AllAvailability from './pages/AllAvailability';
import Categories from './pages/Categories';
import CreateCategory from './pages/CreateCategory';
import EditCategory from './pages/EditCategory';
import UserReservations from './pages/UserReservations';

console.log('=== Рендеринг App компонента ===');

function App() {
  const { isDarkMode, webApp } = useTelegram();
  
  // Add effect to log theme on App initialization
  useEffect(() => {
    console.log('App: Current theme isDarkMode:', isDarkMode);
  }, [isDarkMode]);
  
  console.log('App: Проверка window.Telegram:', window.Telegram);
  console.log('App: Проверка WebApp:', window.Telegram?.WebApp);
  
  // Применяем нужную тему исходя из настроек Telegram
  useEffect(() => {
    const htmlElement = document.documentElement;
    if (isDarkMode) {
      htmlElement.classList.add('dark');
    } else {
      htmlElement.classList.remove('dark');
    }
    
    // Проверяем параметр path в URL для перенаправления с WebApp
    if (webApp) {
      const urlParams = new URLSearchParams(window.location.search);
      const pathParam = urlParams.get('path');
      
      if (pathParam === 'admin') {
        // Перенаправляем на страницу админки
        window.location.href = '/admin';
      }
    }
  }, [isDarkMode, webApp]);

  return (
    <div className={`min-h-screen ${isDarkMode ? 'bg-gray-900 text-white' : 'bg-gray-50 text-gray-900'}`}>
      <Router>
        <Toaster 
          position="top-right" 
          toastOptions={{
            className: isDarkMode ? 'dark-toast' : '',
            style: isDarkMode ? { background: '#374151', color: '#fff' } : {}
          }}
        />
        <Routes>
          {/* Публичные маршруты */}
          <Route path="/" element={<Catalog />} />
          <Route path="/goods/:id" element={<GoodsDetail />} />
          <Route path="/reservations" element={<UserReservations />} />
          
          {/* Маршруты админки */}
          <Route path="/admin" element={<AdminLogin />} />
          <Route path="/admin/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
          <Route path="/admin/goods" element={<ProtectedRoute><GoodsPage /></ProtectedRoute>} />
          <Route path="/admin/goods/create" element={<ProtectedRoute><CreateGoods /></ProtectedRoute>} />
          <Route path="/admin/goods/edit/:id" element={<ProtectedRoute><EditGoods /></ProtectedRoute>} />
          
          {/* Новые маршруты для бронирований и доступности */}
          <Route path="/admin/reservations" element={<ProtectedRoute><AllReservations /></ProtectedRoute>} />
          <Route path="/admin/availability" element={<ProtectedRoute><AllAvailability /></ProtectedRoute>} />
          
          {/* Новые маршруты для категорий */}
          <Route path="/admin/categories" element={<ProtectedRoute><Categories /></ProtectedRoute>} />
          <Route path="/admin/categories/create" element={<ProtectedRoute><CreateCategory /></ProtectedRoute>} />
          <Route path="/admin/categories/edit/:id" element={<ProtectedRoute><EditCategory /></ProtectedRoute>} />
        </Routes>
      </Router>
    </div>
  );
}

export default App;