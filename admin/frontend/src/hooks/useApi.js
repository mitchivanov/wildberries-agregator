import { useState, useCallback, useEffect } from 'react';
import axios from 'axios';
import { toast } from 'react-hot-toast';
import { useTelegram } from './useTelegram';

// Создаем экземпляр axios с базовым URL
const api = axios.create({
  baseURL: 'https://53f8-89-169-52-137.ngrok-free.app/api',
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

// Функция для получения URL медиафайла
const getMediaUrl = (path) => {
  if (!path) return '';
  
  // Проверяем, является ли путь уже полным URL
  if (path.startsWith('http://') || path.startsWith('https://')) {
    return path;
  }
  
  // Удаляем лишние 'uploads/' из пути, если они есть
  let normalizedPath = path;
  if (normalizedPath.startsWith('uploads/')) {
    normalizedPath = normalizedPath.substring(8); // Удаляем 'uploads/'
  }
  if (normalizedPath.startsWith('/uploads/')) {
    normalizedPath = normalizedPath.substring(9); // Удаляем '/uploads/'
  }
  
  // Добавляем проверку для ngrok URL
  const baseUrl = window.location.origin;
  
  // Формируем правильный URL
  return `${baseUrl}/uploads/${normalizedPath}`;
};

// Экспортируем функцию, чтобы она была доступна в useApi
export { api, getMediaUrl };

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

  // Получение всех товаров, включая скрытые (для админки)
  const getGoods = useCallback(async (includeHidden = true) => {
    console.log('Запрос списка товаров, include_hidden:', includeHidden);
    return request('get', `/goods/?include_hidden=${includeHidden}`);
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
  const getAllReservations = useCallback(async () => {
    console.log('Запрос всех бронирований');
    try {
      // Используем наш настроенный экземпляр api вместо axios напрямую
      const response = await api.get('/reservations/');
      
      // Проверяем и логируем данные для отладки
      if (response.data) {
        const reservationsWithConfirmation = response.data.filter(r => r.confirmation_data);
        console.log(`Получено ${response.data.length} бронирований, из них ${reservationsWithConfirmation.length} с данными подтверждения`);
        
        if (reservationsWithConfirmation.length > 0) {
          console.log('Пример данных подтверждения:', 
            Object.keys(reservationsWithConfirmation[0].confirmation_data));
        }
      }
      
      return response.data;
    } catch (error) {
      console.error('Ошибка при получении списка бронирований:', error);
      toast.error('Не удалось загрузить бронирования');
      throw error;
    }
  }, [api]);

  // Добавить функцию для получения всех данных о доступности
  const getAllAvailability = useCallback(async (dateFrom, dateTo) => {
    try {
      let url = '/availability/';
      const params = new URLSearchParams();
      
      if (dateFrom) {
        params.append('date_from', dateFrom.toISOString());
      }
      
      if (dateTo) {
        params.append('date_to', dateTo.toISOString());
      }
      
      if (params.toString()) {
        url += `?${params.toString()}`;
      }
      
      const response = await api.get(url);
      return response.data;
    } catch (error) {
      console.error('Ошибка при получении данных о доступности:', error);
      throw error;
    }
  }, [api]);

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

  // Добавляем методы для работы с примечаниями категорий
  const getCategoryNotes = useCallback(async (categoryId) => {
    console.log('Запрос примечаний категории:', categoryId);
    return request('get', `/category-notes/${categoryId}`);
  }, [request]);

  const createCategoryNote = useCallback(async (noteData) => {
    console.log('Создание нового примечания для категории:', noteData);
    return request('post', '/category-notes/', noteData);
  }, [request]);

  const deleteCategoryNote = useCallback(async (noteId) => {
    console.log('Удаление примечания категории:', noteId);
    return request('delete', `/category-notes/${noteId}`);
  }, [request]);

  // Получение бронирований пользователя
  const getUserReservations = useCallback(async (status = 'active') => {
    console.log(`Запрос бронирований пользователя со статусом: ${status}`);
    
    try {
      // Добавляем параметр status в запрос
      const response = await api.get(`/user-reservations/?status=${status}`);
      
      // Проверяем и обрабатываем данные о товарах
      if (response.data && Array.isArray(response.data)) {
        console.log('Получено бронирований:', response.data.length);
        
        // Убедимся, что у каждого бронирования есть данные о товаре
        const processedReservations = await Promise.all(response.data.map(async (reservation) => {
          if (!reservation.goods && reservation.goods_id) {
            console.log(`Загружаем данные для товара ${reservation.goods_id}`);
            try {
              const goodsData = await getGoodsById(reservation.goods_id);
              return {
                ...reservation,
                goods: goodsData
              };
            } catch (error) {
              console.error(`Ошибка при загрузке товара ${reservation.goods_id}:`, error);
              return reservation;
            }
          }
          return reservation;
        }));
        
        return processedReservations;
      }
      
      return response.data;
    } catch (error) {
      console.error('Ошибка при получении бронирований:', error);
      toast.error('Не удалось загрузить ваши бронирования');
      throw error;
    }
  }, [getGoodsById]);
  
  // Отмена бронирования
  const cancelReservation = async (reservationId) => {
    try {
      await api.delete(`/reservations/${reservationId}`);
      return true;
    } catch (error) {
      handleApiError(error);
      throw error;
    }
  };
  
  // Подтверждение заказа (перевод из PENDING в ACTIVE)
  const confirmReservationOrder = useCallback(async (reservationId, formData) => {
    console.log(`Отправка подтверждения заказа для бронирования ${reservationId}`);
    
    try {
      setLoading(true);
      
      // Создаем FormData и добавляем все поля
      const form = new FormData();
      
      // Собираем информацию о файлах для логирования
      const fileInfo = [];
      
      // Добавляем все текстовые поля и метаданные
      Object.entries(formData.formData).forEach(([fieldId, data]) => {
        // Добавляем метаданные для всех полей
        form.append(`field_${fieldId}_meta`, JSON.stringify({
          id: fieldId,
          type: data.type,
          title: data.title
        }));
        
        if (data.type === 'text') {
          form.append(`field_${fieldId}_text`, data.value);
          console.log(`Добавлено текстовое поле field_${fieldId}_text:`, data.value);
        } else if (data.file) {
          // Логируем информацию о файле перед отправкой
          const fileSize = data.file.size / 1024 / 1024; // в МБ
          console.log(`Добавляем файл field_${fieldId}_file:`, {
            name: data.file.name,
            type: data.file.type,
            size: `${fileSize.toFixed(2)} МБ`
          });
          
          form.append(`field_${fieldId}_file`, data.file);
          fileInfo.push({
            fieldId,
            name: data.file.name,
            size: `${fileSize.toFixed(2)} МБ`
          });
        }
      });
      
      // Отладочная информация о содержимом FormData
      console.log('Отправляемые файлы:', fileInfo);
      
      // Показываем индикатор загрузки
      toast.loading('Отправка данных...', { id: 'uploadStatus' });

      const response = await api.post(
        `/reservations/${reservationId}/confirm-order`,
        form,
        {
          headers: {
            'Content-Type': 'multipart/form-data'
          },
          // Добавляем обработчик прогресса загрузки
          onUploadProgress: (progressEvent) => {
            const percentCompleted = Math.round(
              (progressEvent.loaded * 100) / progressEvent.total
            );
            // Обновляем сообщение о прогрессе
            toast.loading(`Загрузка: ${percentCompleted}%`, 
              { id: 'uploadStatus' });
          }
        }
      );
      
      // Закрываем индикатор загрузки
      toast.dismiss('uploadStatus');
      
      console.log('Ответ сервера:', response.data);
      
      if (response.status === 200) {
        return { success: true, data: response.data };
      }
      
      return { success: false, error: 'Ошибка при отправке данных' };
    } catch (error) {
      // Закрываем индикатор загрузки
      toast.dismiss('uploadStatus');
      
      console.error('Ошибка при подтверждении заказа:', error);
      console.error('Сообщение ошибки:', error.message);
      
      return { 
        success: false, 
        error: error.response?.data?.detail || error.message || 'Неизвестная ошибка при отправке данных' 
      };
    } finally {
      setLoading(false);
    }
  }, [api]);

  // Подтверждение получения товара (перевод из ACTIVE в CONFIRMED)
  const confirmReservationDelivery = useCallback(async (reservationId, formData) => {
    console.log(`Отправка подтверждения получения для бронирования ${reservationId}`);
    
    try {
      setLoading(true);
      
      // Создаем FormData и добавляем все поля
      const form = new FormData();
      
      // Собираем информацию о файлах для логирования
      const fileInfo = [];
      
      // Добавляем все текстовые поля и метаданные
      Object.entries(formData.formData).forEach(([fieldId, data]) => {
        // Добавляем метаданные для всех полей
        form.append(`field_${fieldId}_meta`, JSON.stringify({
          id: fieldId,
          type: data.type,
          title: data.title
        }));
        
        if (data.type === 'text') {
          form.append(`field_${fieldId}_text`, data.value);
          console.log(`Добавлено текстовое поле field_${fieldId}_text:`, data.value);
        } else if (data.file) {
          // Логируем информацию о файле перед отправкой
          const fileSize = data.file.size / 1024 / 1024; // в МБ
          console.log(`Добавляем файл field_${fieldId}_file:`, {
            name: data.file.name,
            type: data.file.type,
            size: `${fileSize.toFixed(2)} МБ`
          });
          
          form.append(`field_${fieldId}_file`, data.file);
          fileInfo.push({
            fieldId,
            name: data.file.name,
            size: `${fileSize.toFixed(2)} МБ`
          });
        }
      });
      
      // Отладочная информация о содержимом FormData
      console.log('Отправляемые файлы:', fileInfo);
      
      // Показываем индикатор загрузки
      toast.loading('Отправка данных...', { id: 'uploadStatus' });

      const response = await api.post(
        `/reservations/${reservationId}/confirm-delivery`,
        form,
        {
          headers: {
            'Content-Type': 'multipart/form-data'
          },
          // Добавляем обработчик прогресса загрузки
          onUploadProgress: (progressEvent) => {
            const percentCompleted = Math.round(
              (progressEvent.loaded * 100) / progressEvent.total
            );
            // Обновляем сообщение о прогрессе
            toast.loading(`Загрузка: ${percentCompleted}%`, 
              { id: 'uploadStatus' });
          }
        }
      );
      
      // Закрываем индикатор загрузки
      toast.dismiss('uploadStatus');
      
      console.log('Ответ сервера:', response.data);
      
      if (response.status === 200) {
        return { success: true, data: response.data };
      }
      
      return { success: false, error: 'Ошибка при отправке данных' };
    } catch (error) {
      // Закрываем индикатор загрузки
      toast.dismiss('uploadStatus');
      
      console.error('Ошибка при подтверждении получения:', error);
      console.error('Сообщение ошибки:', error.message);
      
      return { 
        success: false, 
        error: error.response?.data?.detail || error.message || 'Неизвестная ошибка при отправке данных' 
      };
    } finally {
      setLoading(false);
    }
  }, [api]);

  // Старый метод submitConfirmationData переименуем для совместимости
  const submitConfirmationData = useCallback(async (reservationId, formData) => {
    console.log('Используется устаревший метод submitConfirmationData, необходимо заменить на confirmReservationOrder или confirmReservationDelivery');
    return confirmReservationOrder(reservationId, formData);
  }, [confirmReservationOrder]);

  // Добавляем функцию для парсинга товара с Wildberries
  const parseWildberriesUrl = useCallback(async (url) => {
    console.log(`Парсинг товара Wildberries: ${url}`);
    return request('post', '/parse-wildberries/', { url });
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
    getCategories,
    getCategoryById,
    deleteCategory,
    createCategory,
    updateCategory,
    bulkHideGoods,
    bulkShowGoods,
    getCategoryNotes,
    createCategoryNote,
    deleteCategoryNote,
    getUserReservations,
    cancelReservation,
    confirmReservationOrder,
    confirmReservationDelivery,
    submitConfirmationData,
    parseWildberriesUrl,
    getMediaUrl: (path) => getMediaUrl(path),
  };
}; 