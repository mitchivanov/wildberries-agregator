import { useState, useEffect, useMemo, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useApi } from '../hooks/useApi';
import { useTelegram } from '../hooks/useTelegram';
import GoodsItem from './GoodsItem';
import SearchBar from './SearchBar';
import toast from 'react-hot-toast';

const DEFAULT_PAGE_SIZE = 10;
const PAGE_SIZE_OPTIONS = [10, 20, 50, 100];

const GoodsList = () => {
  const { getGoods, searchGoods, deleteGoods, bulkHideGoods, bulkShowGoods } = useApi();
  const { isDarkMode, webApp } = useTelegram();
  const navigate = useNavigate();

  const [goods, setGoods] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [isSearching, setIsSearching] = useState(false);
  const [highlightedGoodsId, setHighlightedGoodsId] = useState(null);
  
  const [selectedGoods, setSelectedGoods] = useState(new Set());
  const [sortConfig, setSortConfig] = useState({ key: null, direction: 'asc' });

  // Заменяем переменные для бесконечной прокрутки на пагинацию
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);
  const [searchQuery, setSearchQuery] = useState("");

  // Рассчитываем общее количество страниц
  const totalPages = useMemo(() => {
    return Math.max(1, Math.ceil(total / pageSize));
  }, [total, pageSize]);

  // Модифицированная функция загрузки товаров
  const loadGoods = useCallback(async (page = 1, query = "", newPageSize = null) => {
    if (loading) return; // Предотвращаем множественные запросы
    
    const actualPageSize = newPageSize !== null ? newPageSize : pageSize;
    const skip = (page - 1) * actualPageSize;
    
    setLoading(true);
    
    try {
      console.log(`Загрузка товаров: page=${page}, skip=${skip}, limit=${actualPageSize}, query=${query}`);
      
      let data;
      if (query) {
        // Если есть поисковый запрос, используем searchGoods
        setIsSearching(true);
        data = await searchGoods(query, { skip, limit: actualPageSize });
      } else {
        // Иначе загружаем все товары
        setIsSearching(false);
        data = await getGoods({ skip, limit: actualPageSize });
      }
      
      if (data) {
        const items = Array.isArray(data.items) ? data.items : [];
        const reportedTotal = typeof data.total === 'number' ? data.total : 0;
        
        console.log(`Получено ${items.length} товаров из ${reportedTotal} всего`);
        
        // Устанавливаем товары для текущей страницы
        setGoods(items);
        
        // Устанавливаем общее количество товаров
        setTotal(Math.max(reportedTotal, items.length));
        
        // Очищаем выбранные товары при смене страницы
        setSelectedGoods(new Set());
      }
      
      const savedHighlightId = localStorage.getItem('highlightedGoodsId');
      if (savedHighlightId) {
        setHighlightedGoodsId(parseInt(savedHighlightId));
        localStorage.removeItem('highlightedGoodsId');

        setTimeout(() => {
          const element = document.getElementById(`goods-row-${savedHighlightId}`);
          if (element) {
            element.scrollIntoView({ behavior: 'smooth', block: 'center' });

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
  }, [pageSize, loading, getGoods, searchGoods]);

  // Инициальная загрузка
  useEffect(() => {
    loadGoods(1);
  }, []);

  // Эффект для кнопки в Telegram WebApp
  useEffect(() => {
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

  // Модифицированная функция поиска
  const handleSearch = async (query) => {
    setSearchQuery(query);
    setCurrentPage(1); // Сбрасываем на первую страницу при поиске
    
    loadGoods(1, query);
  };

  // Обработчик изменения страницы
  const handlePageChange = (page) => {
    setCurrentPage(page);
    loadGoods(page, searchQuery);
    
    // Скролл наверх при смене страницы
    window.scrollTo({
      top: 0,
      behavior: 'smooth'
    });
  };

  // При смене pageSize сбрасываем на первую страницу и загружаем товары заново
  const handlePageSizeChange = (e) => {
    const newSize = Number(e.target.value);
    setPageSize(newSize);
    setCurrentPage(1);
    
    // Загружаем с новым размером страницы
    loadGoods(1, searchQuery, newSize);
  };

  const handleDelete = async (id) => {
    try {
      await deleteGoods(id);
      setGoods(goods.filter(item => item.id !== id));
      toast.success('Товар удален');
      
      // Обновляем общее количество
      setTotal(prev => Math.max(0, prev - 1));
      
      // Если удалили последний товар на странице и это не первая страница,
      // переходим на предыдущую страницу
      if (goods.length === 1 && currentPage > 1) {
        handlePageChange(currentPage - 1);
      } else {
        // Иначе перезагружаем текущую страницу
        loadGoods(currentPage, searchQuery);
      }
    } catch (err) {
      toast.error(`Ошибка при удалении: ${err.message}`);
    }
  };

  const sortData = (data) => {
    if (!sortConfig.key) return data;

    return [...data].sort((a, b) => {
      let aValue = a[sortConfig.key];
      let bValue = b[sortConfig.key];

      if (sortConfig.key === 'category') {
        aValue = a.category?.name || '';
        bValue = b.category?.name || '';
      }

      if (sortConfig.key === 'id') {
        aValue = parseInt(aValue);
        bValue = parseInt(bValue);
      }

      if (sortConfig.key === 'price') {
        aValue = parseFloat(aValue);
        bValue = parseFloat(bValue);
      }

      if (aValue < bValue) return sortConfig.direction === 'asc' ? -1 : 1;
      if (aValue > bValue) return sortConfig.direction === 'asc' ? 1 : -1;
      return 0;
    });
  };

  const requestSort = (key) => {
    let direction = 'asc';
    if (sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
  };

  const sortedGoods = useMemo(() => sortData(goods), [goods, sortConfig]);

  const themeClasses = isDarkMode
    ? 'bg-gray-800 border-gray-700 text-white'
    : 'bg-white border-gray-200 text-gray-700';

  const handleSelectAll = (e) => {
    if (e.target.checked) {
      const allIds = goods.map(item => Number(item.id));
      setSelectedGoods(new Set(allIds));
    } else {
      setSelectedGoods(new Set());
    }
  };

  const handleSelectItem = (id) => {
    setSelectedGoods(prev => {
      const newSelected = new Set(prev);
      const numericId = Number(id);
      if (newSelected.has(numericId)) {
        newSelected.delete(numericId);
      } else {
        newSelected.add(numericId);
      }
      return newSelected;
    });
  };

  const handleBulkHide = async () => {
    if (selectedGoods.size === 0) {
      toast.error('Выберите товары для скрытия');
      return;
    }
    
    try {
      const goodsIdsArray = Array.from(selectedGoods).map(Number);
      console.log("Скрытие товаров:", goodsIdsArray);
      
      await bulkHideGoods(goodsIdsArray);
      await loadGoods(currentPage, searchQuery);
      toast.success('Товары успешно скрыты');
    } catch (err) {
      console.error("Ошибка при скрытии товаров:", err);
      toast.error(`Ошибка: ${err.message}`);
    }
  };

  const handleBulkShow = async () => {
    if (selectedGoods.size === 0) {
      toast.error('Выберите товары для показа');
      return;
    }
    
    try {
      const goodsIdsArray = Array.from(selectedGoods).map(Number);
      console.log("Показ товаров:", goodsIdsArray);
      
      await bulkShowGoods(goodsIdsArray);
      await loadGoods(currentPage, searchQuery);
      toast.success('Товары успешно показаны');
    } catch (err) {
      console.error("Ошибка при показе товаров:", err);
      toast.error(`Ошибка: ${err.message}`);
    }
  };

  // Компонент пагинации
  const Pagination = ({ currentPage, totalPages, onPageChange }) => {
    // Определяем, какие номера страниц показывать
    const getPageNumbers = () => {
      const pages = [];
      const maxVisiblePages = 5; // Максимальное количество видимых кнопок страниц
      
      // Если меньше или равно maxVisiblePages страниц, показываем все
      if (totalPages <= maxVisiblePages) {
        for (let i = 1; i <= totalPages; i++) {
          pages.push(i);
        }
        return pages;
      }
      
      // Всегда добавляем первую страницу
      pages.push(1);
      
      // Вычисляем начальную и конечную страницу для отображения
      let startPage = Math.max(2, currentPage - 1);
      let endPage = Math.min(totalPages - 1, currentPage + 1);
      
      // Корректируем, если мы близко к началу или концу
      if (currentPage <= 3) {
        endPage = Math.min(totalPages - 1, 4);
      } else if (currentPage >= totalPages - 2) {
        startPage = Math.max(2, totalPages - 3);
      }
      
      // Добавляем троеточие после первой страницы, если текущая страница далеко от начала
      if (startPage > 2) {
        pages.push('...');
      }
      
      // Добавляем промежуточные страницы
      for (let i = startPage; i <= endPage; i++) {
        pages.push(i);
      }
      
      // Добавляем троеточие перед последней страницей, если текущая страница далеко от конца
      if (endPage < totalPages - 1) {
        pages.push('...');
      }
      
      // Всегда добавляем последнюю страницу, если totalPages > 1
      if (totalPages > 1) {
        pages.push(totalPages);
      }
      
      return pages;
    };
    
    const pageNumbers = getPageNumbers();
    
    return (
      <div className={`flex justify-center items-center mt-4 space-x-1 ${
        isDarkMode ? 'text-gray-200' : 'text-gray-700'
      }`}>
        {/* Кнопка "Предыдущая" */}
        <button
          onClick={() => onPageChange(Math.max(1, currentPage - 1))}
          disabled={currentPage === 1}
          className={`px-3 py-1 rounded ${
            currentPage === 1
              ? isDarkMode ? 'bg-gray-700 text-gray-500' : 'bg-gray-200 text-gray-400'
              : isDarkMode ? 'bg-gray-700 hover:bg-gray-600' : 'bg-gray-200 hover:bg-gray-300'
          }`}
        >
          &laquo;
        </button>
        
        {/* Номера страниц */}
        {pageNumbers.map((page, index) => (
          page === '...' ? (
            <span key={`ellipsis-${index}`} className="px-3 py-1">...</span>
          ) : (
            <button
              key={`page-${page}`}
              onClick={() => onPageChange(page)}
              className={`px-3 py-1 rounded ${
                currentPage === page
                  ? isDarkMode ? 'bg-blue-600 text-white' : 'bg-blue-500 text-white'
                  : isDarkMode ? 'bg-gray-700 hover:bg-gray-600' : 'bg-gray-200 hover:bg-gray-300'
              }`}
            >
              {page}
            </button>
          )
        ))}
        
        {/* Кнопка "Следующая" */}
        <button
          onClick={() => onPageChange(Math.min(totalPages, currentPage + 1))}
          disabled={currentPage === totalPages || totalPages === 0}
          className={`px-3 py-1 rounded ${
            currentPage === totalPages || totalPages === 0
              ? isDarkMode ? 'bg-gray-700 text-gray-500' : 'bg-gray-200 text-gray-400'
              : isDarkMode ? 'bg-gray-700 hover:bg-gray-600' : 'bg-gray-200 hover:bg-gray-300'
          }`}
        >
          &raquo;
        </button>
      </div>
    );
  };

  return (
    <div className="px-1 sm:px-2 lg:px-4 max-w-full">
      <div className="flex flex-col sm:flex-row justify-between items-center mb-4 space-y-2 sm:space-y-0">
        <SearchBar onSearch={handleSearch} />
        <div className="flex items-center space-x-4">
          <select
            value={pageSize}
            onChange={handlePageSizeChange}
            className={`rounded-md border ${
              isDarkMode 
                ? 'bg-gray-700 border-gray-600 text-white' 
                : 'bg-white border-gray-300 text-gray-900'
            } px-3 py-1`}
          >
            {PAGE_SIZE_OPTIONS.map(opt => (
              <option key={opt} value={opt}>{opt} на странице</option>
            ))}
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

      {/* Информация о результатах поиска и текущей странице */}
      <div className={`mb-3 text-sm ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
        {isSearching ? (
          <p>Поиск: "{searchQuery}" - найдено {total} товаров</p>
        ) : (
          <p>Всего товаров: {total}, страница {currentPage} из {totalPages}</p>
        )}
      </div>

      {selectedGoods.size > 0 && (
        <div className={`mb-4 p-2 rounded-lg flex items-center justify-between ${
          isDarkMode ? 'bg-gray-700' : 'bg-gray-100'
        }`}>
          <span>Выбрано товаров: {selectedGoods.size}</span>
          <div className="space-x-2">
            <button
              onClick={handleBulkHide}
              className="btn btn-warning"
            >
              Скрыть выбранные
            </button>
            <button
              onClick={handleBulkShow}
              className="btn btn-success"
            >
              Показать выбранные
            </button>
          </div>
        </div>
      )}

      {/* Модифицированный контейнер таблицы */}
      <div className="w-full overflow-x-auto rounded-lg">
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
                onClick={() => {
                  setSearchQuery("");
                  setCurrentPage(1);
                  loadGoods(1, "");
                }}
                className="mt-2 btn btn-secondary"
              >
                Вернуться к полному списку
              </button>
            )}
          </div>
        ) : !Array.isArray(goods) || goods.length === 0 ? (
          <div className={`text-center py-10 rounded-lg shadow ${themeClasses}`}>
            <p>
              {isSearching
                ? 'По вашему запросу ничего не найдено'
                : 'Список товаров пуст'}
            </p>
            {isSearching && (
              <button
                onClick={() => {
                  setSearchQuery("");
                  setCurrentPage(1);
                  loadGoods(1, "");
                }}
                className="mt-2 btn btn-secondary"
              >
                Вернуться к полному списку
              </button>
            )}
          </div>
        ) : (
          // Оптимизированная таблица
          <div className={`shadow border ${isDarkMode ? 'border-gray-700' : 'border-gray-200'} rounded-lg overflow-hidden`}>
            <table className="w-full table-fixed divide-y divide-gray-200">
              <thead className={`${isDarkMode ? 'bg-gray-700' : 'bg-gray-50'}`}>
                <tr>
                  {/* Оптимизированные ширины колонок */}
                  <th scope="col" className="w-12 px-2 py-3 text-center">
                    <input
                      type="checkbox"
                      onChange={handleSelectAll}
                      checked={selectedGoods.size === goods.length}
                      className="rounded border-gray-300"
                    />
                  </th>
                  <th scope="col" className="w-20 px-2 py-3">Фото</th>
                  <th scope="col" className="w-14 px-2 py-3" onClick={() => requestSort("id")}>
                    <div className="flex items-center justify-center">
                      <span>ID</span>
                      {sortConfig.key === "id" && (
                        <span className="ml-1">{sortConfig.direction === 'asc' ? '↑' : '↓'}</span>
                      )}
                    </div>
                  </th>
                  <th scope="col" className="w-1/4 px-2 py-3" onClick={() => requestSort("name")}>
                    <div className="flex items-center">
                      <span>Название</span>
                      {sortConfig.key === "name" && (
                        <span className="ml-1">{sortConfig.direction === 'asc' ? '↑' : '↓'}</span>
                      )}
                    </div>
                  </th>
                  <th scope="col" className="w-24 px-2 py-3" onClick={() => requestSort("category")}>
                    <div className="flex items-center">
                      <span>Категория</span>
                      {sortConfig.key === "category" && (
                        <span className="ml-1">{sortConfig.direction === 'asc' ? '↑' : '↓'}</span>
                      )}
                    </div>
                  </th>
                  <th scope="col" className="w-24 px-2 py-3" onClick={() => requestSort("article")}>
                    <div className="flex items-center">
                      <span>Артикул</span>
                      {sortConfig.key === "article" && (
                        <span className="ml-1">{sortConfig.direction === 'asc' ? '↑' : '↓'}</span>
                      )}
                    </div>
                  </th>
                  <th scope="col" className="w-20 px-2 py-3" onClick={() => requestSort("price")}>
                    <div className="flex items-center">
                      <span>Цена</span>
                      {sortConfig.key === "price" && (
                        <span className="ml-1">{sortConfig.direction === 'asc' ? '↑' : '↓'}</span>
                      )}
                    </div>
                  </th>
                  <th scope="col" className="w-20 px-2 py-3 text-center" onClick={() => requestSort("cashback_percent")}>
                    <div className="flex items-center justify-center">
                      <span>Кешбэк</span>
                      {sortConfig.key === "cashback_percent" && (
                        <span className="ml-1">{sortConfig.direction === 'asc' ? '↑' : '↓'}</span>
                      )}
                    </div>
                  </th>
                  <th scope="col" className="w-16 px-2 py-3 text-center" onClick={() => requestSort("is_active")}>
                    <div className="flex items-center justify-center">
                      <span>Статус</span>
                      {sortConfig.key === "is_active" && (
                        <span className="ml-1">{sortConfig.direction === 'asc' ? '↑' : '↓'}</span>
                      )}
                    </div>
                  </th>
                  <th scope="col" className="w-20 px-2 py-3 text-center" onClick={() => requestSort("is_hidden")}>
                    <div className="flex items-center justify-center">
                      <span>Видим</span>
                      {sortConfig.key === "is_hidden" && (
                        <span className="ml-1">{sortConfig.direction === 'asc' ? '↑' : '↓'}</span>
                      )}
                    </div>
                  </th>
                  <th scope="col" className="w-24 px-2 py-3 text-center">Действия</th>
                </tr>
              </thead>
              <tbody className={`divide-y ${isDarkMode ? 'divide-gray-700 bg-gray-800' : 'divide-gray-200 bg-white'}`}>
                {sortedGoods.map((item) => (
                  <tr 
                    key={item.id} 
                    className={`
                      ${isDarkMode 
                        ? item.is_hidden ? 'bg-gray-900 hover:bg-gray-800' : 'hover:bg-gray-700' 
                        : item.is_hidden ? 'bg-gray-100 hover:bg-gray-200' : 'hover:bg-gray-50'}
                      ${highlightedGoodsId === parseInt(item.id) ? 'border-l-4 border-blue-500' : ''}
                    `}
                    id={`goods-row-${item.id}`}
                  >
                    <td className="px-2 py-2 text-center">
                      <input
                        type="checkbox"
                        checked={selectedGoods.has(parseInt(item.id))}
                        onChange={() => handleSelectItem(parseInt(item.id))}
                        className="rounded border-gray-300"
                      />
                    </td>
                    <td className="px-2 py-2 text-center">
                      <div className="flex items-center justify-center h-12 w-12 mx-auto overflow-hidden rounded">
                        <img 
                          src={item.image} 
                          alt={item.name}
                          className="h-full w-full object-cover"
                          onError={(e) => {
                            e.target.onerror = null;
                            e.target.src = "https://via.placeholder.com/80?text=Нет+фото";
                          }}
                        />
                      </div>
                    </td>
                    <td className={`px-2 py-2 text-center text-sm ${isDarkMode ? 'text-gray-300' : 'text-gray-500'}`}>
                      {item.id}
                    </td>
                    <td className={`px-2 py-2 text-sm font-medium truncate ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                      <div className="truncate" title={item.name}>
                        {item.name}
                      </div>
                    </td>
                    <td className={`px-2 py-2 text-sm truncate ${isDarkMode ? 'text-gray-300' : 'text-gray-500'}`}>
                      {item.category ? (
                        <span className={`px-1 py-0.5 text-xs rounded truncate inline-block max-w-full ${
                          isDarkMode ? 'bg-gray-700 text-gray-200' : 'bg-gray-200 text-gray-800'
                        }`} title={item.category.name}>
                          {item.category.name}
                        </span>
                      ) : (
                        <span className={`text-xs ${isDarkMode ? 'text-gray-500' : 'text-gray-400'}`}>
                          Нет
                        </span>
                      )}
                    </td>
                    <td className={`px-2 py-2 text-sm truncate ${isDarkMode ? 'text-gray-300' : 'text-gray-500'}`}>
                      <div className="truncate" title={item.article}>
                        {item.article}
                      </div>
                    </td>
                    <td className={`px-2 py-2 text-right text-sm ${isDarkMode ? 'text-gray-300' : 'text-gray-500'}`}>
                      {item.price} ₽
                    </td>
                    <td className={`px-2 py-2 text-center text-sm ${isDarkMode ? 'text-gray-300' : 'text-gray-500'}`}>
                      {item.cashback_percent}%
                    </td>
                    <td className={`px-2 py-2 text-center text-sm`}>
                      <span className={`inline-block px-1.5 py-0.5 text-xs rounded ${
                        item.is_active
                          ? isDarkMode ? 'bg-green-800 text-green-100' : 'bg-green-100 text-green-800'
                          : isDarkMode ? 'bg-red-800 text-red-100' : 'bg-red-100 text-red-800'
                      }`}>
                        {item.is_active ? 'Да' : 'Нет'}
                      </span>
                    </td>
                    <td className={`px-2 py-2 text-center text-sm ${isDarkMode ? 'text-gray-300' : 'text-gray-500'}`}>
                      {item.is_hidden ? (
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-red-500 mx-auto" viewBox="0 0 20 20" fill="currentColor">
                          <path fillRule="evenodd" d="M3.707 2.293a1 1 0 00-1.414 1.414l14 14a1 1 0 001.414-1.414l-1.473-1.473A10.014 10.014 0 0019.542 10C18.268 5.943 14.478 3 10 3a9.958 9.958 0 00-4.512 1.074l-1.78-1.781zm4.261 4.26l1.514 1.515a2.003 2.003 0 012.45 2.45l1.514 1.514a4 4 0 00-5.478-5.478z" clipRule="evenodd" />
                          <path d="M12.454 16.697L9.75 13.992a4 4 0 01-3.742-3.741L2.335 6.578A9.98 9.98 0 00.458 10c1.274 4.057 5.065 7 9.542 7 .847 0 1.669-.105 2.454-.303z" />
                        </svg>
                      ) : (
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-green-500 mx-auto" viewBox="0 0 20 20" fill="currentColor">
                          <path d="M10 12a2 2 0 100-4 2 2 0 000 4z" />
                          <path fillRule="evenodd" d="M.458 10C1.732 5.943 5.522 3 10 3s8.268 2.943 9.542 7c-1.274 4.057-5.064 7-9.542 7S1.732 14.057.458 10zM14 10a4 4 0 11-8 0 4 4 0 018 0z" clipRule="evenodd" />
                        </svg>
                      )}
                    </td>
                    <td className="px-2 py-2 text-center text-sm">
                      <div className="flex justify-center space-x-2">
                        <Link
                          to={`/admin/goods/edit/${item.id}`}
                          className={`${isDarkMode ? 'text-blue-400 hover:text-blue-300' : 'text-blue-600 hover:text-blue-900'}`}
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                            <path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z" />
                          </svg>
                        </Link>
                        <button
                          onClick={() => handleDelete(item.id)}
                          className={`${isDarkMode ? 'text-red-400 hover:text-red-300' : 'text-red-600 hover:text-red-900'}`}
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                            <path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
                          </svg>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Компонент пагинации вместо бесконечной прокрутки */}
      {!loading && goods.length > 0 && totalPages > 1 && (
        <Pagination 
          currentPage={currentPage}
          totalPages={totalPages}
          onPageChange={handlePageChange}
        />
      )}
    </div>
  );
};

export default GoodsList; 