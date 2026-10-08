from fastapi import Depends, HTTPException, Security
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
import os
import jwt
from jwt import PyJWKClient
from pydantic import BaseModel

security = HTTPBearer()

class User(BaseModel):
    id: str
    email: str
    role: str

_jwks_client = None

def get_jwks_client():
    global _jwks_client
    if _jwks_client is None:
        supabase_url = os.environ.get("SUPABASE_URL")
        if supabase_url:
            jwks_url = f"{supabase_url}/auth/v1/.well-known/jwks.json"
            _jwks_client = PyJWKClient(jwks_url)
    return _jwks_client

def get_current_user(credentials: HTTPAuthorizationCredentials = Security(security)) -> User:
    token = credentials.credentials
    secret = os.environ.get("SUPABASE_JWT_SECRET")
    
    try:
        header = jwt.get_unverified_header(token)
        alg = header.get("alg")
        
        if alg == "HS256":
            if not secret:
                raise HTTPException(status_code=500, detail="JWT secret not configured")
            payload = jwt.decode(token, secret, algorithms=["HS256"], audience="authenticated")
        else:
            client = get_jwks_client()
            if not client:
                raise HTTPException(status_code=500, detail="SUPABASE_URL not configured for JWKS")
            signing_key = client.get_signing_key_from_jwt(token)
            payload = jwt.decode(
                token, 
                signing_key.key, 
                algorithms=["RS256", "ES256", alg], 
                audience="authenticated"
            )

        user_id = payload.get("sub")
        email = payload.get("email")
        
        # In Supabase, custom claims or app_metadata usually hold roles.
        app_metadata = payload.get("app_metadata", {})
        role = app_metadata.get("role", "student")
        
        if not user_id:
            raise HTTPException(status_code=401, detail="Invalid authentication credentials")
            
        return User(id=user_id, email=email, role=role)
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token has expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")
    except HTTPException:
        raise
    except Exception:
        raise HTTPException(status_code=401, detail="Invalid token")

def get_instructor_user(user: User = Depends(get_current_user)) -> User:
    if user.role != "instructor":
        raise HTTPException(status_code=403, detail="Instructor access required")
    return user
