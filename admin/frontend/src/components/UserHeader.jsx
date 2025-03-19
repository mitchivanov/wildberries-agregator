import { NavLink } from 'react-router-dom';
import { useTelegram } from '../hooks/useTelegram';

const UserHeader = () => {
  const { isDarkMode } = useTelegram();

  const navLinkClass = ({ isActive }) => {
    const baseClass = "px-4 py-2 text-center flex-1 transition-colors";
    
    if (isActive) {
      return `${baseClass} ${isDarkMode ? 'bg-blue-700 text-white' : 'bg-blue-600 text-white'}`;
    } else {
      return `${baseClass} ${isDarkMode ? 'bg-gray-700 text-gray-300 hover:bg-gray-600' : 'bg-gray-100 text-gray-800 hover:bg-gray-200'}`;
    }
  };

  return (
    <header className={`${isDarkMode ? 'bg-gray-800' : 'bg-white'} shadow mb-4`}>
      <div className="flex">
        <NavLink 
          to="/" 
          className={navLinkClass}
          end
        >
          Каталог
        </NavLink>
        <NavLink 
          to="/reservations" 
          className={navLinkClass}
        >
          Мои бронирования
        </NavLink>
      </div>
    </header>
  );
};

export default UserHeader; 