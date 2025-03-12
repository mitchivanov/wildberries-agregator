import { useState, useCallback, useEffect } from 'react';
import axios from 'axios';
import { toast } from 'react-hot-toast';
import { useTelegram } from './useTelegram';

// Создаем экземпляр axios с базовым URL
const api = axios.create({
  baseURL: 'https://develooper.ru/api',
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

  // Получение всех товаров
  const getGoods = useCallback(async () => {
    console.log('Запрос списка товаров');
    return request('get', '/goods/');
  }, [request]);

  // Поиск товаров
  const searchGoods = useCallback(async (query) => {
    console.log(`Поиск товаров по запросу: ${query}`);
    return request('get', `/goods/?search=${encodeURIComponent(query)}`);
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
    console.log('Запрос данных о доступности товаров');
    
    // Проверяем кэш перед запросом
    const cacheKey = '/availability/';
    if (queryCache.has(cacheKey)) {
      console.log('Возвращаем кэшированные данные о доступности');
      return queryCache.get(cacheKey);
    }
    
    try {
      const response = await api.get('/availability/');
      
      // Дополнительный запрос для получения информации о товарах
      const goodsResponse = await api.get('/goods/');
      const goodsMap = {};
      
      // Создаем карту товаров по ID для быстрого доступа
      if (goodsResponse.data) {
        goodsResponse.data.forEach(goods => {
          goodsMap[goods.id] = {
            name: goods.name,
            article: goods.article
          };
        });
      }
      
      // Добавляем информацию о товарах к данным о доступности
      const enrichedData = response.data.map(item => ({
        ...item,
        goods_name: goodsMap[item.goods_id]?.name || null,
        goods_article: goodsMap[item.goods_id]?.article || null
      }));
      
      // Сохраняем в кэш
      queryCache.set(cacheKey, enrichedData);
      
      return enrichedData;
    } catch (error) {
      const errorMessage = error.response?.data?.detail || error.message;
      console.error('Ошибка при получении данных о доступности:', errorMessage);
      toast.error(`Ошибка: ${errorMessage}`);
      throw error;
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
    updateCategory
  };
}; 