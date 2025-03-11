import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTelegram } from '../hooks/useTelegram';
import { useApi } from '../hooks/useApi';
import toast from 'react-hot-toast';

const GoodsForm = ({ initialData = {}, isEditing = false }) => {
  const { isDarkMode } = useTelegram();
  const { createGoods, updateGoods } = useApi();
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(false);
  
  // Начальное состояние формы
  const [formData, setFormData] = useState({
    name: '',
    article: '',
    price: '',
    cashback_percent: '5',  // Значение по умолчанию
    url: '',
    image: '',
    is_active: true,
    purchase_guide: '',
    start_date: '',
    end_date: '',
    min_daily: '1',  // Значение по умолчанию
    max_daily: '5'   // Значение по умолчанию
  });

  // Заполняем форму начальными данными, если они есть
  useEffect(() => {
    if (initialData && Object.keys(initialData).length > 0) {
      console.log("Заполнение формы начальными данными:", initialData);
      
      // Форматируем данные для формы
      const formattedData = {
        ...initialData,
        // Убедимся, что числовые значения преобразованы в строки для полей ввода
        price: initialData.price?.toString() || '',
        cashback_percent: initialData.cashback_percent?.toString() || '5',
        min_daily: initialData.min_daily?.toString() || '1',
        max_daily: initialData.max_daily?.toString() || '5',
        // Устанавливаем даты, если их нет
        start_date: initialData.start_date || getCurrentDate(),
        end_date: initialData.end_date || getDefaultEndDate()
      };
      
      setFormData(formattedData);
    } else if (isEditing) {
      // Если мы находимся в режиме редактирования, но данные не предоставлены
      toast.error('Не удалось загрузить данные товара');
    } else {
      // В режиме создания, устанавливаем даты по умолчанию
      setFormData(prev => ({
        ...prev,
        start_date: getCurrentDate(),
        end_date: getDefaultEndDate()
      }));
    }
  }, [initialData, isEditing]);

  // Функция для получения текущей даты в формате YYYY-MM-DD
  const getCurrentDate = () => {
    const now = new Date();
    return now.toISOString().split('T')[0];
  };

  // Функция для получения даты через 30 дней от текущей
  const getDefaultEndDate = () => {
    const date = new Date();
    date.setDate(date.getDate() + 30);
    return date.toISOString().split('T')[0];
  };

  // Обработчик изменения поля формы
  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
  };

  // Обработчик отправки формы
  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      // Подготавливаем данные для отправки
      const dataToSubmit = {
        ...formData,
        price: parseFloat(formData.price),
        cashback_percent: parseInt(formData.cashback_percent, 10),
        min_daily: parseInt(formData.min_daily, 10),
        max_daily: parseInt(formData.max_daily, 10)
      };

      // Проверка на корректность данных
      if (dataToSubmit.min_daily > dataToSubmit.max_daily) {
        toast.error('Минимальное количество не может быть больше максимального');
        setIsLoading(false);
        return;
      }

      let response;
      if (isEditing) {
        response = await updateGoods(initialData.id, dataToSubmit);
        toast.success('Товар успешно обновлен');
      } else {
        response = await createGoods(dataToSubmit);
        toast.success('Товар успешно создан');
      }

      // Перенаправляем на страницу со списком товаров
      navigate('/admin/goods');
    } catch (error) {
      console.error('Ошибка при сохранении товара:', error);
      toast.error(`Ошибка: ${error.message || 'Не удалось сохранить товар'}`);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className={`bg-${isDarkMode ? 'gray-800' : 'white'} shadow rounded-lg p-6`}>
      <form onSubmit={handleSubmit}>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Название товара */}
          <div className="col-span-2">
            <label htmlFor="name" className={`block text-sm font-medium ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
              Название товара
            </label>
            <input
              type="text"
              id="name"
              name="name"
              value={formData.name}
              onChange={handleChange}
              required
              className={`mt-1 block w-full border ${
                isDarkMode 
                  ? 'bg-gray-700 border-gray-600 text-white' 
                  : 'bg-white border-gray-300 text-gray-900'
              } rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm p-2`}
            />
          </div>

          {/* Артикул */}
          <div>
            <label htmlFor="article" className={`block text-sm font-medium ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
              Артикул
            </label>
            <input
              type="text"
              id="article"
              name="article"
              value={formData.article}
              onChange={handleChange}
              required
              className={`mt-1 block w-full border ${
                isDarkMode 
                  ? 'bg-gray-700 border-gray-600 text-white' 
                  : 'bg-white border-gray-300 text-gray-900'
              } rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm p-2`}
            />
          </div>

          {/* Цена */}
          <div>
            <label htmlFor="price" className={`block text-sm font-medium ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
              Цена (руб.)
            </label>
            <input
              type="number"
              id="price"
              name="price"
              value={formData.price}
              onChange={handleChange}
              required
              min="0"
              step="0.01"
              className={`mt-1 block w-full border ${
                isDarkMode 
                  ? 'bg-gray-700 border-gray-600 text-white' 
                  : 'bg-white border-gray-300 text-gray-900'
              } rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm p-2`}
            />
          </div>

          {/* Процент кэшбэка */}
          <div>
            <label htmlFor="cashback_percent" className={`block text-sm font-medium ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
              Процент кэшбэка
            </label>
            <input
              type="number"
              id="cashback_percent"
              name="cashback_percent"
              value={formData.cashback_percent}
              onChange={handleChange}
              required
              min="0"
              max="100"
              className={`mt-1 block w-full border ${
                isDarkMode 
                  ? 'bg-gray-700 border-gray-600 text-white' 
                  : 'bg-white border-gray-300 text-gray-900'
              } rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm p-2`}
            />
          </div>

          {/* URL товара */}
          <div className="col-span-2">
            <label htmlFor="url" className={`block text-sm font-medium ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
              URL товара
            </label>
            <input
              type="url"
              id="url"
              name="url"
              value={formData.url}
              onChange={handleChange}
              required
              className={`mt-1 block w-full border ${
                isDarkMode 
                  ? 'bg-gray-700 border-gray-600 text-white' 
                  : 'bg-white border-gray-300 text-gray-900'
              } rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm p-2`}
            />
          </div>

          {/* URL изображения */}
          <div className="col-span-2">
            <label htmlFor="image" className={`block text-sm font-medium ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
              URL изображения
            </label>
            <input
              type="url"
              id="image"
              name="image"
              value={formData.image}
              onChange={handleChange}
              required
              className={`mt-1 block w-full border ${
                isDarkMode 
                  ? 'bg-gray-700 border-gray-600 text-white' 
                  : 'bg-white border-gray-300 text-gray-900'
              } rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm p-2`}
            />
            {formData.image && (
              <div className="mt-2">
                <img 
                  src={formData.image} 
                  alt="Предпросмотр" 
                  className="h-32 w-auto object-contain border rounded"
                  onError={(e) => {
                    e.target.onerror = null;
                    e.target.src = 'https://via.placeholder.com/150?text=Изображение+недоступно';
                  }}
                />
              </div>
            )}
          </div>

          {/* Инструкция по покупке */}
          <div className="col-span-2">
            <label htmlFor="purchase_guide" className={`block text-sm font-medium ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
              Инструкция по покупке
            </label>
            <textarea
              id="purchase_guide"
              name="purchase_guide"
              value={formData.purchase_guide}
              onChange={handleChange}
              rows="4"
              className={`mt-1 block w-full border ${
                isDarkMode 
                  ? 'bg-gray-700 border-gray-600 text-white' 
                  : 'bg-white border-gray-300 text-gray-900'
              } rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm p-2`}
            ></textarea>
          </div>

          {/* Дата начала и окончания */}
          <div>
            <label htmlFor="start_date" className={`block text-sm font-medium ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
              Дата начала
            </label>
            <input
              type="date"
              id="start_date"
              name="start_date"
              value={formData.start_date}
              onChange={handleChange}
              required
              className={`mt-1 block w-full border ${
                isDarkMode 
                  ? 'bg-gray-700 border-gray-600 text-white' 
                  : 'bg-white border-gray-300 text-gray-900'
              } rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm p-2`}
            />
          </div>

          <div>
            <label htmlFor="end_date" className={`block text-sm font-medium ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
              Дата окончания
            </label>
            <input
              type="date"
              id="end_date"
              name="end_date"
              value={formData.end_date}
              onChange={handleChange}
              required
              className={`mt-1 block w-full border ${
                isDarkMode 
                  ? 'bg-gray-700 border-gray-600 text-white' 
                  : 'bg-white border-gray-300 text-gray-900'
              } rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm p-2`}
            />
          </div>

          {/* Мин/макс количество в день */}
          <div>
            <label htmlFor="min_daily" className={`block text-sm font-medium ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
              Мин. количество в день
            </label>
            <input
              type="number"
              id="min_daily"
              name="min_daily"
              value={formData.min_daily}
              onChange={handleChange}
              required
              min="0"
              className={`mt-1 block w-full border ${
                isDarkMode 
                  ? 'bg-gray-700 border-gray-600 text-white' 
                  : 'bg-white border-gray-300 text-gray-900'
              } rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm p-2`}
            />
          </div>

          <div>
            <label htmlFor="max_daily" className={`block text-sm font-medium ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
              Макс. количество в день
            </label>
            <input
              type="number"
              id="max_daily"
              name="max_daily"
              value={formData.max_daily}
              onChange={handleChange}
              required
              min="0"
              className={`mt-1 block w-full border ${
                isDarkMode 
                  ? 'bg-gray-700 border-gray-600 text-white' 
                  : 'bg-white border-gray-300 text-gray-900'
              } rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm p-2`}
            />
          </div>

          {/* Активность товара */}
          <div className="col-span-2">
            <div className="flex items-center">
              <input
                type="checkbox"
                id="is_active"
                name="is_active"
                checked={formData.is_active}
                onChange={handleChange}
                className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
              />
              <label htmlFor="is_active" className={`ml-2 block text-sm ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                Активен
              </label>
            </div>
          </div>
        </div>

        {/* Кнопки действий */}
        <div className="mt-6 flex justify-end space-x-3">
          <button
            type="button"
            onClick={() => navigate('/admin/goods')}
            className={`px-4 py-2 border rounded-md shadow-sm text-sm font-medium ${
              isDarkMode 
                ? 'border-gray-600 bg-gray-700 text-gray-200 hover:bg-gray-600' 
                : 'border-gray-300 bg-white text-gray-700 hover:bg-gray-50'
            } focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500`}
          >
            Отмена
          </button>
          <button
            type="submit"
            disabled={isLoading}
            className={`px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white ${
              isDarkMode 
                ? 'bg-blue-600 hover:bg-blue-700' 
                : 'bg-blue-600 hover:bg-blue-700'
            } focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500`}
          >
            {isLoading ? (
              <span className="flex items-center justify-center">
                <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Сохранение...
              </span>
            ) : (
              isEditing ? 'Обновить' : 'Создать'
            )}
          </button>
        </div>
      </form>
    </div>
  );
};

export default GoodsForm;