from pydantic import BaseModel, Field
from typing import Optional, List
import datetime

# User Schemas
class UserCreate(BaseModel):
    username: str
    password: str

class UserResponse(BaseModel):
    id: int
    username: str

    class Config:
        from_attributes = True

# Token Schemas
class Token(BaseModel):
    access_token: str
    token_type: str

class TokenData(BaseModel):
    username: Optional[str] = None

# Category Schemas
class CategoryCreate(BaseModel):
    name: str

class CategoryResponse(BaseModel):
    id: int
    name: str
    user_id: Optional[int] = None

    class Config:
        from_attributes = True

# Expense Schemas
class ExpenseCreate(BaseModel):
    amount: float = Field(gt=0, description="Amount must be positive")
    category_id: int
    description: Optional[str] = None
    date: Optional[datetime.datetime] = None

class ExpenseResponse(BaseModel):
    id: int
    amount: float
    description: Optional[str] = None
    date: datetime.datetime
    category_id: int
    category_name: str
    user_id: int

    class Config:
        from_attributes = True

# Chatbot Schemas
class ChatMessage(BaseModel):
    message: str

class ChatResponse(BaseModel):
    response: str
    amount_detected: Optional[float] = None
    action_required: Optional[str] = None # e.g. "needs_category"
    updated_expenses: Optional[bool] = None
