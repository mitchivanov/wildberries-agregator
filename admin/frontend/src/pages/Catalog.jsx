import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useApi } from '../hooks/useApi';
import { useTelegram } from '../hooks/useTelegram';
import SearchBar from '../components/SearchBar';
import toast from 'react-hot-toast';

const Catalog = () => {
  const { getGoods, searchGoods, maskArticle } = useApi();
  const { isDarkMode, webApp } = useTelegram();
  const [goods, setGoods] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isSearching, setIsSearching] = useState(false);
  const [availabilityData, setAvailabilityData] = useState({});

  useEffect(() => {
    loadGoods();
    
    // Скрываем кнопку "Назад" в WebApp, так как мы на главной странице
    if (webApp) {
      webApp.BackButton.hide();
    }
  }, [webApp]);

  const loadGoods = async () => {
    setLoading(true);
    setIsSearching(false);
    try {
      const data = await getGoods();
      if (data) {
        // Фильтруем только активные товары
        const activeGoods = data.filter(item => item.is_active);
        setGoods(activeGoods);
        
        // Получаем данные о доступности для всех товаров на сегодня
        const today = new Date().toISOString().split('T')[0];
        const availabilityMap = {};
        
        activeGoods.forEach(item => {
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
        
        if (data.length > 0 && activeGoods.length === 0) {
          toast.info('В настоящее время нет доступных товаров');
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
      // Фильтруем только активные товары
      const activeGoods = data.filter(item => item.is_active);
      setGoods(activeGoods);
      
      // Получаем данные о доступности для всех найденных товаров на сегодня
      const today = new Date().toISOString().split('T')[0];
      const availabilityMap = {};
      
      activeGoods.forEach(item => {
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

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="text-center mb-8">
        <h1 className={`text-3xl font-bold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
          Каталог товаров
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
          {goods.map((item) => (
            <Link
              key={item.id}
              to={`/goods/${item.id}`}
              className={`block overflow-hidden rounded-lg shadow transition transform hover:-translate-y-1 ${
                isDarkMode ? 'bg-gray-800 hover:shadow-blue-500/20' : 'bg-white hover:shadow-lg'
              }`}
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
                      isDarkMode ? 'bg-blue-700 text-white' : 'bg-blue-100 text-blue-800'
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
  );
};

export default Catalog; 