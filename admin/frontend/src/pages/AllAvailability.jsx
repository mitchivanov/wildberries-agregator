import React, { useState, useEffect, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import Layout from '../components/Layout';
import { useApi } from '../hooks/useApi';
import { useTelegram } from '../hooks/useTelegram';
import toast from 'react-hot-toast';

const AllAvailability = () => {
  const { isDarkMode } = useTelegram();
  const { getAllAvailability } = useApi();
  const [availabilityData, setAvailabilityData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dateFilter, setDateFilter] = useState('');
  const navigate = useNavigate();
  
  // Используем useCallback, чтобы предотвратить ненужные перерисовки
  const fetchAvailability = useCallback(async () => {
    try {
      setLoading(true);
      const data = await getAllAvailability();
      setAvailabilityData(data || []);
    } catch (error) {
      console.error('Ошибка при загрузке данных:', error);
      toast.error(`Ошибка при загрузке данных: ${error.message}`);
    } finally {
      setLoading(false);
    }
  }, [getAllAvailability]);

  // Используем useEffect с пустым массивом зависимостей для загрузки данных только при монтировании
  useEffect(() => {
    console.log('Компонент AllAvailability смонтирован, загружаем данные');
    fetchAvailability();
    // Убираем getAllAvailability из зависимостей
  }, []);
  
  // Форматирование даты
  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('ru-RU');
  };
  
  // Переход к товару и его подсветка
  const navigateToGoods = (goodsId) => {
    // Сохраняем ID товара для подсветки в локальное хранилище
    localStorage.setItem('highlightedGoodsId', goodsId);
    navigate(`/admin/goods`);
  };
  
  // Фильтрация по дате
  const filteredData = dateFilter
    ? availabilityData.filter(item => {
        const itemDate = new Date(item.date).toLocaleDateString('ru-RU');
        return itemDate.includes(dateFilter);
      })
    : availabilityData;
  
  return (
    <Layout>
      <div className="space-y-6">
        <h1 className={`text-2xl font-bold ${isDarkMode ? 'text-white' : 'text-gray-800'}`}>
          Доступность товаров
        </h1>
        
        {/* Фильтр по дате */}
        <div className="mb-4">
          <input
            type="text"
            placeholder="Фильтр по дате (например, 15.07.2023)"
            value={dateFilter}
            onChange={(e) => setDateFilter(e.target.value)}
            className={`form-input ${
              isDarkMode 
                ? 'bg-gray-700 border-gray-600 text-white placeholder-gray-400' 
                : 'bg-white border-gray-300 text-gray-900 placeholder-gray-500'
            }`}
          />
        </div>
        
        {loading ? (
          <div className="text-center py-10">
            <svg className="animate-spin h-10 w-10 text-blue-500 mx-auto" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            <p className={`mt-2 ${isDarkMode ? 'text-gray-300' : 'text-gray-600'}`}>Загрузка...</p>
          </div>
        ) : filteredData.length === 0 ? (
          <div className={`text-center py-10 rounded-lg shadow ${isDarkMode ? 'bg-gray-800 text-white' : 'bg-white text-gray-700'}`}>
            <p>Нет данных о доступности товаров</p>
          </div>
        ) : (
          <div className="overflow-x-auto rounded-lg border dark:border-gray-700">
            <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
              <thead className={isDarkMode ? 'bg-gray-700' : 'bg-gray-50'}>
                <tr>
                  <th scope="col" className={`px-6 py-3 text-left text-xs font-medium uppercase tracking-wider ${isDarkMode ? 'text-gray-300' : 'text-gray-500'}`}>
                    Товар
                  </th>
                  <th scope="col" className={`px-6 py-3 text-left text-xs font-medium uppercase tracking-wider ${isDarkMode ? 'text-gray-300' : 'text-gray-500'}`}>
                    Артикул
                  </th>
                  <th scope="col" className={`px-6 py-3 text-left text-xs font-medium uppercase tracking-wider ${isDarkMode ? 'text-gray-300' : 'text-gray-500'}`}>
                    Дата
                  </th>
                  <th scope="col" className={`px-6 py-3 text-left text-xs font-medium uppercase tracking-wider ${isDarkMode ? 'text-gray-300' : 'text-gray-500'}`}>
                    Доступное количество
                  </th>
                </tr>
              </thead>
              <tbody className={`divide-y ${isDarkMode ? 'divide-gray-700 bg-gray-800' : 'divide-gray-200 bg-white'}`}>
                {filteredData.map((item) => (
                  <tr key={item.id} className={isDarkMode ? 'hover:bg-gray-700' : 'hover:bg-gray-50'}>
                    <td className={`px-6 py-4 whitespace-nowrap text-sm ${isDarkMode ? 'text-gray-300' : 'text-gray-500'}`}>
                      <button 
                        onClick={() => navigateToGoods(item.goods_id)}
                        className={`font-medium hover:underline ${isDarkMode ? 'text-blue-400' : 'text-blue-600'}`}
                      >
                        {item.goods_name || `Товар #${item.goods_id}`}
                      </button>
                    </td>
                    <td className={`px-6 py-4 whitespace-nowrap text-sm ${isDarkMode ? 'text-gray-300' : 'text-gray-500'}`}>
                      {item.goods_article || 'Н/Д'}
                    </td>
                    <td className={`px-6 py-4 whitespace-nowrap text-sm ${isDarkMode ? 'text-gray-300' : 'text-gray-500'}`}>
                      {formatDate(item.date)}
                    </td>
                    <td className={`px-6 py-4 whitespace-nowrap text-sm ${isDarkMode ? 'text-gray-300' : 'text-gray-500'}`}>
                      {item.available_quantity} шт.
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </Layout>
  );
};

export default AllAvailability; 