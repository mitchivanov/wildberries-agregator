from database import Base
from sqlalchemy import Column, Integer, String, Boolean, DateTime, BigInteger, ForeignKey, Text, JSON, Enum
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship
from datetime import datetime as dt, timedelta
import enum
import random

class Category(Base):
    __tablename__ = "categories"
    
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, index=True, unique=True)
    description = Column(Text, nullable=True)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
    
    goods = relationship("Goods", back_populates="category")
    notes = relationship("CategoryNote", back_populates="category")
    
    def __repr__(self):
        return f"Category(id={self.id}, name={self.name})"

class CategoryNote(Base):
    __tablename__ = "category_notes"
    
    id = Column(Integer, primary_key=True, index=True)
    category_id = Column(Integer, ForeignKey('categories.id'), index=True)
    text = Column(Text, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    
    category = relationship("Category", back_populates="notes")
    
    def __repr__(self):
        return f"CategoryNote(id={self.id}, category_id={self.category_id})"

class Goods(Base):
    __tablename__ = "goods"
    
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, index=True)
    price = Column(Integer)
    cashback_percent = Column(Integer, default=0)
    article = Column(String, index=True)
    url = Column(String, index=True)
    image = Column(String, index=True)
    is_active = Column(Boolean, default=True)
    is_hidden = Column(Boolean, default=False)
    start_date = Column(DateTime(timezone=True), nullable=True)
    end_date = Column(DateTime(timezone=True), nullable=True)
    min_daily = Column(Integer, default=1)
    max_daily = Column(Integer, default=10)
    total_sales_limit = Column(Integer, nullable=True)
    purchase_guide = Column(String, nullable=True)
    category_id = Column(Integer, ForeignKey('categories.id'), nullable=True)
    note = Column(Text, nullable=True)
    confirmation_requirements = Column(JSON, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
    
    category = relationship("Category", back_populates="goods")
    daily_availability = relationship("DailyAvailability", back_populates="goods")
    reservations = relationship("Reservation", back_populates="goods")
    
    def __repr__(self):
        return f"Goods(id={self.id}, name={self.name})"

class DailyAvailability(Base):
    __tablename__ = "daily_availability"
    
    id = Column(Integer, primary_key=True, index=True)
    goods_id = Column(Integer, ForeignKey('goods.id'), index=True)
    date = Column(DateTime(timezone=True), index=True)
    available_quantity = Column(Integer, default=0)
    
    goods = relationship("Goods", back_populates="daily_availability")
    
    def __repr__(self):
        return f"DailyAvailability(id={self.id}, goods_id={self.goods_id}, date={self.date}, quantity={self.available_quantity})"

class ReservationStatus(enum.Enum):
    PENDING = "pending"     # Ожидание подтверждения заказа
    ACTIVE = "active"       # Заказ подтвержден, ожидание получения
    CONFIRMED = "confirmed" # Получение товара подтверждено
    CANCELED = "canceled"   # Отменено

class Reservation(Base):
    __tablename__ = "reservations"
    
    id = Column(Integer, primary_key=True, index=True)
    goods_id = Column(Integer, ForeignKey('goods.id'), index=True)
    user_id = Column(BigInteger, index=True)
    quantity = Column(Integer, default=1)
    reserved_at = Column(DateTime(timezone=True), server_default=func.now())
    status = Column(Enum(ReservationStatus), default=ReservationStatus.ACTIVE, index=True)
    confirmation_data = Column(JSON, nullable=True)  # Данные подтверждения от пользователя
    
    goods = relationship("Goods", back_populates="reservations")

    def __repr__(self):
        return f"Reservation(id={self.id}, goods={self.goods_id}, user={self.user_id}, status={self.status})"