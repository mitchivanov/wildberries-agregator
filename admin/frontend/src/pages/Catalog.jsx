import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useApi } from '../hooks/useApi';
import { useTelegram } from '../hooks/useTelegram';
import SearchBar from '../components/SearchBar';
import toast from 'react-hot-toast';

const Catalog = () => {
  const { getGoods, searchGoods } = useApi();
  const { isDarkMode, webApp } = useTelegram();
  const [goods, setGoods] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isSearching, setIsSearching] = useState(false);

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
      if (data && Array.isArray(data)) {
        // Фильтруем только активные товары для публичного каталога
        setGoods(data.filter(item => item.is_active));
      } else {
        console.error('Получены некорректные данные:', data);
        setGoods([]);
      }
    } catch (err) {
      toast.error(`Ошибка при загрузке товаров: ${err.message}`);
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
      if (data) {
        setGoods(data.filter(item => item.is_active));
      }
    } catch (err) {
      toast.error(`Ошибка при поиске: ${err.message}`);
    } finally {
      setLoading(false);
    }
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
                    e.target.src = "https://via.placeholder.com/400x300?text=Нет+фото";
                  }}
                />
              </div>
              <div className="p-4">
                <h3 className={`text-lg font-semibold mb-2 ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                  {item.name}
                </h3>
                <p className={`text-sm mb-2 ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                  Артикул: {item.article}
                </p>
                <div className="flex justify-between items-center">
                  <span className={`text-lg font-bold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                    {item.price.toLocaleString()} ₽
                  </span>
                  <span className={`inline-block px-2 py-1 text-xs font-semibold rounded ${
                    isDarkMode ? 'bg-blue-700 text-white' : 'bg-blue-100 text-blue-800'
                  }`}>
                    Подробнее
                  </span>
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