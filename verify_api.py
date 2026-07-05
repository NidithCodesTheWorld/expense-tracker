import urllib.request
import urllib.parse
import json

BASE_URL = "http://127.0.0.1:8000"

def test_api():
    print("--- STARTING API VERIFICATION ---")
    
    # 1. Register User
    print("\n1. Testing User Registration...")
    reg_data = json.dumps({"username": "jarvis_tester", "password": "securepassword123"}).encode('utf-8')
    req = urllib.request.Request(
        f"{BASE_URL}/api/auth/register",
        data=reg_data,
        headers={"Content-Type": "application/json"}
    )
    try:
        with urllib.request.urlopen(req) as res:
            user = json.loads(res.read().decode('utf-8'))
            print("Registration Successful:", user)
    except urllib.error.HTTPError as e:
        print("Registration error (user might already exist, which is fine):", e.read().decode('utf-8'))

    # 2. Login User
    print("\n2. Testing User Login...")
    login_payload = urllib.parse.urlencode({
        "username": "jarvis_tester",
        "password": "securepassword123"
    }).encode('utf-8')
    req = urllib.request.Request(
        f"{BASE_URL}/api/auth/login",
        data=login_payload,
        headers={"Content-Type": "application/x-www-form-urlencoded"}
    )
    token = None
    with urllib.request.urlopen(req) as res:
        token_res = json.loads(res.read().decode('utf-8'))
        token = token_res["access_token"]
        print("Login Successful. Token obtained.")

    if not token:
        print("Verification failed: no token.")
        return

    auth_headers = {
        "Authorization": f"Bearer {token}",
        "Content-Type": "application/json"
    }

    # 3. Get Seeded Categories
    print("\n3. Testing Get Categories...")
    req = urllib.request.Request(f"{BASE_URL}/api/categories", headers=auth_headers)
    categories = []
    with urllib.request.urlopen(req) as res:
        categories = json.loads(res.read().decode('utf-8'))
        print(f"Categories seeded: {[c['name'] for c in categories]}")

    # Find category IDs
    cat_map = {c['name']: c['id'] for c in categories}
    movies_id = cat_map.get("Movies")
    phone_id = cat_map.get("Phone")

    # 4. Add Expense
    print("\n4. Testing Add Expense (Movies)...")
    exp_data = json.dumps({
        "amount": 25.50,
        "category_id": movies_id,
        "description": "Cinema ticket & popcorn"
    }).encode('utf-8')
    req = urllib.request.Request(
        f"{BASE_URL}/api/expenses",
        data=exp_data,
        headers=auth_headers
    )
    with urllib.request.urlopen(req) as res:
        expense = json.loads(res.read().decode('utf-8'))
        print("Expense Added Successful:", expense)

    # 5. Create Custom Category
    print("\n5. Testing Create Custom Category (Biking)...")
    cat_data = json.dumps({"name": "Biking"}).encode('utf-8')
    req = urllib.request.Request(
        f"{BASE_URL}/api/categories",
        data=cat_data,
        headers=auth_headers
    )
    biking_id = None
    try:
        with urllib.request.urlopen(req) as res:
            new_cat = json.loads(res.read().decode('utf-8'))
            biking_id = new_cat["id"]
            print("Custom Category Created Successful:", new_cat)
    except urllib.error.HTTPError as e:
        # If it already exists, let's fetch categories again to get its id
        print("Category might already exist, fetching again...")
        req = urllib.request.Request(f"{BASE_URL}/api/categories", headers=auth_headers)
        with urllib.request.urlopen(req) as res:
            cats = json.loads(res.read().decode('utf-8'))
            for c in cats:
                if c["name"] == "Biking":
                    biking_id = c["id"]
                    print("Found existing Biking ID:", biking_id)

    # 6. Chat with Jarvis - Request Entry
    print("\n6. Chat with Jarvis: 'spent $150'...")
    chat_data = json.dumps({"message": "spent $150"}).encode('utf-8')
    req = urllib.request.Request(
        f"{BASE_URL}/api/chatbot",
        data=chat_data,
        headers=auth_headers
    )
    with urllib.request.urlopen(req) as res:
        chat_res = json.loads(res.read().decode('utf-8'))
        print("Jarvis Response:", chat_res["response"])
        assert chat_res["action_required"] == "needs_category", "Jarvis should ask for category"

    # 7. Chat with Jarvis - Complete Entry with Category Biking
    print("\n7. Chat with Jarvis: providing category 'Biking'...")
    chat_data = json.dumps({"message": "Biking"}).encode('utf-8')
    req = urllib.request.Request(
        f"{BASE_URL}/api/chatbot",
        data=chat_data,
        headers=auth_headers
    )
    with urllib.request.urlopen(req) as res:
        chat_res = json.loads(res.read().decode('utf-8'))
        print("Jarvis Response:", chat_res["response"])
        assert chat_res["updated_expenses"] is True, "Jarvis should mark expenses as updated"

    # 8. Chat with Jarvis - Query spending today
    print("\n8. Chat with Jarvis: querying 'How much did I spend today?'...")
    chat_data = json.dumps({"message": "How much did I spend today?"}).encode('utf-8')
    req = urllib.request.Request(
        f"{BASE_URL}/api/chatbot",
        data=chat_data,
        headers=auth_headers
    )
    with urllib.request.urlopen(req) as res:
        chat_res = json.loads(res.read().decode('utf-8'))
        print("Jarvis Response:", chat_res["response"])
        # Expected total: 25.50 (movies) + 150 (biking) = 175.50
        assert "175.50" in chat_res["response"], f"Expected total $175.50 in response. Got: {chat_res['response']}"

    print("\n--- ALL API ENDPOINTS FUNCTION PERFECTLY! ---")

if __name__ == "__main__":
    test_api()
