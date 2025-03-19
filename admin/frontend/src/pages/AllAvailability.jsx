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
  const [groupedData, setGroupedData] = useState({});
  const [expandedGoods, setExpandedGoods] = useState({});
  const [loading, setLoading] = useState(true);
  const [dateFilter, setDateFilter] = useState('');
  const navigate = useNavigate();
  
  const fetchAvailability = useCallback(async () => {
    try {
      setLoading(true);
      const data = await getAllAvailability();
      
      // Сохраняем исходные данные
      setAvailabilityData(data || []);
      
      // Группируем данные по товарам
      const grouped = {};
      (data || []).forEach(item => {
        if (!grouped[item.goods_id]) {
          grouped[item.goods_id] = {
            goods_id: item.goods_id,
            goods_name: item.goods_name || `Товар #${item.goods_id}`,
            goods_article: item.goods_article || 'Н/Д',
            goods_image: item.goods_image,
            goods_price: item.goods_price,
            availability: []
          };
        }
        
        grouped[item.goods_id].availability.push({
          id: item.id,
          date: item.date,
          available_quantity: item.available_quantity
        });
      });
      
      setGroupedData(grouped);
    } catch (error) {
      console.error('Ошибка при загрузке данных:', error);
      toast.error(`Ошибка при загрузке данных: ${error.message}`);
    } finally {
      setLoading(false);
    }
  }, [getAllAvailability]);

  useEffect(() => {
    console.log('Компонент AllAvailability смонтирован, загружаем данные');
    fetchAvailability();
  }, []);
  
  // Форматирование даты
  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('ru-RU');
  };
  
  // Переход к товару и его подсветка
  const navigateToGoods = (goodsId) => {
    localStorage.setItem('highlightedGoodsId', goodsId);
    navigate(`/admin/goods`);
  };
  
  // Фильтрация по дате
  const filterByDate = (dateValue) => {
    setDateFilter(dateValue);
  };
  
  // Раскрытие/скрытие деталей товара
  const toggleGoodsDetails = (goodsId) => {
    setExpandedGoods(prev => ({
      ...prev,
      [goodsId]: !prev[goodsId]
    }));
  };
  
  // Фильтрованные товары
  const filteredGoods = Object.values(groupedData).filter(goods => {
    if (!dateFilter) return true;
    
    // Если есть фильтр даты, проверяем наличие этой даты в доступности товара
    return goods.availability.some(item => {
      const itemDate = new Date(item.date).toLocaleDateString('ru-RU');
      return itemDate.includes(dateFilter);
    });
  });
  
  // Фильтрованные даты для конкретного товара
  const getFilteredDates = (availability) => {
    if (!dateFilter) return availability;
    
    return availability.filter(item => {
      const itemDate = new Date(item.date).toLocaleDateString('ru-RU');
      return itemDate.includes(dateFilter);
    });
  };
  
  return (
    <Layout>
      <div className="space-y-6">
        <h1 className={`text-2xl font-bold ${isDarkMode ? 'text-white' : 'text-gray-800'}`}>
          Доступность товаров
        </h1>
        
        {/* Фильтр по дате */}
        <div className="mb-6">
          <div className="flex">
            <input
              type="text"
              placeholder="Фильтр по дате (например, 15.07.2023)"
              value={dateFilter}
              onChange={(e) => filterByDate(e.target.value)}
              className={`px-4 py-2 rounded-lg w-full ${
                isDarkMode 
                  ? 'bg-gray-700 border-gray-600 text-white placeholder-gray-400' 
                  : 'bg-white border border-gray-300 text-gray-900 placeholder-gray-500'
              }`}
            />
            {dateFilter && (
              <button
                onClick={() => filterByDate('')}
                className={`ml-2 px-3 py-2 rounded-lg ${
                  isDarkMode 
                    ? 'bg-gray-700 text-gray-300 hover:bg-gray-600' 
                    : 'bg-gray-200 text-gray-600 hover:bg-gray-300'
                }`}
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                </svg>
              </button>
            )}
          </div>
        </div>
        
        {loading ? (
          <div className="text-center py-10">
            <svg className="animate-spin h-10 w-10 text-blue-500 mx-auto" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            <p className={`mt-2 ${isDarkMode ? 'text-gray-300' : 'text-gray-600'}`}>Загрузка...</p>
          </div>
        ) : filteredGoods.length === 0 ? (
          <div className={`text-center py-10 rounded-lg shadow ${isDarkMode ? 'bg-gray-800 text-white' : 'bg-white text-gray-700'}`}>
            <p>Нет данных о доступности товаров</p>
          </div>
        ) : (
          <div className="space-y-4">
            {filteredGoods.map((goods) => (
              <div 
                key={goods.goods_id}
                className={`rounded-lg shadow-md overflow-hidden transition-all duration-300 ${
                  isDarkMode ? 'bg-gray-800' : 'bg-white'
                }`}
              >
                {/* Заголовок карточки товара */}
                <div 
                  className={`px-6 py-4 flex items-center justify-between cursor-pointer ${
                    isDarkMode ? 'hover:bg-gray-700' : 'hover:bg-gray-50'
                  }`}
                  onClick={() => toggleGoodsDetails(goods.goods_id)}
                >
                  <div className="flex items-center">
                    {goods.goods_image && (
                      <img 
                        src={goods.goods_image} 
                        alt={goods.goods_name}
                        className="w-12 h-12 object-cover rounded mr-4"
                      />
                    )}
                    <div>
                      <h3 className={`font-medium ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                        {goods.goods_name}
                      </h3>
                      <p className={`text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                        Артикул: {goods.goods_article}
                      </p>
                    </div>
                  </div>
                  
                  <div className="flex items-center">
                    <span className={`px-3 py-1 rounded-full text-xs font-medium mr-4 ${
                      isDarkMode ? 'bg-blue-900/30 text-blue-300' : 'bg-blue-100 text-blue-800'
                    }`}>
                      {goods.availability.length} дней доступности
                    </span>
                    
                    <button 
                      onClick={(e) => {
                        e.stopPropagation();
                        navigateToGoods(goods.goods_id);
                      }}
                      className={`mr-4 px-2 py-1 rounded text-xs font-medium ${
                        isDarkMode 
                          ? 'bg-green-700 text-white hover:bg-green-600' 
                          : 'bg-green-600 text-white hover:bg-green-700'
                      }`}
                    >
                      Редактировать
                    </button>
                    
                    <svg 
                      xmlns="http://www.w3.org/2000/svg" 
                      className={`h-5 w-5 transition-transform duration-300 ${
                        expandedGoods[goods.goods_id] ? 'transform rotate-180' : ''
                      } ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`} 
                      viewBox="0 0 20 20" 
                      fill="currentColor"
                    >
                      <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
                    </svg>
                  </div>
                </div>
                
                {/* Раскрывающаяся таблица доступности */}
                {expandedGoods[goods.goods_id] && (
                  <div className={`px-6 py-4 border-t ${isDarkMode ? 'border-gray-700' : 'border-gray-200'}`}>
                    <div className="overflow-x-auto rounded-lg">
                      <table className={`min-w-full divide-y ${isDarkMode ? 'divide-gray-700' : 'divide-gray-200'}`}>
                        <thead className={isDarkMode ? 'bg-gray-700' : 'bg-gray-50'}>
                          <tr>
                            <th scope="col" className={`px-6 py-3 text-left text-xs font-medium uppercase tracking-wider ${isDarkMode ? 'text-gray-300' : 'text-gray-500'}`}>
                              Дата
                            </th>
                            <th scope="col" className={`px-6 py-3 text-left text-xs font-medium uppercase tracking-wider ${isDarkMode ? 'text-gray-300' : 'text-gray-500'}`}>
                              Доступное количество
                            </th>
                          </tr>
                        </thead>
                        <tbody className={`divide-y ${isDarkMode ? 'divide-gray-700 bg-gray-800' : 'divide-gray-200 bg-white'}`}>
                          {getFilteredDates(goods.availability).map((item) => (
                            <tr key={item.id} className={isDarkMode ? 'hover:bg-gray-700' : 'hover:bg-gray-50'}>
                              <td className={`px-6 py-3 whitespace-nowrap text-sm ${isDarkMode ? 'text-gray-300' : 'text-gray-500'}`}>
                                {formatDate(item.date)}
                              </td>
                              <td className={`px-6 py-3 whitespace-nowrap text-sm ${isDarkMode ? 'text-gray-300' : 'text-gray-500'}`}>
                                {item.available_quantity} шт.
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </Layout>
  );
};

export default AllAvailability; 