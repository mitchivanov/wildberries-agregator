import React, { useState, useEffect } from 'react';
import Layout from '../components/Layout';
import { useApi } from '../hooks/useApi';
import { useTelegram } from '../hooks/useTelegram';
import toast from 'react-hot-toast';
import { api, getMediaUrl } from '../hooks/useApi';

const AllReservations = () => {
  const { isDarkMode } = useTelegram();
  const { getAllReservations } = useApi();
  const [reservations, setReservations] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedReservation, setSelectedReservation] = useState(null);
  const [showConfirmationModal, setShowConfirmationModal] = useState(false);
  const [showImageViewer, setShowImageViewer] = useState(false);
  const [currentImage, setCurrentImage] = useState('');
  const [showVideoViewer, setShowVideoViewer] = useState(false);
  const [currentVideo, setCurrentVideo] = useState('');
  
  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const data = await getAllReservations();
        console.log("Получены данные о бронированиях:", data.length);
        
        // Проверяем данные подтверждения
        const withConfirmation = data.filter(r => r.confirmation_data && Object.keys(r.confirmation_data).length > 0);
        console.log(`Бронирований с данными подтверждения: ${withConfirmation.length}`);
        
        if (withConfirmation.length > 0) {
          console.log("Пример данных подтверждения:", withConfirmation[0].confirmation_data);
        }
        
        setReservations(data || []);
      } catch (err) {
        console.error("Ошибка при загрузке бронирований:", err);
        toast.error(`Ошибка при загрузке бронирований: ${err.message || 'Неизвестная ошибка'}`);
      } finally {
        setLoading(false);
      }
    };
    
    fetchData();
  }, []);
  
  // Форматирование даты и времени
  const formatDateTime = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleString('ru-RU');
  };
  
  // Функция для открытия модального окна с деталями подтверждения
  const openConfirmationDetails = (reservation) => {
    console.log("Открываем детали для бронирования:", reservation.id);
    console.log("Данные подтверждения:", reservation.confirmation_data);
    setSelectedReservation(reservation);
    setShowConfirmationModal(true);
  };

  // Функция для закрытия модального окна
  const closeConfirmationDetails = () => {
    setShowConfirmationModal(false);
    setSelectedReservation(null);
  };

  // Функция для форматирования статуса
  const formatStatus = (status) => {
    switch (status) {
      case 'active':
        return <span className="px-2 py-1 text-xs rounded-full bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200">Активно</span>;
      case 'confirmed':
        return <span className="px-2 py-1 text-xs rounded-full bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">Подтверждено</span>;
      case 'canceled':
        return <span className="px-2 py-1 text-xs rounded-full bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200">Отменено</span>;
      default:
        return <span>{status}</span>;
    }
  };
  
  // Обновленная функция formatMediaUrl с дополнительной обработкой путей
  const formatMediaUrl = (path) => {
    if (!path) return '';
    
    console.log('Исходный путь к медиафайлу:', path);
    
    // Удаляем лишние 'uploads/' из пути, если они есть
    let normalizedPath = path;
    if (normalizedPath.startsWith('uploads/')) {
      normalizedPath = normalizedPath.substring(8); // Удаляем 'uploads/'
    }
    if (normalizedPath.startsWith('/uploads/')) {
      normalizedPath = normalizedPath.substring(9); // Удаляем '/uploads/'
    }
    
    // Базовый URL сайта
    const baseUrl = window.location.origin;
    
    // Формируем правильный URL
    const result = `${baseUrl}/uploads/${normalizedPath}`;
    console.log('Форматированный URL:', result);
    
    return result;
  };

  // Функция для просмотра изображения в полном размере
  const openImageViewer = (imagePath) => {
    const fullUrl = formatMediaUrl(imagePath);
    console.log("Открываем просмотр изображения:", fullUrl);
    setCurrentImage(fullUrl);
    setShowImageViewer(true);
  };
  
  // Функция для просмотра видео в полном размере
  const openVideoViewer = (videoPath) => {
    const fullUrl = formatMediaUrl(videoPath);
    console.log("Открываем просмотр видео:", fullUrl);
    setCurrentVideo(fullUrl);
    setShowVideoViewer(true);
  };
  
  return (
    <Layout>
      <div className="space-y-6">
        <h1 className={`text-2xl font-bold ${isDarkMode ? 'text-white' : 'text-gray-800'}`}>
          Все бронирования
        </h1>
        
        {loading ? (
          <div className="text-center py-10">
            <svg className="animate-spin h-10 w-10 text-blue-500 mx-auto" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            <p className={`mt-2 ${isDarkMode ? 'text-gray-300' : 'text-gray-600'}`}>Загрузка...</p>
          </div>
        ) : reservations.length === 0 ? (
          <div className={`text-center py-10 rounded-lg shadow ${isDarkMode ? 'bg-gray-800 text-white' : 'bg-white text-gray-800'}`}>
            <p>Нет данных о бронированиях</p>
          </div>
        ) : (
          <div className="overflow-x-auto rounded-lg shadow">
            <table className={`min-w-full divide-y ${isDarkMode ? 'divide-gray-700' : 'divide-gray-200'}`}>
              <thead className={isDarkMode ? 'bg-gray-700' : 'bg-gray-50'}>
                <tr>
                  <th scope="col" className={`px-6 py-3 text-left text-xs font-medium uppercase tracking-wider ${isDarkMode ? 'text-gray-300' : 'text-gray-500'}`}>
                    ID
                  </th>
                  <th scope="col" className={`px-6 py-3 text-left text-xs font-medium uppercase tracking-wider ${isDarkMode ? 'text-gray-300' : 'text-gray-500'}`}>
                    Товар
                  </th>
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
                  <th scope="col" className={`px-6 py-3 text-left text-xs font-medium uppercase tracking-wider ${isDarkMode ? 'text-gray-300' : 'text-gray-500'}`}>
                    Подтверждение
                  </th>
                </tr>
              </thead>
              <tbody className={`divide-y ${isDarkMode ? 'divide-gray-700 bg-gray-800' : 'divide-gray-200 bg-white'}`}>
                {reservations.map((item) => (
                  <tr 
                    key={item.id} 
                    className={`${isDarkMode ? 'hover:bg-gray-700' : 'hover:bg-gray-50'} cursor-pointer`}
                    onClick={() => openConfirmationDetails(item)}
                  >
                    <td className={`px-6 py-4 whitespace-nowrap text-sm ${isDarkMode ? 'text-gray-300' : 'text-gray-500'}`}>
                      {item.id}
                    </td>
                    <td className={`px-6 py-4 whitespace-nowrap text-sm ${isDarkMode ? 'text-gray-300' : 'text-gray-500'}`}>
                      {item.goods_name || `ID: ${item.goods_id}`}
                    </td>
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
                    <td className={`px-6 py-4 whitespace-nowrap text-sm ${isDarkMode ? 'text-gray-300' : 'text-gray-500'}`}>
                      {item.confirmation_data && Object.keys(item.confirmation_data).length > 0 ? (
                        <span className="text-green-600 dark:text-green-400">✓ Есть данные</span>
                      ) : (
                        <span className="text-gray-400">Нет данных</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Модальное окно с деталями подтверждения */}
      {showConfirmationModal && selectedReservation && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex items-center justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
            <div className="fixed inset-0 transition-opacity" aria-hidden="true">
              <div className={`absolute inset-0 ${isDarkMode ? 'bg-gray-900' : 'bg-gray-500'} opacity-75`}></div>
            </div>

            <span className="hidden sm:inline-block sm:align-middle sm:h-screen" aria-hidden="true">&#8203;</span>
            
            <div 
              className={`inline-block align-bottom rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle max-w-2xl w-full ${
                isDarkMode ? 'bg-gray-800 text-white' : 'bg-white text-gray-900'
              }`}
            >
              <div className="px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
                <div className="sm:flex sm:items-start">
                  <div className="mt-3 text-center sm:mt-0 sm:text-left w-full">
                    <h3 className="text-lg leading-6 font-medium">
                      Детали бронирования #{selectedReservation.id}
                    </h3>
                    
                    <div className="mt-4 space-y-4">
                      <div>
                        <p className="font-medium">Товар:</p>
                        <p>{selectedReservation.goods_name || `ID: ${selectedReservation.goods_id}`}</p>
                      </div>
                      
                      <div>
                        <p className="font-medium">Пользователь:</p>
                        <p>ID: {selectedReservation.user_id}</p>
                      </div>
                      
                      <div>
                        <p className="font-medium">Статус:</p>
                        <p>{formatStatus(selectedReservation.status)}</p>
                      </div>
                      
                      <div>
                        <p className="font-medium">Дата бронирования:</p>
                        <p>{formatDateTime(selectedReservation.reserved_at)}</p>
                      </div>
                      
                      {selectedReservation.confirmation_data && Object.keys(selectedReservation.confirmation_data).length > 0 ? (
                        <div>
                          <p className="font-medium mb-2">Данные подтверждения:</p>
                          <div className="mt-2 space-y-4">
                            {Object.entries(selectedReservation.confirmation_data).map(([key, data]) => (
                              <div key={key} className={`p-4 rounded-lg ${isDarkMode ? 'bg-gray-700' : 'bg-gray-100'}`}>
                                <p className="font-medium text-lg mb-2">{data.title}:</p>
                                {data.type === 'text' ? (
                                  <p className="break-words">{data.value}</p>
                                ) : data.type === 'photo' ? (
                                  <div className="mt-2 flex flex-col items-center">
                                    <div className="relative w-full max-w-md mx-auto">
                                      <img 
                                        src={formatMediaUrl(data.value)} 
                                        alt={data.title} 
                                        className="max-w-full rounded shadow-lg object-contain max-h-96 cursor-pointer hover:opacity-90 transition-opacity"
                                        onClick={() => openImageViewer(data.value)}
                                        onError={(e) => {
                                          console.error(`Ошибка загрузки изображения: ${formatMediaUrl(data.value)}`);
                                          e.target.src = 'https://via.placeholder.com/400x300?text=Ошибка+загрузки+изображения';
                                        }}
                                      />
                                      <div className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-0 hover:bg-opacity-30 transition-all">
                                        <svg className="w-12 h-12 text-white opacity-0 hover:opacity-100" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                                        </svg>
                                      </div>
                                    </div>
                                    <div className="mt-3 flex space-x-4">
                                      <a 
                                        href={formatMediaUrl(data.value)} 
                                        target="_blank" 
                                        rel="noopener noreferrer"
                                        className="px-3 py-1.5 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors text-sm"
                                        onClick={(e) => e.stopPropagation()}
                                      >
                                        Открыть в новой вкладке
                                      </a>
                                      <button
                                        className="px-3 py-1.5 bg-gray-600 text-white rounded-md hover:bg-gray-700 transition-colors text-sm"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          openImageViewer(data.value);
                                        }}
                                      >
                                        Увеличить
                                      </button>
                                    </div>
                                  </div>
                                ) : data.type === 'video' ? (
                                  <div className="mt-2 flex flex-col items-center">
                                    <div className="w-full max-w-md relative">
                                      <video 
                                        src={formatMediaUrl(data.value)} 
                                        controls
                                        className="max-w-full rounded shadow-lg"
                                        onError={(e) => {
                                          console.error(`Ошибка загрузки видео: ${formatMediaUrl(data.value)}`);
                                          e.target.parentNode.innerHTML = `<div class="bg-red-100 text-red-700 p-4 rounded">Ошибка загрузки видео: ${data.value}</div>`;
                                        }}
                                      />
                                      <button
                                        className="absolute top-2 right-2 bg-gray-800 bg-opacity-70 text-white p-1 rounded hover:bg-opacity-100"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          openVideoViewer(data.value);
                                        }}
                                      >
                                        <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                                        </svg>
                                      </button>
                                    </div>
                                    <div className="mt-3 flex space-x-4">
                                      <a 
                                        href={formatMediaUrl(data.value)} 
                                        download
                                        className="px-3 py-1.5 bg-green-600 text-white rounded-md hover:bg-green-700 transition-colors text-sm"
                                        onClick={(e) => e.stopPropagation()}
                                      >
                                        Скачать видео
                                      </a>
                                      <button
                                        className="px-3 py-1.5 bg-gray-600 text-white rounded-md hover:bg-gray-700 transition-colors text-sm"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          openVideoViewer(data.value);
                                        }}
                                      >
                                        Полноэкранный режим
                                      </button>
                                    </div>
                                  </div>
                                ) : (
                                  <p className="text-yellow-500">Неизвестный тип данных: {data.type}</p>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                      ) : (
                        <div className={`p-4 rounded ${isDarkMode ? 'bg-gray-700' : 'bg-gray-100'}`}>
                          <p className="text-center text-gray-500">Нет данных подтверждения</p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
              
              <div className={`px-4 py-3 sm:px-6 sm:flex sm:flex-row-reverse ${isDarkMode ? 'bg-gray-700' : 'bg-gray-50'}`}>
                <button
                  type="button"
                  className="w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-blue-600 text-base font-medium text-white hover:bg-blue-700 focus:outline-none sm:ml-3 sm:w-auto sm:text-sm"
                  onClick={closeConfirmationDetails}
                >
                  Закрыть
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Компонент для просмотра изображений */}
      {showImageViewer && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-90 transition-opacity duration-300">
          <button 
            className="absolute top-4 right-4 text-white text-4xl hover:text-gray-300 z-10"
            onClick={() => setShowImageViewer(false)}
            title="Закрыть"
          >
            &times;
          </button>
          <div className="relative max-w-[90vw] max-h-[90vh]">
            <img 
              src={currentImage} 
              alt="Просмотр изображения" 
              className="max-w-full max-h-[90vh] object-contain"
              onError={(e) => {
                console.error(`Ошибка при загрузке полноразмерного изображения: ${currentImage}`);
                e.target.src = 'https://via.placeholder.com/800x600?text=Ошибка+загрузки+изображения';
              }}
            />
            <div className="absolute bottom-4 left-0 right-0 flex justify-center">
              <a 
                href={currentImage} 
                download 
                className="bg-white bg-opacity-20 backdrop-blur-sm text-white px-3 py-1.5 rounded-md hover:bg-opacity-30 transition-colors"
                onClick={(e) => e.stopPropagation()}
              >
                Скачать изображение
              </a>
            </div>
          </div>
        </div>
      )}

      {/* Компонент для просмотра видео */}
      {showVideoViewer && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-90 transition-opacity duration-300">
          <button 
            className="absolute top-4 right-4 text-white text-4xl hover:text-gray-300 z-10"
            onClick={() => setShowVideoViewer(false)}
            title="Закрыть"
          >
            &times;
          </button>
          <div className="relative max-w-[90vw] max-h-[90vh]">
            <video 
              src={currentVideo} 
              controls
              autoPlay
              className="max-w-full max-h-[80vh]"
              onError={(e) => {
                console.error(`Ошибка при загрузке видео: ${currentVideo}`);
                e.target.parentNode.innerHTML = `<div class="bg-red-800 text-white p-8 rounded">Ошибка загрузки видео</div>`;
              }}
            />
            <div className="absolute bottom-4 left-0 right-0 flex justify-center">
              <a 
                href={currentVideo} 
                download 
                className="bg-white bg-opacity-20 backdrop-blur-sm text-white px-3 py-1.5 rounded-md hover:bg-opacity-30 transition-colors"
                onClick={(e) => e.stopPropagation()}
              >
                Скачать видео
              </a>
            </div>
          </div>
        </div>
      )}
    </Layout>
  );
};

export default AllReservations; 