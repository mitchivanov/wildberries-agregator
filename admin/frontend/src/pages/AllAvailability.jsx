import React, { useState, useEffect, useCallback, useMemo } from 'react';
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
  const [expandedDays, setExpandedDays] = useState(new Set());
  const [searchQuery, setSearchQuery] = useState('');
  const navigate = useNavigate();
  
  // Используем useCallback, чтобы предотвратить ненужные перерисовки
  const fetchAvailability = useCallback(async () => {
    try {
      setLoading(true);
      const data = await getAllAvailability();
      setAvailabilityData(data || []);
      
      // Автоматически раскрываем сегодняшний день
      const today = new Date().toISOString().split('T')[0];
      setExpandedDays(new Set([today]));
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
  }, [fetchAvailability]);
  
  // Группировка данных по дням
  const groupedByDays = useMemo(() => {
    if (!availabilityData || availabilityData.length === 0) return [];
    
    // Фильтруем по поисковому запросу
    const filteredData = searchQuery
      ? availabilityData.filter(item => 
          item.goods_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
          item.goods_article?.toLowerCase().includes(searchQuery.toLowerCase())
        )
      : availabilityData;
    
    // Группируем по датам
    const groups = {};
    filteredData.forEach(item => {
      const date = new Date(item.date);
      const dateKey = date.toISOString().split('T')[0];
      
      if (!groups[dateKey]) {
        groups[dateKey] = {
          date: dateKey,
          dateObject: date,
          items: []
        };
      }
      groups[dateKey].items.push(item);
    });
    
    // Сортируем дни по дате (начиная с сегодняшнего)
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    return Object.values(groups)
      .filter(group => group.dateObject >= today) // Показываем только с сегодняшнего дня
      .sort((a, b) => a.dateObject - b.dateObject)
      .map(group => ({
        ...group,
        totalItems: group.items.length,
        totalQuantity: group.items.reduce((sum, item) => sum + item.available_quantity, 0)
      }));
  }, [availabilityData, searchQuery]);
  
  // Форматирование даты
  const formatDate = (dateString) => {
    const date = new Date(dateString);
    const today = new Date();
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    
    const isToday = date.toDateString() === today.toDateString();
    const isTomorrow = date.toDateString() === tomorrow.toDateString();
    
    if (isToday) return `Сегодня, ${date.toLocaleDateString('ru-RU')}`;
    if (isTomorrow) return `Завтра, ${date.toLocaleDateString('ru-RU')}`;
    
    const daysOfWeek = ['Воскресенье', 'Понедельник', 'Вторник', 'Среда', 'Четверг', 'Пятница', 'Суббота'];
    const dayName = daysOfWeek[date.getDay()];
    
    return `${dayName}, ${date.toLocaleDateString('ru-RU')}`;
  };
  
  // Переход к товару и его подсветка
  const navigateToGoods = (goodsId) => {
    localStorage.setItem('highlightedGoodsId', goodsId);
    navigate(`/admin/goods`);
  };
  
  // Управление раскрытием дня
  const toggleDay = (dateKey) => {
    const newExpanded = new Set(expandedDays);
    if (newExpanded.has(dateKey)) {
      newExpanded.delete(dateKey);
    } else {
      newExpanded.add(dateKey);
    }
    setExpandedDays(newExpanded);
  };
  
  // Раскрыть/свернуть все дни
  const expandAll = () => {
    setExpandedDays(new Set(groupedByDays.map(group => group.date)));
  };
  
  const collapseAll = () => {
    setExpandedDays(new Set());
  };
  
  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <h1 className={`text-2xl font-bold ${isDarkMode ? 'text-white' : 'text-gray-800'}`}>
            Доступность товаров по дням
          </h1>
          
          <div className="flex space-x-2">
            <button
              onClick={expandAll}
              className={`px-3 py-2 text-sm rounded ${
                isDarkMode ? 'bg-blue-600 text-white hover:bg-blue-700' : 'bg-blue-500 text-white hover:bg-blue-600'
              }`}
            >
              Раскрыть все
            </button>
            <button
              onClick={collapseAll}
              className={`px-3 py-2 text-sm rounded ${
                isDarkMode ? 'bg-gray-600 text-white hover:bg-gray-700' : 'bg-gray-500 text-white hover:bg-gray-600'
              }`}
            >
              Свернуть все
            </button>
          </div>
        </div>
        
        {/* Поиск */}
        <div className="mb-4">
          <div className="relative">
            <input
              type="text"
              placeholder="Поиск по названию или артикулу товара..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className={`w-full pl-10 pr-4 py-3 rounded-lg border ${
                isDarkMode 
                  ? 'bg-gray-700 border-gray-600 text-white placeholder-gray-400' 
                  : 'bg-white border-gray-300 text-gray-900 placeholder-gray-500'
              } focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500`}
            />
            <svg 
              className={`absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 ${
                isDarkMode ? 'text-gray-400' : 'text-gray-500'
              }`} 
              fill="none" 
              stroke="currentColor" 
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>
          {searchQuery && (
            <p className={`mt-2 text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
              Найдено записей: {availabilityData.filter(item => 
                item.goods_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
                item.goods_article?.toLowerCase().includes(searchQuery.toLowerCase())
              ).length}
            </p>
          )}
        </div>
        
        {loading ? (
          <div className="text-center py-10">
            <svg className="animate-spin h-10 w-10 text-blue-500 mx-auto" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            <p className={`mt-2 ${isDarkMode ? 'text-gray-300' : 'text-gray-600'}`}>Загрузка доступности товаров...</p>
          </div>
        ) : groupedByDays.length === 0 ? (
          <div className={`text-center py-10 rounded-lg shadow ${isDarkMode ? 'bg-gray-800 text-white' : 'bg-white text-gray-700'}`}>
            <svg className={`mx-auto h-12 w-12 ${isDarkMode ? 'text-gray-600' : 'text-gray-400'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
            </svg>
            <p className="mt-2">
              {searchQuery ? 'Нет товаров, соответствующих поиску' : 'Нет данных о доступности товаров'}
            </p>
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className={`mt-2 text-sm ${isDarkMode ? 'text-blue-400 hover:text-blue-300' : 'text-blue-600 hover:text-blue-700'} underline`}
              >
                Очистить поиск
              </button>
            )}
          </div>
        ) : (
          <div className="space-y-4">
            {/* Статистика */}
            <div className={`grid grid-cols-1 md:grid-cols-3 gap-4 p-4 rounded-lg ${isDarkMode ? 'bg-gray-800' : 'bg-gray-50'}`}>
              <div className="text-center">
                <div className={`text-2xl font-bold ${isDarkMode ? 'text-blue-400' : 'text-blue-600'}`}>
                  {groupedByDays.length}
                </div>
                <div className={`text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                  Дней с товарами
                </div>
              </div>
              <div className="text-center">
                <div className={`text-2xl font-bold ${isDarkMode ? 'text-green-400' : 'text-green-600'}`}>
                  {groupedByDays.reduce((sum, group) => sum + group.totalItems, 0)}
                </div>
                <div className={`text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                  Всего позиций
                </div>
              </div>
              <div className="text-center">
                <div className={`text-2xl font-bold ${isDarkMode ? 'text-orange-400' : 'text-orange-600'}`}>
                  {groupedByDays.reduce((sum, group) => sum + group.totalQuantity, 0)}
                </div>
                <div className={`text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                  Общее количество
                </div>
              </div>
            </div>
            
            {/* Аккордеон дней */}
            <div className="space-y-3">
              {groupedByDays.map((dayGroup) => {
                const isExpanded = expandedDays.has(dayGroup.date);
                const isToday = new Date(dayGroup.date).toDateString() === new Date().toDateString();
                
                return (
                  <div 
                    key={dayGroup.date} 
                    className={`rounded-lg border ${
                      isDarkMode ? 'border-gray-700 bg-gray-800' : 'border-gray-200 bg-white'
                    } overflow-hidden shadow-sm ${isToday ? 'ring-2 ring-blue-500' : ''}`}
                  >
                    {/* Заголовок дня */}
                    <button
                      onClick={() => toggleDay(dayGroup.date)}
                      className={`w-full px-6 py-4 flex items-center justify-between ${
                        isDarkMode ? 'hover:bg-gray-700' : 'hover:bg-gray-50'
                      } transition-colors duration-200`}
                    >
                      <div className="flex items-center space-x-4">
                        <div className={`text-lg font-semibold ${
                          isToday ? (isDarkMode ? 'text-blue-400' : 'text-blue-600') : (isDarkMode ? 'text-white' : 'text-gray-900')
                        }`}>
                          {formatDate(dayGroup.date)}
                          {isToday && (
                            <span className={`ml-2 inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                              isDarkMode ? 'bg-blue-800 text-blue-200' : 'bg-blue-100 text-blue-800'
                            }`}>
                              Сегодня
                            </span>
                          )}
                        </div>
                      </div>
                      
                      <div className="flex items-center space-x-4">
                        <div className={`text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                          <span className="font-medium">{dayGroup.totalItems}</span> товаров
                          <span className="mx-2">•</span>
                          <span className="font-medium">{dayGroup.totalQuantity}</span> шт.
                        </div>
                        
                        <svg 
                          className={`h-5 w-5 ${isDarkMode ? 'text-gray-400' : 'text-gray-500'} transform transition-transform duration-200 ${
                            isExpanded ? 'rotate-180' : ''
                          }`} 
                          fill="none" 
                          stroke="currentColor" 
                          viewBox="0 0 24 24"
                        >
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                        </svg>
                      </div>
                    </button>
                    
                    {/* Содержимое дня */}
                    <div className={`transition-all duration-300 ease-in-out ${isExpanded ? 'max-h-screen opacity-100' : 'max-h-0 opacity-0'} overflow-hidden`}>
                      <div className={`border-t ${isDarkMode ? 'border-gray-700' : 'border-gray-200'}`}>
                        <div className="px-6 py-4">
                          <div className="grid gap-3">
                            {dayGroup.items.map((item) => (
                              <div 
                                key={item.id} 
                                className={`flex items-center justify-between p-4 rounded-lg ${
                                  isDarkMode ? 'bg-gray-700 hover:bg-gray-600' : 'bg-gray-50 hover:bg-gray-100'
                                } transition-colors duration-200`}
                              >
                                <div className="flex-1">
                                  <button 
                                    onClick={() => navigateToGoods(item.goods_id)}
                                    className={`font-medium hover:underline ${isDarkMode ? 'text-blue-400 hover:text-blue-300' : 'text-blue-600 hover:text-blue-700'}`}
                                  >
                                    {item.goods_name || `Товар #${item.goods_id}`}
                                  </button>
                                  {item.goods_article && (
                                    <div className={`text-sm mt-1 ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                                      Артикул: {item.goods_article}
                                    </div>
                                  )}
                                </div>
                                
                                <div className="flex items-center space-x-4">
                                  <div className={`text-lg font-semibold px-3 py-1 rounded-full ${
                                    item.available_quantity > 0 
                                      ? (isDarkMode ? 'bg-green-800 text-green-200' : 'bg-green-100 text-green-800')
                                      : (isDarkMode ? 'bg-red-800 text-red-200' : 'bg-red-100 text-red-800')
                                  }`}>
                                    {item.available_quantity} шт.
                                  </div>
                                  
                                  <button 
                                    onClick={() => navigateToGoods(item.goods_id)}
                                    className={`p-2 rounded-full ${
                                      isDarkMode ? 'text-gray-400 hover:text-white hover:bg-gray-600' : 'text-gray-500 hover:text-gray-700 hover:bg-gray-200'
                                    } transition-colors duration-200`}
                                    title="Перейти к товару"
                                  >
                                    <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                                    </svg>
                                  </button>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
};

export default AllAvailability; 