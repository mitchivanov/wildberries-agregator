import { useEffect, useState } from 'react'

export const useTelegram = () => {
  const [isDarkMode, setIsDarkMode] = useState(false)
  const [initData, setInitData] = useState('')
  
  // Проверяем наличие объекта Telegram в window
  console.log('Проверка window.Telegram:', !!window.Telegram)
  
  // Получаем WebApp
  const tg = window.Telegram?.WebApp
  console.log('Проверка window.Telegram.WebApp:', !!tg)
  
  // Логируем свойства WebApp если он существует
  if (tg) {
    console.log('Свойства WebApp:', {
      initDataExists: !!tg.initData,
      colorScheme: tg.colorScheme,
      initDataValue: tg.initData
    })
  }

  useEffect(() => {
    console.log('Инициализация Telegram WebApp...')
    
    if (tg) {
      console.log('Telegram WebApp обнаружен')
      
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
      
      // Определяем начальную тему
      const initialColorScheme = tg.colorScheme || 'light'
      setIsDarkMode(initialColorScheme === 'dark')
      console.log('Начальная тема:', initialColorScheme)
      
      // Сохраняем данные инициализации
      if (tg.initData) {
        setInitData(tg.initData)
        console.log('Данные инициализации получены')
      } else {
        console.warn('Данные инициализации не найдены')
      }
      
      // Обработчик изменения темы
      const themeChangeHandler = () => {
        const newColorScheme = tg.colorScheme || 'light'
        console.log('Событие изменения темы:', newColorScheme)
        setIsDarkMode(newColorScheme === 'dark')
      }
      
      // Подписываемся на событие изменения темы
      try {
        tg.onEvent('themeChanged', themeChangeHandler)
        console.log('Подписка на изменение темы установлена')
      } catch (error) {
        console.error('Ошибка при подписке на изменение темы:', error)
      }
      
      // Отписываемся при размонтировании
      return () => {
        console.log('Очистка обработчиков событий WebApp')
        try {
          tg.offEvent('themeChanged', themeChangeHandler)
        } catch (error) {
          console.error('Ошибка при отписке от изменения темы:', error)
        }
      }
    } else {
      console.log('Telegram WebApp не обнаружен, приложение запущено вне Telegram')
      console.log('window.Telegram:', window.Telegram)
      console.log('Убедитесь, что:')
      console.log('1. Скрипт telegram-web-app.js подключен в index.html')
      console.log('2. Приложение открыто через Telegram WebApp')
    }
  }, [])

  const toggleTheme = () => {
    console.log('Ручное переключение темы')
    setIsDarkMode(!isDarkMode)
  }

  return {
    isDarkMode,
    toggleTheme,
    initData,
    isTelegram: !!tg,
    webApp: tg,
    user: tg?.initDataUnsafe?.user
  }
}