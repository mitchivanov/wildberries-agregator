import { useState, useCallback, useEffect } from 'react';
import axios from 'axios';
import { toast } from 'react-hot-toast';
import { useTelegram } from './useTelegram';

// Создаем экземпляр axios с базовым URL
const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:8000',
  headers: {
    'Content-Type': 'application/json',
  },
});

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
  const request = useCallback(async (method, url, data = null, options = {}) => {
    try {
      setLoading(true);
      setError(null);

      // Проверяем кэш для GET запросов
      const cacheKey = method === 'get' ? url : null;
      if (cacheKey && queryCache.has(cacheKey) && !options.skipCache) {
        console.log(`Данные получены из кэша для ${url}`);
        return queryCache.get(cacheKey);
      }

      console.log(`Отправка ${method.toUpperCase()} запроса на ${url}`);
      const response = await api({
        method,
        url,
        data,
        ...options
      });

      // Сохраняем в кэш для GET запросов
      if (cacheKey) {
        queryCache.set(cacheKey, response.data);
      }

      return response.data;
    } catch (err) {
      console.error(`Ошибка в ${method.toUpperCase()} запросе на ${url}:`, err);
      
      const errorMessage = err.response?.data?.detail || err.message || 'Произошла ошибка';
      setError(errorMessage);
      
      if (!options.suppressToast) {
        toast.error(errorMessage);
      }
      
      throw err;
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
    
    // Сбрасываем кэш списка товаров
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

  return {
    loading,
    error,
    getGoods,
    searchGoods,
    getGoodsById,
    createGoods,
    updateGoods,
    deleteGoods,
  };
}; 