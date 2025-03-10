import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useEffect } from 'react';
import { useTelegram } from '../hooks/useTelegram';
import { useAuth } from '../hooks/useAuth';

const Layout = ({ children }) => {
  const location = useLocation();
  const navigate = useNavigate();
  const { webApp, isDarkMode } = useTelegram();
  const { logout } = useAuth();
  
  useEffect(() => {
    if (webApp) {
      // Настраиваем главную кнопку в зависимости от маршрута
      if (location.pathname === '/admin/goods') {
        webApp.MainButton.setParams({
          text: 'Создать товар',
          color: '#0B63F6',
          text_color: '#ffffff'
        });
        
        const handleMainButtonClick = () => {
          navigate('/admin/goods/create');
        };
        
        webApp.MainButton.onClick(handleMainButtonClick);
        webApp.MainButton.show();
        
        return () => {
          webApp.MainButton.offClick(handleMainButtonClick);
          webApp.MainButton.hide();
        };
      } else {
        webApp.MainButton.hide();
      }
    }
  }, [location.pathname, webApp, navigate]);

  // Классы с учетом темной/светлой темы
  const navLinkClass = (path) => {
    const baseClass = "px-3 py-2 rounded-md text-sm font-medium";
    const activeClass = isDarkMode
      ? "bg-gray-700 text-white"
      : "bg-blue-50 text-blue-800";
    const inactiveClass = isDarkMode
      ? "text-gray-300 hover:bg-gray-700 hover:text-white"
      : "text-gray-600 hover:bg-gray-100 hover:text-gray-900";
    
    return `${baseClass} ${location.pathname === path ? activeClass : inactiveClass}`;
  };
  
  const handleLogout = () => {
    logout();
    navigate('/admin');
  };

  return (
    <div className="min-h-screen flex flex-col">
      <header className={`${isDarkMode ? 'bg-gray-800' : 'bg-white'} shadow`}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex">
              <div className="flex-shrink-0 flex items-center">
                <Link to="/admin/dashboard" className={`text-xl font-bold ${isDarkMode ? 'text-white' : 'text-gray-800'}`}>
                  Админ-панель
                </Link>
              </div>
              <nav className="ml-6 flex space-x-4">
                <Link
                  to="/admin/dashboard"
                  className={navLinkClass('/admin/dashboard')}
                >
                  Главная
                </Link>
                <Link
                  to="/admin/goods"
                  className={navLinkClass('/admin/goods')}
                >
                  Товары
                </Link>
              </nav>
            </div>
            <div className="flex items-center">
              <button
                onClick={handleLogout}
                className={`px-3 py-2 rounded-md text-sm font-medium ${
                  isDarkMode 
                    ? 'text-gray-300 hover:bg-gray-700 hover:text-white' 
                    : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
                }`}
              >
                Выйти
              </button>
            </div>
          </div>
        </div>
      </header>
      
      <main className="flex-1">
        <div className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
          {children}
        </div>
      </main>
      
      <footer className={`${isDarkMode ? 'bg-gray-800 text-gray-300' : 'bg-white text-gray-500'}`}>
        <div className="max-w-7xl mx-auto py-4 px-4 sm:px-6 lg:px-8">
          <p className="text-center text-sm">
            © 2023 Админ-панель товаров
          </p>
        </div>
      </footer>
    </div>
  );
};

export default Layout;
