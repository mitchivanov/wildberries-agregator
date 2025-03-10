from database import Base
from sqlalchemy import Column, Integer, String, Boolean, DateTime, BigInteger
from sqlalchemy.sql import func

class Goods(Base):
    __tablename__ = "goods"
    
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, index=True)
    price = Column(Integer)
    article = Column(String, index=True)
    image = Column(String, index=True)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
    
    def __repr__(self):
        return f"Goods(id={self.id}, name={self.name}, price={self.price}, article={self.article}, image={self.image})"

class Admin(Base):
    __tablename__ = "admins"
    
    user_id = Column(BigInteger, primary_key=True)
    full_name = Column(String)
    is_superadmin = Column(Boolean, default=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())