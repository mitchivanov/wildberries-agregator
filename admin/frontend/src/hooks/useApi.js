import { useState, useCallback, useEffect } from 'react';
import axios from 'axios';
import { toast } from 'react-hot-toast';
import { useTelegram } from './useTelegram';


const VITE_API_URL = import.meta.env.VITE_API_URL;

// Создаем экземпляр axios с базовым URL
const api = axios.create({
  baseURL: 'https://develooper.ru/api', //'https://lobster-civil-pigeon.ngrok-free.app/api'
  headers: {
    'Content-Type': 'application/json',
  },
});

// Добавляем перехватчик запросов для проблем с CORS
api.interceptors.request.use(config => {
  // Добавляем случайный параметр к URL для предотвращения кэширования
  if (config.method === 'get') {
    config.params = {
      ...config.params,
      _t: Date.now()
    };
  }
  return config;
});

// Добавляем перехватчик ответов для обработки ошибок
api.interceptors.response.use(
  response => response,
  error => {
    console.error('API Error:', error);
    if (error.message === 'Network Error') {
      console.error('Сетевая ошибка. Проверьте соединение с бэкендом.');
    }
    return Promise.reject(error);
  }
);

// Кэш для запросов
const queryCache = new Map();

export const useApi = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const { initData } = useTelegram();
  
  // Если есть initData от Telegram, добавляем его в заголовки
  useEffect(() => {
    if (initData) {
      api.defaults.headers.common['X-Telegram-Init-Data'] = initData;
      console.log('Установлены данные инициализации в заголовки API');
    }
  }, [initData]);

  // Общая функция для запросов с обработкой ошибок и индикатором загрузки
  const request = useCallback(async (method, url, data = null) => {
    try {
      setLoading(true);
      const response = await api({
        method,
        url,
        data,
        params: method === 'get' ? data : null
      });
      return response.data;
    } catch (error) {
      const errorMessage = error.response?.data?.detail || error.message;
      setError(errorMessage);
      toast.error(`Ошибка: ${errorMessage}`);
      
      // Возвращаем стандартизированный объект ошибки
      return {
        error: true,
        message: errorMessage,
        status: error.response?.status,
        data: error.response?.data
      };
    } finally {
      setLoading(false);
    }
  }, []);

  // Получение всех товаров с пагинацией и сортировкой
  const getGoods = useCallback(async (params = {}) => {
    // params: { skip, limit, includeHidden, sortBy, sortOrder }
    const { skip = 0, limit = 100, includeHidden = true, sortBy, sortOrder = 'asc' } = params;
    
    // Добавляем логирование для отладки
    console.log(`Запрос товаров: skip=${skip}, limit=${limit}, includeHidden=${includeHidden}, sortBy=${sortBy}, sortOrder=${sortOrder}`);
    
    // Используем URLSearchParams для правильного форматирования параметров запроса
    const searchParams = new URLSearchParams();
    searchParams.append('skip', skip);
    searchParams.append('limit', limit);
    searchParams.append('include_hidden', includeHidden);
    
    // Добавляем параметры сортировки, если они указаны
    if (sortBy) {
      searchParams.append('sort_by', sortBy);
      searchParams.append('sort_order', sortOrder);
    }
    
    const url = `/goods/?${searchParams.toString()}`;
    console.log(`URL запроса: ${url}`);
    
    try {
      setLoading(true);
      const response = await api({
        method: 'get',
        url,
      });
      
      // Обработка ответа для обеспечения корректного формата
      const data = response.data;
      
      // Проверяем корректность поля total
      if (data) {
        // Если сервер вернул некорректное значение total, исправляем
        if (typeof data.total === 'number' && data.total < (data.items?.length || 0)) {
          console.warn(`Сервер вернул некорректное значение total=${data.total}, но items.length=${data.items?.length}`);
          
          // Если total меньше, чем количество полученных элементов, скорректируем его
          data.total = Math.max(data.total, (skip || 0) + (data.items?.length || 0) + limit);
          console.log(`Скорректированное значение total=${data.total}`);
        }
        
        // Убедимся, что поле items всегда присутствует и это массив
        if (!data.items) {
          data.items = [];
        } else if (!Array.isArray(data.items)) {
          console.warn('Сервер вернул некорректное поле items, преобразуем к массиву');
          data.items = [data.items].filter(Boolean);
        }
      }
      
      return data;
    } catch (error) {
      const errorMessage = error.response?.data?.detail || error.message;
      setError(errorMessage);
      toast.error(`Ошибка: ${errorMessage}`);
      
      // Возвращаем стандартизированный объект ошибки
      return {
        error: true,
        message: errorMessage,
        status: error.response?.status,
        data: error.response?.data,
        items: [],
        total: 0
      };
    } finally {
      setLoading(false);
    }
  }, [request]);

  // Поиск товаров с пагинацией и сортировкой
  const searchGoods = useCallback(async (query, params = {}) => {
    const { skip = 0, limit = 100, sortBy, sortOrder = 'asc' } = params;
    
    // Добавляем логирование для отладки поиска
    console.log(`Поиск товаров: query=${query}, skip=${skip}, limit=${limit}, sortBy=${sortBy}, sortOrder=${sortOrder}`);
    
    // Используем URLSearchParams для правильного форматирования параметров запроса
    const searchParams = new URLSearchParams();
    searchParams.append('search', query);
    searchParams.append('skip', skip);
    searchParams.append('limit', limit);
    
    // Добавляем параметры сортировки, если они указаны
    if (sortBy) {
      searchParams.append('sort_by', sortBy);
      searchParams.append('sort_order', sortOrder);
    }
    
    const url = `/goods/?${searchParams.toString()}`;
    console.log(`URL запроса поиска: ${url}`);
    
    try {
      setLoading(true);
      const response = await api({
        method: 'get',
        url,
      });
      
      // Аналогичная обработка ответа как в getGoods 
      const data = response.data;
      
      // Проверяем корректность поля total
      if (data) {
        // Если сервер вернул некорректное значение total, исправляем
        if (typeof data.total === 'number' && data.total < (data.items?.length || 0)) {
          console.warn(`Сервер вернул некорректное значение total=${data.total}, но items.length=${data.items?.length}`);
          
          // Если total меньше, чем количество полученных элементов, скорректируем его
          data.total = Math.max(data.total, (skip || 0) + (data.items?.length || 0) + limit);
          console.log(`Скорректированное значение total=${data.total}`);
        }
        
        // Убедимся, что поле items всегда присутствует и это массив
        if (!data.items) {
          data.items = [];
        } else if (!Array.isArray(data.items)) {
          console.warn('Сервер вернул некорректное поле items, преобразуем к массиву');
          data.items = [data.items].filter(Boolean);
        }
      }
      
      return data;
    } catch (error) {
      const errorMessage = error.response?.data?.detail || error.message;
      setError(errorMessage);
      toast.error(`Ошибка поиска: ${errorMessage}`);
      
      // Возвращаем стандартизированный объект ошибки
      return {
        error: true,
        message: errorMessage,
        status: error.response?.status,
        data: error.response?.data,
        items: [],
        total: 0
      };
    } finally {
      setLoading(false);
    }
  }, [request]);

  // Получение товара по ID
  const getGoodsById = useCallback(async (id) => {
    console.log(`Запрос товара по ID: ${id}`);
    return request('get', `/goods/${id}`);
  }, [request]);

  // Создание товара
  const createGoods = useCallback(async (goodsData) => {
    console.log('Создание нового товара:', goodsData);
    const result = await request('post', '/goods/', goodsData);
    
    if (result.error) {
      // Ошибка уже обработана в request
      return result;
    }

    queryCache.delete('/goods/');
    toast.success('Товар успешно создан');
    return result;
  }, [request]);

  // Обновление товара
  const updateGoods = useCallback(async (id, goodsData) => {
    console.log(`Обновление товара ${id}:`, goodsData);
    try {
      // Убедитесь, что category_id правильно сериализуется
      // Если category_id пустая строка или null, отправляем null
      if (goodsData.category_id === '' || goodsData.category_id === undefined) {
        goodsData.category_id = null;
      }
      
      const response = await request('put', `/goods/${id}`, goodsData);
      return response;
    } catch (error) {
      const errorMessage = error.response?.data?.detail || error.message;
      console.error('Ошибка при обновлении товара:', errorMessage);
      toast.error(`Ошибка: ${errorMessage}`);
      throw error;
    }
  }, [request]);

  // Удаление товара
  const deleteGoods = useCallback(async (id) => {
    console.log(`Удаление товара ${id}`);
    await request('delete', `/goods/${id}`);
    
    // Сбрасываем кэш списка товаров
    queryCache.delete('/goods/');
    
    toast.success('Товар успешно удален');
  }, [request]);

  // Бронирование товара
  const reserveGoods = useCallback(async (goodsId, quantity = 1) => {
    console.log(`Бронирование товара ${goodsId}, количество: ${quantity}`);
    const result = await request('post', '/reservations/', {
      goods_id: goodsId,
      quantity: quantity,
      // user_id получается из Telegram данных на бэкенде
    });
    
    if (!result.error) {
      // Сбрасываем кэш для обновления списка
      queryCache.delete('/goods/');
      queryCache.delete(`/goods/${goodsId}`);
      
      toast.success('Товар успешно забронирован');
    }
    return result;
  }, [request]);

  // Получение всех бронирований
  const getAllReservations = async () => {
    try {
      const response = await axios.get('/api/reservations/');
      return response.data;
    } catch (error) {
      handleApiError(error);
      throw error;
    }
  };

  // Функция для получения всей доступности товаров
  const getAllAvailability = useCallback(async () => {
    console.log('⭐ Запрос данных о доступности товаров');
    
    try {
      console.log('⭐ Отправляем запрос к бэкенду');
      const response = await api.get('/availability/');
      console.log('⭐ Ответ от бэкенда:', response);
      console.log('⭐ Ответ.data:', response.data, 'Тип:', typeof response.data, 'Array?', Array.isArray(response.data));

      // ЗАЩИТА ОТ НЕКОРРЕКТНЫХ ДАННЫХ
      let availabilityData = [];
      if (Array.isArray(response.data)) {
        availabilityData = response.data;
      } else if (response.data && Array.isArray(response.data.data)) {
        // Если пришёл объект с полем data, которое является массивом
        availabilityData = response.data.data;
      } else if (response.data && typeof response.data === 'object') {
        // Крайний случай - объект без data, но с другими полями
        console.warn('⭐ Некорректная структура данных от бэкенда, пытаемся преобразовать');
        try {
          availabilityData = Object.values(response.data).filter(item => typeof item === 'object');
        } catch (dataError) {
          console.error('⭐ Не удалось преобразовать данные', dataError);
        }
      }
      
      console.log('⭐ Нормализованные данные доступности:', availabilityData);
      
      // Данные о товарах обрабатываем безопасно
      let goodsMap = {};
      try {
        console.log('⭐ Запрашиваем данные о товарах');
        const goodsResponse = await api.get('/goods/');
        console.log('⭐ Ответ товаров:', goodsResponse.data);
        
        if (goodsResponse.data && goodsResponse.data.items && Array.isArray(goodsResponse.data.items)) {
          console.log('⭐ Корректные данные о товарах');
          goodsResponse.data.items.forEach(goods => {
            try {
              if (goods && goods.id) {
                goodsMap[goods.id] = {
                  name: goods.name || 'Без названия',
                  article: goods.article || 'Нет артикула'
                };
              }
            } catch (itemError) {
              console.error('⭐ Ошибка при обработке товара:', itemError);
            }
          });
        } else if (goodsResponse.data && Array.isArray(goodsResponse.data)) {
          console.log('⭐ Данные о товарах в виде массива');
          goodsResponse.data.forEach(goods => {
            try {
              if (goods && goods.id) {
                goodsMap[goods.id] = {
                  name: goods.name || 'Без названия',
                  article: goods.article || 'Нет артикула'
                };
              }
            } catch (itemError) {
              console.error('⭐ Ошибка при обработке товара:', itemError);
            }
          });
        } else {
          console.warn('⭐ Некорректная структура данных о товарах');
        }
      } catch (goodsError) {
        console.error('⭐ Ошибка при получении данных о товарах:', goodsError);
      }
      
      console.log('⭐ Карта товаров:', goodsMap);
      
      // Безопасно обогащаем данные
      let enrichedData = [];
      try {
        enrichedData = availabilityData.map(item => {
          try {
            return {
              ...item,
              goods_name: item && item.goods_id ? (goodsMap[item.goods_id]?.name || null) : null,
              goods_article: item && item.goods_id ? (goodsMap[item.goods_id]?.article || null) : null
            };
          } catch (enrichError) {
            console.error('⭐ Ошибка при обогащении элемента:', enrichError, item);
            return item;
          }
        });
      } catch (mapError) {
        console.error('⭐ Общая ошибка при обогащении данных:', mapError);
        enrichedData = availabilityData;
      }
      
      console.log('⭐ Итоговые данные:', enrichedData);
      return enrichedData;
    } catch (error) {
      console.error('⭐ КРИТИЧЕСКАЯ ОШИБКА В getAllAvailability:', error);
      toast.error(`Ошибка при получении данных о доступности: ${error.message}`);
      return []; // Всегда возвращаем массив, даже в случае ошибки
    }
  }, []);

  // Функция для маскирования артикула (последние 4 цифры видны)
  const maskArticle = useCallback((article) => {
    if (!article) return '';
    
    // Если артикул короче 4 символов, просто возвращаем его
    if (article.length <= 4) return article;
    
    // Иначе маскируем все символы кроме последних 4
    const visiblePart = article.slice(-4);
    const maskedPart = '*'.repeat(article.length - 4);
    
    return maskedPart + visiblePart;
  }, []);

  // Добавляем функцию для парсинга товара с Wildberries
  const parseWildberriesUrl = useCallback(async (url) => {
    console.log(`Парсинг товара Wildberries: ${url}`);
    return request('post', '/parse-wildberries/', { url });
  }, [request]);

  // Добавляем методы для работы с категориями
  const createCategory = useCallback(async (categoryData) => {
    console.log('Создание новой категории:', categoryData);
    return request('post', '/categories/', categoryData);
  }, [request]);

  const getCategories = useCallback(async () => {
    console.log('Запрос списка категорий');
    return request('get', '/categories/');
  }, [request]);

  // Добавим метод для обновления категории
  const updateCategory = useCallback(async (id, categoryData) => {
    console.log(`Обновление категории ${id}:`, categoryData);
    const result = await request('put', `/categories/${id}`, categoryData);
    
    // Сбрасываем кэши
    queryCache.delete('/categories/');
    queryCache.delete(`/categories/${id}`);
    
    if (!result.error) {
      toast.success('Категория успешно обновлена');
    }
    return result;
  }, [request]);

  // Обновляем getCategoryById и deleteCategory, чтобы они использовали request
  const getCategoryById = useCallback(async (id) => {
    console.log(`Запрос категории по ID: ${id}`);
    return request('get', `/categories/${id}`);
  }, [request]);

  const deleteCategory = useCallback(async (id) => {
    console.log(`Удаление категории ${id}`);
    const result = await request('delete', `/categories/${id}`);
    
    // Сбрасываем кэш списка категорий
    queryCache.delete('/categories/');
    
    if (!result.error) {
      toast.success('Категория успешно удалена');
    }
    return result;
  }, [request]);


  const bulkHideGoods = useCallback(async (goodsIds) => {
    try {
        // Убедимся, что все ID являются числами
        const payload = {
            goods_ids: Array.from(goodsIds).map(Number)
        };

        console.log('Отправка запроса на скрытие товаров:', payload);
        console.log('Тип данных goods_ids:', payload.goods_ids.map(id => typeof id));

        const response = await request('put', '/goods/bulk/hide', payload);
        
        if (!response.error) {
            toast.success('Товары успешно скрыты');
            // Сбрасываем кэш списка товаров
            queryCache.delete('/goods/');
        }
        
        return response;
    } catch (error) {
        console.error('Ошибка при скрытии товаров:', error.response?.data || error);
        throw error;
    }
  }, [request]);

  const bulkShowGoods = useCallback(async (goodsIds) => {
    try {
        // Убедимся, что все ID являются числами
        const payload = {
            goods_ids: Array.from(goodsIds).map(Number)
        };

        console.log('Отправка запроса на показ товаров:', payload);
        console.log('Тип данных goods_ids:', payload.goods_ids.map(id => typeof id));

        const response = await request('put', '/goods/bulk/show', payload);
        
        if (!response.error) {
            toast.success('Товары успешно показаны');
            // Сбрасываем кэш списка товаров
            queryCache.delete('/goods/');
        }
        
        return response;
    } catch (error) {
        console.error('Ошибка при показе товаров:', error.response?.data || error);
        throw error;
    }
  }, [request]);

  // Добавляем функцию для получения количества бронирований пользователя за день
  const getUserDailyReservationsCount = useCallback(async (userId) => {
    console.log(`Запрос количества бронирований пользователя ${userId} за день`);
    try {
      const response = await api.get(`/user/${userId}/daily_reservations_count/`);
      console.log('Результат запроса количества бронирований:', response.data);
      return response.data.count || 0;
    } catch (error) {
      console.error('Ошибка при получении количества бронирований:', error);
      toast.error(`Не удалось получить информацию о лимитах: ${error.message}`);
      return 0; // В случае ошибки считаем, что бронирований нет
    }
  }, []);

  // Добавляем функцию для ручной перегенерации доступности товара (для отладки)
  const regenerateAvailability = useCallback(async (goodsId) => {
    console.log(`🔧 Запрос на перегенерацию доступности для товара ${goodsId}`);
    try {
      const response = await api.post(`/goods/${goodsId}/regenerate-availability/`);
      console.log('✅ Результат перегенерации:', response.data);
      toast.success(`Доступность товара перегенерирована: ${response.data.records_created} записей`);
      return response.data;
    } catch (error) {
      console.error('❌ Ошибка при перегенерации доступности:', error);
      const errorMessage = error.response?.data?.detail || error.message;
      toast.error(`Ошибка при перегенерации доступности: ${errorMessage}`);
      throw error;
    }
  }, []);

  return {
    loading,
    error,
    getGoods,
    searchGoods,
    getGoodsById,
    createGoods,
    updateGoods,
    deleteGoods,
    reserveGoods,
    getAllReservations,
    getAllAvailability,
    maskArticle,
    parseWildberriesUrl,
    getCategories,
    getCategoryById,
    deleteCategory,
    createCategory,
    updateCategory,
    bulkHideGoods,
    bulkShowGoods,
    getUserDailyReservationsCount,
    regenerateAvailability
  };
}; 