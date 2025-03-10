import { useEffect } from 'react';
import { useTelegram } from '../hooks/useTelegram';
import Layout from '../components/Layout';
import GoodsList from '../components/GoodsList';

const GoodsPage = () => {
  const { webApp } = useTelegram();

  useEffect(() => {
    if (webApp) {
      webApp.BackButton.show();
      
      const handleBackButton = () => {
        window.location.href = '/';
      };
      
      webApp.BackButton.onClick(handleBackButton);
      
      return () => {
        webApp.BackButton.offClick(handleBackButton);
      };
    }
  }, [webApp]);

  return (
    <Layout>
      <GoodsList />
    </Layout>
  );
};

export default GoodsPage; 