import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Formik, Form, Field, ErrorMessage } from 'formik';
import * as Yup from 'yup';
import { useApi } from '../hooks/useApi';
import { useTelegram } from '../hooks/useTelegram';
import Layout from '../components/Layout';
import toast from 'react-hot-toast';
import GoodsAvailability from '../components/GoodsAvailability';

// Схема валидации с Yup
const GoodsSchema = Yup.object().shape({
  name: Yup.string().required('Обязательное поле'),
  price: Yup.number().positive('Должно быть положительным числом').required('Обязательное поле'),
  cashback_percent: Yup.number().min(0, 'Минимальное значение 0').max(100, 'Максимальное значение 100'),
  article: Yup.string().required('Обязательное поле'),
  url: Yup.string().url('Введите корректный URL').required('Обязательное поле'),
  image: Yup.string().url('Введите корректный URL изображения').required('Обязательное поле'),
  is_active: Yup.boolean(),
  purchase_guide: Yup.string(),
  start_date: Yup.date().nullable(),
  end_date: Yup.date().nullable().min(
    Yup.ref('start_date'),
    'Дата окончания должна быть позже даты начала'
  ),
  min_daily: Yup.number().positive('Должно быть положительным числом').required('Обязательное поле'),
  max_daily: Yup.number().positive('Должно быть положительным числом').required('Обязательное поле')
    .min(Yup.ref('min_daily'), 'Должно быть больше или равно минимальному количеству'),
});

