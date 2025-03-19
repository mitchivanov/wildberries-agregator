import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useApi } from '../hooks/useApi';
import { useTelegram } from '../hooks/useTelegram';
import toast from 'react-hot-toast';
import UserHeader from '../components/UserHeader';

const GoodsDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { getGoodsById, reserveGoods, loading, maskArticle } = useApi();
  const { isDarkMode, webApp, user } = useTelegram();
  
  const [goods, setGoods] = useState(null);
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [availableToday, setAvailableToday] = useState(0);
  const [showInstructions, setShowInstructions] = useState(false);
  
  useEffect(() => {
    loadGoodsDetails();
    
    // Настраиваем кнопку "Назад" в WebApp Telegram
    if (webApp) {
      webApp.BackButton.show();
      webApp.BackButton.onClick(() => navigate(-1));
      
      return () => {
        webApp.BackButton.offClick(() => navigate(-1));
        webApp.BackButton.hide();
      };
    }
  }, [webApp, navigate, id]);
  
  const loadGoodsDetails = async () => {
    try {
      const result = await getGoodsById(id);
      if (result) {
        setGoods(result);
        // Получаем доступное количество товара на сегодня
        if (result.daily_availability && result.daily_availability.length > 0) {
          const today = new Date().toISOString().split('T')[0];
          const todayAvailability = result.daily_availability.find(item => 
            item.date.split('T')[0] === today
          );
          setAvailableToday(todayAvailability ? todayAvailability.available_quantity : 0);
        }
      }
    } catch (error) {
      console.error('Ошибка при загрузке товара:', error);
      toast.error('Не удалось загрузить информацию о товаре');
    }
  };
  
  // Функция для расчета цены с учетом кэшбека
  const calculatePriceWithCashback = (price, cashbackPercent) => {
    if (!cashbackPercent) return price;
    const discountAmount = (price * cashbackPercent) / 100;
    return Math.round(price - discountAmount);
  };
  
  const openConfirmation = () => {
    if (!user) {
      toast.error('Для бронирования товара необходимо открыть приложение через Telegram');
      return;
    }
    setShowConfirmation(true);
  };
  
  const handleReserve = async () => {
    try {
      // Всегда бронируем 1 товар
      const result = await reserveGoods(goods.id, 1);
      
      if (result.error) {
        // Если вернулась ошибка из API
        toast.error(`Ошибка: ${result.message}`);
        setShowConfirmation(false);
        return;
      }
      
      setShowConfirmation(false);
      setShowInstructions(true);
      toast.success('Товар успешно забронирован! Проверьте сообщение в Telegram');
    } catch (error) {
      console.error('Ошибка при бронировании:', error);
      toast.error('Не удалось забронировать товар');
      setShowConfirmation(false);
    }
  };
  
  if (loading || !goods) {
    return (
      <div className="text-center py-20">
        <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-blue-500 mx-auto"></div>
        <p className={`mt-4 ${isDarkMode ? 'text-gray-300' : 'text-gray-600'}`}>
          Загрузка информации о товаре...
        </p>
      </div>
    );
  }
  
  return (
    <div className={`min-h-screen ${isDarkMode ? 'bg-gray-900 text-white' : 'bg-gray-50 text-gray-900'}`}>
      <UserHeader />
      
      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className={`overflow-hidden rounded-lg shadow ${isDarkMode ? 'bg-gray-800' : 'bg-white'}`}>
          <div className="md:flex">
            <div className="md:flex-shrink-0 md:w-1/2">
              <img
                className="h-80 w-full object-contain md:h-full"
                src={goods.image}
                alt={goods.name}
                onError={(e) => {
                  e.target.onerror = null;
                  e.target.src = 'https://via.placeholder.com/400x400?text=Нет+изображения';
                }}
              />
            </div>
            
            <div className="p-6 md:w-1/2">
              <h1 className={`text-2xl font-bold mb-2 ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                {goods.name}
              </h1>
              
              <p className={`text-sm mb-4 ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                Артикул: {maskArticle(goods.article)}
              </p>
              
              {/* Цена товара */}
              <div className="mb-6">
                {goods.cashback_percent > 0 ? (
                  <>
                    {/* Цена с учетом кэшбека (главная) */}
                    <div className={`text-3xl font-bold ${isDarkMode ? 'text-green-400' : 'text-green-600'}`}>
                      {calculatePriceWithCashback(goods.price, goods.cashback_percent).toLocaleString()} ₽
                    </div>
                    
                    {/* Цена без кэшбека (зачеркнутая) */}
                    <div className="mt-1">
                      <span className={`text-lg line-through ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                        {goods.price.toLocaleString()} ₽
                      </span>
                      <span className={`ml-2 text-sm ${isDarkMode ? 'text-gray-300' : 'text-gray-600'}`}>
                        Кэшбек {goods.cashback_percent}%
                      </span>
                    </div>
                  </>
                ) : (
                  /* Если кэшбека нет, то просто показываем обычную цену */
                  <div className={`text-3xl font-bold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                    {goods.price.toLocaleString()} ₽
                  </div>
                )}
              </div>
              
              <div className="flex items-center mt-4">
                <span className={`inline-block px-3 py-1 text-sm font-semibold rounded-full ${
                  isDarkMode 
                    ? 'bg-green-700 text-white' 
                    : 'bg-green-100 text-green-800'
                }`}>
                  Доступно сегодня: {availableToday} шт.
                </span>
              </div>
              
              <button
                onClick={openConfirmation}
                className={`w-full py-3 px-4 rounded-md text-white font-medium mt-6 ${
                  isDarkMode ? 'bg-blue-600 hover:bg-blue-700' : 'bg-blue-500 hover:bg-blue-600'
                }`}
              >
                Забронировать
              </button>
              
              {showInstructions && goods.purchase_guide && (
                <div className="mt-6">
                  <h3 className={`text-lg font-medium mb-2 ${isDarkMode ? 'text-gray-200' : 'text-gray-800'}`}>
                    Инструкция по покупке:
                  </h3>
                  <div className={`prose ${isDarkMode ? 'prose-invert' : ''} max-w-none`}>
                    <p className={`text-sm ${isDarkMode ? 'text-gray-300' : 'text-gray-600'}`}>
                      {goods.purchase_guide}
                    </p>
                  </div>
                  <p className={`mt-2 text-xs italic ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                    Инструкция также будет продублирована Вам в личные сообщения
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
        
        {/* Модальное окно подтверждения */}
        {showConfirmation && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className={`rounded-lg p-6 max-w-md w-full ${isDarkMode ? 'bg-gray-800' : 'bg-white'}`}>
              <h3 className={`text-xl font-bold mb-4 ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                Подтверждение бронирования
              </h3>
              <p className={`mb-6 ${isDarkMode ? 'text-gray-300' : 'text-gray-600'}`}>
                Вы действительно хотите забронировать товар "{goods.name}"?
              </p>
              <div className="flex justify-end space-x-4">
                <button
                  onClick={() => setShowConfirmation(false)}
                  className={`px-4 py-2 rounded-md ${
                    isDarkMode 
                      ? 'bg-gray-700 text-gray-300 hover:bg-gray-600' 
                      : 'bg-gray-200 text-gray-800 hover:bg-gray-300'
                  }`}
                >
                  Отмена
                </button>
                <button
                  onClick={handleReserve}
                  className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
                >
                  Подтвердить
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default GoodsDetail; 