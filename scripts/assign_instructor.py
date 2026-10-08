import os
import sys
from dotenv import load_dotenv
from supabase import create_client

def main():
    if len(sys.argv) != 2:
        print("Usage: python assign_instructor.py <email>")
        sys.exit(1)
        
    email = sys.argv[1]
    load_dotenv()
    
    url = os.environ.get('SUPABASE_URL')
    key = os.environ.get('SUPABASE_KEY')
    
    if not url or not key:
        print("Error: SUPABASE_URL and SUPABASE_KEY must be set in .env")
        sys.exit(1)
        
    # Must use Service Role Key, NOT Publishable Key
    supabase = create_client(url, key)
    
    users = supabase.auth.admin.list_users()
    user = next((u for u in users if u.email == email), None)
    
    if not user:
        print(f"Error: User {email} not found")
        sys.exit(1)
        
    supabase.auth.admin.update_user_by_id(
        user.id, 
        {'app_metadata': {'role': 'instructor'}}
    )
    print(f"Success: Granted 'instructor' role to {email}.")

if __name__ == '__main__':
    main()
