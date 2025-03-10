import { useState, useCallback, useEffect } from 'react';
import axios from 'axios';
import { toast } from 'react-hot-toast';
import { useTelegram } from './useTelegram';

// Создаем экземпляр axios с базовым URL
const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || '/api',
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
    const result = await request('put', `/goods/${id}`, goodsData);
    
    // Сбрасываем кэши
    queryCache.delete('/goods/');
    queryCache.delete(`/goods/${id}`);
    
    toast.success('Товар успешно обновлен');
    return result;
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
  };
}; 