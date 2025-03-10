from typing import List, Optional
from pydantic import BaseModel
from datetime import datetime

class GoodsBase(BaseModel):
    name: str
    price: int
    article: str
    image: str
    is_active: bool = True
    start_date: Optional[datetime] = None
    end_date: Optional[datetime] = None
    min_daily: int = 1
    max_daily: int = 10
    purchase_guide: Optional[str] = None

    class Config:
        from_attributes = True

class GoodsCreate(GoodsBase):
    pass

class GoodsUpdate(BaseModel):
    name: Optional[str] = None
    price: Optional[int] = None
    article: Optional[str] = None
    image: Optional[str] = None
    is_active: Optional[bool] = None

class GoodsResponse(GoodsBase):
    id: int
    created_at: datetime
    updated_at: datetime
    
    class Config:
        orm_mode = True

class ReservationResponse(BaseModel):
    id: int
    goods_id: int
    user_id: int
    quantity: int
    reserved_at: datetime

    class Config:
        from_attributes = True

class DailyAvailabilityBase(BaseModel):
    goods_id: int
    date: datetime
    available_quantity: int

    class Config:
        from_attributes = True

class DailyAvailabilityResponse(DailyAvailabilityBase):
    id: int
    
    class Config:
        orm_mode = True

class ReservationBase(BaseModel):
    goods_id: int
    quantity: int = 1

class ReservationCreate(ReservationBase):
    pass