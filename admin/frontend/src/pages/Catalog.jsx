import { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useApi } from '../hooks/useApi';
import { useTelegram } from '../hooks/useTelegram';
import SearchBar from '../components/SearchBar';
import toast from 'react-hot-toast';

const Catalog = () => {
  const { getGoods, searchGoods, maskArticle, getCategories } = useApi();
  const { isDarkMode, webApp } = useTelegram();
  const [goods, setGoods] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isSearching, setIsSearching] = useState(false);
  const [availabilityData, setAvailabilityData] = useState({});
  const [categories, setCategories] = useState([]);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState(null);

  useEffect(() => {
    loadGoods();
    
    // Скрываем кнопку "Назад" в WebApp, так как мы на главной странице
    if (webApp) {
      webApp.BackButton.hide();
    }
  }, [webApp]);

  useEffect(() => {
    const loadCategories = async () => {
      setLoading(true);
      try {
        const data = await getCategories();
        if (data) setCategories(data);
      } catch (err) {
        console.error('Ошибка при загрузке категорий:', err);
      } finally {
        setLoading(false);
      }
    };
    
    loadCategories();
  }, [getCategories]);

  const loadGoods = async () => {
    setLoading(true);
    setIsSearching(false);
    try {
      const data = await getGoods();
      if (data) {
        // Фильтруем активные и не скрытые товары
        const availableGoods = Array.isArray(data) 
          ? data.filter(item => item.is_active && !item.is_hidden) 
          : [];
        setGoods(availableGoods);
        
        // Получаем данные о доступности для всех доступных товаров на сегодня
        const today = new Date().toISOString().split('T')[0];
        const availabilityMap = {};
        
        if (Array.isArray(availableGoods) && availableGoods.length > 0) {
          availableGoods.forEach(item => {
            if (item.daily_availability && item.daily_availability.length > 0) {
              const todayAvailability = item.daily_availability.find(av => 
                av.date.split('T')[0] === today
              );
              availabilityMap[item.id] = todayAvailability ? todayAvailability.available_quantity : 0;
            } else {
              availabilityMap[item.id] = 0;
            }
          });
          
          setAvailabilityData(availabilityMap);
          
          if (data.length > 0 && availableGoods.length === 0) {
            toast.info('В настоящее время нет доступных товаров');
          }
        }
      }
    } catch (err) {
      console.error('Ошибка при загрузке товаров:', err);
      toast.error('Ошибка при загрузке товаров');
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = async (query) => {
    if (!query.trim()) {
      return loadGoods();
    }
    
    setLoading(true);
    setIsSearching(true);
    try {
      const data = await searchGoods(query);
      console.log('Результаты поиска:', data);
      
      // Фильтруем активные и не скрытые товары
      const availableGoods = Array.isArray(data) 
        ? data.filter(item => item.is_active && !item.is_hidden) 
        : [];
      setGoods(availableGoods);
      
      // Получаем данные о доступности
      const today = new Date().toISOString().split('T')[0];
      const availabilityMap = {};
      
      if (Array.isArray(availableGoods) && availableGoods.length > 0) {
        availableGoods.forEach(item => {
          if (item.daily_availability && item.daily_availability.length > 0) {
            const todayAvailability = item.daily_availability.find(av => 
              av.date.split('T')[0] === today
            );
            availabilityMap[item.id] = todayAvailability ? todayAvailability.available_quantity : 0;
          } else {
            availabilityMap[item.id] = 0;
          }
        });
        
        setAvailabilityData(availabilityMap);
      }
    } catch (error) {
      console.error('Ошибка при поиске товаров:', error);
      toast.error('Не удалось выполнить поиск');
    } finally {
      setLoading(false);
    }
  };

  // Функция для расчета цены с учетом кэшбека
  const calculatePriceWithCashback = (price, cashbackPercent) => {
    if (!cashbackPercent) return price;
    const discountAmount = (price * cashbackPercent) / 100;
    return Math.round(price - discountAmount);
  };

  // Модифицированная функция для обработки выбора категории
  const handleCategorySelect = (categoryId) => {
    setSelectedCategory(categoryId);
    setIsMenuOpen(false); // Закрываем меню после выбора
  };
  
  // Обновим sortedGoods для учета фильтрации по категории
  const sortedGoods = useMemo(() => {
    if (!goods || !goods.length) return [];
    
    // Фильтрация по выбранной категории
    let filteredGoods = [...goods];
    if (selectedCategory) {
      filteredGoods = filteredGoods.filter(item => 
        item.category && item.category.id === selectedCategory
      );
    }
    
    return filteredGoods.sort((a, b) => {
      const aAvailable = availabilityData[a.id] > 0 ? 1 : 0;
      const bAvailable = availabilityData[b.id] > 0 ? 1 : 0;
      
      // Сначала сортируем по наличию товара (в наличии - выше)
      if (aAvailable !== bAvailable) {
        return bAvailable - aAvailable;
      }
      
      // Если наличие одинаковое, то сортируем по количеству (больше - выше)
      const aQuantity = availabilityData[a.id] || 0;
      const bQuantity = availabilityData[b.id] || 0;
      
      if (aQuantity !== bQuantity) {
        return bQuantity - aQuantity;
      }
      
      // Если количество одинаковое, сортируем по названию
      return a.name.localeCompare(b.name);
    });
  }, [goods, availabilityData, selectedCategory]);

  return (
    <div className={`min-h-screen ${isDarkMode ? 'bg-gray-900 text-white' : 'bg-gray-50 text-gray-900'}`}>
      {/* Кнопка меню */}
      <button 
        onClick={() => setIsMenuOpen(!isMenuOpen)}
        className={`fixed top-4 left-4 z-50 p-2 rounded-md ${
          isDarkMode ? 'bg-gray-800 text-white' : 'bg-white text-gray-900'
        } shadow-lg`}
      >
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
        </svg>
      </button>
      
      {/* Боковое меню */}
      <div 
        className={`fixed inset-y-0 left-0 transform ${
          isMenuOpen ? 'translate-x-0' : '-translate-x-full'
        } w-64 transition-transform duration-300 ease-in-out z-40 ${
          isDarkMode ? 'bg-gray-800 text-white' : 'bg-white text-gray-900'
        } shadow-lg`}
      >
        <div className="p-5">
          <h3 className={`text-xl font-bold mb-4 ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
            Категории
          </h3>
          
          {loading ? (
            <div className="flex justify-center items-center">
              <svg className="animate-spin h-5 w-5 text-blue-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
            </div>
          ) : categories.length === 0 ? (
            <p className={`text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
              Нет доступных категорий
            </p>
          ) : (
            <div className="space-y-2">
              {/* Добавим опцию "Все категории" */}
              <button
                onClick={() => handleCategorySelect(null)}
                className={`block w-full text-left px-3 py-2 rounded ${
                  selectedCategory === null
                    ? isDarkMode ? 'bg-blue-700 text-white' : 'bg-blue-100 text-blue-800'
                    : isDarkMode ? 'hover:bg-gray-700' : 'hover:bg-gray-100'
                }`}
              >
                Все категории
              </button>
              
              {categories.map(category => (
                <button
                  key={category.id}
                  onClick={() => handleCategorySelect(category.id)}
                  className={`block w-full text-left px-3 py-2 rounded ${
                    selectedCategory === category.id
                      ? isDarkMode ? 'bg-blue-700 text-white' : 'bg-blue-100 text-blue-800'
                      : isDarkMode ? 'hover:bg-gray-700' : 'hover:bg-gray-100'
                  }`}
                >
                  {category.name}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
      
      {/* Остальное содержимое каталога */}
      <div className="container mx-auto px-4 py-8 pt-16">
        <div className="text-center mb-8">
          <h1 className={`text-3xl font-bold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
            Каталог товаров
            {selectedCategory && categories.find(c => c.id === selectedCategory) && 
              `: ${categories.find(c => c.id === selectedCategory).name}`
            }
          </h1>
          <p className={`mt-2 ${isDarkMode ? 'text-gray-300' : 'text-gray-600'}`}>
            Выберите товар для бронирования
          </p>
        </div>

        <SearchBar onSearch={handleSearch} isDarkMode={isDarkMode} />

        {loading ? (
          <div className="text-center py-10">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto"></div>
            <p className={`mt-2 ${isDarkMode ? 'text-gray-300' : 'text-gray-600'}`}>Загрузка...</p>
          </div>
        ) : goods.length === 0 ? (
          <div className={`text-center py-10 rounded-lg ${isDarkMode ? 'bg-gray-800' : 'bg-white'} shadow`}>
            <p className={isDarkMode ? 'text-gray-300' : 'text-gray-600'}>
              {isSearching 
                ? 'По вашему запросу ничего не найдено' 
                : 'В каталоге пока нет товаров'}
            </p>
            {isSearching && (
              <button 
                onClick={loadGoods} 
                className="mt-4 btn btn-secondary"
              >
                Вернуться к полному каталогу
              </button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {sortedGoods.map((item) => (
              <Link
                key={item.id}
                to={`/goods/${item.id}`}
                className={`block overflow-hidden rounded-lg shadow transition transform hover:-translate-y-1 ${
                  isDarkMode ? 'bg-gray-800 hover:shadow-blue-500/20' : 'bg-white hover:shadow-lg'
                } ${availabilityData[item.id] ? '' : 'opacity-70'}`}
              >
                <div className="h-48 overflow-hidden">
                  <img
                    src={item.image}
                    alt={item.name}
                    className="h-full w-full object-cover"
                    onError={(e) => {
                      e.target.onerror = null;
                      e.target.src = 'https://via.placeholder.com/300x200?text=Нет+изображения';
                    }}
                  />
                </div>
                <div className="p-4">
                  <p className={`text-sm mb-2 line-clamp-2 ${
                    isDarkMode ? 'text-gray-300' : 'text-gray-700'
                  }`}>
                    {item.name}
                  </p>
                  <p className={`text-xs mb-3 ${
                    isDarkMode ? 'text-gray-400' : 'text-gray-500'
                  }`}>
                    Артикул: {maskArticle(item.article)}
                  </p>
                  <div className="flex flex-col space-y-2">
                    <div className="flex justify-between items-center">
                      {item.cashback_percent > 0 ? (
                        <div className="flex flex-col">
                          {/* Цена с учетом кэшбека (главная) */}
                          <span className={`text-lg font-bold ${isDarkMode ? 'text-green-400' : 'text-green-600'}`}>
                            {calculatePriceWithCashback(item.price, item.cashback_percent).toLocaleString()} ₽
                          </span>
                          {/* Цена без кэшбека (зачеркнутая) */}
                          <span className={`text-sm line-through ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                            {item.price.toLocaleString()} ₽
                          </span>
                        </div>
                      ) : (
                        <span className={`text-lg font-bold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                          {item.price.toLocaleString()} ₽
                        </span>
                      )}
                      <span className={`inline-block px-2 py-1 text-xs font-semibold rounded ${
                        availabilityData[item.id] 
                          ? (isDarkMode ? 'bg-blue-700 text-white' : 'bg-blue-100 text-blue-800')
                          : (isDarkMode ? 'bg-red-900 text-white' : 'bg-red-100 text-red-800')
                      }`}>
                        {availabilityData[item.id] ? `Доступно: ${availabilityData[item.id]} шт.` : 'Нет в наличии'}
                      </span>
                    </div>
                    {item.cashback_percent > 0 && (
                      <div className="text-xs ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}">
                        Кэшбек {item.cashback_percent}%
                      </div>
                    )}
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default Catalog; 