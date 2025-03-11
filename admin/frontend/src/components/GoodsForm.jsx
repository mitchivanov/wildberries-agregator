import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useApi } from '../hooks/useApi';
import { useTelegram } from '../hooks/useTelegram';
import { toast } from 'react-hot-toast';

const GoodsForm = ({ editMode = false }) => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { getGoodsById, createGoods, updateGoods } = useApi();
  const { isDarkMode, webApp } = useTelegram();
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

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
    max_daily: 10
  });

  // Состояние ошибок валидации
  const [errors, setErrors] = useState({});

  // Загрузка данных для редактирования
  useEffect(() => {
    if (editMode && id) {
      loadGoodsData();
    }
  }, [id, editMode]);

  // Получение данных товара для редактирования
  const loadGoodsData = async () => {
    setLoading(true);
    try {
      const data = await getGoodsById(id);
      if (data) {
        // Преобразуем даты из ISO в локальный формат для input type="date"
        const formattedData = {
          ...data,
          start_date: data.start_date ? formatDateForInput(data.start_date) : '',
          end_date: data.end_date ? formatDateForInput(data.end_date) : ''
        };
        setForm(formattedData);
      }
    } catch (err) {
      toast.error(`Ошибка при загрузке данных товара: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  // Форматирование даты из ISO в формат для input date
  const formatDateForInput = (isoDate) => {
    if (!isoDate) return '';
    const date = new Date(isoDate);
    return date.toISOString().split('T')[0];
  };

  // Обработка изменений полей формы
  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    
    // Для checkbox используем checked вместо value
    const fieldValue = type === 'checkbox' ? checked : value;
    
    setForm(prev => ({
      ...prev,
      [name]: fieldValue
    }));
    
    // Сбрасываем ошибку поля при изменении
    if (errors[name]) {
      setErrors(prev => ({
        ...prev,
        [name]: null
      }));
    }
  };

  // Валидация URL изображения
  const validateImageUrl = (url) => {
    if (!url) return true; // Пустой URL разрешен
    try {
      new URL(url);
      return true;
    } catch (e) {
      return false;
    }
  };

  // Валидация формы
  const validateForm = () => {
    const newErrors = {};
    
    if (!form.name.trim()) {
      newErrors.name = 'Название товара обязательно';
    }
    
    if (!form.article.trim()) {
      newErrors.article = 'Артикул обязателен';
    }
    
    if (!form.url.trim()) {
      newErrors.url = 'URL обязателен';
    }
    
    if (!form.price || form.price <= 0) {
      newErrors.price = 'Цена должна быть больше нуля';
    }
    
    if (form.cashback_percent < 0 || form.cashback_percent > 100) {
      newErrors.cashback_percent = 'Процент кэшбэка должен быть от 0 до 100';
    }
    
    if (form.min_daily < 1) {
      newErrors.min_daily = 'Минимальное количество должно быть не менее 1';
    }
    
    if (form.max_daily < form.min_daily) {
      newErrors.max_daily = 'Максимальное количество должно быть не меньше минимального';
    }
    
    if (form.image && !validateImageUrl(form.image)) {
      newErrors.image = 'Некорректный URL изображения';
    }
    
    if (form.start_date && form.end_date && new Date(form.start_date) > new Date(form.end_date)) {
      newErrors.end_date = 'Дата окончания должна быть позже даты начала';
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // Отправка формы
  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    
    if (!validateForm()) {
      setSubmitting(false);
      return;
    }
    
    try {
      // Формируем данные для отправки
      const goodsData = {
        name: form.name.trim(),
        article: form.article.trim(),
        url: form.url.trim(),
        price: parseInt(form.price, 10),
        cashback_percent: parseInt(form.cashback_percent, 10) || 0,
        purchase_guide: form.purchase_guide.trim(),
        image: form.image.trim(),
        min_daily: parseInt(form.min_daily, 10) || 1,
        max_daily: parseInt(form.max_daily, 10) || 10
      };
      
      // Добавляем даты, если они указаны
      if (form.start_date) {
        goodsData.start_date = form.start_date;
      }
      
      if (form.end_date) {
        goodsData.end_date = form.end_date;
      }
      
      // Создаем новый товар или обновляем существующий
      if (editMode) {
        await updateGoods(id, goodsData);
        toast.success('Товар успешно обновлен');
      } else {
        await createGoods(goodsData);
        toast.success('Товар успешно создан');
      }
      
      // Возвращаемся к списку товаров
      navigate('/admin/goods');
    } catch (err) {
      toast.error(`Ошибка при ${editMode ? 'обновлении' : 'создании'} товара: ${err.message}`);
    } finally {
      setSubmitting(false);
    }
  };

  // Классы для темной/светлой темы
  const inputClass = `w-full p-3 rounded-md border text-lg ${
    isDarkMode 
      ? 'bg-gray-700 border-gray-600 text-white placeholder-gray-400' 
      : 'bg-white border-gray-300 text-gray-900 placeholder-gray-500'
  } focus:ring-2 focus:ring-blue-500 focus:border-blue-500`;
  
  const labelClass = `block text-lg font-medium mb-2 ${
    isDarkMode ? 'text-gray-200' : 'text-gray-700'
  }`;
  
  const errorClass = 'mt-1 text-red-600 dark:text-red-400 text-sm';
  
  if (loading) {
    return (
      <div className="text-center py-10">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto"></div>
        <p className={`mt-2 ${isDarkMode ? 'text-gray-300' : 'text-gray-600'}`}>Загрузка данных...</p>
      </div>
    );
  }

  return (
    <div className={`w-full max-w-4xl mx-auto ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
      <h1 className="text-2xl font-bold mb-6">
        {editMode ? 'Редактирование товара' : 'Добавление нового товара'}
      </h1>
      
      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Название товара */}
        <div>
          <label htmlFor="name" className={labelClass}>
            Название товара*
          </label>
          <input
            type="text"
            id="name"
            name="name"
            value={form.name}
            onChange={handleChange}
            className={inputClass}
            placeholder="Введите название товара"
            required
          />
          {errors.name && <p className={errorClass}>{errors.name}</p>}
        </div>
        
        {/* Артикул */}
        <div>
          <label htmlFor="article" className={labelClass}>
            Артикул*
          </label>
          <input
            type="text"
            id="article"
            name="article"
            value={form.article}
            onChange={handleChange}
            className={inputClass}
            placeholder="Введите артикул товара"
            required
          />
          {errors.article && <p className={errorClass}>{errors.article}</p>}
        </div>

        {/* URL */}
        <div>
          <label htmlFor="url" className={labelClass}>
            URL*
          </label>
          <input
            type="text"
            id="url"
            name="url"
            value={form.url}
            onChange={handleChange}
            className={inputClass}
            placeholder="Введите URL товара"
            required
          />
          {errors.url && <p className={errorClass}>{errors.url}</p>}
        </div>
        
        
        
        
        {/* Цена */}
        <div>
          <label htmlFor="price" className={labelClass}>
            Цена (руб.)*
          </label>
          <input
            type="number"
            id="price"
            name="price"
            value={form.price}
            onChange={handleChange}
            className={inputClass}
            placeholder="Введите цену товара"
            min="0"
            step="1"
            required
          />
          {errors.price && <p className={errorClass}>{errors.price}</p>}
        </div>
        
        {/* Процент кэшбэка */}
        <div>
          <label htmlFor="cashback_percent" className={labelClass}>
            Процент кэшбэка (%)
          </label>
          <input
            type="number"
            id="cashback_percent"
            name="cashback_percent"
            value={form.cashback_percent}
            onChange={handleChange}
            className={inputClass}
            placeholder="Введите процент кэшбэка"
            min="0"
            max="100"
            step="1"
          />
          {errors.cashback_percent && <p className={errorClass}>{errors.cashback_percent}</p>}
        </div>
        
        {/* Инструкция по покупке */}
        <div>
          <label htmlFor="purchase_guide" className={labelClass}>
            Инструкция по покупке
          </label>
          <textarea
            id="purchase_guide"
            name="purchase_guide"
            value={form.purchase_guide}
            onChange={handleChange}
            rows="4"
            className={inputClass}
            placeholder="Введите инструкцию по покупке товара"
          />
        </div>
        
        {/* URL изображения */}
        <div>
          <label htmlFor="image" className={labelClass}>
            URL изображения
          </label>
          <input
            type="text"
            id="image"
            name="image"
            value={form.image}
            onChange={handleChange}
            className={inputClass}
            placeholder="Введите URL изображения товара"
          />
          {errors.image && <p className={errorClass}>{errors.image}</p>}
          
          {/* Предпросмотр изображения */}
          {form.image && (
            <div className="mt-4 max-w-xs mx-auto">
              <img
                src={form.image}
                alt="Предпросмотр"
                className="object-cover rounded-md border border-gray-300 dark:border-gray-700"
                onError={(e) => {
                  e.target.onerror = null;
                  e.target.src = "https://via.placeholder.com/200x200?text=Ошибка+загрузки";
                }}
              />
            </div>
          )}
        </div>
        
        {/* Дата начала */}
        <div>
          <label htmlFor="start_date" className={labelClass}>
            Дата начала
          </label>
          <input
            type="date"
            id="start_date"
            name="start_date"
            value={form.start_date}
            onChange={handleChange}
            className={inputClass}
          />
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Укажите дату начала действия товара
          </p>
        </div>
        
        {/* Дата окончания */}
        <div>
          <label htmlFor="end_date" className={labelClass}>
            Дата окончания
          </label>
          <input
            type="date"
            id="end_date"
            name="end_date"
            value={form.end_date}
            onChange={handleChange}
            className={inputClass}
          />
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Укажите дату окончания действия товара
          </p>
        </div>
        
        {/* Минимальное количество в день */}
        <div>
          <label htmlFor="min_daily" className={labelClass}>
            Минимальное количество в день
          </label>
          <input
            type="number"
            id="min_daily"
            name="min_daily"
            value={form.min_daily}
            onChange={handleChange}
            className={inputClass}
            placeholder="Минимальное количество товаров в день"
            min="1"
            step="1"
          />
          {errors.min_daily && <p className={errorClass}>{errors.min_daily}</p>}
        </div>
        
        {/* Максимальное количество в день */}
        <div>
          <label htmlFor="max_daily" className={labelClass}>
            Максимальное количество в день
          </label>
          <input
            type="number"
            id="max_daily"
            name="max_daily"
            value={form.max_daily}
            onChange={handleChange}
            className={inputClass}
            placeholder="Максимальное количество товаров в день"
            min="1"
            step="1"
          />
          {errors.max_daily && <p className={errorClass}>{errors.max_daily}</p>}
        </div>
        
        {/* Кнопки действий */}
        <div className="flex justify-end space-x-4 mt-8">
          <button
            type="button"
            onClick={() => navigate('/admin/goods')}
            className={`btn btn-secondary text-lg py-3 px-6 ${
              submitting ? 'opacity-50 cursor-not-allowed' : ''
            }`}
            disabled={submitting}
          >
            Отмена
          </button>
          
          <button
            type="submit"
            className={`btn btn-primary text-lg py-3 px-8 ${
              submitting ? 'opacity-70 cursor-wait' : ''
            }`}
            disabled={submitting}
          >
            {submitting ? 'Сохранение...' : editMode ? 'Обновить товар' : 'Создать товар'}
          </button>
        </div>
      </form>
    </div>
  );
};

export default GoodsForm;