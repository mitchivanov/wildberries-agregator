import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import Dashboard from './pages/Dashboard';
import GoodsPage from './pages/GoodsPage';
import CreateGoods from './pages/CreateGoods';
import EditGoods from './pages/EditGoods';
import { useTelegram } from './hooks/useTelegram';
import { useEffect } from 'react';

console.log('=== Рендеринг App компонента ===');

function App() {
  const { isDarkMode, webApp } = useTelegram();
  
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
  }, [isDarkMode]);

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
          <Route path="/" element={<Dashboard />} />
          <Route path="/goods" element={<GoodsPage />} />
          <Route path="/goods/create" element={<CreateGoods />} />
          <Route path="/goods/edit/:id" element={<EditGoods />} />
        </Routes>
      </Router>
    </div>
  );
}

export default App;