const EditGoods = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { getGoodsById, updateGoods } = useApi();
  const { isDarkMode } = useTelegram();
  
  const [goods, setGoods] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showAvailability, setShowAvailability] = useState(false);
  
  // Загрузка товара при монтировании компонента
  useEffect(() => {
    const fetchGoods = async () => {
      try {
        const data = await getGoodsById(id);
        setGoods(data);
      } catch (err) {
        setError(err.message);
        toast.error(`Ошибка при загрузке товара: ${err.message}`);
      } finally {
        setLoading(false);
      }
    };
    
    fetchGoods();
  }, [id, getGoodsById]);
  
  const handleSubmit = async (values, { setSubmitting }) => {
    try {
      // Форматирование дат перед отправкой
      const formattedValues = {
        ...values,
        start_date: values.start_date ? new Date(values.start_date).toISOString() : null,
        end_date: values.end_date ? new Date(values.end_date).toISOString() : null,
      };
      
      await updateGoods(id, formattedValues);
      toast.success('Товар успешно обновлен');
      navigate('/admin/goods');
    } catch (err) {
      toast.error(`Ошибка при обновлении товара: ${err.message}`);
    } finally {
      setSubmitting(false);
    }
  };
  
  if (loading) {
    return (
      <Layout>
        <div className="text-center py-10">
          <svg className="animate-spin h-10 w-10 text-blue-500 mx-auto" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
          <p className={`mt-2 ${isDarkMode ? 'text-gray-300' : 'text-gray-600'}`}>Загрузка...</p>
        </div>
      </Layout>
    );
  }
  
  if (error) {
    return (
      <Layout>
        <div className="text-center py-10">
          <p className="text-red-500">Ошибка: {error}</p>
          <button 
            onClick={() => navigate('/admin/goods')} 
            className="mt-4 btn btn-secondary"
          >
            Вернуться к списку товаров
          </button>
        </div>
      </Layout>
    );
  }
  
  if (!goods) {
    return (
      <Layout>
        <div className="text-center py-10">
          <p className={isDarkMode ? 'text-gray-300' : 'text-gray-600'}>Товар не найден</p>
          <button 
            onClick={() => navigate('/admin/goods')} 
            className="mt-4 btn btn-secondary"
          >
            Вернуться к списку товаров
          </button>
        </div>
      </Layout>
    );
  }
  
  // Форматирование дат для отображения в форме
  const initialValues = {
    ...goods,
    start_date: goods.start_date ? new Date(goods.start_date).toISOString().split('T')[0] : '',
    end_date: goods.end_date ? new Date(goods.end_date).toISOString().split('T')[0] : '',
  };
  
  return (
    <Layout>
      <div className="space-y-8">
        <h1 className={`text-2xl font-bold ${isDarkMode ? 'text-white' : 'text-gray-800'}`}>
          Редактирование товара
        </h1>
        
        {loading ? (
          <div className="text-center py-10">
            <svg className="animate-spin h-10 w-10 text-blue-500 mx-auto" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            <p className={`mt-2 ${isDarkMode ? 'text-gray-300' : 'text-gray-600'}`}>Загрузка...</p>
          </div>
        ) : (
          <>
            <div className={`p-6 rounded-lg shadow ${isDarkMode ? 'bg-gray-800' : 'bg-white'}`}>
              <Formik
                initialValues={initialValues}
                validationSchema={GoodsSchema}
                onSubmit={handleSubmit}
              >
                {({ isSubmitting, errors, touched }) => (
                  <Form className="space-y-6">
                    <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
                      <div>
                        <label htmlFor="name" className="form-label">Название товара</label>
                        <Field id="name" name="name" type="text" className="form-input" />
                        <ErrorMessage name="name" component="div" className="form-error" />
                      </div>
                      
                      <div>
                        <label htmlFor="article" className="form-label">Артикул</label>
                        <Field id="article" name="article" type="text" className="form-input" />
                        <ErrorMessage name="article" component="div" className="form-error" />
                      </div>
                    </div>
                    
                    <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
                      <div>
                        <label htmlFor="price" className="form-label">Цена (руб.)</label>
                        <Field id="price" name="price" type="number" className="form-input" />
                        <ErrorMessage name="price" component="div" className="form-error" />
                      </div>
                      
                      <div>
                        <label htmlFor="cashback_percent" className="form-label">Кэшбэк (%)</label>
                        <Field id="cashback_percent" name="cashback_percent" type="number" className="form-input" />
                        <ErrorMessage name="cashback_percent" component="div" className="form-error" />
                      </div>
                    </div>
                    
                    <div>
                      <label htmlFor="url" className="form-label">URL товара на Wildberries</label>
                      <Field id="url" name="url" type="text" className="form-input" />
                      <ErrorMessage name="url" component="div" className="form-error" />
                    </div>
                    
                    <div>
                      <label htmlFor="image" className="form-label">URL изображения</label>
                      <Field id="image" name="image" type="text" className="form-input" />
                      <ErrorMessage name="image" component="div" className="form-error" />
                    </div>
                    
                    <div>
                      <label htmlFor="purchase_guide" className="form-label">Инструкция по покупке</label>
                      <Field as="textarea" id="purchase_guide" name="purchase_guide" rows="4" className="form-input" />
                      <ErrorMessage name="purchase_guide" component="div" className="form-error" />
                    </div>
                    
                    <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
                      <div>
                        <label htmlFor="start_date" className="form-label">Дата начала</label>
                        <Field id="start_date" name="start_date" type="date" className="form-input" />
                        <ErrorMessage name="start_date" component="div" className="form-error" />
                      </div>
                      
                      <div>
                        <label htmlFor="end_date" className="form-label">Дата окончания</label>
                        <Field id="end_date" name="end_date" type="date" className="form-input" />
                        <ErrorMessage name="end_date" component="div" className="form-error" />
                      </div>
                    </div>
                    
                    <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
                      <div>
                        <label htmlFor="min_daily" className="form-label">Мин. количество в день</label>
                        <Field id="min_daily" name="min_daily" type="number" className="form-input" />
                        <ErrorMessage name="min_daily" component="div" className="form-error" />
                      </div>
                      
                      <div>
                        <label htmlFor="max_daily" className="form-label">Макс. количество в день</label>
                        <Field id="max_daily" name="max_daily" type="number" className="form-input" />
                        <ErrorMessage name="max_daily" component="div" className="form-error" />
                      </div>
                    </div>
                    
                    <div>
                      <label className="flex items-center">
                        <Field type="checkbox" name="is_active" className="form-checkbox mr-2" />
                        <span className="form-label">Активный товар</span>
                      </label>
                    </div>
                    
                    <div className="flex justify-end space-x-3">
                      <button
                        type="button"
                        onClick={() => navigate('/admin/goods')}
                        className="btn btn-secondary"
                      >
                        Отмена
                      </button>
                      <button
                        type="submit"
                        disabled={isSubmitting}
                        className="btn btn-primary"
                      >
                        {isSubmitting ? 'Сохранение...' : 'Сохранить'}
                      </button>
                    </div>
                  </Form>
                )}
              </Formik>
            </div>
            
            <div className={`p-6 rounded-lg shadow ${isDarkMode ? 'bg-gray-800' : 'bg-white'}`}>
              <h2 className={`text-xl font-semibold mb-4 ${isDarkMode ? 'text-white' : 'text-gray-800'}`}>
                Доступность и бронирования
              </h2>
              <GoodsAvailability 
                dailyAvailability={goods.daily_availability || []} 
                reservations={goods.reservations || []} 
              />
            </div>
          </>
        )}
      </div>
    </Layout>
  );
};

export default EditGoods; 