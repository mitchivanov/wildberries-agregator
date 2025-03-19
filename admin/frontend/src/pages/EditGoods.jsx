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
  const { getGoodsById, updateGoods, getCategories, createCategoryNote, deleteCategoryNote } = useApi();
  const { isDarkMode, webApp } = useTelegram();
  
  const [goods, setGoods] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showAvailability, setShowAvailability] = useState(false);
  const [categories, setCategories] = useState([]);
  const [saving, setSaving] = useState(false);
  const [newNote, setNewNote] = useState('');
  
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
    category_id: '',
    confirmation_requirements: []
  });
  
  // Загрузка товара при монтировании компонента
  useEffect(() => {
    const fetchGoods = async () => {
      try {
        const data = await getGoodsById(id);
        
        // Преобразуем данные для отображения в форме
        const processedData = {
          ...data,
          category: data.category ? {
            id: data.category.id,
            name: data.category.name,
            description: data.category.description,
            is_active: data.category.is_active,
            created_at: data.category.created_at || null,
            updated_at: data.category.updated_at || null,
            notes: data.category.notes || []
          } : null
        };
        
        setGoods(processedData);
        setForm({
          ...data,
          start_date: data.start_date ? formatDateForInput(data.start_date) : '',
          end_date: data.end_date ? formatDateForInput(data.end_date) : '',
          category_id: data.category?.id || '',
          confirmation_requirements: data.confirmation_requirements || []
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
  
  // Добавляем функцию для создания примечания к категории
  const handleAddCategoryNote = async () => {
    if (!newNote.trim() || !form.category_id) return;
    
    try {
      setLoading(true);
      const noteData = {
        category_id: form.category_id,
        text: newNote.trim()
      };
      
      const response = await createCategoryNote(noteData);
      
      if (!response.error) {
        toast.success('Примечание добавлено');
        setNewNote('');
        
        // Обновляем данные товара для отображения нового примечания
        const updatedGoods = await getGoodsById(id);
        setGoods(updatedGoods);
      }
    } catch (error) {
      toast.error('Ошибка при добавлении примечания');
      console.error(error);
    } finally {
      setLoading(false);
    }
  };
  
  // Добавляем функцию для удаления примечания
  const handleDeleteCategoryNote = async (noteId) => {
    try {
      setLoading(true);
      const response = await deleteCategoryNote(noteId);
      
      if (!response.error) {
        toast.success('Примечание удалено');
        
        // Обновляем данные товара
        const updatedGoods = await getGoodsById(id);
        setGoods(updatedGoods);
      }
    } catch (error) {
      toast.error('Ошибка при удалении примечания');
      console.error(error);
    } finally {
      setLoading(false);
    }
  };
  
  // Добавим обработчики для требований подтверждения
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
  
  const handleRemoveRequirement = (id) => {
    setForm({
      ...form,
      confirmation_requirements: form.confirmation_requirements.filter(req => req.id !== id)
    });
  };
  
  const handleRequirementChange = (id, field, value) => {
    setForm({
      ...form,
      confirmation_requirements: form.confirmation_requirements.map(req => 
        req.id === id ? { ...req, [field]: value } : req
      )
    });
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
        
        {/* Блок с примечаниями к категории */}
        {form.category_id && (
          <div className="mt-6 mb-6">
            <h3 className={`text-lg font-semibold mb-3 ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
              Примечания к категории
            </h3>
            
            {/* Отображение существующих примечаний */}
            {goods?.category?.notes && goods.category.notes.length > 0 ? (
              <div className={`border rounded-lg p-4 mb-4 ${isDarkMode ? 'bg-gray-800 border-gray-700' : 'bg-gray-50 border-gray-200'}`}>
                <ul className="space-y-2">
                  {goods.category.notes.map(note => (
                    <li 
                      key={note.id} 
                      className={`p-3 rounded-md flex justify-between items-center ${
                        isDarkMode ? 'bg-gray-700 text-white' : 'bg-white text-gray-800 border border-gray-200'
                      }`}
                    >
                      <span>{note.text}</span>
                      <button
                        onClick={() => handleDeleteCategoryNote(note.id)}
                        className={`ml-2 p-1 rounded-full ${
                          isDarkMode ? 'text-gray-300 hover:bg-red-900' : 'text-gray-500 hover:bg-red-100'
                        }`}
                        title="Удалить примечание"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                          <path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
                        </svg>
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            ) : (
              <p className={`italic mb-4 ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                Нет примечаний
              </p>
            )}
            
            {/* Форма добавления нового примечания */}
            <div className="flex items-center">
              <input
                type="text"
                value={newNote}
                onChange={(e) => setNewNote(e.target.value)}
                placeholder="Добавить новое примечание..."
                className={`flex-grow p-2 border rounded-md ${
                  isDarkMode 
                    ? 'bg-gray-700 border-gray-600 text-white placeholder-gray-400' 
                    : 'bg-white border-gray-300 text-gray-900 placeholder-gray-400'
                }`}
              />
              <button
                onClick={handleAddCategoryNote}
                disabled={!newNote.trim() || !form.category_id}
                className={`ml-2 px-4 py-2 rounded-md ${
                  isDarkMode 
                    ? 'bg-blue-700 text-white hover:bg-blue-600 disabled:bg-gray-600' 
                    : 'bg-blue-600 text-white hover:bg-blue-700 disabled:bg-gray-300'
                } disabled:cursor-not-allowed`}
              >
                Добавить
              </button>
            </div>
          </div>
        )}
        
        {/* Добавим секцию для требований подтверждения после других полей */}
        <div className="mt-8">
          <h3 className={`text-xl font-medium mb-4 ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
            Требования для подтверждения покупки
          </h3>
          
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
      </div>
    </Layout>
  );
};

export default EditGoods; 