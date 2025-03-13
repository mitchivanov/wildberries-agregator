import { useState, useEffect, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useApi } from '../hooks/useApi';
import { useTelegram } from '../hooks/useTelegram';
import GoodsItem from './GoodsItem';
import SearchBar from './SearchBar';
import toast from 'react-hot-toast';

const GoodsList = () => {
  const { getGoods, searchGoods, deleteGoods, bulkToggleGoodsVisibility } = useApi();
  const { isDarkMode, webApp } = useTelegram();
  const navigate = useNavigate();

  const [goods, setGoods] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [isSearching, setIsSearching] = useState(false);
  const [highlightedGoodsId, setHighlightedGoodsId] = useState(null);
  
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);

  const [selectedGoods, setSelectedGoods] = useState(new Set());
  const [sortConfig, setSortConfig] = useState({ key: null, direction: 'asc' });

  const loadGoods = async () => {
    setLoading(true);
    setIsSearching(false);
    try {
      const data = await getGoods();
      if (data) setGoods(data);

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
  };

  useEffect(() => {
    loadGoods();

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

  const handleDelete = async (id) => {
    try {
      await deleteGoods(id);
      setGoods(goods.filter(item => item.id !== id));
      toast.success('Товар удален');
    } catch (err) {
      toast.error(`Ошибка при удалении: ${err.message}`);
    }
  };

  const indexOfLastItem = currentPage * itemsPerPage;
  const indexOfFirstItem = indexOfLastItem - itemsPerPage;
  const currentItems = goods.slice(indexOfFirstItem, indexOfLastItem);
  const totalPages = Math.ceil(goods.length / itemsPerPage);

  const handlePageChange = (pageNumber) => {
    setCurrentPage(pageNumber);
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

  const sortedGoods = useMemo(() => sortData(currentItems), [currentItems, sortConfig]);

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

  const handleBulkVisibility = async (isHidden) => {
    if (selectedGoods.size === 0) {
      toast.error(`Выберите товары для ${isHidden ? 'скрытия' : 'показа'}`);
      return;
    }
    
    try {
      const goodsIdsArray = Array.from(selectedGoods);
      console.log("IDs для отправки:", goodsIdsArray);
      
      await bulkToggleGoodsVisibility(goodsIdsArray, isHidden);
      
      toast.success(`Товары успешно ${isHidden ? 'скрыты' : 'показаны'}`);
      setSelectedGoods(new Set());
      await loadGoods();
    } catch (err) {
      console.error("Ошибка при изменении видимости:", err);
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
    const newSelected = new Set(selectedGoods);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedGoods(newSelected);
  };

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

      {selectedGoods.size > 0 && (
        <div className={`mb-4 p-2 rounded-lg flex items-center justify-between ${
          isDarkMode ? 'bg-gray-700' : 'bg-gray-100'
        }`}>
          <span>Выбрано товаров: {selectedGoods.size}</span>
          <div className="space-x-2">
            <button
              onClick={() => handleBulkVisibility(true)}
              className="btn btn-warning"
            >
              Скрыть выбранные
            </button>
            <button
              onClick={() => handleBulkVisibility(false)}
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
                          <tr key={item.id} className={isDarkMode ? 'hover:bg-gray-700' : 'hover:bg-gray-50'}>
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
                            <td className="px-6 py-4 whitespace-nowrap text-sm">
                              <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                                item.is_hidden 
                                  ? isDarkMode ? 'bg-red-800 text-red-100' : 'bg-red-100 text-red-800'
                                  : isDarkMode ? 'bg-green-800 text-green-100' : 'bg-green-100 text-green-800'
                              }`}>
                                {item.is_hidden ? 'Скрыт' : 'Виден'}
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