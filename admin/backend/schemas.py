from typing import List, Optional, Dict, Any
from pydantic import BaseModel, Field
from datetime import datetime

class GoodsBase(BaseModel):
    name: str
    price: int
    cashback_percent: int = 0
    article: str
    url: str
    image: str
    is_active: bool = True
    purchase_guide: Optional[str] = None
    start_date: Optional[datetime] = None
    end_date: Optional[datetime] = None
    min_daily: int = 1
    max_daily: int = 10

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
    purchase_guide: Optional[str] = None
    start_date: Optional[datetime] = None
    end_date: Optional[datetime] = None
    min_daily: Optional[int] = None
    max_daily: Optional[int] = None


class DailyAvailabilityBase(BaseModel):
    date: datetime
    available_quantity: int

    class Config:
        from_attributes = True
        
        
class DailyAvailabilityResponse(DailyAvailabilityBase):
    id: int
    goods_id: int
    goods_name: Optional[str] = None
    
    class Config:
        from_attributes = True
        orm_mode = True

class ReservationResponse(BaseModel):
    id: int
    goods_id: int
    user_id: int
    quantity: int
    reserved_at: datetime
    goods_name: Optional[str] = None

    class Config:
        from_attributes = True
        orm_mode = True


class GoodsResponse(GoodsBase):
    id: int
    created_at: datetime
    updated_at: datetime
    daily_availability: List[DailyAvailabilityResponse] = []
    reservations: List[ReservationResponse] = []
    
    class Config:
        from_attributes = True
        orm_mode = True




class DailyAvailabilityCreate(DailyAvailabilityBase):
    goods_id: int



class ReservationBase(BaseModel):
    goods_id: int
    quantity: int = 1

class ReservationCreate(ReservationBase):
    pass