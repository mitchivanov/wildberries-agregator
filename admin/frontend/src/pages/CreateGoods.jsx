import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApi } from '../hooks/useApi';
import Layout from '../components/Layout';
import GoodsForm from '../components/GoodsForm';
import ParseProductForm from '../components/ParseProductForm';
import toast from 'react-hot-toast';

const CreateGoods = () => {
  const [parsedData, setParsedData] = useState(null);
  const [showParseForm, setShowParseForm] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const { createGoods } = useApi();
  const navigate = useNavigate();

  const handleParsedData = (data) => {
    setParsedData(data);
    setShowParseForm(false);
  };

  const handleSubmit = async (values) => {
    setIsLoading(true);
    try {
      await createGoods(values);
      navigate('/admin/goods');
    } catch (error) {
      console.error('Error creating goods:', error);
      toast.error('Ошибка при создании товара');
    } finally {
      setIsLoading(false);
    }
  };

  // Формируем начальные значения на основе данных парсера
  const initialValues = parsedData ? {
    name: parsedData.name || '',
    price: parsedData.price || 0,
    cashback_percent: 0, // Устанавливаем стандартное значение
    article: parsedData.article || '',
    url: parsedData.url || '',
    image: parsedData.image || '',
    purchase_guide: '',
    is_active: true,
    start_date: new Date().toISOString().split('T')[0],
    end_date: new Date(new Date().setDate(new Date().getDate() + 30)).toISOString().split('T')[0],
    min_daily: 1,
    max_daily: 5
  } : null;

  return (
    <Layout>
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Создание товара</h1>
      </div>
      
      {showParseForm ? (
        <ParseProductForm onParsedData={handleParsedData} />
      ) : (
        <GoodsForm 
          initialValues={initialValues} 
          onSubmit={handleSubmit} 
          isLoading={isLoading} 
        />
      )}
    </Layout>
  );
};

export default CreateGoods; 