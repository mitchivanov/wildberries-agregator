import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useApi } from '../hooks/useApi';
import { useTelegram } from '../hooks/useTelegram';
import Layout from '../components/Layout';
import toast from 'react-hot-toast';
import GoodsAvailability from '../components/GoodsAvailability';

const EditGoods = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { getGoodsById, updateGoods, getCategories, parseWildberriesUrl, regenerateAvailability } = useApi();
  const { isDarkMode } = useTelegram();
  
  const [goods, setGoods] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showAvailability, setShowAvailability] = useState(false);
  const [categories, setCategories] = useState([]);
  const [parsing, setParsing] = useState(false);
  const [regenerating, setRegenerating] = useState(false);
  
  // Состояние формы
  const [form, setForm] = useState({
    name: '',
    article: '',
    url: '',
    price: 0,
    cashback_percent: 0,
    purchase_guide: '',
    image: '',
    start_date: '',
    end_date: '',
    min_daily: 1,
    max_daily: 10,
    is_active: true,
    category_id: ''
  });
  
  // Загрузка товара при монтировании компонента
  useEffect(() => {
    const fetchGoods = async () => {
      try {
        const data = await getGoodsById(id);
        setGoods(data);
        setForm({
          ...data,
          start_date: data.start_date ? formatDateForInput(data.start_date) : '',
          end_date: data.end_date ? formatDateForInput(data.end_date) : '',
          category_id: data.category?.id || ''
        });
      } catch (err) {
        setError(err.message);
        toast.error(`Ошибка при загрузке товара: ${err.message}`);
      } finally {
        setLoading(false);
      }
    };
    
    fetchGoods();
  }, [id, getGoodsById]);
  
  useEffect(() => {
    // Загрузка категорий при монтировании компонента
    const loadCategories = async () => {
      try {
        const data = await getCategories();
        if (data) setCategories(data.filter(cat => cat.is_active));
      } catch (err) {
        console.error('Ошибка при загрузке категорий:', err);
        toast.error('Не удалось загрузить категории');
      }
    };
    
    loadCategories();
  }, [getCategories]);
  
  // Форматирование даты из ISO в формат для input date
  const formatDateForInput = (isoDate) => {
    if (!isoDate) return '';
    const date = new Date(isoDate);
    return date.toISOString().split('T')[0];
  };
  
  // Обработка изменений в форме
  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    
    let fieldValue;
    
    // Для числовых полей преобразуем в число
    if (name === 'price' || name === 'cashback_percent' || name === 'min_daily' || name === 'max_daily') {
      fieldValue = value === '' ? '' : Number(value);
    } else if (type === 'checkbox') {
      fieldValue = checked;
    } else {
      fieldValue = value;
    }
    
    setForm(prev => ({
      ...prev,
      [name]: fieldValue
    }));
  };
  
  // Валидация формы
  const validateForm = () => {
    let isValid = true;
    
    if (!form.name.trim()) {
      toast.error('Название товара обязательно');
      isValid = false;
    }
    
    if (!form.price || form.price <= 0) {
      toast.error('Цена должна быть больше нуля');
      isValid = false;
    }
    
    if (form.cashback_percent < 0 || form.cashback_percent > 100) {
      toast.error('Процент кэшбэка должен быть от 0 до 100');
      isValid = false;
    }
    
    if (!form.article.trim()) {
      toast.error('Артикул обязателен');
      isValid = false;
    }
    
    if (!form.url.trim()) {
      toast.error('URL обязателен');
      isValid = false;
    }
    
    if (!form.image.trim()) {
      toast.error('URL изображения обязателен');
      isValid = false;
    }
    
    if (form.start_date && form.end_date && new Date(form.start_date) > new Date(form.end_date)) {
      toast.error('Дата окончания должна быть позже даты начала');
      isValid = false;
    }
    
    if (form.min_daily <= 0) {
      toast.error('Минимальное количество в день должно быть больше нуля');
      isValid = false;
    }
    
    if (form.max_daily < form.min_daily) {
      toast.error('Максимальное количество должно быть больше или равно минимальному');
      isValid = false;
    }
    
    return isValid;
  };
  
  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!validateForm()) {
      return;
    }
    
    try {
      // Форматирование данных перед отправкой
      const formattedValues = {
        ...form,
        start_date: form.start_date ? new Date(form.start_date).toISOString() : null,
        end_date: form.end_date ? new Date(form.end_date).toISOString() : null,
        // Преобразуем в число или null для категории
        category_id: form.category_id ? Number(form.category_id) : null
      };
      
      await updateGoods(id, formattedValues);
      toast.success('Товар успешно обновлен');
      navigate('/admin/goods');
    } catch (err) {
      console.error('Ошибка при обновлении товара:', err);
      toast.error(`Ошибка при обновлении товара: ${err.message}`);
    }
  };
  
  // Функция для перегенерации доступности
  const handleRegenerateAvailability = async () => {
    if (!id) {
      toast.error('ID товара не найден');
      return;
    }
    
    setRegenerating(true);
    try {
      const result = await regenerateAvailability(id);
      console.log('Результат перегенерации:', result);
      
      // После успешной перегенерации обновляем данные товара
      const updatedGoods = await getGoodsById(id);
      setGoods(updatedGoods);
      
      // Если показана доступность, обновляем её
      if (showAvailability) {
        // Компонент GoodsAvailability сам обновится при следующем рендере
      }
    } catch (err) {
      console.error('Ошибка при перегенерации доступности:', err);
      // Ошибка уже обработана в regenerateAvailability
    } finally {
      setRegenerating(false);
    }
  };
  
  if (loading) {
    return (
      <Layout>
        <div className="flex justify-center items-center py-12">
          <div className="animate-spin rounded-full h-16 w-16 border-t-2 border-b-2 border-primary"></div>
        </div>
      </Layout>
    );
  }
  
  if (error) {
    return (
      <Layout>
        <div className="p-4">
          <h1 className="text-xl font-semibold mb-4 text-red-500">Ошибка при загрузке товара</h1>
          <p>{error}</p>
          <button 
            onClick={() => navigate('/admin/goods')} 
            className="mt-4 bg-primary text-white px-4 py-2 rounded"
          >
            Вернуться к списку товаров
          </button>
        </div>
      </Layout>
    );
  }
  
  const inputClass = `mt-1 block w-full px-3 py-2 border rounded-md shadow-sm ${
    isDarkMode 
      ? 'bg-gray-700 border-gray-600 text-white' 
      : 'bg-white border-gray-300 text-gray-900'
  } focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500`;
  
  return (
    <Layout>
      <div className="p-4">
        <div className="flex justify-between items-center mb-6">
          <h1 className={`text-2xl font-semibold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
            Редактирование товара
          </h1>
        </div>
        
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Название товара */}
            <div>
              <label className={`block text-sm font-medium ${isDarkMode ? 'text-gray-200' : 'text-gray-700'}`}>
                Название товара
              </label>
              <input
                type="text"
                name="name"
                value={form.name}
                onChange={handleChange}
                className={inputClass}
                required
              />
            </div>
            
            {/* Артикул */}
            <div>
              <label className={`block text-sm font-medium ${isDarkMode ? 'text-gray-200' : 'text-gray-700'}`}>
                Артикул
              </label>
              <input
                type="text"
                name="article"
                value={form.article}
                onChange={handleChange}
                className={inputClass}
                required
              />
            </div>
            
            {/* URL товара */}
            <div>
              <label className={`block text-sm font-medium ${isDarkMode ? 'text-gray-200' : 'text-gray-700'}`}>
                URL товара
              </label>
              <div className="flex gap-2 items-center">
                <input
                  type="url"
                  name="url"
                  value={form.url}
                  onChange={handleChange}
                  className={inputClass}
                  required
                />
                <button
                  type="button"
                  className={`px-3 py-2 rounded ${isDarkMode ? 'bg-blue-700 text-white' : 'bg-blue-100 text-blue-800'} flex items-center`}
                  onClick={async () => {
                    if (!form.url) {
                      toast.error('Введите URL товара');
                      return;
                    }
                    setParsing(true);
                    try {
                      const result = await parseWildberriesUrl(form.url);
                      if (result && !result.error) {
                        setForm(prev => ({
                          ...prev,
                          name: result.name || prev.name,
                          article: result.article || prev.article,
                          price: result.price || prev.price,
                          image: result.image || prev.image,
                          url: result.url || prev.url,
                        }));
                        toast.success('Данные успешно обновлены с сайта');
                      } else {
                        toast.error(result?.message || 'Не удалось получить данные с сайта');
                      }
                    } catch (e) {
                      toast.error('Ошибка при парсинге товара');
                    } finally {
                      setParsing(false);
                    }
                  }}
                  disabled={parsing}
                  title="Обновить данные с сайта"
                >
                  {parsing ? (
                    <svg className="animate-spin h-5 w-5 text-blue-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                  ) : (
                    <span>Обновить с сайта</span>
                  )}
                </button>
              </div>
            </div>
            
            {/* URL изображения */}
            <div>
              <label className={`block text-sm font-medium ${isDarkMode ? 'text-gray-200' : 'text-gray-700'}`}>
                URL изображения
              </label>
              <input
                type="url"
                name="image"
                value={form.image}
                onChange={handleChange}
                className={inputClass}
                required
              />
            </div>
            
            {/* Цена */}
            <div>
              <label className={`block text-sm font-medium ${isDarkMode ? 'text-gray-200' : 'text-gray-700'}`}>
                Цена
              </label>
              <input
                type="number"
                name="price"
                value={form.price}
                onChange={handleChange}
                className={inputClass}
                min="0"
                step="1"
                required
              />
            </div>
            
            {/* Процент кэшбэка */}
            <div>
              <label className={`block text-sm font-medium ${isDarkMode ? 'text-gray-200' : 'text-gray-700'}`}>
                Процент кэшбэка
              </label>
              <input
                type="number"
                name="cashback_percent"
                value={form.cashback_percent}
                onChange={handleChange}
                className={inputClass}
                min="0"
                max="100"
                step="1"
              />
            </div>
            
            {/* Категория */}
            <div>
              <label className={`block text-sm font-medium ${isDarkMode ? 'text-gray-200' : 'text-gray-700'}`}>
                Категория
              </label>
              <select
                name="category_id"
                value={form.category_id}
                onChange={handleChange}
                className={inputClass}
              >
                <option value="">Без категории</option>
                {categories.map(category => (
                  <option key={category.id} value={category.id}>
                    {category.name}
                  </option>
                ))}
              </select>
            </div>
            
            {/* Минимальное количество в день */}
            <div>
              <label className={`block text-sm font-medium ${isDarkMode ? 'text-gray-200' : 'text-gray-700'}`}>
                Минимальное кол-во в день
              </label>
              <input
                type="number"
                name="min_daily"
                value={form.min_daily}
                onChange={handleChange}
                className={inputClass}
                min="1"
                step="1"
                required
              />
            </div>
            
            {/* Максимальное количество в день */}
            <div>
              <label className={`block text-sm font-medium ${isDarkMode ? 'text-gray-200' : 'text-gray-700'}`}>
                Максимальное кол-во в день
              </label>
              <input
                type="number"
                name="max_daily"
                value={form.max_daily}
                onChange={handleChange}
                className={inputClass}
                min="1"
                step="1"
                required
              />
            </div>
            
            {/* Дата начала */}
            <div>
              <label className={`block text-sm font-medium ${isDarkMode ? 'text-gray-200' : 'text-gray-700'}`}>
                Дата начала
              </label>
              <input
                type="date"
                name="start_date"
                value={form.start_date}
                onChange={handleChange}
                className={inputClass}
              />
            </div>
            
            {/* Дата окончания */}
            <div>
              <label className={`block text-sm font-medium ${isDarkMode ? 'text-gray-200' : 'text-gray-700'}`}>
                Дата окончания
              </label>
              <input
                type="date"
                name="end_date"
                value={form.end_date}
                onChange={handleChange}
                className={inputClass}
              />
            </div>
          </div>
          
          {/* Инструкция по покупке */}
          <div>
            <label className={`block text-sm font-medium ${isDarkMode ? 'text-gray-200' : 'text-gray-700'}`}>
              Инструкция по покупке
            </label>
            <textarea
              name="purchase_guide"
              value={form.purchase_guide || ''}
              onChange={handleChange}
              rows="4"
              className={inputClass}
            />
          </div>
          
          {/* Активен */}
          <div className="flex items-center">
            <input
              type="checkbox"
              name="is_active"
              checked={form.is_active}
              onChange={handleChange}
              className={`h-4 w-4 rounded ${
                isDarkMode ? 'bg-gray-700 border-gray-600' : 'bg-white border-gray-300'
              }`}
            />
            <label className={`ml-2 block text-sm ${isDarkMode ? 'text-gray-200' : 'text-gray-700'}`}>
              Товар активен
            </label>
          </div>
          
          <div className="flex justify-between mt-6">
            <div className="flex space-x-4">
              <button
                type="button"
                onClick={() => setShowAvailability(!showAvailability)}
                className={`px-4 py-2 rounded ${
                  isDarkMode ? 'bg-gray-600 text-white' : 'bg-gray-200 text-gray-800'
                }`}
              >
                {showAvailability ? 'Скрыть доступность' : 'Показать доступность'}
              </button>
              
              <button
                type="button"
                onClick={handleRegenerateAvailability}
                disabled={regenerating}
                className={`px-4 py-2 rounded flex items-center space-x-2 ${
                  regenerating 
                    ? (isDarkMode ? 'bg-gray-700 text-gray-400' : 'bg-gray-300 text-gray-500')
                    : (isDarkMode ? 'bg-orange-600 text-white hover:bg-orange-700' : 'bg-orange-500 text-white hover:bg-orange-600')
                }`}
                title="Перегенерировать доступность товара"
              >
                {regenerating ? (
                  <>
                    <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    <span>Генерирую...</span>
                  </>
                ) : (
                  <>
                    <svg className="h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    </svg>
                    <span>Перегенерировать доступность</span>
                  </>
                )}
              </button>
            </div>
            
            <div className="space-x-4">
              <button
                type="button"
                onClick={() => navigate('/admin/goods')}
                className={`px-4 py-2 rounded ${
                  isDarkMode ? 'bg-gray-700 text-white' : 'bg-gray-200 text-gray-800'
                }`}
              >
                Отмена
              </button>
              
              <button
                type="submit"
                className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
              >
                Сохранить изменения
              </button>
            </div>
          </div>
        </form>
        
        {showAvailability && (
          <div className="mt-8">
            <GoodsAvailability goodsId={id} />
          </div>
        )}
      </div>
    </Layout>
  );
};

export default EditGoods;