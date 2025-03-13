from typing import List, Optional, Dict, Any
from pydantic import BaseModel, Field
from datetime import datetime
from pydantic import validator

# Базовые схемы для товаров
class GoodsBase(BaseModel):
    name: str
    price: int
    cashback_percent: int = 0
    article: str
    url: str
    image: str
    is_active: bool = True
    is_hidden: bool = False
    purchase_guide: Optional[str] = None
    start_date: Optional[datetime] = None
    end_date: Optional[datetime] = None
    min_daily: int = 1
    max_daily: int = 10
    category_id: Optional[int] = None

    class Config:
        from_attributes = True

class GoodsCreate(GoodsBase):
    pass

class GoodsUpdate(BaseModel):
    name: Optional[str] = None
    price: Optional[int] = None
    cashback_percent: Optional[int] = None
    article: Optional[str] = None
    url: Optional[str] = None
    image: Optional[str] = None
    is_active: Optional[bool] = None
    is_hidden: Optional[bool] = None
    purchase_guide: Optional[str] = None
    start_date: Optional[datetime] = None
    end_date: Optional[datetime] = None
    min_daily: Optional[int] = None
    max_daily: Optional[int] = None
    category_id: Optional[int] = None

# Схемы для категорий
class CategoryBase(BaseModel):
    name: str
    description: Optional[str] = None
    is_active: bool = True

    class Config:
        from_attributes = True

class CategoryCreate(CategoryBase):
    pass

class CategoryUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    is_active: Optional[bool] = None

class CategoryResponse(BaseModel):
    id: int
    name: str
    description: Optional[str] = None
    is_active: bool = True
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None
    
    class Config:
        from_attributes = True

# Схемы для доступности
class DailyAvailabilityBase(BaseModel):
    date: datetime
    available_quantity: int

    class Config:
        from_attributes = True

class DailyAvailabilityCreate(DailyAvailabilityBase):
    goods_id: int
        
class DailyAvailabilityResponse(DailyAvailabilityBase):
    id: int
    goods_id: int
    goods_name: Optional[str] = None
    
    class Config:
        from_attributes = True

# Схемы для резервирования
class ReservationBase(BaseModel):
    goods_id: int
    quantity: int = 1

class ReservationCreate(ReservationBase):
    pass

class ReservationResponse(BaseModel):
    id: int
    goods_id: int
    user_id: int
    quantity: int
    reserved_at: datetime
    goods_name: Optional[str] = None
    goods_image: Optional[str] = None
    goods_price: Optional[int] = None
    goods_cashback_percent: Optional[int] = None

    class Config:
        from_attributes = True

# Расширенные схемы с вложенными объектами
class GoodsResponse(GoodsBase):
    id: int
    created_at: datetime
    updated_at: datetime
    daily_availability: List[DailyAvailabilityResponse] = []
    reservations: List[ReservationResponse] = []
    category: Optional[CategoryResponse] = None
    
    class Config:
        from_attributes = True

# Добавить в schemas.py
class BulkVisibilityUpdate(BaseModel):
    goods_ids: List[int] = Field(..., description="Список ID товаров для обновления")

    @validator('goods_ids')
    def validate_goods_ids(cls, v):
        if not v:
            raise ValueError("Список товаров не может быть пустым")
        return [int(id) for id in v]  # Убедимся, что все ID - целые числа

    class Config:
        json_schema_extra = {
            "example": {
                "goods_ids": [1, 2, 3]
            }
        }
