import { useState, useEffect } from 'react';
import { useTelegram } from '../hooks/useTelegram';
import { useApi } from '../hooks/useApi';
import UserHeader from '../components/UserHeader';
import toast from 'react-hot-toast';

const UserReservations = () => {
  const { isDarkMode, user, initData } = useTelegram();
  const { getUserReservations, cancelReservation, getGoodsById, submitConfirmationData } = useApi();
  const [reservations, setReservations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedReservation, setSelectedReservation] = useState(null);
  const [goodsDetails, setGoodsDetails] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [showConfirmationModal, setShowConfirmationModal] = useState(false);
  const [confirmationData, setConfirmationData] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [confirmationType, setConfirmationType] = useState('order'); // 'order' или 'delivery'
  
  useEffect(() => {
    fetchReservations();
  }, [initData]);
  
  const fetchReservations = async () => {
    try {
      setLoading(true);
      // Получаем бронирования со статусами "pending" и "active"
      const data = await getUserReservations(['pending', 'active']);
      setReservations(data || []);
    } catch (error) {
      console.error('Ошибка при загрузке бронирований:', error);
      toast.error('Не удалось загрузить ваши бронирования');
    } finally {
      setLoading(false);
    }
  };
  
  const handleCancelReservation = async (reservationId) => {
    try {
      await cancelReservation(reservationId);
      toast.success('Бронирование успешно отменено');
      // Обновляем список бронирований
      fetchReservations();
      // Закрываем модальное окно, если оно было открыто
      if (showModal) {
        setShowModal(false);
      }
    } catch (error) {
      console.error('Ошибка при отмене бронирования:', error);
      toast.error('Не удалось отменить бронирование');
    }
  };

  const handleConfirmReservation = async (reservationId) => {
    try {
      // Здесь будет запрос на подтверждение бронирования
      toast.success('Бронирование подтверждено');
      fetchReservations();
    } catch (error) {
      console.error('Ошибка при подтверждении бронирования:', error);
      toast.error('Не удалось подтвердить бронирование');
    }
  };
  
  const handleReservationClick = async (reservation) => {
    try {
      setSelectedReservation(reservation);
      const goodsData = await getGoodsById(reservation.goods_id);
      
      // Сохраняем данные о товаре в бронировании
      const updatedReservation = {
        ...reservation,
        goods: goodsData
      };
      setSelectedReservation(updatedReservation);
      setGoodsDetails(goodsData);
      setShowModal(true);
    } catch (error) {
      console.error('Ошибка при загрузке деталей товара:', error);
      toast.error('Не удалось загрузить детали товара');
    }
  };
  
  // Форматирование даты и времени
  const formatDateTime = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleString('ru-RU');
  };
  
  // Функция для расчета цены с учетом кэшбека
  const calculatePriceWithCashback = (price, cashbackPercent) => {
    if (!cashbackPercent) return price;
    const discountAmount = (price * cashbackPercent) / 100;
    return Math.round(price - discountAmount);
  };

  // Обновленная функция для обработки подтверждения в зависимости от статуса
  const handleConfirm = (reservation, event) => {
    // Предотвращаем всплытие события для случаев, когда кнопка внутри карточки
    if (event) {
      event.stopPropagation();
    }
    
    console.log("Нажата кнопка подтверждения для:", reservation);
    
    // Если нет данных о товаре, загрузим их
    if (!reservation.goods) {
      setLoading(true);
      toast.loading('Загрузка данных о товаре...');
      
      getGoodsById(reservation.goods_id)
        .then(goodsData => {
          setLoading(false);
          toast.dismiss();
          
          if (!goodsData) {
            toast.error('Не удалось загрузить данные о товаре');
            return;
          }
          
          const updatedReservation = {
            ...reservation,
            goods: goodsData
          };
          
          // Обновляем список бронирований с новыми данными
          setReservations(prev => 
            prev.map(item => 
              item.id === reservation.id ? updatedReservation : item
            )
          );
          
          // Продолжаем с обновленными данными
          processConfirmation(updatedReservation);
        })
        .catch(() => {
          setLoading(false);
          toast.dismiss();
          toast.error('Ошибка при загрузке данных о товаре');
        });
      return;
    }
    
    // Если goods уже есть, просто продолжаем
    processConfirmation(reservation);
  };

  // Обновленная функция обработки подтверждения с учетом типа
  const processConfirmation = (reservation) => {
    const goods = reservation.goods;
    console.log("Обрабатываем подтверждение для товара:", goods);
    
    // Определяем тип подтверждения на основе статуса бронирования
    const type = reservation.status === 'pending' ? 'order' : 'delivery';
    setConfirmationType(type);
    
    // Проверяем наличие требований подтверждения в товаре для соответствующего типа
    const requirementsKey = type === 'order' ? 'confirmation_requirements' : 'delivery_confirmation_requirements';
    
    if (!goods[requirementsKey] || goods[requirementsKey].length === 0) {
        console.log(`Нет требований подтверждения типа ${type}`);
        // Показываем информационное сообщение
        toast.info(type === 'order' 
            ? 'Для этого товара не требуется подтверждение выкупа. Пожалуйста, следуйте инструкциям по покупке.' 
            : 'Для этого товара не требуется подтверждение доставки. Пожалуйста, следуйте инструкциям.');
        // Закрываем модальное окно деталей
        setShowModal(false); 
        return;
    }
    
    console.log(`Найдены требования подтверждения типа ${type}:`, goods[requirementsKey]);
    
    // Создаем объект с начальными значениями для формы подтверждения
    const initialConfirmationData = {};
    
    goods[requirementsKey].forEach(req => {
        initialConfirmationData[req.id] = {
            type: req.type,
            title: req.title,
            value: '',
            file: null
        };
    });
    
    // Сохраняем данные для формы и открываем модальное окно
    setConfirmationData({
        reservationId: reservation.id,
        confirmationType: type,
        requirements: goods[requirementsKey],
        formData: initialConfirmationData
    });
    
    console.log(`Открываем форму подтверждения типа ${type}`);
    // Закрываем модальное окно деталей и открываем форму подтверждения
    setShowModal(false);
    setShowConfirmationModal(true);
  };

  // Обновленная функция отправки формы подтверждения
  const handleSubmitConfirmation = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    toast.loading('Отправка данных...');
    
    try {
      console.log(`Отправляем данные ${confirmationType === 'order' ? 'выкупа' : 'доставки'} для бронирования:`, confirmationData.reservationId);
      console.log('Содержимое формы:', confirmationData.formData);
      
      // Проверяем наличие всех необходимых данных
      const formData = confirmationData.formData;
      const allRequiredFieldsFilled = Object.values(formData).every(field => {
        if (field.type === 'text') return !!field.value;
        if (field.type === 'photo' || field.type === 'video') return !!field.file;
        return true;
      });
      
      if (!allRequiredFieldsFilled) {
        toast.dismiss();
        toast.error('Пожалуйста, заполните все обязательные поля');
        setIsSubmitting(false);
        return;
      }
      
      // Отправляем данные с указанием типа подтверждения
      const result = await submitConfirmationData(
        confirmationData.reservationId, 
        { ...confirmationData, confirmationType }
      );
      
      toast.dismiss();
      
      if (result.success) {
        // Закрываем модальное окно
        setShowConfirmationModal(false);
        
        if (confirmationType === 'delivery') {
          // Если это подтверждение доставки, удаляем бронирование из списка локально
          setReservations(prev => 
            prev.filter(r => r.id !== confirmationData.reservationId)
          );
          toast.success('Информация о доставке успешно отправлена');
        } else {
          // Если это подтверждение выкупа, обновляем статус бронирования на 'active'
          setReservations(prev => 
            prev.map(r => 
              r.id === confirmationData.reservationId 
                ? { ...r, status: 'active' } 
                : r
            )
          );
          toast.success('Информация для подтверждения выкупа успешно отправлена');
        }
      } else {
        toast.error(result.error || 'Ошибка при отправке данных');
      }
    } catch (error) {
      toast.dismiss();
      console.error('Ошибка при отправке данных:', error);
      toast.error('Ошибка при отправке данных подтверждения');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Обработчик изменения текстовых полей
  const handleTextChange = (fieldId, value) => {
    setConfirmationData(prev => ({
      ...prev,
      formData: {
        ...prev.formData,
        [fieldId]: {
          ...prev.formData[fieldId],
          value
        }
      }
    }));
  };

  // Обновляем функцию handleFileChange
  const handleFileChange = (fieldId, file, type) => {
    // Добавляем проверку размера файла
    const maxSizeInMB = type === 'photo' ? 5 : 20; // 5 МБ для фото, 20 МБ для видео
    const maxSizeInBytes = maxSizeInMB * 1024 * 1024;
    
    if (file && file.size > maxSizeInBytes) {
      toast.error(`Размер файла превышает ${maxSizeInMB} МБ. Пожалуйста, выберите файл меньшего размера.`);
      return; // Прерываем выполнение функции, не сохраняя файл
    }
    
    setConfirmationData(prev => ({
      ...prev,
      formData: {
        ...prev.formData,
        [fieldId]: {
          ...prev.formData[fieldId],
          file,
          value: file ? file.name : ''
        }
      }
    }));
  };

  return (
    <div className={`min-h-screen ${isDarkMode ? 'bg-gray-900 text-white' : 'bg-gray-50 text-gray-900'}`}>
      <UserHeader />
      
      <div className="max-w-4xl mx-auto px-4 py-4">
        <h1 className={`text-2xl font-bold mb-6 ${isDarkMode ? 'text-white' : 'text-gray-800'}`}>
          Мои бронирования
        </h1>
        
        {loading ? (
          <div className="text-center py-10">
            <svg className="animate-spin h-10 w-10 text-blue-500 mx-auto" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            <p className="mt-3">Загрузка бронирований...</p>
          </div>
        ) : reservations.length === 0 ? (
          <div className={`text-center py-12 rounded-xl ${isDarkMode ? 'bg-gray-800 text-gray-300' : 'bg-white text-gray-500'} shadow-md`}>
            <svg xmlns="http://www.w3.org/2000/svg" className="h-16 w-16 mx-auto mb-4 opacity-50" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
            </svg>
            <p className="text-lg font-medium mb-2">У вас нет активных бронирований</p>
            <p className="text-sm">Перейдите в каталог, чтобы забронировать товар</p>
          </div>
        ) : (
          <div className="grid gap-6 md:grid-cols-2">
            {reservations.map((reservation) => (
              <div 
                key={reservation.id} 
                className={`rounded-xl overflow-hidden shadow-lg transition-all duration-300 transform hover:-translate-y-1 hover:shadow-xl ${
                  isDarkMode ? 'bg-gray-800' : 'bg-white'
                }`}
              >
                {/* Верхняя часть карточки с изображением */}
                <div 
                  className="relative h-40 bg-cover bg-center cursor-pointer"
                  style={{
                    backgroundImage: reservation.goods_image ? `url(${reservation.goods_image})` : 'none',
                    backgroundColor: reservation.goods_image ? undefined : isDarkMode ? '#374151' : '#f3f4f6'
                  }}
                  onClick={() => handleReservationClick(reservation)}
                >
                  {!reservation.goods_image && (
                    <div className="flex items-center justify-center h-full">
                      <svg xmlns="http://www.w3.org/2000/svg" className={`h-16 w-16 ${isDarkMode ? 'text-gray-600' : 'text-gray-300'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                    </div>
                  )}
                  <div className={`absolute inset-0 ${reservation.goods_image ? 'bg-gradient-to-t from-black/80 to-transparent' : ''}`}></div>
                  
                  <div className="absolute bottom-0 left-0 right-0 p-4">
                    <h3 className="text-lg font-semibold text-white truncate drop-shadow-md">
                      {reservation.goods_name || `Товар #${reservation.goods_id}`}
                    </h3>
                  </div>
                </div>
                
                {/* Содержимое карточки */}
                <div className="p-5">
                  <div className="flex justify-between mb-3">
                    <div className="flex items-center">
                      <svg xmlns="http://www.w3.org/2000/svg" className={`h-5 w-5 mr-1.5 ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
                      </svg>
                      <span className={`text-sm ${isDarkMode ? 'text-gray-300' : 'text-gray-600'}`}>
                        {reservation.quantity} шт.
                      </span>
                    </div>
                    <div className="flex items-center">
                      <svg xmlns="http://www.w3.org/2000/svg" className={`h-5 w-5 mr-1.5 ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      <span className={`text-sm font-medium ${isDarkMode ? 'text-gray-200' : 'text-gray-700'}`}>
                        {reservation.goods_price} ₽
                      </span>
                    </div>
                  </div>
                  
                  {reservation.goods_cashback_percent > 0 && (
                    <div className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium mb-3 ${
                      isDarkMode ? 'bg-green-900/30 text-green-400' : 'bg-green-100 text-green-800'
                    }`}>
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
                      </svg>
                      Кэшбэк {reservation.goods_cashback_percent}%
                    </div>
                  )}
                  
                  <div className={`flex items-center mb-4 text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                    {formatDateTime(reservation.reserved_at)}
                  </div>
                  
                  {/* Обновленные кнопки действий в зависимости от статуса */}
                  <div className="p-4 flex justify-between items-center">
                    <div className={`px-3 py-1 rounded-full text-sm ${
                      reservation.status === 'pending' 
                        ? isDarkMode ? 'bg-yellow-800/30 text-yellow-400' : 'bg-yellow-100 text-yellow-800'
                        : isDarkMode ? 'bg-green-800/30 text-green-400' : 'bg-green-100 text-green-800'
                    }`}>
                      {reservation.status === 'pending' ? 'Ожидает выкупа' : 'Ожидает доставки'}
                    </div>
                    
                    <button 
                      onClick={(e) => handleConfirm(reservation, e)}
                      className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors duration-200 ${
                        reservation.status === 'pending'
                          ? isDarkMode ? 'bg-blue-600 hover:bg-blue-500 text-white' : 'bg-blue-600 hover:bg-blue-700 text-white'
                          : isDarkMode ? 'bg-green-600 hover:bg-green-500 text-white' : 'bg-green-600 hover:bg-green-700 text-white'
                      }`}
                    >
                      <span className="flex items-center">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                        {reservation.status === 'pending' ? 'Подтвердить выкуп' : 'Подтвердить доставку'}
                      </span>
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
      
      {/* Модальное окно с деталями товара */}
      {showModal && goodsDetails && selectedReservation && (
        <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4 transition-opacity duration-300">
          <div className={`rounded-lg max-w-xl w-full max-h-[90vh] overflow-y-auto shadow-2xl transform transition-all duration-300 ${isDarkMode ? 'bg-gray-800' : 'bg-white'}`}>
            <div className="relative">
              {goodsDetails.image && (
                <div className="relative h-64 bg-cover bg-center bg-no-repeat" style={{ backgroundImage: `url(${goodsDetails.image})` }}>
                  <div className="absolute inset-0 bg-gradient-to-t from-black/70 to-transparent"></div>
                  <button 
                    onClick={() => setShowModal(false)}
                    className="absolute top-4 right-4 bg-black/30 text-white rounded-full p-1.5 backdrop-blur-sm hover:bg-black/50 transition-colors duration-200"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                  
                  <div className="absolute bottom-0 left-0 right-0 p-6 text-white">
                    <h2 className="text-2xl font-bold mb-2 drop-shadow-md">
                      {goodsDetails.name}
                    </h2>
                    <div className="flex items-center">
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-900/30 text-blue-200 backdrop-blur-sm mr-2">
                        Артикул: {goodsDetails.article}
                      </span>
                      {goodsDetails.cashback_percent > 0 && (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-900/30 text-green-200 backdrop-blur-sm">
                          Кэшбэк: {goodsDetails.cashback_percent}%
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              )}
              
              {!goodsDetails.image && (
                <div className="relative h-32 bg-gray-100 dark:bg-gray-700 flex items-center justify-center">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-16 w-16 text-gray-400 dark:text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                  <button 
                    onClick={() => setShowModal(false)}
                    className="absolute top-4 right-4 bg-gray-200 dark:bg-gray-600 text-gray-600 dark:text-white rounded-full p-1.5 hover:bg-gray-300 dark:hover:bg-gray-500 transition-colors duration-200"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                  
                  <div className="absolute bottom-0 left-0 right-0 p-6">
                    <h2 className={`text-2xl font-bold mb-1 ${isDarkMode ? 'text-white' : 'text-gray-800'}`}>
                      {goodsDetails.name}
                    </h2>
                  </div>
                </div>
              )}
            </div>
            
            <div className="p-6">
              <div className="grid grid-cols-2 gap-6 mb-6">
                <div className={`rounded-lg p-4 ${isDarkMode ? 'bg-gray-700' : 'bg-gray-50'}`}>
                  <p className={`text-sm font-medium mb-1 ${isDarkMode ? 'text-gray-300' : 'text-gray-500'}`}>
                    Цена:
                  </p>
                  {goodsDetails.cashback_percent > 0 ? (
                    <div>
                      <p className={`text-2xl font-bold ${isDarkMode ? 'text-green-400' : 'text-green-600'}`}>
                        {calculatePriceWithCashback(goodsDetails.price, goodsDetails.cashback_percent)} ₽
                      </p>
                      <p className={`text-sm line-through ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                        {goodsDetails.price} ₽
                      </p>
                    </div>
                  ) : (
                    <p className={`text-2xl font-bold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                      {goodsDetails.price} ₽
                    </p>
                  )}
                </div>
                
                <div className={`rounded-lg p-4 ${isDarkMode ? 'bg-gray-700' : 'bg-gray-50'}`}>
                  <p className={`text-sm font-medium mb-1 ${isDarkMode ? 'text-gray-300' : 'text-gray-500'}`}>
                    Бронирование:
                  </p>
                  <p className={`text-lg font-medium ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                    {selectedReservation.quantity} шт.
                  </p>
                  <p className={`text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                    от {formatDateTime(selectedReservation.reserved_at)}
                  </p>
                </div>
              </div>
              
              {goodsDetails.purchase_guide && (
                <div className={`mb-6 p-4 rounded-lg ${isDarkMode ? 'bg-gray-700/50' : 'bg-blue-50'}`}>
                  <h3 className={`font-medium mb-2 flex items-center ${isDarkMode ? 'text-gray-200' : 'text-gray-800'}`}>
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    Инструкция по покупке:
                  </h3>
                  <p className={`text-sm ${isDarkMode ? 'text-gray-300' : 'text-gray-600'}`}>
                    {goodsDetails.purchase_guide}
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Модальное окно для формы подтверждения */}
      {showConfirmationModal && (
        <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50 p-4 transition-opacity duration-300">
          <div 
            className={`relative p-6 rounded-lg shadow-xl max-w-md w-full max-h-[90vh] overflow-y-auto transform transition-all duration-300 ease-in-out ${
              isDarkMode ? 'bg-gray-800 text-white' : 'bg-white text-gray-900'
            }`}
          >
            <button
              onClick={() => setShowConfirmationModal(false)}
              className={`absolute top-4 right-4 rounded-full p-1 transition-colors duration-200 ${
                isDarkMode 
                  ? 'text-gray-400 hover:text-white hover:bg-gray-700' 
                  : 'text-gray-500 hover:text-gray-900 hover:bg-gray-100'
              }`}
              aria-label="Закрыть"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
            
            <div className="mb-6">
              <h2 className={`text-xl font-bold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                {confirmationType === 'order' ? 'Подтверждение выкупа товара' : 'Подтверждение получения товара'}
              </h2>
              <p className={`mt-1 text-sm ${isDarkMode ? 'text-gray-300' : 'text-gray-500'}`}>
                Пожалуйста, заполните все необходимые поля для подтверждения
              </p>
            </div>
            
            <form onSubmit={handleSubmitConfirmation} className="space-y-5">
              {confirmationData.requirements && confirmationData.requirements.map(req => (
                <div key={req.id} className="relative">
                  <label className={`block mb-2 font-medium ${isDarkMode ? 'text-gray-200' : 'text-gray-700'}`}>
                    {req.title}
                  </label>
                  
                  {req.type === 'text' && (
                    <div className="relative">
                      <input
                        type="text"
                        className={`w-full px-4 py-3 border rounded-lg transition-colors duration-200 ${
                          isDarkMode 
                            ? 'bg-gray-700 border-gray-600 text-white focus:border-blue-500 focus:ring-1 focus:ring-blue-500' 
                            : 'bg-white border-gray-300 text-gray-900 focus:border-blue-500 focus:ring-1 focus:ring-blue-500'
                        }`}
                        placeholder={`Введите ${req.title.toLowerCase()}`}
                        value={confirmationData.formData[req.id]?.value || ''}
                        onChange={(e) => handleTextChange(req.id, e.target.value)}
                        required
                      />
                      <div className={`absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none ${
                        isDarkMode ? 'text-gray-400' : 'text-gray-500'
                      }`}>
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                          <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                        </svg>
                      </div>
                    </div>
                  )}
                  
                  {req.type === 'photo' && (
                    <div className={`border-2 border-dashed rounded-lg p-4 transition-colors ${
                      isDarkMode 
                        ? 'bg-gray-700 border-gray-600 hover:border-blue-500' 
                        : 'bg-gray-50 border-gray-300 hover:border-blue-500'
                    }`}>
                      <div className="space-y-2">
                        <div className="flex items-center justify-center">
                          {confirmationData.formData[req.id]?.file ? (
                            <div className="relative w-full">
                              <img 
                                src={URL.createObjectURL(confirmationData.formData[req.id].file)} 
                                alt="Предпросмотр" 
                                className="w-full h-48 object-contain rounded-lg mb-2"
                              />
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleFileChange(req.id, null, 'photo');
                                }}
                                className={`absolute top-2 right-2 rounded-full p-1 ${
                                  isDarkMode 
                                    ? 'bg-gray-800 text-white hover:bg-red-600' 
                                    : 'bg-white text-gray-700 hover:bg-red-500 hover:text-white'
                                }`}
                              >
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                                  <path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
                                </svg>
                              </button>
                            </div>
                          ) : (
                            <label className={`flex flex-col items-center justify-center w-full h-32 cursor-pointer ${
                              isDarkMode ? 'text-gray-300' : 'text-gray-600'
                            }`}>
                              <svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10 mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                              </svg>
                              <span className="text-sm font-medium">Нажмите для загрузки фото</span>
                              <span className="text-xs mt-1">JPG, PNG, WebP до 5 МБ</span>
                              <input
                                type="file"
                                accept="image/*"
                                className="hidden"
                                onChange={(e) => handleFileChange(req.id, e.target.files[0], 'photo')}
                                required={!confirmationData.formData[req.id]?.file}
                              />
                            </label>
                          )}
                        </div>
                      </div>
                    </div>
                  )}
                  
                  {req.type === 'video' && (
                    <div className={`border-2 border-dashed rounded-lg p-4 transition-colors ${
                      isDarkMode 
                        ? 'bg-gray-700 border-gray-600 hover:border-blue-500' 
                        : 'bg-gray-50 border-gray-300 hover:border-blue-500'
                    }`}>
                      <div className="space-y-2">
                        <div className="flex items-center justify-center">
                          {confirmationData.formData[req.id]?.file ? (
                            <div className="relative w-full">
                              <video 
                                src={URL.createObjectURL(confirmationData.formData[req.id].file)} 
                                controls 
                                className="w-full rounded-lg mb-2"
                              />
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleFileChange(req.id, null, 'video');
                                }}
                                className={`absolute top-2 right-2 rounded-full p-1 ${
                                  isDarkMode 
                                    ? 'bg-gray-800 text-white hover:bg-red-600' 
                                    : 'bg-white text-gray-700 hover:bg-red-500 hover:text-white'
                                }`}
                              >
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                                  <path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
                                </svg>
                              </button>
                            </div>
                          ) : (
                            <label className={`flex flex-col items-center justify-center w-full h-32 cursor-pointer ${
                              isDarkMode ? 'text-gray-300' : 'text-gray-600'
                            }`}>
                              <svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10 mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                              </svg>
                              <span className="text-sm font-medium">Нажмите для загрузки видео</span>
                              <span className="text-xs mt-1">MP4, WebM, AVI до 20 МБ</span>
                              <input
                                type="file"
                                accept="video/*"
                                className="hidden"
                                onChange={(e) => handleFileChange(req.id, e.target.files[0], 'video')}
                                required={!confirmationData.formData[req.id]?.file}
                              />
                            </label>
                          )}
                        </div>
                      </div>
                    </div>
                  )}
                  
                  <p className={`mt-1 text-xs ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                    {req.type === 'text' ? 'Введите текстовые данные' : req.type === 'photo' ? 'Загрузите фотографию' : 'Загрузите видео'}
                  </p>
                </div>
              ))}
              
              <div className="flex justify-end space-x-3 mt-8 pt-4 border-t border-gray-200 dark:border-gray-700">
                <button
                  type="button"
                  onClick={() => setShowConfirmationModal(false)}
                  className={`px-4 py-2 rounded-lg transition-colors duration-200 ${
                    isDarkMode 
                      ? 'bg-gray-700 text-white hover:bg-gray-600' 
                      : 'bg-gray-200 text-gray-800 hover:bg-gray-300'
                  }`}
                  disabled={isSubmitting}
                >
                  <span className="flex items-center">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-1.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                    Отмена
                  </span>
                </button>
                
                <button
                  type="submit"
                  className={`px-5 py-2 rounded-lg transition-all duration-200 transform ${
                    isDarkMode 
                      ? 'bg-green-600 text-white hover:bg-green-500 active:scale-95' 
                      : 'bg-green-600 text-white hover:bg-green-500 active:scale-95'
                  } ${isSubmitting ? 'opacity-70 cursor-wait' : ''}`}
                  disabled={isSubmitting}
                >
                  <span className="flex items-center">
                    {isSubmitting ? (
                      <>
                        <svg className="animate-spin h-4 w-4 mr-2" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        Отправка...
                      </>
                    ) : (
                      <>
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-1.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                        {confirmationType === 'order' ? 'Подтвердить выкуп' : 'Подтвердить получение'}
                      </>
                    )}
                  </span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default UserReservations; 