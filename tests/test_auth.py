from fastapi.testclient import TestClient
from fastapi import APIRouter, Depends, HTTPException
from backend.main import app
from backend.api.auth import get_current_user, get_instructor_user, User
import os
import jwt
from datetime import datetime, timedelta, timezone

# Override environment for testing
os.environ["SUPABASE_JWT_SECRET"] = "super-secret-test-key-which-is-at-least-32-chars-long"
SECRET = os.environ["SUPABASE_JWT_SECRET"]

# Create a temporary router for testing auth dependencies
auth_test_router = APIRouter()

@auth_test_router.get("/api-auth-any")
def api_auth_any(user: User = Depends(get_current_user)):
    return {"user": user.model_dump()}

@auth_test_router.get("/api-auth-instructor")
def api_auth_instructor(user: User = Depends(get_instructor_user)):
    return {"user": user.model_dump()}

app.include_router(auth_test_router)

client = TestClient(app)

def create_token(user_id: str, email: str, role: str, expired: bool = False):
    now = datetime.now(timezone.utc)
    exp = now - timedelta(hours=1) if expired else now + timedelta(hours=1)
    
    payload = {
        "sub": user_id,
        "email": email,
        "aud": "authenticated",
        "exp": exp,
        "app_metadata": {
            "role": role
        }
    }
    return jwt.encode(payload, SECRET, algorithm="HS256")

def test_unauthenticated_request():
    response = client.get("/api-auth-any")
    assert response.status_code == 403 or response.status_code == 401
    assert "Not authenticated" in response.json()["detail"]

def test_invalid_jwt():
    headers = {"Authorization": "Bearer not-a-real-jwt"}
    response = client.get("/api-auth-any", headers=headers)
    assert response.status_code == 401
    assert "Invalid token" in response.json()["detail"]

def test_expired_jwt():
    token = create_token("inst_1", "inst@test.com", "instructor", expired=True)
    headers = {"Authorization": f"Bearer {token}"}
    response = client.get("/api-auth-any", headers=headers)
    assert response.status_code == 401
    assert "Token has expired" in response.json()["detail"]

def test_instructor_access():
    token = create_token("inst_1", "inst@test.com", "instructor")
    headers = {"Authorization": f"Bearer {token}"}
    response = client.get("/api-auth-instructor", headers=headers)
    assert response.status_code == 200
    assert response.json()["user"]["role"] == "instructor"

def test_student_access_any():
    token = create_token("stu_1", "stu@test.com", "student")
    headers = {"Authorization": f"Bearer {token}"}
    response = client.get("/api-auth-any", headers=headers)
    assert response.status_code == 200
    assert response.json()["user"]["role"] == "student"

def test_student_access_instructor_route_fails():
    token = create_token("stu_1", "stu@test.com", "student")
    headers = {"Authorization": f"Bearer {token}"}
    response = client.get("/api-auth-instructor", headers=headers)
    assert response.status_code == 403
    assert "Instructor access required" in response.json()["detail"]

def test_unauthorized_student_access_to_another_students_data():
    # Simulate a route that expects a specific student ID
    @app.get("/test-student-data/{student_id}")
    def get_student_data(student_id: str, user: User = Depends(get_current_user)):
        if user.role != "instructor" and user.id != student_id:
            raise HTTPException(status_code=403, detail="Cannot access another student's data")
        return {"data": "secret"}
        
    stu1_token = create_token("stu_1", "stu1@test.com", "student")
    stu2_token = create_token("stu_2", "stu2@test.com", "student")
    inst_token = create_token("inst_1", "inst@test.com", "instructor")
    
    # Test with stu_1 trying to access stu_2
    headers = {"Authorization": f"Bearer {stu1_token}"}
    response = client.get("/test-student-data/stu_2", headers=headers)
    assert response.status_code == 403
    assert "Cannot access another student's data" in response.json()["detail"]
    
    # Test with stu_1 trying to access stu_1 (success)
    response = client.get("/test-student-data/stu_1", headers=headers)
    assert response.status_code == 200
    
    # Test with instructor trying to access stu_2 (success)
    headers = {"Authorization": f"Bearer {inst_token}"}
    response = client.get("/test-student-data/stu_2", headers=headers)
    assert response.status_code == 200
