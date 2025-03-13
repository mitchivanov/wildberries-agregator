import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useApi } from '../../hooks/useApi';
import { useTelegram } from '../../hooks/useTelegram';
import GoodsItem from './GoodsItem';
import SearchBar from '../common/SearchBar';
import toast from 'react-hot-toast';

const GoodsList = () => {
  const { getGoods, searchGoods, deleteGoods } = useApi();
  const { isDarkMode, webApp } = useTelegram();
  const navigate = useNavigate();

  // Добавляем состояния для сортировки
  const [sortField, setSortField] = useState(null);
  const [sortDirection, setSortDirection] = useState('asc');

  const [goods, setGoods] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [isSearching, setIsSearching] = useState(false);
  const [highlightedGoodsId, setHighlightedGoodsId] = useState(null);
  
  // Добавляем новые состояния для пагинации
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);

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

  // Вычисляем индексы для текущей страницы
  const indexOfLastItem = currentPage * itemsPerPage;
  const indexOfFirstItem = indexOfLastItem - itemsPerPage;
  const currentItems = goods.slice(indexOfFirstItem, indexOfLastItem);
  const totalPages = Math.ceil(goods.length / itemsPerPage);

  // Функция изменения страницы
  const handlePageChange = (pageNumber) => {
    setCurrentPage(pageNumber);
  };

  // Функция для сортировки товаров
  const sortGoods = (items) => {
    if (!sortField) return items;
    
    return [...items].sort((a, b) => {
      let aValue = a[sortField];
      let bValue = b[sortField];
      
      // Специальная обработка для разных типов полей
      if (sortField === 'category') {
        aValue = a.category?.name || '';
        bValue = b.category?.name || '';
      } else if (sortField === 'id' || sortField === 'price') {
        // Преобразуем строки в числа для числовых полей
        aValue = Number(aValue) || 0;
        bValue = Number(bValue) || 0;
        
        // Прямое сравнение чисел
        return sortDirection === 'asc' 
          ? aValue - bValue 
          : bValue - aValue;
      }
      
      // Для текстовых полей оставляем строковое сравнение
      aValue = String(aValue).toLowerCase();
      bValue = String(bValue).toLowerCase();
      
      if (sortDirection === 'asc') {
        return aValue > bValue ? 1 : -1;
      } else {
        return aValue < bValue ? 1 : -1;
      }
    });
  };

  // Обработчик клика по заголовку столбца
  const handleSort = (field) => {
    if (sortField === field) {
      // Если поле то же, меняем направление
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      // Если поле новое, устанавливаем его и направление по умолчанию
      setSortField(field);
      setSortDirection('asc');
    }
  };

  // Компонент заголовка столбца с сортировкой
  const SortableHeader = ({ field, children }) => {
    const isSorted = sortField === field;
    
    return (
      <th 
        scope="col" 
        className={`px-6 py-3 text-left text-xs font-medium uppercase tracking-wider cursor-pointer
          ${isDarkMode ? 'text-gray-300 hover:text-white' : 'text-gray-500 hover:text-gray-700'}`}
        onClick={() => handleSort(field)}
      >
        <div className="flex items-center space-x-1">
          <span>{children}</span>
          {isSorted && (
            <span className="ml-1">
              {sortDirection === 'asc' ? '↑' : '↓'}
            </span>
          )}
        </div>
      </th>
    );
  };

  // Модифицируем отображение отсортированных товаров
  const displayItems = sortGoods(currentItems);

  // Стили в зависимости от темы
  const themeClasses = isDarkMode
    ? 'bg-gray-800 border-gray-700 text-white'
    : 'bg-white border-gray-200 text-gray-700';

  return (
    <div className="px-1 sm:px-2 lg:px-4">
      <div className="flex flex-col sm:flex-row justify-between items-center mb-4 space-y-2 sm:space-y-0">
        <SearchBar onSearch={handleSearch} />
        <div className="flex items-center space-x-4">
          <select
            value={itemsPerPage}
            onChange={(e) => {
              setItemsPerPage(Number(e.target.value));
              setCurrentPage(1);
            }}
            className={`rounded-md border ${
              isDarkMode 
                ? 'bg-gray-700 border-gray-600 text-white' 
                : 'bg-white border-gray-300 text-gray-900'
            } px-3 py-1`}
          >
            <option value={10}>10 на странице</option>
            <option value={50}>50 на странице</option>
            <option value={100}>100 на странице</option>
          </select>
          <Link
            to="/admin/goods/create"
            className={`btn ${
              isDarkMode ? 'btn-dark' : 'btn-light'
            }`}
          >
            Добавить товар
          </Link>
        </div>
      </div>

      {/* Расширяем контейнер таблицы на всю ширину */}
      <div className="w-full overflow-x-auto">
        <div className="inline-block min-w-full align-middle">
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
            <table className={`min-w-full divide-y ${isDarkMode ? 'divide-gray-700' : 'divide-gray-200'}`}>
              <thead className={isDarkMode ? 'bg-gray-700' : 'bg-gray-50'}>
                <tr>
                  <SortableHeader field="id">ID</SortableHeader>
                  <SortableHeader field="name">Название</SortableHeader>
                  <SortableHeader field="category">Категория</SortableHeader>
                  <SortableHeader field="article">Артикул</SortableHeader>
                  <SortableHeader field="url">URL</SortableHeader>
                  <SortableHeader field="price">Цена</SortableHeader>
                  <SortableHeader field="is_active">Статус</SortableHeader>
                  <th scope="col" className={`px-6 py-3 text-right text-xs font-medium uppercase tracking-wider ${isDarkMode ? 'text-gray-300' : 'text-gray-500'}`}>
                    Действия
                  </th>
                </tr>
              </thead>
              <tbody className={`divide-y ${isDarkMode ? 'divide-gray-700 bg-gray-800' : 'divide-gray-200 bg-white'}`}>
                {displayItems.map((item) => (
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
          )}
        </div>
      </div>

      {/* Добавляем пагинацию */}
      {!loading && goods.length > 0 && (
        <div className="flex justify-between items-center mt-4 px-4">
          <div className={`text-sm ${isDarkMode ? 'text-gray-300' : 'text-gray-500'}`}>
            Показано {indexOfFirstItem + 1}-{Math.min(indexOfLastItem, goods.length)} из {goods.length}
          </div>
          <div className="flex space-x-2">
            {Array.from({ length: totalPages }, (_, i) => i + 1).map((number) => (
              <button
                key={number}
                onClick={() => handlePageChange(number)}
                className={`px-3 py-1 rounded-md ${
                  currentPage === number
                    ? isDarkMode
                      ? 'bg-blue-600 text-white'
                      : 'bg-blue-500 text-white'
                    : isDarkMode
                    ? 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                {number}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default GoodsList; 