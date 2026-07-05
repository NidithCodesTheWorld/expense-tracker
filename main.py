import os
import datetime
from typing import List
from fastapi import FastAPI, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from fastapi.middleware.cors import CORSMiddleware  # <-- ADDED
from sqlalchemy.orm import Session

from .database import engine, get_db, Base
from . import models, schemas, auth, chatbot

# Initialize database schema constraints 
Base.metadata.create_all(bind=engine)

app = FastAPI(title="My-Money API")

# --- Configure Cross-Origin Resource Sharing (CORS) ---
# Allows your decoupled GitHub Pages domain to securely interface with the API runtime
origins = [
    "http://localhost:3000",
    "http://127.0.0.1:5500",
    "http://127.0.0.1:8000",
]

# Dynamically add your GitHub Pages custom origin block via environment vars if present
PRODUCTION_DOMAIN = os.getenv("FRONTEND_PRODUCTION_URL")
if PRODUCTION_DOMAIN:
    origins.append(PRODUCTION_DOMAIN)
else:
    # Fallback to wildcard or broad check for testing; restrict explicitly in production
    origins.append("https://*.github.io")

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_origin_regex="https://.*\\.github\\.io", # Securely matches all subdomains under github.io
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Seed default categories if they don't exist
@app.on_event("startup")
def startup_event():
    db = next(get_db())
    default_categories = ["Movies", "Travel", "Miscellaneous", "Grocery", "Phone"]
    for cat_name in default_categories:
        exists = db.query(models.Category).filter(
            models.Category.name == cat_name,
            models.Category.user_id == None
        ).first()
        if not exists:
            new_cat = models.Category(name=cat_name, user_id=None)
            db.add(new_cat)
    db.commit()

# --- Auth Routes ---
@app.post("/api/auth/register", response_model=schemas.UserResponse)
def register(user_in: schemas.UserCreate, db: Session = Depends(get_db)):
    db_user = db.query(models.User).filter(models.User.username == user_in.username).first()
    if db_user:
        raise HTTPException(status_code=400, detail="Username already registered")
    
    hashed_pwd = auth.get_password_hash(user_in.password)
    new_user = models.User(username=user_in.username, hashed_password=hashed_pwd)
    db.add(new_user)
    db.commit()
    db.refresh(new_user)
    return new_user

@app.post("/api/auth/login", response_model=schemas.Token)
def login(form_data: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(get_db)):
    user = db.query(models.User).filter(models.User.username == form_data.username).first()
    if not user or not auth.verify_password(form_data.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    access_token = auth.create_access_token(data={"sub": user.username})
    return {"access_token": access_token, "token_type": "bearer"}

@app.get("/api/users/me", response_model=schemas.UserResponse)
def read_users_me(current_user: models.User = Depends(auth.get_current_user)):
    return current_user

# --- Category Routes ---
@app.get("/api/categories", response_model=List[schemas.CategoryResponse])
def get_categories(current_user: models.User = Depends(auth.get_current_user), db: Session = Depends(get_db)):
    return db.query(models.Category).filter(
        (models.Category.user_id == current_user.id) | (models.Category.user_id == None)
    ).all()

@app.post("/api/categories", response_model=schemas.CategoryResponse)
def create_category(category: schemas.CategoryCreate, current_user: models.User = Depends(auth.get_current_user), db: Session = Depends(get_db)):
    exists = db.query(models.Category).filter(
        models.Category.name == category.name,
        (models.Category.user_id == current_user.id) | (models.Category.user_id == None)
    ).first()
    if exists:
        raise HTTPException(status_code=400, detail="Category already exists")
    
    new_cat = models.Category(name=category.name, user_id=current_user.id)
    db.add(new_cat)
    db.commit()
    db.refresh(new_cat)
    return new_cat

# --- Expense Routes ---
@app.get("/api/expenses", response_model=List[schemas.ExpenseResponse])
def get_expenses(current_user: models.User = Depends(auth.get_current_user), db: Session = Depends(get_db)):
    expenses = db.query(models.Expense).filter(models.Expense.user_id == current_user.id).order_by(models.Expense.date.desc()).all()
    res = []
    for exp in expenses:
        res.append(schemas.ExpenseResponse(
            id=exp.id,
            amount=exp.amount,
            description=exp.description,
            date=exp.date,
            category_id=exp.category_id,
            category_name=exp.category.name,
            user_id=exp.user_id
        ))
    return res

@app.post("/api/expenses", response_model=schemas.ExpenseResponse)
def create_expense(expense: schemas.ExpenseCreate, current_user: models.User = Depends(auth.get_current_user), db: Session = Depends(get_db)):
    category = db.query(models.Category).filter(
        models.Category.id == expense.category_id,
        (models.Category.user_id == current_user.id) | (models.Category.user_id == None)
    ).first()
    if not category:
        raise HTTPException(status_code=404, detail="Category not found")
    
    exp_date = expense.date or datetime.datetime.utcnow()
    new_expense = models.Expense(
        amount=expense.amount,
        description=expense.description,
        date=exp_date,
        category_id=expense.category_id,
        user_id=current_user.id
    )
    db.add(new_expense)
    db.commit()
    db.refresh(new_expense)
    
    return schemas.ExpenseResponse(
        id=new_expense.id,
        amount=new_expense.amount,
        description=new_expense.description,
        date=new_expense.date,
        category_id=new_expense.category_id,
        category_name=category.name,
        user_id=new_expense.user_id
    )

@app.delete("/api/expenses/{expense_id}", status_code=204)
def delete_expense(expense_id: int, current_user: models.User = Depends(auth.get_current_user), db: Session = Depends(get_db)):
    expense = db.query(models.Expense).filter(
        models.Expense.id == expense_id,
        models.Expense.user_id == current_user.id
    ).first()
    if not expense:
        raise HTTPException(status_code=404, detail="Expense not found")
    
    db.delete(expense)
    db.commit()
    return None

# --- Chatbot / Jarvis Route ---
@app.post("/api/chatbot", response_model=schemas.ChatResponse)
def chat_with_jarvis(message: schemas.ChatMessage, current_user: models.User = Depends(auth.get_current_user), db: Session = Depends(get_db)):
    result = chatbot.process_chatbot_message(message.message, current_user, db)
    return schemas.ChatResponse(
        response=result.get("response"),
        amount_detected=result.get("amount_detected"),
        action_required=result.get("action_required"),
        updated_expenses=result.get("updated_expenses")
    )

# --- Serving Frontend Static Files (Kept active for local testing loops) ---
BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
FRONTEND_DIR = os.path.join(BASE_DIR, "frontend")

if os.path.exists(FRONTEND_DIR):
    app.mount("/static", StaticFiles(directory=FRONTEND_DIR), name="static")

@app.get("/")
def read_root():
    index_path = os.path.join(FRONTEND_DIR, "index.html")
    if os.path.exists(index_path):
        return FileResponse(index_path)
    return {"message": "Server system live. UI running decoupled."}
