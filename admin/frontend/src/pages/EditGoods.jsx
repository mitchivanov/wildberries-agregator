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
  const { getGoodsById, updateGoods, getCategories } = useApi();
  const { isDarkMode } = useTelegram();
  
  const [goods, setGoods] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showAvailability, setShowAvailability] = useState(false);
  const [categories, setCategories] = useState([]);
  
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
              <input
                type="url"
                name="url"
                value={form.url}
                onChange={handleChange}
                className={inputClass}
                required
              />
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
            <button
              type="button"
              onClick={() => setShowAvailability(!showAvailability)}
              className={`px-4 py-2 rounded ${
                isDarkMode ? 'bg-gray-600 text-white' : 'bg-gray-200 text-gray-800'
              }`}
            >
              {showAvailability ? 'Скрыть доступность' : 'Показать доступность'}
            </button>
            
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