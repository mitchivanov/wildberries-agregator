import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useFormik } from 'formik';
import * as Yup from 'yup';
import { useApi } from '../hooks/useApi';
import { useTelegram } from '../hooks/useTelegram';
import toast from 'react-hot-toast';

const GoodsForm = ({ isEditing = false }) => {
  const navigate = useNavigate();
  const { id } = useParams();
  const { getGoodsById, createGoods, updateGoods, loading, error } = useApi();
  const { isDarkMode, webApp } = useTelegram();
  const [initialLoading, setInitialLoading] = useState(isEditing);

  const validationSchema = Yup.object({
    name: Yup.string().required('Название обязательно'),
    price: Yup.number().required('Цена обязательна').min(0, 'Цена не может быть отрицательной'),
    article: Yup.string().required('Артикул обязателен'),
    image: Yup.string().url('Должен быть валидный URL').required('URL изображения обязателен'),
    is_active: Yup.boolean()
  });

  const formik = useFormik({
    initialValues: {
      name: '',
      price: 0,
      article: '',
      image: '',
      is_active: true
    },
    validationSchema,
    onSubmit: async (values) => {
      let success;
      
      if (isEditing) {
        success = await updateGoods(id, values);
        if (success) {
          toast.success('Товар успешно обновлен');
          navigate('/goods');
        }
      } else {
        success = await createGoods(values);
        if (success) {
          toast.success('Товар успешно создан');
          navigate('/goods');
        }
      }
    }
  });

  useEffect(() => {
    if (isEditing && id) {
      const fetchGoods = async () => {
        try {
          const data = await getGoodsById(id);
          if (data) {
            formik.setValues({
              name: data.name,
              price: data.price,
              article: data.article,
              image: data.image,
              is_active: data.is_active
            });
          }
        } catch (err) {
          toast.error(`Ошибка загрузки данных: ${err.message}`);
        } finally {
          setInitialLoading(false);
        }
      };
      
      fetchGoods();
    }
  }, [isEditing, id, getGoodsById]);

  // Интеграция с Telegram WebApp
  useEffect(() => {
    if (webApp) {
      // Настраиваем главную кнопку Telegram
      webApp.MainButton.setParams({
        text: isEditing ? 'Сохранить товар' : 'Создать товар',
        color: '#0B63F6',
        text_color: '#ffffff'
      });
      
      if (!formik.isValid) {
        webApp.MainButton.disable();
      } else {
        webApp.MainButton.enable();
      }
      
      const handleMainButtonClick = () => {
        formik.handleSubmit();
      };
      
      webApp.MainButton.onClick(handleMainButtonClick);
      webApp.MainButton.show();
      
      return () => {
        webApp.MainButton.offClick(handleMainButtonClick);
        webApp.MainButton.hide();
      };
    }
  }, [webApp, formik.isValid, isEditing]);
  
  // При изменении значений формы проверяем валидность для кнопки Telegram
  useEffect(() => {
    if (webApp && formik.dirty) {
      if (formik.isValid) {
        webApp.MainButton.enable();
      } else {
        webApp.MainButton.disable();
      }
    }
  }, [formik.values, formik.isValid, formik.dirty, webApp]);

  // Вспомогательная функция для рендеринга полей формы
  const renderField = (name, label, type = 'text') => {
    const field = formik.getFieldProps(name);
    const meta = formik.getFieldMeta(name);
    
    return (
      <div>
        <label 
          htmlFor={name} 
          className={`block text-sm font-medium mb-1 ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}
        >
          {label}
        </label>
        <input
          id={name}
          type={type}
          {...field}
          className={`w-full rounded border px-3 py-2 focus:outline-none focus:ring-1 ${
            isDarkMode 
              ? 'bg-gray-700 border-gray-600 text-white focus:border-blue-400 focus:ring-blue-400' 
              : 'border-gray-300 focus:border-blue-500 focus:ring-blue-500'
          } ${meta.error && meta.touched ? 'border-red-500' : ''}`}
        />
        {meta.error && meta.touched && (
          <p className={`mt-1 text-sm ${isDarkMode ? 'text-red-400' : 'text-red-600'}`}>
            {meta.error}
          </p>
        )}
      </div>
    );
  };

  if (initialLoading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  return (
    <div className={`max-w-2xl mx-auto ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
      <h1 className="text-2xl font-bold mb-6">
        {isEditing ? 'Редактирование товара' : 'Создание нового товара'}
      </h1>
      
      {error && (
        <div className={`mb-4 p-4 rounded-md ${isDarkMode ? 'bg-red-900 text-red-100' : 'bg-red-100 text-red-700'}`}>
          {error}
        </div>
      )}
      
      <form onSubmit={formik.handleSubmit}>
        <div className="grid grid-cols-1 gap-6 mb-6">
          {renderField('name', 'Название')}
          {renderField('price', 'Цена', 'number')}
          {renderField('article', 'Артикул')}
          {renderField('image', 'URL изображения')}
          
          <div>
            <div className="flex items-center">
              <input
                id="is_active"
                name="is_active"
                type="checkbox"
                className={`h-4 w-4 rounded focus:ring-offset-0 ${
                  isDarkMode 
                    ? 'text-blue-500 border-gray-600 bg-gray-700 focus:ring-blue-600' 
                    : 'text-blue-600 border-gray-300 focus:ring-blue-500'
                }`}
                {...formik.getFieldProps('is_active')}
                checked={formik.values.is_active}
              />
              <label htmlFor="is_active" className={`ml-2 block text-sm ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                Активен
              </label>
            </div>
          </div>
          
          {formik.values.image && (
            <div className="mt-2">
              <p className={`text-sm font-medium mb-1 ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                Предпросмотр изображения:
              </p>
              <div className="mt-1 w-full h-48 flex items-center justify-center border rounded-md overflow-hidden">
                <img 
                  src={formik.values.image} 
                  alt="Предпросмотр товара" 
                  className="max-h-full max-w-full object-contain"
                  onError={(e) => {
                    e.target.onerror = null;
                    e.target.src = "https://via.placeholder.com/400x300?text=Ошибка+изображения";
                  }}
                />
              </div>
            </div>
          )}
        </div>
        
        {/* Показываем обычные кнопки формы только если нет Telegram WebApp */}
        {!webApp && (
          <div className="flex space-x-4">
            <button
              type="submit"
              className={`px-4 py-2 rounded font-medium focus:outline-none focus:ring-2 focus:ring-offset-2 ${
                isDarkMode 
                  ? 'bg-blue-700 text-white hover:bg-blue-600 focus:ring-blue-500' 
                  : 'bg-blue-600 text-white hover:bg-blue-700 focus:ring-blue-500'
              }`}
              disabled={loading}
            >
              {loading ? 'Сохранение...' : isEditing ? 'Обновить товар' : 'Создать товар'}
            </button>
            <button
              type="button"
              className={`px-4 py-2 rounded font-medium focus:outline-none focus:ring-2 focus:ring-offset-2 ${
                isDarkMode 
                  ? 'bg-gray-700 text-gray-200 hover:bg-gray-600 focus:ring-gray-500' 
                  : 'bg-gray-200 text-gray-700 hover:bg-gray-300 focus:ring-gray-500'
              }`}
              onClick={() => navigate('/goods')}
            >
              Отмена
            </button>
          </div>
        )}
      </form>
    </div>
  );
};

export default GoodsForm; 