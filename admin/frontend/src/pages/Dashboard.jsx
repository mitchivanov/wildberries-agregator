import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useTelegram } from '../hooks/useTelegram';
import Layout from '../components/Layout';

const Dashboard = () => {
  const { isDarkMode, webApp, user } = useTelegram();

  useEffect(() => {
    if (webApp) {
      webApp.BackButton.hide();
    }
  }, [webApp]);

  return (
    <Layout>
      <div className="max-w-3xl mx-auto">
        <h1 className={`text-3xl font-bold mb-6 ${isDarkMode ? 'text-white' : 'text-gray-800'}`}>
          Панель управления
        </h1>
        
        {user && (
          <div className={`p-4 mb-6 rounded-lg ${isDarkMode ? 'bg-gray-700' : 'bg-blue-50'}`}>
            <p className={isDarkMode ? 'text-white' : 'text-gray-900'}>
              Добро пожаловать, {user.first_name} {user.last_name}!
            </p>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
          <Link 
            to="/admin/goods" 
            className={`p-6 rounded-lg shadow hover:shadow-md transition ${
              isDarkMode ? 'bg-gray-800 hover:bg-gray-700' : 'bg-white hover:bg-gray-50'
            }`}
          >
            <h2 className={`text-xl font-semibold mb-2 ${isDarkMode ? 'text-white' : 'text-gray-800'}`}>
              Управление товарами
            </h2>
            <p className={isDarkMode ? 'text-gray-300' : 'text-gray-600'}>
              Добавление, редактирование и удаление товаров
            </p>
          </Link>
        </div>

        <div className={`p-6 rounded-lg shadow ${isDarkMode ? 'bg-gray-800' : 'bg-white'}`}>
          <h2 className={`text-xl font-semibold mb-4 ${isDarkMode ? 'text-white' : 'text-gray-800'}`}>
            Быстрые действия
          </h2>
          <div className="space-y-4">
            <Link 
              to="/admin/goods/create" 
              className={`block w-full text-center py-2 px-4 rounded ${
                isDarkMode 
                  ? 'bg-blue-700 text-white hover:bg-blue-600' 
                  : 'bg-blue-600 text-white hover:bg-blue-700'
              }`}
            >
              Добавить новый товар
            </Link>
            <Link 
              to="/admin/goods" 
              className={`block w-full text-center py-2 px-4 rounded ${
                isDarkMode 
                  ? 'bg-gray-700 text-white hover:bg-gray-600' 
                  : 'bg-gray-200 text-gray-800 hover:bg-gray-300'
              }`}
            >
              Просмотреть все товары
            </Link>
          </div>
        </div>
      </div>
    </Layout>
  );
};

export default Dashboard; 