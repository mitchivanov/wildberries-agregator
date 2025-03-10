import { Link } from 'react-router-dom';
import { useTelegram } from '../hooks/useTelegram';

const GoodsItem = ({ goods, onDelete }) => {
  const { isDarkMode } = useTelegram();
  
  const handleDelete = () => {
    if (window.confirm('Вы действительно хотите удалить этот товар?')) {
      onDelete(goods.id);
    }
  };

  return (
    <tr className={`${isDarkMode ? 'hover:bg-gray-700' : 'hover:bg-gray-50'}`}>
      <td className={`px-6 py-4 whitespace-nowrap text-sm font-medium ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
        {goods.id}
      </td>
      <td className="px-6 py-4 whitespace-nowrap">
        <div className="flex items-center justify-center h-16 w-16 overflow-hidden rounded">
          <img 
            src={goods.image} 
            alt={goods.name}
            className="h-full w-full object-cover"
            onError={(e) => {
              e.target.onerror = null;
              e.target.src = "https://via.placeholder.com/80?text=Нет+фото";
            }}
          />
        </div>
      </td>
      <td className={`px-6 py-4 whitespace-nowrap text-sm ${isDarkMode ? 'text-gray-300' : 'text-gray-900'}`}>
        {goods.name}
      </td>
      <td className={`px-6 py-4 whitespace-nowrap text-sm ${isDarkMode ? 'text-gray-300' : 'text-gray-500'}`}>
        {goods.article}
      </td>
      <td className={`px-6 py-4 whitespace-nowrap text-sm ${isDarkMode ? 'text-gray-300' : 'text-gray-900'}`}>
        {goods.price.toLocaleString()} ₽
      </td>
      <td className="px-6 py-4 whitespace-nowrap">
        <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
          goods.is_active 
            ? isDarkMode ? 'bg-green-800 text-green-100' : 'bg-green-100 text-green-800' 
            : isDarkMode ? 'bg-red-800 text-red-100' : 'bg-red-100 text-red-800'
        }`}>
          {goods.is_active ? 'Активен' : 'Неактивен'}
        </span>
      </td>
      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
        <div className="flex justify-end space-x-3">
          <Link
            to={`/goods/edit/${goods.id}`}
            className={isDarkMode ? 'text-blue-400 hover:text-blue-300' : 'text-blue-600 hover:text-blue-900'}
          >
            Изменить
          </Link>
          <button
            onClick={handleDelete}
            className={isDarkMode ? 'text-red-400 hover:text-red-300' : 'text-red-600 hover:text-red-900'}
          >
            Удалить
          </button>
        </div>
      </td>
    </tr>
  );
};

export default GoodsItem; 