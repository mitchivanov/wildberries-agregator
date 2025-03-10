from database import Base
from sqlalchemy import Column, Integer, String, Boolean, DateTime, BigInteger, ForeignKey
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship
from datetime import datetime as dt, timedelta
import random

class Goods(Base):
    __tablename__ = "goods"
    
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, index=True)
    price = Column(Integer)
    article = Column(String, index=True)
    image = Column(String, index=True)
    is_active = Column(Boolean, default=True)
    start_date = Column(DateTime(timezone=True), nullable=True)
    end_date = Column(DateTime(timezone=True), nullable=True)
    min_daily = Column(Integer, default=1)
    max_daily = Column(Integer, default=10)
    purchase_guide = Column(String, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
    
    def __repr__(self):
        return f"Goods(id={self.id}, name={self.name}, price={self.price}, article={self.article}, image={self.image})"

class DailyAvailability(Base):
    __tablename__ = "daily_availability"
    
    id = Column(Integer, primary_key=True, index=True)
    goods_id = Column(Integer, ForeignKey('goods.id'), index=True)
    date = Column(DateTime(timezone=True), index=True)
    available_quantity = Column(Integer, default=0)
    
    goods = relationship("Goods", backref="daily_availability")
    
    def __repr__(self):
        return f"DailyAvailability(id={self.id}, goods_id={self.goods_id}, date={self.date}, quantity={self.available_quantity})"

class Reservation(Base):
    __tablename__ = "reservations"
    
    id = Column(Integer, primary_key=True, index=True)
    goods_id = Column(Integer, ForeignKey('goods.id'), index=True)
    user_id = Column(BigInteger, index=True)
    quantity = Column(Integer, default=1)
    reserved_at = Column(DateTime(timezone=True), server_default=func.now())
    
    goods = relationship("Goods", backref="reservations")

    def __repr__(self):
        return f"Reservation(id={self.id}, goods={self.goods_id}, user={self.user_id})"