from typing import List, Optional
from pydantic import BaseModel
from datetime import datetime

class GoodsBase(BaseModel):
    name: str
    price: int
    article: str
    image: str
    is_active: bool = True

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