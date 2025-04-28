// src/pages/CreateCategory.jsx
import { useEffect } from 'react';
import { useTelegram } from '../hooks/useTelegram';
import Layout from '../components/Layout';
import CategoryForm from '../components/CategoryForm';

const CreateCategory = () => {
  const { webApp } = useTelegram();

  useEffect(() => {
    if (webApp) {
      webApp.MainButton.hide();
      
      // Set page title
      webApp.setHeaderColor('bg_color');
      document.title = 'Создание категории';
      
      return () => {
        webApp.MainButton.hide();
      };
    }
  }, [webApp]);

  return (
    <Layout>
      <CategoryForm />
    </Layout>
  );
};

export default CreateCategory;