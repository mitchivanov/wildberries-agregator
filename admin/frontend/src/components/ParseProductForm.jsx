import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTelegram } from '../hooks/useTelegram';
import { useApi } from '../hooks/useApi';
import toast from 'react-hot-toast';

const ParseProductForm = ({ onParsedData }) => {
  const [url, setUrl] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const { isDarkMode } = useTelegram();
  const { parseProduct } = useApi();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!url.trim()) {
      toast.error('Пожалуйста, введите URL товара');
      return;
    }
    
    if (!url.includes('wildberries.ru')) {
      toast.error('Пожалуйста, введите корректную ссылку на товар Wildberries');
      return;
    }
    
    setIsLoading(true);
    
    try {
      const productData = await parseProduct(url);
      onParsedData(productData);
    } catch (error) {
      // В случае ошибки всё равно переходим к форме, но с пустыми полями
      onParsedData(null);
    } finally {
      setIsLoading(false);
    }
  };

  const handleManualEntry = () => {
    onParsedData(null);
  };

  return (
    <div className={`max-w-md mx-auto p-6 rounded-lg shadow-md ${isDarkMode ? 'bg-gray-800' : 'bg-white'}`}>
      <h2 className={`text-2xl font-bold mb-6 ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
        Новый товар
      </h2>
      
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label htmlFor="url" className={`block text-sm font-medium ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
            URL товара с Wildberries
          </label>
          <input
            type="url"
            id="url"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://www.wildberries.ru/catalog/12345678/detail.aspx"
            required
            className={`mt-1 block w-full px-3 py-2 border rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 ${
              isDarkMode 
                ? 'bg-gray-700 border-gray-600 text-white placeholder-gray-400' 
                : 'bg-white border-gray-300 text-gray-900 placeholder-gray-500'
            }`}
          />
        </div>
        
        <div className="flex space-x-4">
          <button
            type="submit"
            disabled={isLoading}
            className={`flex-1 py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white ${
              isDarkMode 
                ? 'bg-blue-600 hover:bg-blue-700' 
                : 'bg-blue-600 hover:bg-blue-700'
            } focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500`}
          >
            {isLoading ? (
              <span className="flex items-center justify-center">
                <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Загрузка...
              </span>
            ) : (
              'Получить данные товара'
            )}
          </button>
          
          <button
            type="button"
            onClick={handleManualEntry}
            className={`flex-1 py-2 px-4 border rounded-md shadow-sm text-sm font-medium ${
              isDarkMode 
                ? 'border-gray-600 bg-gray-700 text-gray-200 hover:bg-gray-600' 
                : 'border-gray-300 bg-white text-gray-700 hover:bg-gray-50'
            } focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500`}
          >
            Ввести вручную
          </button>
        </div>
      </form>
    </div>
  );
};

export default ParseProductForm; 