import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useApi } from '../hooks/useApi';
import { useTelegram } from '../hooks/useTelegram';
import GoodsItem from './GoodsItem';
import SearchBar from './SearchBar';
import toast from 'react-hot-toast';

const DEFAULT_PAGE_SIZE = 100;
const PAGE_SIZE_OPTIONS = [10, 50, 100, 200, 500];

const GoodsList = () => {
  const { getGoods, searchGoods, deleteGoods, bulkHideGoods, bulkShowGoods } = useApi();
  const { isDarkMode, webApp } = useTelegram();
  const navigate = useNavigate();

  const [goods, setGoods] = useState([]);
  const [total, setTotal] = useState(0);
  const [skip, setSkip] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [isSearching, setIsSearching] = useState(false);
  const [highlightedGoodsId, setHighlightedGoodsId] = useState(null);
  
  const [selectedGoods, setSelectedGoods] = useState(new Set());
  const [sortConfig, setSortConfig] = useState({ key: null, direction: 'asc' });

  const loaderRef = useRef(null);
  const [hasMore, setHasMore] = useState(true);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);

  const loadGoods = useCallback(async (reset = false, customPageSize = null) => {
    if (loading) return; // Предотвращаем множественные запросы
    
    setLoading(true);
    setIsSearching(false);
    try {
      const limit = customPageSize !== null ? customPageSize : pageSize;
      const skipValue = reset ? 0 : skip;
      
      console.log(`Загрузка товаров: reset=${reset}, skipValue=${skipValue}, limit=${limit}`);
      
      const data = await getGoods({ skip: skipValue, limit });
      if (data) {
        const items = Array.isArray(data.items) ? data.items : [];
        // Получаем значение total с сервера, но добавляем проверку корректности
        const reportedTotal = typeof data.total === 'number' ? data.total : 0;
        
        console.log(`Получено ${items.length} товаров из ${reportedTotal} всего`);
        
        // Логика обработки ответа от сервера
        if (reset) {
          setGoods(items);
        } else {
          setGoods(prev => {
            // Проверяем, что не добавляем дубликаты
            const newIds = new Set(items.map(item => item.id));
            const prevFiltered = prev.filter(item => !newIds.has(item.id));
            return [...prevFiltered, ...items];
          });
        }
        
        // Обновляем skip для следующего запроса
        setSkip(reset ? items.length : skipValue + items.length);
        
        // Исправляем логику для total и hasMore
        // Если сервер возвращает total = 1, но при этом items.length = limit,
        // значит, скорее всего, есть еще товары для загрузки
        const correctedTotal = reportedTotal < items.length ? items.length * 2 : reportedTotal;
        const actualTotal = Math.max(correctedTotal, (reset ? 0 : skipValue) + items.length);
        
        // Обновляем общее количество товаров с учетом корректировки
        setTotal(actualTotal);
        
        // Проверяем, есть ли еще товары для загрузки:
        // 1. Если получили полную страницу (items.length === limit), скорее всего есть еще товары
        // 2. Иначе используем исправленное total для проверки
        const moreItemsExist = items.length === limit || (skipValue + items.length) < actualTotal;
        setHasMore(items.length > 0 && moreItemsExist);
        
        console.log(`hasMore установлен в ${items.length > 0 && moreItemsExist}, т.к. items.length=${items.length}, limit=${limit}, actualTotal=${actualTotal}`);
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
  }, [getGoods, skip, pageSize, loading]);

  useEffect(() => {
    loadGoods(true);

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

  // Infinite scroll observer
  useEffect(() => {
    // Создаем IntersectionObserver только если есть товары для загрузки и элемент наблюдения существует
    if (!hasMore || !loaderRef.current) return;

    // Создаем функцию обработчика пересечения
    const handleObserver = (entries) => {
      const [entry] = entries;
      // Загружаем новые данные только если:
      // 1. Элемент видим (пересекает viewport)
      // 2. Не идет загрузка в данный момент
      // 3. Есть еще товары для загрузки
      if (entry.isIntersecting && !loading && hasMore) {
        console.log('Loader element intersecting viewport, loading more goods');
        loadGoods(false);
      }
    };

    // Создаем observer с более низким порогом для раннего обнаружения
    const observer = new IntersectionObserver(handleObserver, {
      // Уменьшаем порог до 0.1 (10% видимости элемента достаточно для срабатывания)
      threshold: 0.1,
      // Добавляем margin для раннего срабатывания до появления на экране
      rootMargin: '100px'
    });

    observer.observe(loaderRef.current);
    
    console.log('IntersectionObserver attached with hasMore =', hasMore, 'loading =', loading);

    // Очистка наблюдателя при размонтировании или изменении зависимостей
    return () => {
      if (loaderRef.current) {
        observer.unobserve(loaderRef.current);
      }
      observer.disconnect();
    };
  }, [hasMore, loading, loadGoods]);

  const handleSearch = async (query) => {
    if (!query.trim()) {
      setSkip(0);
      setGoods([]);
      setTotal(0);
      setHasMore(true);
      return loadGoods(true);
    }
    setLoading(true);
    setIsSearching(true);
    setSkip(0);
    setGoods([]);
    setTotal(0);
    setHasMore(true);
    try {
      const data = await searchGoods(query, { skip: 0, limit: pageSize });
      if (data) {
        const items = Array.isArray(data.items) ? data.items : [];
        setGoods(items);
        setTotal(typeof data.total === 'number' ? data.total : 0);
        setSkip(items.length);
        setHasMore(items.length < (typeof data.total === 'number' ? data.total : 0));
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id) => {
    try {
      await deleteGoods(id);
      setGoods(goods.filter(item => item.id !== id));
      toast.success('Товар удален');
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

  const SortableHeader = ({ column, label }) => {
    return (
      <th 
        scope="col" 
        className={`px-6 py-3 text-left text-xs font-medium uppercase tracking-wider cursor-pointer
          ${isDarkMode ? 'text-gray-300 hover:text-white' : 'text-gray-500 hover:text-gray-700'}`}
        onClick={() => requestSort(column)}
      >
        <div className="flex items-center space-x-1">
          <span>{label}</span>
          {sortConfig.key === column && (
            <span>{sortConfig.direction === 'asc' ? '↑' : '↓'}</span>
          )}
        </div>
      </th>
    );
  };

  const sortedGoods = useMemo(() => sortData(goods), [goods, sortConfig]);

  const themeClasses = isDarkMode
    ? 'bg-gray-800 border-gray-700 text-white'
    : 'bg-white border-gray-200 text-gray-700';

  const toggleSelectGoods = (id) => {
    setSelectedGoods(prev => {
      const newSelected = new Set(prev);
      if (newSelected.has(id)) {
        newSelected.delete(id);
      } else {
        newSelected.add(id);
      }
      return newSelected;
    });
  };

  const toggleSelectAll = () => {
    if (selectedGoods.size === sortedGoods.length) {
      setSelectedGoods(new Set());
    } else {
      setSelectedGoods(new Set(sortedGoods.map(item => parseInt(item.id))));
    }
  };

  const handleBulkHide = async () => {
    if (selectedGoods.size === 0) {
      toast.error('Выберите товары для скрытия');
      return;
    }
    
    try {
      const goodsIdsArray = Array.from(selectedGoods).map(Number);
      console.log("Скрытие товаров:", goodsIdsArray);
      console.log("Типы ID:", goodsIdsArray.map(id => typeof id));
      
      await bulkHideGoods(goodsIdsArray);
      await loadGoods(true);
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
      console.log("Типы ID:", goodsIdsArray.map(id => typeof id));
      
      await bulkShowGoods(goodsIdsArray);
      await loadGoods(true);
    } catch (err) {
      console.error("Ошибка при показе товаров:", err);
      toast.error(`Ошибка: ${err.message}`);
    }
  };

  const tableHeaderClass = `px-6 py-3 text-left text-xs font-medium uppercase tracking-wider ${
    isDarkMode ? 'text-gray-300' : 'text-gray-500'
  }`;

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

  // При смене pageSize сбрасываем пагинацию и подгружаем новые данные
  const handlePageSizeChange = (e) => {
    const newSize = Number(e.target.value);
    setPageSize(newSize);
    setSkip(0);
    setTotal(0);
    setGoods([]);
    loadGoods(true, newSize);
  };

  return (
    <div className="px-1 sm:px-2 lg:px-4">
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
          ) : !Array.isArray(goods) || goods.length === 0 ? (
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
            <div className="flex flex-col">
              <div className="-my-2 overflow-x-auto sm:-mx-6 lg:-mx-8">
                <div className="py-2 align-middle inline-block min-w-full sm:px-6 lg:px-8">
                  <div className={`shadow overflow-hidden border-b ${isDarkMode ? 'border-gray-700' : 'border-gray-200'} sm:rounded-lg`}>
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead className={`${isDarkMode ? 'bg-gray-700' : 'bg-gray-50'}`}>
                        <tr>
                          <th scope="col" className="relative px-6 py-3">
                            <input
                              type="checkbox"
                              onChange={handleSelectAll}
                              checked={selectedGoods.size === goods.length}
                              className="rounded border-gray-300"
                            />
                          </th>
                          <th scope="col" className="px-6 py-3">Изображение</th>
                          <SortableHeader column="id" label="ID" />
                          <SortableHeader column="name" label="Название" />
                          <SortableHeader column="category" label="Категория" />
                          <SortableHeader column="article" label="Артикул" />
                          <SortableHeader column="price" label="Цена" />
                          <SortableHeader column="cashback_percent" label="Кешбэк %" />
                          <SortableHeader column="min_daily" label="Мин. в день" />
                          <SortableHeader column="max_daily" label="Макс. в день" />
                          <SortableHeader column="is_active" label="Статус" />
                          <SortableHeader column="is_hidden" label="Видимость" />
                          <th scope="col" className="px-6 py-3">Действия</th>
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
                            <td className={`px-6 py-4 whitespace-nowrap text-sm ${isDarkMode ? 'text-gray-300' : 'text-gray-500'}`}>
                              <input
                                type="checkbox"
                                checked={selectedGoods.has(parseInt(item.id))}
                                onChange={() => handleSelectItem(parseInt(item.id))}
                                className="rounded border-gray-300"
                              />
                            </td>
                            <td className={`px-6 py-4 whitespace-nowrap`}>
                              <div className="flex items-center justify-center h-16 w-16 overflow-hidden rounded">
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
                            <td className={`px-6 py-4 whitespace-nowrap text-sm ${isDarkMode ? 'text-gray-300' : 'text-gray-500'}`}>
                              {item.id}
                            </td>
                            <td className={`px-6 py-4 whitespace-nowrap text-sm font-medium ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                              {item.name}
                            </td>
                            <td className={`px-6 py-4 whitespace-nowrap text-sm ${isDarkMode ? 'text-gray-300' : 'text-gray-500'}`}>
                              {item.category ? (
                                <span className={`px-2 py-1 text-xs rounded ${
                                  isDarkMode ? 'bg-gray-700 text-gray-200' : 'bg-gray-200 text-gray-800'
                                }`}>
                                  {item.category.name}
                                </span>
                              ) : (
                                <span className={`text-xs ${isDarkMode ? 'text-gray-500' : 'text-gray-400'}`}>
                                  Без категории
                                </span>
                              )}
                            </td>
                            <td className={`px-6 py-4 whitespace-nowrap text-sm ${isDarkMode ? 'text-gray-300' : 'text-gray-500'}`}>
                              {item.article}
                            </td>
                            <td className={`px-6 py-4 whitespace-nowrap text-sm ${isDarkMode ? 'text-gray-300' : 'text-gray-500'}`}>
                              {item.price} ₽
                            </td>
                            <td className={`px-6 py-4 whitespace-nowrap text-sm ${isDarkMode ? 'text-gray-300' : 'text-gray-500'}`}>
                              {item.cashback_percent}%
                            </td>
                            <td className={`px-6 py-4 whitespace-nowrap text-sm ${isDarkMode ? 'text-gray-300' : 'text-gray-500'}`}>
                              {item.min_daily}
                            </td>
                            <td className={`px-6 py-4 whitespace-nowrap text-sm ${isDarkMode ? 'text-gray-300' : 'text-gray-500'}`}>
                              {item.max_daily}
                            </td>
                            <td className={`px-6 py-4 whitespace-nowrap text-sm`}>
                              <span className={`px-2 py-1 text-xs rounded ${
                                item.is_active
                                  ? isDarkMode ? 'bg-green-800 text-green-100' : 'bg-green-100 text-green-800'
                                  : isDarkMode ? 'bg-red-800 text-red-100' : 'bg-red-100 text-red-800'
                              }`}>
                                {item.is_active ? 'Активен' : 'Неактивен'}
                              </span>
                            </td>
                            <td className={`px-6 py-4 whitespace-nowrap text-sm ${isDarkMode ? 'text-gray-300' : 'text-gray-500'}`}>
                              <span className="flex items-center">
                                {item.is_hidden ? (
                                  <span className="inline-flex items-center">
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-red-500 mr-1" viewBox="0 0 20 20" fill="currentColor">
                                      <path fillRule="evenodd" d="M3.707 2.293a1 1 0 00-1.414 1.414l14 14a1 1 0 001.414-1.414l-1.473-1.473A10.014 10.014 0 0019.542 10C18.268 5.943 14.478 3 10 3a9.958 9.958 0 00-4.512 1.074l-1.78-1.781zm4.261 4.26l1.514 1.515a2.003 2.003 0 012.45 2.45l1.514 1.514a4 4 0 00-5.478-5.478z" clipRule="evenodd" />
                                      <path d="M12.454 16.697L9.75 13.992a4 4 0 01-3.742-3.741L2.335 6.578A9.98 9.98 0 00.458 10c1.274 4.057 5.065 7 9.542 7 .847 0 1.669-.105 2.454-.303z" />
                                    </svg>
                                    <span className="text-red-500">Скрыт</span>
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center">
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-green-500 mr-1" viewBox="0 0 20 20" fill="currentColor">
                                      <path d="M10 12a2 2 0 100-4 2 2 0 000 4z" />
                                      <path fillRule="evenodd" d="M.458 10C1.732 5.943 5.522 3 10 3s8.268 2.943 9.542 7c-1.274 4.057-5.064 7-9.542 7S1.732 14.057.458 10zM14 10a4 4 0 11-8 0 4 4 0 018 0z" clipRule="evenodd" />
                                    </svg>
                                    <span className="text-green-500">Виден</span>
                                  </span>
                                )}
                              </span>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                              <div className="flex justify-end space-x-3">
                                <Link
                                  to={`/admin/goods/edit/${item.id}`}
                                  className={isDarkMode ? 'text-blue-400 hover:text-blue-300' : 'text-blue-600 hover:text-blue-900'}
                                >
                                  Изменить
                                </Link>
                                <button
                                  onClick={() => handleDelete(item.id)}
                                  className={isDarkMode ? 'text-red-400 hover:text-red-300' : 'text-red-600 hover:text-red-900'}
                                >
                                  Удалить
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Infinite scroll loader */}
      <div 
        ref={loaderRef} 
        style={{ height: '50px', margin: '20px 0' }}
        className={isDarkMode ? 'text-gray-300' : 'text-gray-500'} 
      >
        {loading && hasMore && (
          <div className="text-center">
            <svg className="animate-spin h-6 w-6 mx-auto mb-2" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            <span>Загрузка...</span>
          </div>
        )}
      </div>
      {!hasMore && !loading && goods.length > 0 && (
        <div className="text-center text-sm text-gray-400 mt-4">Все товары загружены</div>
      )}
    </div>
  );
};

export default GoodsList; 