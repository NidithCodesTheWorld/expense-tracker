import re
from datetime import datetime, timedelta
from sqlalchemy.orm import Session
from sqlalchemy import func
from . import models

# In-memory store for pending chatbot transactions: {user_id: {"amount": float, "description": str, "time": datetime}}
pending_transactions = {}

def process_chatbot_message(message: str, user: models.User, db: Session) -> dict:
    msg_clean = message.strip().lower()
    user_id = user.id
    
    # 1. Check if user has a pending transaction (waiting for category)
    if user_id in pending_transactions:
        pending = pending_transactions[user_id]
        
        # Check if the user wants to cancel
        if msg_clean in ["cancel", "stop", "nevermind", "forget it"]:
            del pending_transactions[user_id]
            return {
                "response": "Understood, sir. I have cancelled the pending entry."
            }
            
        # Try to resolve category
        # Fetch all user's categories (default + custom)
        categories = db.query(models.Category).filter(
            (models.Category.user_id == user_id) | (models.Category.user_id == None)
        ).all()
        
        target_category = None
        # Check direct match
        for cat in categories:
            if cat.name.lower() == msg_clean:
                target_category = cat
                break
                
        # Check partial/contains match
        if not target_category:
            for cat in categories:
                if cat.name.lower() in msg_clean or msg_clean in cat.name.lower():
                    target_category = cat
                    break
        
        # If category matched, save the expense!
        if target_category:
            amount = pending["amount"]
            description = pending["description"] or "Added via Jarvis Chat"
            
            new_expense = models.Expense(
                amount=amount,
                description=description,
                date=datetime.utcnow(),
                category_id=target_category.id,
                user_id=user_id
            )
            db.add(new_expense)
            db.commit()
            db.refresh(new_expense)
            
            del pending_transactions[user_id]
            
            return {
                "response": f"Indeed, sir. I have saved an expense of **${amount:.2f}** under the **{target_category.name}** category.",
                "updated_expenses": True
            }
        else:
            # Category not found. Ask again and list categories
            cat_list = ", ".join([c.name for c in categories])
            return {
                "response": f"I couldn't match '{message}' with any category. Which of the following categories should I use?\n\n* {cat_list}\n\n*(Or type 'cancel' to abort)*",
                "action_required": "needs_category"
            }
            
    # 2. Check if user is asking for spending statistics
    # Patterns for Today
    if any(p in msg_clean for p in ["today", "spending today", "spend today", "spent today"]):
        today_start = datetime.utcnow().replace(hour=0, minute=0, second=0, microsecond=0)
        total = db.query(func.sum(models.Expense.amount)).filter(
            models.Expense.user_id == user_id,
            models.Expense.date >= today_start
        ).scalar() or 0.0
        return {
            "response": f"Your total expenditure for today is **${total:.2f}**, sir."
        }
        
    # Patterns for Week
    if any(p in msg_clean for p in ["this week", "spend this week", "spent this week", "spending of the week", "my week"]):
        # Start of current week (Monday)
        today = datetime.utcnow()
        start_of_week = today - timedelta(days=today.weekday())
        start_of_week = start_of_week.replace(hour=0, minute=0, second=0, microsecond=0)
        total = db.query(func.sum(models.Expense.amount)).filter(
            models.Expense.user_id == user_id,
            models.Expense.date >= start_of_week
        ).scalar() or 0.0
        return {
            "response": f"You have spent a total of **${total:.2f}** this week, sir."
        }
        
    # Patterns for Month
    if any(p in msg_clean for p in ["this month", "spend this month", "spent this month", "spending of the month", "my month"]):
        today = datetime.utcnow()
        start_of_month = today.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
        total = db.query(func.sum(models.Expense.amount)).filter(
            models.Expense.user_id == user_id,
            models.Expense.date >= start_of_month
        ).scalar() or 0.0
        return {
            "response": f"For the current month, your total expenditure stands at **${total:.2f}**, sir."
        }
        
    # Patterns for Year
    if any(p in msg_clean for p in ["this year", "spend this year", "spent this year", "spending of the year", "my year"]):
        today = datetime.utcnow()
        start_of_year = today.replace(month=1, day=1, hour=0, minute=0, second=0, microsecond=0)
        total = db.query(func.sum(models.Expense.amount)).filter(
            models.Expense.user_id == user_id,
            models.Expense.date >= start_of_year
        ).scalar() or 0.0
        return {
            "response": f"In the entirety of this year, you have spent a total of **${total:.2f}**, sir."
        }

    # 3. Check for Quick Expense Entry Pattern e.g. "spent $200" or "spent 200" or just "$200"
    # Matches patterns like "spent $200", "spent 200.50", "add $45", "$150", "150.25", etc.
    amount_match = re.search(r'(?:spent|add|buy)?\s*\$?\s*(\d+(?:\.\d{1,2})?)', msg_clean)
    if amount_match:
        try:
            amount = float(amount_match.group(1))
            # Extract possible description (words after amount or general words)
            description = None
            # e.g. "spent $200 on grocery" -> "grocery" as description/hint
            desc_match = re.search(r'on\s+(.+)', msg_clean)
            if desc_match:
                description = desc_match.group(1).strip().capitalize()
            
            # Save to pending transactions
            pending_transactions[user_id] = {
                "amount": amount,
                "description": description,
                "time": datetime.utcnow()
            }
            
            # Fetch all user's categories to present to them
            categories = db.query(models.Category).filter(
                (models.Category.user_id == user_id) | (models.Category.user_id == None)
            ).all()
            cat_list = ", ".join([c.name for c in categories])
            
            return {
                "response": f"I have noted the amount of **${amount:.2f}**. Which category does this belong to, sir?\n\n* {cat_list}",
                "amount_detected": amount,
                "action_required": "needs_category"
            }
        except ValueError:
            pass

    # Default fallback greeting / help response
    return {
        "response": "Greetings, sir. I am J.A.R.V.I.S., your personal expense assistant. How may I be of service?\n\n"
                    "You may ask questions like:\n"
                    "* *'What is my spending today?'*\n"
                    "* *'How much did I spend this week/month/year?'*\n"
                    "Or record a transaction by saying:\n"
                    "* *'spent $200'* or *'spent $45 on lunch'*"
    }
