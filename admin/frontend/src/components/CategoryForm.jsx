import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useTelegram } from '../hooks/useTelegram';
import { useApi } from '../hooks/useApi';

const CategoryForm = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { isDarkMode } = useTelegram();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const { getCategoryById, createCategory, updateCategory } = useApi();
  
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    is_active: true
  });

  useEffect(() => {
    // Если есть id, значит это режим редактирования
    if (id) {
      const fetchCategoryData = async () => {
        setLoading(true);
        try {
          const response = await getCategoryById(id);
          setFormData({
            name: response.name,
            description: response.description || '',
            is_active: response.is_active
          });
          setLoading(false);
        } catch (err) {
          console.error('Ошибка при загрузке данных категории:', err);
          setError('Не удалось загрузить данные категории. Пожалуйста, попробуйте позже.');
          setLoading(false);
        }
      };
      
      fetchCategoryData();
    }
  }, [id, getCategoryById]);

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    
    try {
      const dataToSubmit = { ...formData };
      
      if (id) {
        // Обновление существующей категории
        await updateCategory(id, dataToSubmit);
      } else {
        // Создание новой категории
        await createCategory(dataToSubmit);
      }
      
      setLoading(false);
      navigate('/admin/categories');
    } catch (err) {
      console.error('Ошибка при сохранении категории:', err);
      setError('Не удалось сохранить категорию. Пожалуйста, проверьте введенные данные и попробуйте снова.');
      setLoading(false);
    }
  };

  const inputClass = `w-full p-2 border rounded-md ${
    isDarkMode ? 'bg-gray-700 border-gray-600 text-white' : 'bg-white border-gray-300 text-gray-900'
  }`;

  const labelClass = `block mb-2 font-medium ${
    isDarkMode ? 'text-white' : 'text-gray-700'
  }`;

  if (loading) {
    return (
      <div className="text-center py-10">
        <p className={isDarkMode ? 'text-white' : 'text-gray-800'}>Загрузка...</p>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto">
      <h1 className={`text-2xl font-bold mb-6 ${isDarkMode ? 'text-white' : 'text-gray-800'}`}>
        {id ? 'Редактирование категории' : 'Создание новой категории'}
      </h1>
      
      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4" role="alert">
          <p>{error}</p>
        </div>
      )}
      
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className={labelClass} htmlFor="name">Название категории</label>
          <input
            type="text"
            id="name"
            name="name"
            value={formData.name}
            onChange={handleChange}
            required
            className={inputClass}
          />
        </div>
        
        <div>
          <label className={labelClass} htmlFor="description">Описание (необязательно)</label>
          <textarea
            id="description"
            name="description"
            value={formData.description}
            onChange={handleChange}
            rows="3"
            className={inputClass}
          />
        </div>
        
        <div className="flex items-center">
          <input
            type="checkbox"
            id="is_active"
            name="is_active"
            checked={formData.is_active}
            onChange={handleChange}
            className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
          />
          <label htmlFor="is_active" className={`ml-2 ${isDarkMode ? 'text-white' : 'text-gray-700'}`}>
            Активна
          </label>
        </div>
        
        <div className="flex items-center space-x-4">
          <button
            type="submit"
            disabled={loading}
            className={`px-6 py-2 rounded-md ${
              isDarkMode 
                ? 'bg-blue-700 text-white hover:bg-blue-600' 
                : 'bg-blue-600 text-white hover:bg-blue-700'
            }`}
          >
            {loading ? 'Сохранение...' : id ? 'Обновить категорию' : 'Создать категорию'}
          </button>
          
          <button
            type="button"
            onClick={() => navigate('/admin/categories')}
            className={`px-6 py-2 rounded-md ${
              isDarkMode 
                ? 'bg-gray-700 text-white hover:bg-gray-600' 
                : 'bg-gray-200 text-gray-800 hover:bg-gray-300'
            }`}
          >
            Отмена
          </button>
        </div>
      </form>
    </div>
  );
};

export default CategoryForm; 