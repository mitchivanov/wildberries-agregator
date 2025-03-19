import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useApi } from '../hooks/useApi';
import { useTelegram } from '../hooks/useTelegram';
import toast from 'react-hot-toast';

const CategoryList = () => {
  const { getCategories, deleteCategory } = useApi();
  const { isDarkMode, webApp } = useTelegram();
  const navigate = useNavigate();

  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [expandedCategoryId, setExpandedCategoryId] = useState(null);

  // Загрузка категорий при монтировании компонента
  const loadCategories = async () => {
    setLoading(true);
    try {
      const data = await getCategories();
      if (data) setCategories(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadCategories();

    // Настраиваем главную кнопку Telegram если доступно
    if (webApp) {
      webApp.MainButton.setParams({
        text: 'Добавить категорию',
        color: '#0B63F6',
        text_color: '#ffffff'
      });

      const handleMainButtonClick = () => {
        navigate('/admin/categories/create');
      };

      webApp.MainButton.onClick(handleMainButtonClick);
      webApp.MainButton.show();

      return () => {
        webApp.MainButton.offClick(handleMainButtonClick);
        webApp.MainButton.hide();
      };
    }
  }, [webApp, navigate]);

  // Удаление категории
  const handleDelete = async (id) => {
    try {
      await deleteCategory(id);
      setCategories(categories.filter(item => item.id !== id));
      toast.success('Категория удалена');
    } catch (err) {
      console.error('Ошибка при удалении категории:', err);
      toast.error('Не удалось удалить категорию');
    }
  };

  // Переключение состояния развернутости категории
  const toggleCategory = (id) => {
    setExpandedCategoryId(expandedCategoryId === id ? null : id);
  };

  const themeClasses = isDarkMode ? 'bg-gray-800 text-white' : 'bg-white text-gray-800';

  if (loading) {
    return (
      <div className="flex justify-center items-center py-12">
        <div className="animate-spin rounded-full h-16 w-16 border-t-2 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 text-red-500">
        <h2 className="text-xl font-bold mb-2">Ошибка при загрузке категорий</h2>
        <p>{error}</p>
        <button 
          onClick={loadCategories}
          className="mt-4 bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600"
        >
          Попробовать снова
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className={`text-2xl font-bold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
          Категории товаров
        </h1>
        <Link 
          to="/admin/categories/create" 
          className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700"
        >
          Добавить категорию
        </Link>
      </div>

      {categories.length > 0 ? (
        <div className="space-y-4">
          {categories.map((category) => (
            <div 
              key={category.id} 
              className={`border rounded-lg overflow-hidden shadow-sm ${
                isDarkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'
              }`}
            >
              <div 
                className={`p-4 flex justify-between items-center cursor-pointer ${
                  expandedCategoryId === category.id 
                    ? (isDarkMode ? 'bg-gray-700' : 'bg-gray-100') 
                    : ''
                }`}
                onClick={() => toggleCategory(category.id)}
              >
                <div className="flex items-center">
                  <span className={`font-medium ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                    {category.name}
                  </span>
                  <span className={`ml-2 text-xs px-2 py-1 rounded ${
                    category.is_active 
                      ? (isDarkMode ? 'bg-green-800 text-green-100' : 'bg-green-100 text-green-800') 
                      : (isDarkMode ? 'bg-red-800 text-red-100' : 'bg-red-100 text-red-800')
                  }`}>
                    {category.is_active ? 'Активна' : 'Неактивна'}
                  </span>
                </div>
                <div className="flex space-x-2">
                  <Link 
                    to={`/admin/categories/edit/${category.id}`}
                    className="text-blue-500 hover:text-blue-700"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                      <path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z" />
                    </svg>
                  </Link>
                  <button 
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDelete(category.id);
                    }}
                    className="text-red-500 hover:text-red-700"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
                    </svg>
                  </button>
                </div>
              </div>
              
              {expandedCategoryId === category.id && (
                <div className={`p-4 border-t ${isDarkMode ? 'border-gray-700' : 'border-gray-200'}`}>
                  {category.description && (
                    <div className="mb-4">
                      <h3 className={`text-sm font-medium ${isDarkMode ? 'text-gray-300' : 'text-gray-600'}`}>
                        Описание:
                      </h3>
                      <p className={isDarkMode ? 'text-white' : 'text-gray-800'}>
                        {category.description}
                      </p>
                    </div>
                  )}
                  
                  <div className="mt-4">
                    <h3 className={`text-sm font-medium mb-2 ${isDarkMode ? 'text-gray-300' : 'text-gray-600'}`}>
                      Примечания:
                    </h3>
                    {category.notes && category.notes.length > 0 ? (
                      <ul className={`space-y-2 ${isDarkMode ? 'text-white' : 'text-gray-800'}`}>
                        {category.notes.map(note => (
                          <li key={note.id} className={`p-2 rounded ${isDarkMode ? 'bg-gray-700' : 'bg-gray-100'}`}>
                            {note.text}
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className={`italic ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                        Нет примечаний
                      </p>
                    )}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      ) : (
        <div className={`text-center py-10 ${isDarkMode ? 'text-gray-300' : 'text-gray-600'}`}>
          <p>Категории не найдены</p>
        </div>
      )}
    </div>
  );
};

export default CategoryList; 