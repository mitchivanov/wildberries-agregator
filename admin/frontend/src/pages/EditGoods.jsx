import { useEffect } from 'react';
import { useTelegram } from '../hooks/useTelegram';
import Layout from '../components/Layout';
import GoodsForm from '../components/GoodsForm';

const EditGoods = () => {
  const { webApp } = useTelegram();

  useEffect(() => {
    if (webApp) {
      webApp.BackButton.show();
      
      const handleBackButton = () => {
        window.location.href = '/goods';
      };
      
      webApp.BackButton.onClick(handleBackButton);
      
      return () => {
        webApp.BackButton.offClick(handleBackButton);
      };
    }
  }, [webApp]);

  return (
    <Layout>
      <GoodsForm isEditing={true} />
    </Layout>
  );
};

export default EditGoods; 