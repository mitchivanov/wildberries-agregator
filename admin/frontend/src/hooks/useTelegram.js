import { useEffect, useState, useCallback } from 'react'

// Создаем объект для хранения состояния Telegram WebApp
const telegramState = {
  isDarkMode: false, // Default value
  initData: '',
  tg: null,
  initialized: false,
  themeDetected: false // New flag to track if theme was detected
}

// Инициализируем Telegram WebApp только один раз
const initTelegramApp = () => {
  if (telegramState.initialized) return;
  
  console.log('Инициализация Telegram WebApp...')
  
  // Проверяем наличие объекта Telegram в window
  if (window.Telegram && window.Telegram.WebApp) {
    telegramState.tg = window.Telegram.WebApp
    
    // Сохраняем данные инициализации
    telegramState.initData = window.Telegram.WebApp.initData
    
    // Устанавливаем тему только один раз при инициализации
    if (!telegramState.themeDetected) {
      // Определяем тему из Telegram WebApp
      const colorScheme = window.Telegram.WebApp.colorScheme
      telegramState.isDarkMode = colorScheme === 'dark'
      telegramState.themeDetected = true
      
      console.log(`Установлена тема: ${colorScheme} (isDarkMode: ${telegramState.isDarkMode})`)
    }
    
    // Удаляем старый обработчик темы, чтобы избежать многократного подключения
    window.Telegram.WebApp.onEvent('themeChanged', () => {
      // Игнорируем динамические изменения темы для обеспечения консистентности интерфейса
      console.log('Событие themeChanged игнорируется для поддержания стабильной темы')
    })
    
    console.log('Telegram WebApp успешно инициализирован')
  } else {
    console.log('Telegram WebApp не обнаружен в окружении')
    
    // Для тестирования вне Telegram определяем тему по предпочтениям системы
    if (!telegramState.themeDetected) {
      const prefersDarkMode = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches
      telegramState.isDarkMode = prefersDarkMode
      telegramState.themeDetected = true
      
      console.log(`Установлена системная тема (isDarkMode: ${telegramState.isDarkMode})`)
    }
    
    console.log('1. Скрипт telegram-web-app.js подключен в index.html')
    console.log('2. Приложение открыто через Telegram WebApp')
  }
  
  // Уведомляем всех подписчиков о начальной теме
  themeSubscribers.forEach(callback => callback(telegramState.isDarkMode))
  
  telegramState.initialized = true
}

// Массив подписчиков на изменение темы 
const themeSubscribers = []

export const useTelegram = () => {
  // Access the Telegram WebApp
  const webApp = window.Telegram?.WebApp;
  
  // Store user data
  const [user, setUser] = useState(null);
  // Always use light mode - removing dark mode switching
  const isDarkMode = false; // Force light mode
  const [initData, setInitData] = useState('');
  
  // Initialize WebApp data on component mount
  useEffect(() => {
    if (webApp) {
      // Set initial user data
      const currentUser = webApp.initDataUnsafe?.user;
      if (currentUser) {
        setUser(currentUser);
      }
      
      // Get init data for API authorization
      if (webApp.initData) {
        setInitData(webApp.initData);
      }
      
      // Enable closing confirmation if needed
      webApp.enableClosingConfirmation();
    }
  }, [webApp]);
  
  return {
    webApp,
    user,
    isDarkMode, // Will always be false
    initData
  };
}