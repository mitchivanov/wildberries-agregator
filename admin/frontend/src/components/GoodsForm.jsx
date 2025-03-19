import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useTelegram } from '../hooks/useTelegram';
import { useApi } from '../hooks/useApi';
import { toast } from 'react-hot-toast';

const GoodsForm = ({ editMode = false }) => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { isDarkMode, webApp } = useTelegram();
  const { getGoodsById, createGoods, updateGoods, getCategories, parseWildberriesUrl, getCategoryNotes, createCategoryNote, createCategory } = useApi();
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [isParsing, setIsParsing] = useState(false);
  const [categories, setCategories] = useState([]);
  const [categoryNotes, setCategoryNotes] = useState([]);
  const [isAddingNote, setIsAddingNote] = useState(false);
  const [newNote, setNewNote] = useState('');
  
  // Добавляем состояния для модального окна создания категории
  const [showCreateCategoryModal, setShowCreateCategoryModal] = useState(false);
  const [newCategoryForm, setNewCategoryForm] = useState({
    name: '',
    description: '',
    is_active: true
  });
  const [creatingCategory, setCreatingCategory] = useState(false);

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
    total_sales_limit: '',
    category_id: '',
    note: '',
    confirmation_requirements: []
  });

  // Состояние ошибок валидации
  const [errors, setErrors] = useState({});

  // Загрузка данных для редактирования и списка категорий
  useEffect(() => {
    loadCategories();
    if (editMode && id) {
      loadGoodsData();
    }
  }, [id, editMode]);

  // Загрузка списка категорий
  const loadCategories = async () => {
    try {
      const categoriesData = await getCategories();
      console.log("Загружены категории:", categoriesData);
      
      if (Array.isArray(categoriesData)) {
        // Фильтруем только активные категории
        const activeCategories = categoriesData.filter(cat => cat.is_active);
        setCategories(activeCategories);
      } else {
        console.error("Получены некорректные данные категорий:", categoriesData);
        setCategories([]);
      }
    } catch (error) {
      console.error("Ошибка при загрузке категорий:", error);
      setCategories([]);
      // Показываем уведомление об ошибке
      toast.error("Не удалось загрузить список категорий");
    }
  };

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
          end_date: data.end_date ? formatDateForInput(data.end_date) : '',
          category_id: data.category?.id || '',
          note: data.note || '',
          confirmation_requirements: data.confirmation_requirements || []
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

  // Загрузка примечаний для выбранной категории
  useEffect(() => {
    const loadCategoryNotes = async () => {
      if (!form.category_id) {
        setCategoryNotes([]);
        return;
      }

      try {
        const data = await getCategoryNotes(form.category_id);
        if (data && Array.isArray(data)) {
          setCategoryNotes(data);
        }
      } catch (err) {
        console.error('Ошибка при загрузке примечаний категории:', err);
      }
    };

    loadCategoryNotes();
  }, [form.category_id, getCategoryNotes]);

  // Обработка изменений полей формы
  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    
    let fieldValue;
    
    // Для числовых полей обеспечиваем преобразование в число
    if (name === 'min_daily' || name === 'max_daily' || name === 'price' || name === 'cashback_percent') {
      // Преобразуем строку в число, пустую строку преобразуем в 0
      fieldValue = value === '' ? '' : Number(value);
    } else {
      // Для checkbox используем checked вместо value
      fieldValue = type === 'checkbox' ? checked : value;
    }
    
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

  // Функция для парсинга товара с Wildberries
  const handleParseWildberries = async () => {
    if (!form.url) {
      toast.error('Введите URL товара Wildberries для парсинга');
      return;
    }

    setIsParsing(true);
    try {
      const parsedData = await parseWildberriesUrl(form.url);
      
      if (parsedData && !parsedData.error) {
        // Обновляем состояние формы данными из парсера
        setForm(prev => ({
          ...prev,
          name: parsedData.name || prev.name,
          price: parsedData.price || prev.price,
          article: parsedData.article || prev.article,
          image: parsedData.image || prev.image
        }));
        
        toast.success('Данные успешно загружены');
      } else {
        toast.error('Не удалось получить данные о товаре');
      }
    } catch (err) {
      toast.error(`Ошибка при парсинге товара: ${err.message}`);
    } finally {
      setIsParsing(false);
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
    
    // Преобразуем значения в числа для корректного сравнения
    const minDaily = Number(form.min_daily);
    const maxDaily = Number(form.max_daily);
    
    console.log('Validation - minDaily:', minDaily, 'type:', typeof minDaily);
    console.log('Validation - maxDaily:', maxDaily, 'type:', typeof maxDaily);
    
    if (isNaN(minDaily) || minDaily < 1) {
      newErrors.min_daily = 'Минимальное количество должно быть не менее 1';
    }
    
    if (isNaN(maxDaily) || maxDaily < 1) {
      newErrors.max_daily = 'Максимальное количество должно быть не менее 1';
    }
    
    if (!isNaN(minDaily) && !isNaN(maxDaily) && minDaily > maxDaily) {
      newErrors.max_daily = 'Максимальное количество должно быть не меньше минимального';
    }
    
    if (form.image && !validateImageUrl(form.image)) {
      newErrors.image = 'Некорректный URL изображения';
    }
    
    if (form.start_date && form.end_date && new Date(form.start_date) > new Date(form.end_date)) {
      newErrors.end_date = 'Дата окончания должна быть позже даты начала';
    }
    
    if (form.total_sales_limit && parseInt(form.total_sales_limit) <= 0) {
      newErrors.total_sales_limit = 'Общий лимит продаж должен быть больше нуля';
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // Обработчик добавления нового примечания
  const handleAddCategoryNote = async () => {
    if (!newNote.trim() || !form.category_id) return;

    try {
      const noteData = {
        category_id: form.category_id,
        text: newNote.trim()
      };
      
      const result = await createCategoryNote(noteData);
      if (result && !result.error) {
        setCategoryNotes([...categoryNotes, result]);
        setForm({ ...form, note: result.text });
        setNewNote('');
        setIsAddingNote(false);
        toast.success('Примечание добавлено');
      }
    } catch (err) {
      console.error('Ошибка при добавлении примечания:', err);
      toast.error('Ошибка при добавлении примечания');
    }
  };

  // Обработчик добавления нового требования подтверждения
  const handleAddRequirement = () => {
    setForm({
      ...form,
      confirmation_requirements: [
        ...form.confirmation_requirements || [],
        {
          id: Date.now().toString(),
          title: '',
          type: 'text'
        }
      ]
    });
  };
  
  // Обработчик удаления требования подтверждения
  const handleRemoveRequirement = (id) => {
    setForm({
      ...form,
      confirmation_requirements: form.confirmation_requirements.filter(req => req.id !== id)
    });
  };
  
  // Обработчик изменения требования подтверждения
  const handleRequirementChange = (id, field, value) => {
    setForm({
      ...form,
      confirmation_requirements: form.confirmation_requirements.map(req => 
        req.id === id ? { ...req, [field]: value } : req
      )
    });
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
        // Преобразуем поля в числа
        price: Number(form.price),
        cashback_percent: Number(form.cashback_percent),
        min_daily: Number(form.min_daily),
        max_daily: Number(form.max_daily),
        total_sales_limit: form.total_sales_limit ? Number(form.total_sales_limit) : null,
        category_id: form.category_id ? Number(form.category_id) : null,
        note: form.note || null
      };
      
      console.log('Submitting form data:', goodsData);
      
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
      console.error('Error details:', err);
      toast.error(`Ошибка при ${editMode ? 'обновлении' : 'создании'} товара: ${err.message}`);
    } finally {
      setSubmitting(false);
    }
  };

  // Обработка изменений полей формы новой категории
  const handleNewCategoryChange = (e) => {
    const { name, value, type, checked } = e.target;
    setNewCategoryForm(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
  };

  // Функция создания новой категории
  const handleCreateCategory = async () => {
    if (!newCategoryForm.name.trim()) {
      toast.error('Название категории обязательно');
      return;
    }

    setCreatingCategory(true);
    try {
      const result = await createCategory(newCategoryForm);
      
      if (result && !result.error) {
        // Добавляем новую категорию в список и выбираем её
        setCategories([...categories, result]);
        setForm(prev => ({
          ...prev,
          category_id: result.id
        }));
        
        // Очищаем форму и закрываем модальное окно
        setNewCategoryForm({
          name: '',
          description: '',
          is_active: true
        });
        setShowCreateCategoryModal(false);
        
        toast.success('Категория успешно создана');
      } else {
        toast.error('Не удалось создать категорию');
      }
    } catch (error) {
      console.error('Ошибка при создании категории:', error);
      toast.error(`Ошибка при создании категории: ${error.message || 'Неизвестная ошибка'}`);
    } finally {
      setCreatingCategory(false);
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
        {/* URL с кнопкой парсинга */}
        <div>
          <label htmlFor="url" className={labelClass}>
            URL*
          </label>
          <div className="flex">
            <input
              type="text"
              id="url"
              name="url"
              value={form.url}
              onChange={handleChange}
              className={`${inputClass} rounded-r-none`}
              placeholder="Введите URL товара Wildberries"
              required
            />
            <button
              type="button"
              onClick={handleParseWildberries}
              className={`px-4 py-2 bg-blue-600 text-white rounded-r-md hover:bg-blue-700 flex-shrink-0 ${
                isParsing ? 'opacity-70 cursor-wait' : ''
              }`}
              disabled={isParsing}
            >
              {isParsing ? 'Загрузка...' : 'Загрузить'}
            </button>
          </div>
          {errors.url && <p className={errorClass}>{errors.url}</p>}
        </div>
        
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
        
        {/* Категория с кнопкой создания новой */}
        <div>
          <label htmlFor="category_id" className={labelClass}>
            Категория
          </label>
          <div className="flex space-x-2">
            <select
              id="category_id"
              name="category_id"
              value={form.category_id || ''}
              onChange={handleChange}
              className={`${inputClass} flex-grow`}
            >
              <option value="">Выберите категорию</option>
              {categories.map(category => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={() => setShowCreateCategoryModal(true)}
              className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 flex items-center"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-1" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M10 5a1 1 0 011 1v3h3a1 1 0 110 2h-3v3a1 1 0 11-2 0v-3H6a1 1 0 110-2h3V6a1 1 0 011-1z" clipRule="evenodd" />
              </svg>
              Новая
            </button>
          </div>
        </div>
        
        {/* Примечание к товару - Отображается только если выбрана категория */}
        {form.category_id && (
          <div>
            <label htmlFor="note" className={labelClass}>
              Примечание
            </label>
            
            {isAddingNote ? (
              <div className="space-y-2">
                <textarea
                  id="new_note"
                  value={newNote}
                  onChange={(e) => setNewNote(e.target.value)}
                  rows="3"
                  className={inputClass}
                  placeholder="Введите новое примечание"
                />
                <div className="flex space-x-2">
                  <button
                    type="button"
                    className="btn btn-primary"
                    onClick={handleAddCategoryNote}
                  >
                    Добавить
                  </button>
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={() => setIsAddingNote(false)}
                  >
                    Отмена
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-2">
                <select
                  id="note"
                  name="note"
                  value={form.note || ''}
                  onChange={handleChange}
                  className={inputClass}
                >
                  <option value="">Выберите примечание</option>
                  {categoryNotes.map(note => (
                    <option key={note.id} value={note.text}>
                      {note.text}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  className="text-sm text-blue-500 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300"
                  onClick={() => setIsAddingNote(true)}
                >
                  + Добавить новое примечание
                </button>
              </div>
            )}
          </div>
        )}
        
        {/* Требования для подтверждения покупки */}
        <div className="mb-6">
          <h3 className={`text-xl font-medium mb-4 ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
            Требования для подтверждения покупки
          </h3>
          <p className={`text-sm mb-4 ${isDarkMode ? 'text-gray-300' : 'text-gray-600'}`}>
            Укажите, какую информацию нужно запросить у клиента для подтверждения покупки
          </p>
          
          {form.confirmation_requirements && form.confirmation_requirements.length > 0 ? (
            <div className="space-y-4 mb-4">
              {form.confirmation_requirements.map((req) => (
                <div 
                  key={req.id} 
                  className={`p-4 rounded-lg border ${
                    isDarkMode ? 'bg-gray-700 border-gray-600' : 'bg-white border-gray-200'
                  } flex flex-col gap-3`}
                >
                  <div className="flex justify-between items-center">
                    <h4 className={`font-medium ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                      Требование {form.confirmation_requirements.findIndex(r => r.id === req.id) + 1}
                    </h4>
                    <button
                      type="button"
                      onClick={() => handleRemoveRequirement(req.id)}
                      className="text-red-500 hover:text-red-700"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                      </svg>
                    </button>
                  </div>
                  <div>
                    <label className={`block text-sm font-medium mb-1 ${isDarkMode ? 'text-gray-200' : 'text-gray-700'}`}>
                      Заголовок
                    </label>
                    <input
                      type="text"
                      value={req.title}
                      onChange={(e) => handleRequirementChange(req.id, 'title', e.target.value)}
                      className={inputClass}
                      placeholder="Например: Скриншот заказа"
                    />
                  </div>
                  <div>
                    <label className={`block text-sm font-medium mb-1 ${isDarkMode ? 'text-gray-200' : 'text-gray-700'}`}>
                      Тип данных
                    </label>
                    <select
                      value={req.type}
                      onChange={(e) => handleRequirementChange(req.id, 'type', e.target.value)}
                      className={inputClass}
                    >
                      <option value="text">Текст</option>
                      <option value="photo">Фото</option>
                      <option value="video">Видео</option>
                    </select>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className={`p-4 rounded-lg border text-center ${
              isDarkMode ? 'bg-gray-700 border-gray-600 text-gray-300' : 'bg-gray-50 border-gray-200 text-gray-500'
            }`}>
              Нет добавленных требований
            </div>
          )}
          
          <button
            type="button"
            onClick={handleAddRequirement}
            className={`mt-3 flex items-center px-4 py-2 rounded-md ${
              isDarkMode 
                ? 'bg-gray-700 text-blue-400 hover:bg-gray-600' 
                : 'bg-gray-100 text-blue-600 hover:bg-gray-200'
            }`}
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M10 5a1 1 0 011 1v3h3a1 1 0 110 2h-3v3a1 1 0 11-2 0v-3H6a1 1 0 110-2h3V6a1 1 0 011-1z" clipRule="evenodd" />
            </svg>
            Добавить требование
          </button>
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
            min="1"
            step="1"
            required
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
            min="1"
            step="1"
            required
          />
          {errors.max_daily && <p className={errorClass}>{errors.max_daily}</p>}
        </div>
        
        {/* Общий лимит продаж */}
        <div>
          <label htmlFor="total_sales_limit" className={labelClass}>
            Общий лимит продаж
          </label>
          <input
            type="number"
            id="total_sales_limit"
            name="total_sales_limit"
            value={form.total_sales_limit}
            onChange={handleChange}
            className={inputClass}
            min="1"
            step="1"
            placeholder="Оставьте пустым, если нет ограничения"
          />
          {errors.total_sales_limit && <p className={errorClass}>{errors.total_sales_limit}</p>}
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Максимальное количество товара, которое можно продать за весь период
          </p>
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

      {/* Модальное окно для создания новой категории */}
      {showCreateCategoryModal && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex items-center justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
            <div className="fixed inset-0 transition-opacity" aria-hidden="true">
              <div className={`absolute inset-0 ${isDarkMode ? 'bg-gray-900' : 'bg-gray-500'} opacity-75`}></div>
            </div>

            <span className="hidden sm:inline-block sm:align-middle sm:h-screen" aria-hidden="true">&#8203;</span>
            
            <div 
              className={`inline-block align-bottom rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg sm:w-full ${
                isDarkMode ? 'bg-gray-800 text-white' : 'bg-white text-gray-900'
              }`}
            >
              <div className="px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
                <h3 className="text-lg leading-6 font-medium mb-4">
                  Создание новой категории
                </h3>
                
                <div className="space-y-4">
                  <div>
                    <label htmlFor="name" className={`block mb-1 ${isDarkMode ? 'text-gray-200' : 'text-gray-700'}`}>
                      Название категории*
                    </label>
                    <input
                      type="text"
                      id="name"
                      name="name"
                      value={newCategoryForm.name}
                      onChange={handleNewCategoryChange}
                      className={inputClass}
                      placeholder="Введите название категории"
                      required
                    />
                  </div>
                  
                  <div>
                    <label htmlFor="description" className={`block mb-1 ${isDarkMode ? 'text-gray-200' : 'text-gray-700'}`}>
                      Описание
                    </label>
                    <textarea
                      id="description"
                      name="description"
                      value={newCategoryForm.description}
                      onChange={handleNewCategoryChange}
                      className={inputClass}
                      rows="3"
                      placeholder="Введите описание категории"
                    />
                  </div>
                  
                  <div className="flex items-center">
                    <input
                      type="checkbox"
                      id="is_active"
                      name="is_active"
                      checked={newCategoryForm.is_active}
                      onChange={handleNewCategoryChange}
                      className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                    />
                    <label htmlFor="is_active" className={`ml-2 ${isDarkMode ? 'text-gray-200' : 'text-gray-700'}`}>
                      Активна
                    </label>
                  </div>
                </div>
              </div>
              
              <div className={`px-4 py-3 sm:px-6 sm:flex sm:flex-row-reverse ${isDarkMode ? 'bg-gray-700' : 'bg-gray-50'}`}>
                <button
                  type="button"
                  className={`w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-green-600 text-base font-medium text-white hover:bg-green-700 focus:outline-none sm:ml-3 sm:w-auto sm:text-sm ${
                    creatingCategory ? 'opacity-70 cursor-wait' : ''
                  }`}
                  onClick={handleCreateCategory}
                  disabled={creatingCategory}
                >
                  {creatingCategory ? 'Создание...' : 'Создать категорию'}
                </button>
                <button
                  type="button"
                  className={`mt-3 w-full inline-flex justify-center rounded-md border border-gray-300 shadow-sm px-4 py-2 ${
                    isDarkMode ? 'bg-gray-600 text-white hover:bg-gray-500' : 'bg-white text-gray-700 hover:bg-gray-50'
                  } focus:outline-none sm:mt-0 sm:ml-3 sm:w-auto sm:text-sm`}
                  onClick={() => setShowCreateCategoryModal(false)}
                  disabled={creatingCategory}
                >
                  Отмена
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default GoodsForm;