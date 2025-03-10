import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { AuthProvider } from './hooks/useAuth';
import './index.css';

console.log('=== Инициализация приложения ===');
console.log('Проверка window.Telegram при старте:', window.Telegram);

// Ждем загрузки скрипта Telegram WebApp
const waitForTelegram = () => {
  return new Promise((resolve) => {
    if (window.Telegram) {
      console.log('Telegram WebApp скрипт уже загружен');
      resolve();
      return;
    }
    
    console.log('Ожидание загрузки Telegram WebApp...');
    const checkInterval = setInterval(() => {
      if (window.Telegram) {
        clearInterval(checkInterval);
        console.log('Telegram WebApp скрипт загружен');
        resolve();
      }
    }, 100);
    
    // Установка таймаута на случай если скрипт не загрузится
    setTimeout(() => {
      clearInterval(checkInterval);
      console.warn('Timeout: Telegram WebApp не был загружен, продолжаем без него');
      resolve();
    }, 3000);
  });
};

// Инициализация приложения
async function initApp() {
  await waitForTelegram();
  
  console.log('Рендеринг приложения');
  console.log('window.Telegram доступен:', !!window.Telegram);
  console.log('window.Telegram.WebApp доступен:', !!window.Telegram?.WebApp);
  
  ReactDOM.createRoot(document.getElementById('root')).render(
    <React.StrictMode>
      <AuthProvider>
        <App />
      </AuthProvider>
    </React.StrictMode>
  );
}

initApp();
