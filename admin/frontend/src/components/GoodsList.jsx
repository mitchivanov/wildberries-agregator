import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useApi } from '../hooks/useApi';
import { useTelegram } from '../hooks/useTelegram';
import GoodsItem from './GoodsItem';
import SearchBar from './SearchBar';
import toast from 'react-hot-toast';

const GoodsList = () => {
  const { getGoods, searchGoods, deleteGoods } = useApi();
  const { isDarkMode, webApp } = useTelegram();
  const navigate = useNavigate();

  const [goods, setGoods] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [isSearching, setIsSearching] = useState(false);
  const [highlightedGoodsId, setHighlightedGoodsId] = useState(null);

  // Загрузка товаров при монтировании компонента
  const loadGoods = async () => {
    setLoading(true);
    setIsSearching(false);
    try {
      const data = await getGoods();
      if (data) setGoods(data);

      // Проверяем, есть ли сохраненный ID для подсветки
      const savedHighlightId = localStorage.getItem('highlightedGoodsId');
      if (savedHighlightId) {
        setHighlightedGoodsId(parseInt(savedHighlightId));

        // Очищаем после использования
        localStorage.removeItem('highlightedGoodsId');

        // Прокручиваем к выделенному товару через небольшую задержку
        setTimeout(() => {
          const element = document.getElementById(`goods-row-${savedHighlightId}`);
          if (element) {
            element.scrollIntoView({ behavior: 'smooth', block: 'center' });

            // Анимация подсветки
            element.classList.add('highlight-animation');
            setTimeout(() => {
              element.classList.remove('highlight-animation');
            }, 2000);
          }
        }, 100);
      }
    } catch (err) {
      setError(err.message);
      toast.error(`Ошибка при загрузке товаров: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadGoods();

    // Настраиваем главную кнопку Telegram если доступно
    if (webApp) {
      webApp.MainButton.setParams({
        text: 'Добавить товар',
        color: '#0B63F6',
        text_color: '#ffffff'
      });

      const handleMainButtonClick = () => {
        navigate('/goods/create');
      };

      webApp.MainButton.onClick(handleMainButtonClick);
      webApp.MainButton.show();

      return () => {
        webApp.MainButton.offClick(handleMainButtonClick);
        webApp.MainButton.hide();
      };
    }
  }, [webApp, navigate]);

  // Поиск товаров
  const handleSearch = async (query) => {
    if (!query.trim()) {
      return loadGoods();
    }

    setLoading(true);
    setIsSearching(true);
    try {
      const data = await searchGoods(query);
      if (data) setGoods(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // Удаление товара
  const handleDelete = async (id) => {
    try {
      await deleteGoods(id);
      setGoods(goods.filter(item => item.id !== id));
      toast.success('Товар удален');
    } catch (err) {
      toast.error(`Ошибка при удалении: ${err.message}`);
    }
  };

  // Стили в зависимости от темы
  const themeClasses = isDarkMode
    ? 'bg-gray-800 border-gray-700 text-white'
    : 'bg-white border-gray-200 text-gray-700';

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className={`text-2xl font-bold ${isDarkMode ? 'text-white' : 'text-gray-800'}`}>
          Управление товарами
        </h1>
        <Link
          to="/admin/goods/create"
          className={`block w-full text-center py-2 px-4 rounded ${isDarkMode
              ? 'bg-blue-700 text-white hover:bg-blue-600'
              : 'bg-blue-600 text-white hover:bg-blue-700'
            }`}
        >
          Добавить новый товар
        </Link>
      </div>

      <SearchBar onSearch={handleSearch} isDarkMode={isDarkMode} />

      {loading ? (
        <div className="text-center py-10">
          <svg className="animate-spin h-10 w-10 text-blue-500 mx-auto" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
          <p className={`mt-2 ${isDarkMode ? 'text-gray-300' : 'text-gray-600'}`}>Загрузка...</p>
        </div>
      ) : goods.length === 0 ? (
        <div className={`text-center py-10 rounded-lg shadow ${themeClasses}`}>
          <p>
            {isSearching
              ? 'По вашему запросу ничего не найдено'
              : 'Список товаров пуст'}
          </p>
          {isSearching && (
            <button
              onClick={loadGoods}
              className="mt-2 btn btn-secondary"
            >
              Вернуться к полному списку
            </button>
          )}
        </div>
      ) : (
        <div className={`overflow-x-auto rounded-lg border ${isDarkMode ? 'border-gray-700' : 'border-gray-200'}`}>
          <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
            <thead className={isDarkMode ? 'bg-gray-700' : 'bg-gray-50'}>
              <tr>
                <th scope="col" className={`px-6 py-3 text-left text-xs font-medium uppercase tracking-wider ${isDarkMode ? 'text-gray-300' : 'text-gray-500'}`}>
                  ID
                </th>
                <th scope="col" className={`px-6 py-3 text-center text-xs font-medium uppercase tracking-wider ${isDarkMode ? 'text-gray-300' : 'text-gray-500'}`}>
                  Изображение
                </th>
                <th scope="col" className={`px-6 py-3 text-left text-xs font-medium uppercase tracking-wider ${isDarkMode ? 'text-gray-300' : 'text-gray-500'}`}>
                  Название
                </th>
                <th scope="col" className={`px-6 py-3 text-left text-xs font-medium uppercase tracking-wider ${isDarkMode ? 'text-gray-300' : 'text-gray-500'}`}>
                  Категория
                </th>
                <th scope="col" className={`px-6 py-3 text-left text-xs font-medium uppercase tracking-wider ${isDarkMode ? 'text-gray-300' : 'text-gray-500'}`}>
                  Артикул
                </th>
                <th scope="col" className={`px-6 py-3 text-left text-xs font-medium uppercase tracking-wider ${isDarkMode ? 'text-gray-300' : 'text-gray-500'}`}>
                  URL
                </th>
                <th scope="col" className={`px-6 py-3 text-left text-xs font-medium uppercase tracking-wider ${isDarkMode ? 'text-gray-300' : 'text-gray-500'}`}>
                  Цена
                </th>
                <th scope="col" className={`px-6 py-3 text-left text-xs font-medium uppercase tracking-wider ${isDarkMode ? 'text-gray-300' : 'text-gray-500'}`}>
                  Кэшбэк %
                </th>
                <th scope="col" className={`px-6 py-3 text-left text-xs font-medium uppercase tracking-wider ${isDarkMode ? 'text-gray-300' : 'text-gray-500'}`}>
                  Доступность/день
                </th>
                <th scope="col" className={`px-6 py-3 text-left text-xs font-medium uppercase tracking-wider ${isDarkMode ? 'text-gray-300' : 'text-gray-500'}`}>
                  Доступно сегодня
                </th>
                <th scope="col" className={`px-6 py-3 text-left text-xs font-medium uppercase tracking-wider ${isDarkMode ? 'text-gray-300' : 'text-gray-500'}`}>
                  Статус
                </th>
                <th scope="col" className={`px-6 py-3 text-right text-xs font-medium uppercase tracking-wider ${isDarkMode ? 'text-gray-300' : 'text-gray-500'}`}>
                  Действия
                </th>
              </tr>
            </thead>
            <tbody className={`divide-y ${isDarkMode ? 'divide-gray-700 bg-gray-800' : 'divide-gray-200 bg-white'}`}>
              {goods.map((item) => (
                <GoodsItem
                  key={item.id}
                  goods={item}
                  onDelete={handleDelete}
                  isHighlighted={item.id === highlightedGoodsId}
                  rowId={`goods-row-${item.id}`}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default GoodsList; 