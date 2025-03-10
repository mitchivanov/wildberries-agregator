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
    price: 0,
    description: '',
    image: '',
    start_date: '',
    end_date: '',
    is_active: true
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
        // Преобразуем даты из ISO в локальный формат для input type="datetime-local"
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

  // Форматирование даты из ISO в формат для input datetime-local
  const formatDateForInput = (isoDate) => {
    if (!isoDate) return '';
    const date = new Date(isoDate);
    // Преобразуем в формат YYYY-MM-DDThh:mm который требуется для datetime-local
    return new Date(date.getTime() - (date.getTimezoneOffset() * 60000))
      .toISOString()
      .slice(0, 16);
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
    
    if (form.price <= 0) {
      newErrors.price = 'Цена должна быть больше нуля';
    }
    
    if (!validateImageUrl(form.image)) {
      newErrors.image = 'Некорректный URL изображения';
    }
    
    // Проверяем, что дата окончания позже даты начала, если обе указаны
    if (form.start_date && form.end_date && new Date(form.end_date) <= new Date(form.start_date)) {
      newErrors.end_date = 'Дата окончания должна быть позже даты начала';
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // Отправка формы
  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!validateForm()) {
      toast.error('Пожалуйста, исправьте ошибки в форме');
      return;
    }
    
    setSubmitting(true);
    
    try {
      // Подготавливаем данные для отправки
      const goodsData = {
        ...form,
        price: parseFloat(form.price)
      };
      
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
        
        {/* Описание */}
        <div>
          <label htmlFor="description" className={labelClass}>
            Описание
          </label>
          <textarea
            id="description"
            name="description"
            value={form.description}
            onChange={handleChange}
            className={`${inputClass} min-h-[150px]`}
            placeholder="Введите описание товара"
            rows="5"
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
            placeholder="Вставьте URL изображения товара"
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
        
        {/* Дата начала (МСК) */}
        <div>
          <label htmlFor="start_date" className={labelClass}>
            Дата начала (МСК)
          </label>
          <input
            type="datetime-local"
            id="start_date"
            name="start_date"
            value={form.start_date}
            onChange={handleChange}
            className={inputClass}
          />
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Указывается московское время (UTC+3)
          </p>
        </div>
        
        {/* Дата окончания (МСК) */}
        <div>
          <label htmlFor="end_date" className={labelClass}>
            Дата окончания (МСК)
          </label>
          <input
            type="datetime-local"
            id="end_date"
            name="end_date"
            value={form.end_date}
            onChange={handleChange}
            className={inputClass}
          />
          {errors.end_date && <p className={errorClass}>{errors.end_date}</p>}
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Указывается московское время (UTC+3)
          </p>
        </div>
        
        {/* Активность */}
        <div className="flex items-center space-x-3">
          <input
            type="checkbox"
            id="is_active"
            name="is_active"
            checked={form.is_active}
            onChange={handleChange}
            className="h-6 w-6 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
            style={{
              accentColor: isDarkMode ? '#3b82f6' : '',
              cursor: 'pointer'
            }}
          />
          <label htmlFor="is_active" className={`${labelClass} mb-0 cursor-pointer`}>
            Товар активен
          </label>
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