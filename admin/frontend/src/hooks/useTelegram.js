import { useEffect, useState } from 'react'

// Создаем объект для хранения состояния Telegram WebApp
const telegramState = {
  isDarkMode: false,
  initData: '',
  tg: null,
  initialized: false
}

// Инициализируем Telegram WebApp только один раз
const initTelegramApp = () => {
  if (telegramState.initialized) return;
  
  console.log('Инициализация Telegram WebApp...')
  
  // Проверяем наличие объекта Telegram в window
  console.log('Проверка window.Telegram:', !!window.Telegram)
  
  // Получаем WebApp
  const tg = window.Telegram?.WebApp
  console.log('Проверка window.Telegram.WebApp:', !!tg)
  
  // Сохраняем WebApp в состоянии
  telegramState.tg = tg
  
  // Логируем свойства WebApp если он существует
  if (tg) {
    console.log('Свойства WebApp:', {
      initDataExists: !!tg.initData,
      colorScheme: tg.colorScheme,
      initDataValue: tg.initData
    })
    
    // Устанавливаем начальную тему
    telegramState.isDarkMode = tg.colorScheme === 'dark'
    
    // Сохраняем initData
    telegramState.initData = tg.initData
    
    // Расширяем WebApp для лучшей видимости
    try {
      tg.expand()
      console.log('WebApp успешно расширен')
    } catch (error) {
      console.error('Ошибка при расширении WebApp:', error)
    }
    
    // Уведомляем Telegram, что WebApp готов
    try {
      tg.ready()
      console.log('WebApp отметил готовность')
    } catch (error) {
      console.error('Ошибка при отметке готовности WebApp:', error)
    }
    
    // Обработчик изменения темы
    const themeChangeHandler = () => {
      console.log('Изменение темы:', tg.colorScheme)
      telegramState.isDarkMode = tg.colorScheme === 'dark'
      // Вызываем все колбэки подписки на изменение темы
      themeSubscribers.forEach(callback => callback(telegramState.isDarkMode))
    }
    
    // Подписка на событие изменения темы
    try {
      tg.onEvent('themeChanged', themeChangeHandler)
      console.log('Подписка на изменение темы успешно настроена')
    } catch (error) {
      console.error('Ошибка при подписке на изменение темы:', error)
    }
  } else {
    console.log('Telegram WebApp не обнаружен, приложение запущено вне Telegram')
    console.log('window.Telegram:', window.Telegram)
    console.log('Убедитесь, что:')
    console.log('1. Скрипт telegram-web-app.js подключен в index.html')
    console.log('2. Приложение открыто через Telegram WebApp')
  }
  
  telegramState.initialized = true
}

// Массив подписчиков на изменение темы
const themeSubscribers = []

export const useTelegram = () => {
  const [isDarkMode, setIsDarkMode] = useState(telegramState.isDarkMode)
  
  // Инициализация только при первом вызове хука
  useEffect(() => {
    if (!telegramState.initialized) {
      initTelegramApp()
    }
    
    // Подписка на изменение темы
    const themeCallback = (darkMode) => {
      setIsDarkMode(darkMode)
    }
    
    themeSubscribers.push(themeCallback)
    
    // Отписка при размонтировании
    return () => {
      const index = themeSubscribers.indexOf(themeCallback)
      if (index > -1) {
        themeSubscribers.splice(index, 1)
      }
    }
  }, [])
  
  const toggleTheme = () => {
    console.log('Ручное переключение темы')
    const newDarkMode = !isDarkMode
    setIsDarkMode(newDarkMode)
    telegramState.isDarkMode = newDarkMode
  }
  
  return {
    isDarkMode,
    toggleTheme,
    initData: telegramState.initData,
    isTelegram: !!telegramState.tg,
    webApp: telegramState.tg,
    user: telegramState.tg?.initDataUnsafe?.user
  }
}