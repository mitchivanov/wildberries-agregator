import { useState, useEffect, createContext, useContext } from 'react';

// Получаем переменные окружения через import.meta.env
const ADMIN_LOGIN = import.meta.env.VITE_ADMIN_LOGIN
const ADMIN_PASSWORD = import.meta.env.VITE_ADMIN_PASSWORD

// Добавим отладочный вывод только для разработки
if (import.meta.env.DEV) {
  console.log('Переменные аутентификации загружены:');
  console.log('ADMIN_LOGIN доступен:', !!ADMIN_LOGIN);
  console.log('ADMIN_PASSWORD доступен:', !!ADMIN_PASSWORD);
}

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  
  // Проверка авторизации при загрузке
  useEffect(() => {
    const authStatus = localStorage.getItem('isAuthenticated');
    if (authStatus === 'true') {
      setIsAuthenticated(true);
    }
  }, []);
  
  const login = (username, password) => {
    console.log('Попытка входа:', username);
    console.log('Ожидаемый логин:', ADMIN_LOGIN);
    console.log('Введенный пароль совпадает с ожидаемым:', password === ADMIN_PASSWORD);
    
    // Сравниваем строковые представления для надежности
    if (String(username) === String(ADMIN_LOGIN) && String(password) === String(ADMIN_PASSWORD)) {
      setIsAuthenticated(true);
      localStorage.setItem('isAuthenticated', 'true');
      return true;
    }
    
    // Если учетные данные не подошли, выводим сообщение
    console.error('Неверные учетные данные');
    return false;
  };
  
  const logout = () => {
    setIsAuthenticated(false);
    localStorage.removeItem('isAuthenticated');
  };
  
  return (
    <AuthContext.Provider value={{ isAuthenticated, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext); 