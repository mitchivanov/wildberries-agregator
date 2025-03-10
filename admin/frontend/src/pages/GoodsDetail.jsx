import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useApi } from '../hooks/useApi';
import { useTelegram } from '../hooks/useTelegram';
import toast from 'react-hot-toast';

const GoodsDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { getGoodsById, reserveGoods, loading } = useApi();
  const { isDarkMode, webApp, user } = useTelegram();
  
  const [goods, setGoods] = useState(null);
  const [quantity, setQuantity] = useState(1);
  const [showConfirmation, setShowConfirmation] = useState(false);
  
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
  }, [id, webApp]);
  
  const loadGoodsDetails = async () => {
    try {
      const data = await getGoodsById(id);
      if (data) {
        setGoods(data);
        // Устанавливаем начальное количество на минимальное доступное
        setQuantity(1);
      }
    } catch (error) {
      console.error('Ошибка при загрузке товара:', error);
      toast.error('Не удалось загрузить информацию о товаре');
    }
  };
  
  const handleQuantityChange = (e) => {
    const value = parseInt(e.target.value);
    if (value > 0 && goods && value <= goods.max_daily) {
      setQuantity(value);
    }
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
      const result = await reserveGoods(goods.id, quantity);
      
      if (result.error) {
        // Если вернулась ошибка из API
        toast.error(`Ошибка: ${result.message}`);
        setShowConfirmation(false);
        return;
      }
      
      setShowConfirmation(false);
      toast.success('Товар успешно забронирован! Проверьте сообщение в Telegram');
      navigate('/');
    } catch (error) {
      console.error('Ошибка при бронировании:', error);
      toast.error('Не удалось забронировать товар');
      setShowConfirmation(false);
    }
  };
  
  if (loading || !goods) {
    return (
      <div className="text-center py-20">
        <div className={`animate-spin h-12 w-12 border-4 rounded-full mx-auto ${isDarkMode ? 'border-blue-500 border-t-transparent' : 'border-gray-700 border-t-transparent'}`}></div>
        <p className={`mt-4 ${isDarkMode ? 'text-gray-200' : 'text-gray-700'}`}>Загрузка информации о товаре...</p>
      </div>
    );
  }
  
  return (
    <div className={`max-w-4xl mx-auto p-4 ${isDarkMode ? 'text-white' : 'text-gray-800'}`}>
      <div className={`rounded-lg shadow-lg overflow-hidden ${isDarkMode ? 'bg-gray-800' : 'bg-white'}`}>
        <div className="md:flex">
          <div className="md:w-1/2">
            <img 
              src={goods.image} 
              alt={goods.name} 
              className="w-full h-full object-cover object-center"
              onError={(e) => { e.target.src = '/placeholder.jpg'; }}
            />
          </div>
          <div className="p-6 md:w-1/2">
            <h1 className={`text-2xl font-bold mb-2 ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
              {goods.name}
            </h1>
            <p className={`text-sm mb-4 ${isDarkMode ? 'text-gray-300' : 'text-gray-600'}`}>
              Артикул: {goods.article}
            </p>
            <div className={`text-3xl font-bold mb-6 ${isDarkMode ? 'text-green-400' : 'text-green-600'}`}>
              {goods.price.toLocaleString()} ₽
            </div>
            
            <div className="mb-6">
              <label className={`block text-sm font-medium mb-2 ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                Количество:
              </label>
              <input
                type="number"
                min="1"
                max={goods.max_daily}
                value={quantity}
                onChange={handleQuantityChange}
                className={`w-20 px-3 py-2 border rounded-md ${
                  isDarkMode 
                    ? 'bg-gray-700 border-gray-600 text-white' 
                    : 'bg-white border-gray-300 text-gray-900'
                }`}
              />
            </div>
            
            <button
              onClick={openConfirmation}
              className={`w-full py-3 px-4 rounded-md text-white font-medium ${
                isDarkMode ? 'bg-blue-600 hover:bg-blue-700' : 'bg-blue-500 hover:bg-blue-600'
              }`}
            >
              Забронировать
            </button>
            
            {goods.purchase_guide && (
              <div className="mt-6">
                <h3 className={`text-lg font-medium mb-2 ${isDarkMode ? 'text-gray-200' : 'text-gray-800'}`}>
                  Инструкция по покупке:
                </h3>
                <div className={`prose ${isDarkMode ? 'prose-invert' : ''} max-w-none`}>
                  <p className={`text-sm ${isDarkMode ? 'text-gray-300' : 'text-gray-600'}`}>
                    {goods.purchase_guide}
                  </p>
                </div>
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
              Вы действительно хотите забронировать товар "{goods.name}" в количестве {quantity} шт.?
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
  );
};

export default GoodsDetail; 