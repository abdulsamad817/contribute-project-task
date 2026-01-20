import os
from dotenv import load_dotenv

load_dotenv()

MONGODB_URI = os.getenv("MONGODB_URI")
SECRET_KEY = os.getenv("SECRET_KEY", "your_secret_key_change_in_production")
DEBUG = os.getenv("DEBUG", "False").lower() == "true"

EMAIL_ADDRESS = os.getenv("EMAIL_ADDRESS")

ZEROBOUNCE_API_KEY = os.getenv("ZEROBOUNCE_API_KEY")
SENDGRID_API_KEY = os.getenv("SENDGRID_API_KEY")

CLOUDINARY_CLOUD_NAME = os.getenv("CLOUDINARY_CLOUD_NAME")
CLOUDINARY_API_KEY = os.getenv("CLOUDINARY_API_KEY")
CLOUDINARY_API_SECRET = os.getenv("CLOUDINARY_API_SECRET")
CLOUDINARY_UPLOAD_PRESET = os.getenv("CLOUDINARY_UPLOAD_PRESET")
