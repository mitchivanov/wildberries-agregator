import { useEffect } from 'react';
import { useTelegram } from '../hooks/useTelegram';
import Layout from '../components/Layout';
import CategoryList from '../components/CategoryList';

const Categories = () => {
  const { webApp } = useTelegram();

  useEffect(() => {
    if (webApp) {
      webApp.BackButton.show();
      
      const handleBackButton = () => {
        window.location.href = '/admin/dashboard';
      };
      
      webApp.BackButton.onClick(handleBackButton);
      
      return () => {
        webApp.BackButton.offClick(handleBackButton);
      };
    }
  }, [webApp]);

  return (
    <Layout>
      <CategoryList />
    </Layout>
  );
};

export default Categories; 