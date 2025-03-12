import { useState } from 'react';
import { useTelegram } from '../hooks/useTelegram';

const SearchBar = ({ onSearch }) => {
  const [query, setQuery] = useState('');
  const { isDarkMode } = useTelegram();

  const handleSubmit = (e) => {
    e.preventDefault();
    onSearch(query);
  };

  return (
    <form onSubmit={handleSubmit} className="mb-4">
      <div className="flex rounded-md shadow-sm">
        <input
          type="text"
          placeholder="Поиск товаров..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleSubmit(e)}
          className={`block w-full rounded-l-md border px-3 py-2 focus:border-blue-500 focus:ring-blue-500 sm:text-sm ${
            isDarkMode 
              ? 'bg-gray-700 border-gray-600 text-white placeholder-gray-400' 
              : 'bg-white border-gray-300 text-gray-900 placeholder-gray-500'
          }`}
        />
        <button
          type="submit"
          className={`inline-flex items-center px-4 py-2 border border-l-0 rounded-r-md ${
            isDarkMode 
              ? 'border-gray-600 bg-gray-600 text-gray-200 hover:bg-gray-700' 
              : 'border-gray-300 bg-gray-50 text-gray-700 hover:bg-gray-100'
          }`}
        >
          Поиск
        </button>
      </div>
    </form>
  );
};

export default SearchBar; 