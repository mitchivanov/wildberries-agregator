import { useEffect } from 'react';
import { useTelegram } from '../hooks/useTelegram';
import Layout from '../components/Layout';
import CategoryForm from '../components/CategoryForm';

const EditCategory = () => {
  const { webApp } = useTelegram();

  useEffect(() => {
    if (webApp) {
      webApp.BackButton.show();
      
      const handleBackButton = () => {
        window.location.href = '/admin/categories';
      };
      
      webApp.BackButton.onClick(handleBackButton);
      
      return () => {
        webApp.BackButton.offClick(handleBackButton);
      };
    }
  }, [webApp]);

  return (
    <Layout>
      <CategoryForm />
    </Layout>
  );
};

export default EditCategory; 