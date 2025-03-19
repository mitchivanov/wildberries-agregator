import React, { useState } from 'react';
import { useTelegram } from '../hooks/useTelegram';

const GoodsAvailability = ({ dailyAvailability, reservations }) => {
  const { isDarkMode } = useTelegram();
  const [showAvailability, setShowAvailability] = useState(true);
  const [showReservations, setShowReservations] = useState(true);
  
  // Сортировка данных о доступности по дате
  const sortedAvailability = [...(dailyAvailability || [])].sort((a, b) => 
    new Date(a.date) - new Date(b.date)
  );
  
  // Сортировка бронирований по дате
  const sortedReservations = [...(reservations || [])].sort((a, b) => 
    new Date(b.reserved_at) - new Date(a.reserved_at)
  );
  
  // Форматирование даты
  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('ru-RU');
  };
  
  // Форматирование даты и времени
  const formatDateTime = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleString('ru-RU');
  };

  // Форматирование статуса
  const formatStatus = (status) => {
    const statusMap = {
      'active': { text: 'Активно', class: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200' },
      'confirmed': { text: 'Подтверждено', class: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' },
      'canceled': { text: 'Отменено', class: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200' }
    };
    
    const statusInfo = statusMap[status] || { text: status, class: 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300' };
    
    return (
      <span className={`px-2 py-1 text-xs rounded-full ${statusInfo.class}`}>
        {statusInfo.text}
      </span>
    );
  };

  return (
    <div className="mt-6 space-y-6">
      {/* Секция доступности по дням */}
      <div className={`rounded-lg shadow-md overflow-hidden ${isDarkMode ? 'bg-gray-800' : 'bg-white'}`}>
        <div 
          className={`px-6 py-4 flex items-center justify-between cursor-pointer ${
            isDarkMode ? 'bg-gray-700 hover:bg-gray-650' : 'bg-gray-50 hover:bg-gray-100'
          }`}
          onClick={() => setShowAvailability(!showAvailability)}
        >
          <h3 className={`text-lg font-medium ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
            Доступность по дням
          </h3>
          <div className="flex items-center">
            <span className={`mr-3 px-3 py-1 rounded-full text-xs font-medium ${
              isDarkMode ? 'bg-blue-900/30 text-blue-300' : 'bg-blue-100 text-blue-800'
            }`}>
              {sortedAvailability.length} дней
            </span>
            <svg 
              xmlns="http://www.w3.org/2000/svg" 
              className={`h-5 w-5 transition-transform duration-300 ${
                showAvailability ? 'transform rotate-180' : ''
              } ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`} 
              viewBox="0 0 20 20" 
              fill="currentColor"
            >
              <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
            </svg>
          </div>
        </div>
        
        {showAvailability && (
          sortedAvailability.length > 0 ? (
            <div className="overflow-x-auto">
              <table className={`min-w-full divide-y ${isDarkMode ? 'divide-gray-700' : 'divide-gray-200'}`}>
                <thead className={isDarkMode ? 'bg-gray-700' : 'bg-gray-50'}>
                  <tr>
                    <th scope="col" className={`px-6 py-3 text-left text-xs font-medium uppercase tracking-wider ${isDarkMode ? 'text-gray-300' : 'text-gray-500'}`}>
                      Дата
                    </th>
                    <th scope="col" className={`px-6 py-3 text-left text-xs font-medium uppercase tracking-wider ${isDarkMode ? 'text-gray-300' : 'text-gray-500'}`}>
                      Доступное количество
                    </th>
                  </tr>
                </thead>
                <tbody className={`divide-y ${isDarkMode ? 'divide-gray-700' : 'divide-gray-200'}`}>
                  {sortedAvailability.map((item) => (
                    <tr key={item.id} className={isDarkMode ? 'hover:bg-gray-700' : 'hover:bg-gray-50'}>
                      <td className={`px-6 py-4 whitespace-nowrap text-sm ${isDarkMode ? 'text-gray-300' : 'text-gray-500'}`}>
                        {formatDate(item.date)}
                      </td>
                      <td className={`px-6 py-4 whitespace-nowrap text-sm ${
                        item.available_quantity > 0
                          ? isDarkMode ? 'text-green-400' : 'text-green-600'
                          : isDarkMode ? 'text-red-400' : 'text-red-600'
                      }`}>
                        {item.available_quantity} шт.
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className={`px-6 py-4 text-center ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
              Нет данных о доступности
            </div>
          )
        )}
      </div>
      
      {/* Секция истории бронирований */}
      <div className={`rounded-lg shadow-md overflow-hidden ${isDarkMode ? 'bg-gray-800' : 'bg-white'}`}>
        <div 
          className={`px-6 py-4 flex items-center justify-between cursor-pointer ${
            isDarkMode ? 'bg-gray-700 hover:bg-gray-650' : 'bg-gray-50 hover:bg-gray-100'
          }`}
          onClick={() => setShowReservations(!showReservations)}
        >
          <h3 className={`text-lg font-medium ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
            История бронирований
          </h3>
          <div className="flex items-center">
            <span className={`mr-3 px-3 py-1 rounded-full text-xs font-medium ${
              isDarkMode ? 'bg-purple-900/30 text-purple-300' : 'bg-purple-100 text-purple-800'
            }`}>
              {sortedReservations.length} бронирований
            </span>
            <svg 
              xmlns="http://www.w3.org/2000/svg" 
              className={`h-5 w-5 transition-transform duration-300 ${
                showReservations ? 'transform rotate-180' : ''
              } ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`} 
              viewBox="0 0 20 20" 
              fill="currentColor"
            >
              <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
            </svg>
          </div>
        </div>
        
        {showReservations && (
          sortedReservations.length > 0 ? (
            <div className="overflow-x-auto">
              <table className={`min-w-full divide-y ${isDarkMode ? 'divide-gray-700' : 'divide-gray-200'}`}>
                <thead className={isDarkMode ? 'bg-gray-700' : 'bg-gray-50'}>
                  <tr>
                    <th scope="col" className={`px-6 py-3 text-left text-xs font-medium uppercase tracking-wider ${isDarkMode ? 'text-gray-300' : 'text-gray-500'}`}>
                      ID пользователя
                    </th>
                    <th scope="col" className={`px-6 py-3 text-left text-xs font-medium uppercase tracking-wider ${isDarkMode ? 'text-gray-300' : 'text-gray-500'}`}>
                      Количество
                    </th>
                    <th scope="col" className={`px-6 py-3 text-left text-xs font-medium uppercase tracking-wider ${isDarkMode ? 'text-gray-300' : 'text-gray-500'}`}>
                      Дата и время
                    </th>
                    <th scope="col" className={`px-6 py-3 text-left text-xs font-medium uppercase tracking-wider ${isDarkMode ? 'text-gray-300' : 'text-gray-500'}`}>
                      Статус
                    </th>
                  </tr>
                </thead>
                <tbody className={`divide-y ${isDarkMode ? 'divide-gray-700' : 'divide-gray-200'}`}>
                  {sortedReservations.map((item) => (
                    <tr key={item.id} className={isDarkMode ? 'hover:bg-gray-700' : 'hover:bg-gray-50'}>
                      <td className={`px-6 py-4 whitespace-nowrap text-sm ${isDarkMode ? 'text-gray-300' : 'text-gray-500'}`}>
                        {item.user_id}
                      </td>
                      <td className={`px-6 py-4 whitespace-nowrap text-sm ${isDarkMode ? 'text-gray-300' : 'text-gray-500'}`}>
                        {item.quantity} шт.
                      </td>
                      <td className={`px-6 py-4 whitespace-nowrap text-sm ${isDarkMode ? 'text-gray-300' : 'text-gray-500'}`}>
                        {formatDateTime(item.reserved_at)}
                      </td>
                      <td className={`px-6 py-4 whitespace-nowrap text-sm ${isDarkMode ? 'text-gray-300' : 'text-gray-500'}`}>
                        {formatStatus(item.status)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className={`px-6 py-4 text-center ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
              Нет данных о бронированиях
            </div>
          )
        )}
      </div>
    </div>
  );
};

export default GoodsAvailability; 