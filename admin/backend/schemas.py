from typing import List, Optional, Dict, Any, Union
from pydantic import BaseModel, Field
from datetime import datetime
from pydantic import validator
from enum import Enum

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
    total_sales_limit: Optional[int] = None
    category_id: Optional[int] = None
    note: Optional[str] = None
    confirmation_requirements: Optional[List[Dict[str, str]]] = None

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
    total_sales_limit: Optional[int] = None
    category_id: Optional[int] = None
    note: Optional[str] = None

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

class CategoryNoteBase(BaseModel):
    text: str

class CategoryNoteCreate(CategoryNoteBase):
    category_id: int

class CategoryNoteResponse(CategoryNoteBase):
    id: int
    category_id: int
    created_at: datetime
    
    class Config:
        from_attributes = True

# Обновление схем для категорий с учетом примечаний
class CategoryResponse(CategoryBase):
    id: int
    created_at: datetime
    updated_at: datetime
    notes: List[CategoryNoteResponse] = []
    
    class Config:
        from_attributes = True
        
    @validator('notes', pre=True)
    def set_notes_default(cls, v):
        # Если notes is None, возвращаем пустой список
        return v or []

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

# Определение статусов бронирования для схем
class ReservationStatusEnum(str, Enum):
    PENDING = "pending"
    ACTIVE = "active"
    CONFIRMED = "confirmed"
    CANCELED = "canceled"

# Обновляем схемы для резервирования
class ReservationBase(BaseModel):
    goods_id: int
    quantity: int = 1

class ReservationCreate(ReservationBase):
    pass

# Обновляем схему для данных подтверждения
class ConfirmationFileInfo(BaseModel):
    filename: str
    path: str
    file_type: str  # 'image' или 'video'
    content_type: str
    size: int

class ConfirmationItem(BaseModel):
    type: str  # 'text', 'photo' или 'video'
    title: str
    value: str  # Текст или путь к файлу
    file_info: Optional[ConfirmationFileInfo] = None

# Обновляем схему для отправки данных подтверждения
class ReservationConfirmationUpdate(BaseModel):
    confirmation_type: str  # 'order' или 'delivery'
    confirmation_data: Dict[str, ConfirmationItem]

# Схема для данных подтверждения
class ConfirmationDataItem(BaseModel):
    type: str  # "text" или "photo"
    title: str
    value: str

class ReservationConfirmationData(BaseModel):
    confirmation_data: Dict[str, ConfirmationDataItem]

class ReservationResponse(BaseModel):
    id: int
    user_id: int
    goods_id: int
    quantity: int
    reserved_at: datetime
    status: str = "reserved"  # Добавляем значение по умолчанию
    goods_name: Optional[str] = None
    goods_image: Optional[str] = None
    goods_price: Optional[float] = None
    goods_cashback_percent: Optional[float] = None

    class Config:
        from_attributes = True

# Схема для обновления статуса бронирования
class ReservationStatusUpdate(BaseModel):
    status: ReservationStatusEnum

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
