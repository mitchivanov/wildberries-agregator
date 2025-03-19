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
  const { getCategoryById, createCategory, updateCategory, getCategoryNotes, createCategoryNote, deleteCategoryNote } = useApi();
  
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    is_active: true,
    created_at: null,
    updated_at: null
  });
  
  const [notes, setNotes] = useState([]);
  const [newNote, setNewNote] = useState('');

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
            is_active: response.is_active,
            created_at: response.created_at || null,
            updated_at: response.updated_at || null
          });
          
          // Загружаем примечания категории
          if (response.notes) {
            setNotes(response.notes || []);
          } else {
            setNotes([]);
          }
          
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
      // Создаем копию данных для отправки, убираем метаданные для создания новой категории
      const dataToSubmit = { 
        name: formData.name,
        description: formData.description,
        is_active: formData.is_active
      };
      
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

  // Добавление нового примечания
  const handleAddNote = async (e) => {
    e.preventDefault();
    if (!newNote.trim()) return;
    
    try {
      const noteData = {
        category_id: parseInt(id),
        text: newNote.trim()
      };
      
      const response = await createCategoryNote(noteData);
      setNotes([...notes, response]);
      setNewNote('');
    } catch (err) {
      console.error('Ошибка при добавлении примечания:', err);
      setError('Не удалось добавить примечание. Пожалуйста, попробуйте позже.');
    }
  };
  
  // Удаление примечания
  const handleDeleteNote = async (noteId) => {
    try {
      await deleteCategoryNote(noteId);
      setNotes(notes.filter(note => note.id !== noteId));
    } catch (err) {
      console.error('Ошибка при удалении примечания:', err);
      setError('Не удалось удалить примечание. Пожалуйста, попробуйте позже.');
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
        
        {/* Секция с примечаниями (только для редактирования существующей категории) */}
        {id && (
          <div className="mt-8">
            <h2 className={`text-xl font-semibold mb-4 ${isDarkMode ? 'text-white' : 'text-gray-800'}`}>
              Примечания категории
            </h2>
            
            {/* Список существующих примечаний */}
            <div className="space-y-2 mb-4">
              {notes.length > 0 ? (
                notes.map(note => (
                  <div 
                    key={note.id} 
                    className={`flex justify-between items-start p-3 rounded-md ${
                      isDarkMode ? 'bg-gray-700' : 'bg-gray-100'
                    }`}
                  >
                    <p className={isDarkMode ? 'text-white' : 'text-gray-800'}>
                      {note.text}
                    </p>
                    <button
                      type="button"
                      onClick={() => handleDeleteNote(note.id)}
                      className="text-red-500 hover:text-red-700 ml-2"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
                      </svg>
                    </button>
                  </div>
                ))
              ) : (
                <p className={`italic ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                  Нет примечаний
                </p>
              )}
            </div>
            
            {/* Форма добавления нового примечания */}
            <div className="flex mt-4">
              <input
                type="text"
                value={newNote}
                onChange={(e) => setNewNote(e.target.value)}
                placeholder="Добавить новое примечание..."
                className={`flex-grow ${inputClass}`}
              />
              <button
                type="button"
                onClick={handleAddNote}
                disabled={!newNote.trim()}
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
        
        <div className="flex items-center space-x-4 mt-6">
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