import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useApi } from '../hooks/useApi';
import { useTelegram } from '../hooks/useTelegram';
import { toast } from 'react-hot-toast';
import { useToast } from '../hooks/useToast';

const GoodsForm = ({ editMode = false }) => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { getGoodsById, createGoods, updateGoods } = useApi();
  const { isDarkMode, webApp } = useTelegram();
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [urlToFetch, setUrlToFetch] = useState('');
  const [isUrlFormVisible, setIsUrlFormVisible] = useState(!id);
  const [urlLoading, setUrlLoading] = useState(false);
  const { toast: useToastToast } = useToast();
  const { parseWbProduct } = useApi();

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

  // Функция для автозаполнения данных товара по URL
  const handleFetchProductData = async () => {
    if (!urlToFetch) {
      toast.error('Введите URL товара');
      return;
    }
    
    try {
      setUrlLoading(true);
      const data = await parseWbProduct(urlToFetch);
      
      // Заполняем форму полученными данными
      setForm(prev => ({
        ...prev,
        name: data.name,
        article: data.article,
        price: data.price,
        url: data.url,
        image: data.image
      }));
      
      // Скрываем форму URL и показываем основную форму
      setIsUrlFormVisible(false);
      toast.success('Данные товара успешно загружены');
    } catch (err) {
      toast.error(`Ошибка при получении данных: ${err.message}`);
      // В случае ошибки просто скрываем форму URL и показываем пустую форму
      setIsUrlFormVisible(false);
    } finally {
      setUrlLoading(false);
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
    
    const minDaily = parseInt(form.min_daily, 10);
    const maxDaily = parseInt(form.max_daily, 10);
    
    if (!isNaN(minDaily) && !isNaN(maxDaily) && minDaily > maxDaily) {
      newErrors.max_daily = 'Максимальное количество должно быть не меньше минимального';
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
        ...form,
        // Преобразуем строки в числа
        price: parseInt(form.price, 10),
        cashback_percent: parseInt(form.cashback_percent, 10),
        min_daily: parseInt(form.min_daily, 10),
        max_daily: parseInt(form.max_daily, 10)
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

  // Если форма URL видима, показываем её
  if (isUrlFormVisible && !editMode) {
    return (
      <div className={`w-full max-w-4xl mx-auto ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
        <h1 className="text-2xl font-bold mb-6">Добавление нового товара</h1>
        
        <div className="mb-6 p-6 rounded-lg border shadow-sm bg-opacity-50 backdrop-blur-sm 
          ${isDarkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'}">
          <p className="mb-4">Введите URL товара с Wildberries для автозаполнения данных:</p>
          
          <div className="flex space-x-2">
            <input
              type="text"
              value={urlToFetch}
              onChange={(e) => setUrlToFetch(e.target.value)}
              placeholder="https://www.wildberries.ru/catalog/123456/detail.aspx"
              className={`flex-1 p-3 rounded-md border text-lg ${
                isDarkMode 
                  ? 'bg-gray-700 border-gray-600 text-white placeholder-gray-400' 
                  : 'bg-white border-gray-300 text-gray-900 placeholder-gray-500'
              }`}
            />
            
            <button
              onClick={handleFetchProductData}
              disabled={urlLoading}
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
            >
              {urlLoading ? (
                <span className="flex items-center">
                  <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Загрузка...
                </span>
              ) : "Заполнить данные"}
            </button>
          </div>
          
          <div className="mt-4 flex justify-between">
            <button
              onClick={() => setIsUrlFormVisible(false)}
              className={`px-4 py-2 rounded-md ${
                isDarkMode ? 'bg-gray-700 text-gray-200' : 'bg-gray-200 text-gray-800'
              }`}
            >
              Заполнить форму вручную
            </button>
            
            <button
              onClick={() => navigate('/admin/goods')}
              className={`px-4 py-2 rounded-md ${
                isDarkMode ? 'bg-gray-700 text-gray-200' : 'bg-gray-200 text-gray-800'
              }`}
            >
              Вернуться к списку
            </button>
          </div>
        </div>
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