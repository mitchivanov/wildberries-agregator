import { Link } from 'react-router-dom';
import { useTelegram } from '../hooks/useTelegram';

const GoodsItem = ({ goods, onDelete, isHighlighted, rowId, isSelected, onSelect }) => {
  const { isDarkMode } = useTelegram();
  
  const handleDelete = () => {
    if (window.confirm('Вы действительно хотите удалить этот товар?')) {
      onDelete(parseInt(goods.id));
    }
  };

  // Найти доступность на сегодня
  const getTodayAvailability = () => {
    if (!goods.daily_availability || goods.daily_availability.length === 0) {
      return 0;
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const todayItem = goods.daily_availability.find(item => {
      const itemDate = new Date(item.date);
      itemDate.setHours(0, 0, 0, 0);
      return itemDate.getTime() === today.getTime();
    });
    
    return todayItem ? todayItem.available_quantity : 0;
  };

  const todayAvailability = getTodayAvailability();

  // Функция для форматирования требований подтверждения
  const formatRequirements = (requirements) => {
    if (!requirements || requirements.length === 0) return "Нет";
    
    return `${requirements.length} ${requirements.length === 1 ? 'поле' : 
      requirements.length < 5 ? 'поля' : 'полей'}`;
  };

  return (
    <>
      <tr 
        id={rowId}
        className={`${isDarkMode ? 'hover:bg-gray-700' : 'hover:bg-gray-50'} 
          ${isHighlighted ? (isDarkMode ? 'bg-blue-900' : 'bg-blue-100') : ''}
          ${goods.is_hidden ? (isDarkMode ? 'bg-gray-800' : 'bg-gray-200') : ''}`}
      >
        <td className="px-6 py-4 whitespace-nowrap">
          <input
            type="checkbox"
            checked={isSelected}
            onChange={() => onSelect(parseInt(goods.id))}
            className="rounded border-gray-300"
          />
        </td>
        <td className={`px-6 py-4 whitespace-nowrap text-sm ${isDarkMode ? 'text-gray-300' : 'text-gray-500'}`}>
          <div className="flex items-center">
            <div className="ml-1">
              <div className={`text-sm font-medium ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                {goods.id}
              </div>
            </div>
          </div>
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
        <td className={`px-6 py-4 whitespace-nowrap text-sm font-medium ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
          {goods.name}
        </td>
        <td className={`px-6 py-4 whitespace-nowrap text-sm ${isDarkMode ? 'text-gray-300' : 'text-gray-500'}`}>
          {goods.category ? (
            <span className={`px-2 py-1 text-xs rounded ${
              isDarkMode ? 'bg-gray-700 text-gray-200' : 'bg-gray-200 text-gray-800'
            }`}>
              {goods.category.name}
            </span>
          ) : (
            <span className={`text-xs ${isDarkMode ? 'text-gray-500' : 'text-gray-400'}`}>
              Без категории
            </span>
          )}
        </td>
        <td className={`px-6 py-4 whitespace-nowrap text-sm ${isDarkMode ? 'text-gray-300' : 'text-gray-500'}`}>
          {goods.article}
        </td>
        <td className={`px-6 py-4 whitespace-nowrap text-sm ${isDarkMode ? 'text-gray-300' : 'text-gray-500'}`}>
          <a href={goods.url} target="_blank" rel="noopener noreferrer" className="truncate block max-w-xs">
            {goods.url}
          </a>
        </td>
        <td className={`px-6 py-4 whitespace-nowrap text-sm ${isDarkMode ? 'text-gray-300' : 'text-gray-900'}`}>
          {goods.price.toLocaleString()} ₽
        </td>
        <td className={`px-6 py-4 whitespace-nowrap text-sm ${isDarkMode ? 'text-gray-300' : 'text-gray-900'}`}>
          {goods.cashback_percent}%
        </td>
        <td className={`px-6 py-4 whitespace-nowrap text-sm ${isDarkMode ? 'text-gray-300' : 'text-gray-900'}`}>
          {goods.min_daily}-{goods.max_daily}
        </td>
        <td className={`px-6 py-4 whitespace-nowrap text-sm ${isDarkMode ? 'text-gray-300' : 'text-gray-900'}`}>
          <span className={todayAvailability > 0 ? 'text-green-500' : 'text-red-500'}>
            {todayAvailability} шт.
          </span>
        </td>
        <td className={`px-6 py-4 whitespace-nowrap text-sm ${isDarkMode ? 'text-gray-300' : 'text-gray-500'}`}>
          {formatRequirements(goods.confirmation_requirements)}
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
        <td className="px-6 py-4 whitespace-nowrap">
          <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
            goods.is_hidden 
              ? isDarkMode ? 'bg-red-800 text-red-100' : 'bg-red-100 text-red-800'
              : isDarkMode ? 'bg-green-800 text-green-100' : 'bg-green-100 text-green-800'
          }`}>
            {goods.is_hidden ? 'Скрыт' : 'Виден'}
          </span>
        </td>
        <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
          <div className="flex justify-end space-x-3">
            <Link
              to={`/admin/goods/edit/${goods.id}`}
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
      {goods.category && goods.category.notes && goods.category.notes.length > 0 && (
        <tr>
          <td colSpan="12" className="px-0 py-0">
            <div className={`mt-2 px-6 py-2 text-sm rounded ${
              isDarkMode ? 'bg-yellow-900 text-yellow-100' : 'bg-yellow-100 text-yellow-800'
            }`}>
              <strong>Примечания категории:</strong>
              <ul className="mt-1 list-disc list-inside">
                {goods.category.notes.map(note => (
                  <li key={note.id}>{note.text}</li>
                ))}
              </ul>
            </div>
          </td>
        </tr>
      )}
    </>
  );
};

export default GoodsItem; 