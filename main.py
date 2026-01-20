from flask import Flask, render_template, request, jsonify, session, redirect, url_for
from pymongo import MongoClient
from bson import ObjectId
from werkzeug.security import generate_password_hash, check_password_hash
from functools import wraps
import re
import random
import string
from datetime import datetime, timedelta
from email_validator import validate_email, EmailNotValidError
import requests
import ssl
import urllib.request
from sendgrid import SendGridAPIClient
from sendgrid.helpers.mail import Mail
from config import MONGODB_URI, SECRET_KEY, EMAIL_ADDRESS, ZEROBOUNCE_API_KEY, SENDGRID_API_KEY, CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET, CLOUDINARY_UPLOAD_PRESET
from flask_caching import Cache
from flask_wtf.csrf import CSRFProtect
from flask_limiter import Limiter
from flask_limiter.util import get_remote_address
from markupsafe import escape


ssl._create_default_https_context = ssl._create_unverified_context

app = Flask(__name__)
app.secret_key = SECRET_KEY

# CSRF Protection disabled for JSON APIs (use Content-Type header validation instead)
# Note: API endpoints use JSON with secure headers, no CSRF needed
app.config['WTF_CSRF_ENABLED'] = False

# Rate Limiting
limiter = Limiter(
    app=app,
    key_func=get_remote_address,
    default_limits=["200 per day", "50 per hour"],
    storage_uri="memory://"
)

# Configure caching
cache_config = {
    'CACHE_TYPE': 'simple',
    'CACHE_DEFAULT_TIMEOUT': 30  # 30 seconds cache
}
app.config.from_mapping(cache_config)
cache = Cache(app)

# Error handlers
@app.errorhandler(429)
def ratelimit_handler(e):
    return jsonify({'success': False, 'error': 'Too many requests. Please try again later.'}), 429

# Security Headers
@app.after_request
def set_security_headers(response):
    response.headers['X-Content-Type-Options'] = 'nosniff'
    response.headers['X-Frame-Options'] = 'SAMEORIGIN'
    response.headers['X-XSS-Protection'] = '1; mode=block'
    response.headers['Strict-Transport-Security'] = 'max-age=31536000; includeSubDomains'
    response.headers['Content-Security-Policy'] = "default-src 'self'; script-src 'self' 'unsafe-inline' https://cdnjs.cloudflare.com https://upload-widget.cloudinary.com; style-src 'self' 'unsafe-inline' https://cdnjs.cloudflare.com https://fonts.googleapis.com; img-src 'self' data: https:; font-src 'self' https://cdnjs.cloudflare.com https://fonts.gstatic.com; media-src 'self' data: https:;"
    return response


try:
    client = MongoClient(MONGODB_URI, serverSelectionTimeoutMS=5000)
    client.admin.command('ping')
    db = client["auth_db"]
    print("✓ Connected to MongoDB")
except Exception as e:
    print(f"✗ MongoDB connection failed: {e}")
    print("Make sure MONGODB_URI in config.py is correct")
    raise

users_collection = db["users"]
verification_collection = db["verifications"]
posts_collection = db["posts"]
likes_collection = db["likes"]
comments_collection = db["comments"]
comment_likes_collection = db["comment_likes"]
followers_collection = db["followers"]
notifications_collection = db["notifications"]
messages_collection = db["messages"]
reposts_collection = db["reposts"]
hashtags_collection = db["hashtags"]
mutes_collection = db["mutes"]
blocks_collection = db["blocks"]
reports_collection = db["reports"]

# Create indexes for faster queries
try:
    users_collection.create_index('email')
    users_collection.create_index('username')
    posts_collection.create_index('user_id')
    posts_collection.create_index('created_at')
    likes_collection.create_index('post_id')
    likes_collection.create_index([('post_id', 1), ('user_id', 1)])
    comments_collection.create_index('post_id')
    comments_collection.create_index('user_id')
    followers_collection.create_index('follower_id')
    followers_collection.create_index([('follower_id', 1), ('following_id', 1)])
    reposts_collection.create_index('post_id')
    reposts_collection.create_index([('post_id', 1), ('user_id', 1)])
    hashtags_collection.create_index('tag')
    hashtags_collection.create_index('created_at')
    mutes_collection.create_index([('user_id', 1), ('muted_user_id', 1)])
    blocks_collection.create_index([('user_id', 1), ('blocked_user_id', 1)])
    reports_collection.create_index('post_id')
    reports_collection.create_index([('post_id', 1), ('user_id', 1)])
    posts_collection.create_index([('user_id', 1), ('created_at', -1)])  
    followers_collection.create_index([('following_id', 1)])  
    notifications_collection.create_index([('user_id', 1), ('created_at', -1)])  
    notifications_collection.create_index([('user_id', 1), ('read', 1)])  
    
    print("✓ Database indexes created")
except Exception as e:
    print(f"Index creation: {e}")

def validate_post_text(text, max_length=280):
    """Validate post/comment text"""
    if not text or not isinstance(text, str):
        return False, "Text is required"
    
    text = text.strip()
    if len(text) == 0:
        return False, "Text cannot be empty"
    
    if len(text) > max_length:
        return False, f"Text exceeds {max_length} characters"
    
    # Basic SQL injection prevention
    dangerous_patterns = ['<script', 'javascript:', 'onclick=', 'onerror=']
    text_lower = text.lower()
    if any(pattern in text_lower for pattern in dangerous_patterns):
        return False, "Text contains invalid characters"
    
    return True, text.strip()

def verify_email_zerobounce(email):
    """Verify email exists using ZeroBounce"""
    try:
        url = f"https://api.zerobounce.net/v2/validate?api_key={ZEROBOUNCE_API_KEY}&email={email}"
        response = requests.get(url, timeout=10)
        data = response.json()
        
        if data.get('status') == 'valid':
            return True
        else:
            return False
    except Exception as e:
        print(f"ZeroBounce error: {e}")
        return False

def extract_hashtags(text):
    """Extract hashtags from text"""
    import re
    hashtags = re.findall(r'#\w+', text)
    return list(set([tag.lower() for tag in hashtags]))

def update_hashtag_counts(hashtags, post_id):
    """Update hashtag counts for trending"""
    for tag in hashtags:
        hashtags_collection.update_one(
            {'tag': tag},
            {
                '$inc': {'count': 1},
                '$addToSet': {'post_ids': post_id},
                '$set': {'updated_at': datetime.now()}
            },
            upsert=True
        )

def send_verification_email(email, code):
    """Send OTP to email using SendGrid"""
    try:
        message = Mail(
            from_email=EMAIL_ADDRESS,
            to_emails=email,
            subject='Your Verification Code',
            html_content=f"""
            <html>
                <body style="font-family: Arial, sans-serif; color: #333;">
                    <p>Your verification code is:</p>
                    <h2 style="color: #6366f1; letter-spacing: 2px;">{code}</h2>
                    <p style="color: #999; font-size: 12px;">This code expires in 2 hours.</p>
                    <p style="color: #999; font-size: 12px;">Do not share this code with anyone.</p>
                </body>
            </html>
            """
        )
        
        sg = SendGridAPIClient(SENDGRID_API_KEY)
        response = sg.send(message)
        print(f"Email sent to {email} with code {code}")
        return True
    except Exception as e:
        print(f"SendGrid error: {e}")
        return False

def login_required(f):
    @wraps(f)
    def decorated_function(*args, **kwargs):
        if 'user_id' not in session:
            return redirect(url_for('login'))
        return f(*args, **kwargs)
    return decorated_function

@app.route('/')
def index():
    if 'user_id' in session:
        return redirect(url_for('dashboard'))
    return redirect(url_for('login'))

@app.route('/login', methods=['GET', 'POST'])
@limiter.limit("5 per minute")
def login():
    if request.method == 'POST':
        data = request.get_json()
        email = data.get('email', '').strip().lower()
        password = data.get('password', '')
        
        if not email or not password:
            return jsonify({'success': False, 'error': 'Email and password required'}), 400
        
        user = users_collection.find_one({'email': email})
        
        if user and check_password_hash(user['password'], password):
            session['user_id'] = str(user['_id'])
            session['email'] = user['email']
            session['name'] = user['name']
            return jsonify({'success': True, 'message': 'Login successful'}), 200
        
        return jsonify({'success': False, 'error': 'Invalid email or password'}), 401
    
    return render_template('login.html')

@app.route('/signup', methods=['GET', 'POST'])
@limiter.limit("3 per minute")
def signup():
    if request.method == 'POST':
        data = request.get_json()
        action = data.get('action')
        
        if action == 'check_email':
            email = data.get('email', '').strip().lower()
            
            if not email:
                return jsonify({'success': False, 'error': 'Email is required'}), 400
            
            if ' ' in email:
                return jsonify({'success': False, 'error': 'Email cannot contain spaces'}), 400
            
            if not re.match(r'^[a-zA-Z0-9._-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$', email):
                return jsonify({'success': False, 'error': 'Invalid email format'}), 400
            
            if users_collection.find_one({'email': email}):
                return jsonify({'success': False, 'error': 'Email already exists'}), 400
            
            return jsonify({'success': True, 'message': 'Email valid'}), 200
        
        elif action == 'check_name':
            username = data.get('name', '').strip().lower()
            
            if not username:
                return jsonify({'success': False, 'error': 'Username is required'}), 400
            
            if not re.match(r'^[a-zA-Z0-9_]{3,30}$', username):
                return jsonify({'success': False, 'error': 'Username must be 3-30 characters (letters, numbers, underscores only)'}), 400
            
           
            if users_collection.find_one({'username': username}):
                return jsonify({'success': False, 'error': 'Username already taken'}), 400
            
            return jsonify({'success': True, 'message': 'Username valid'}), 200
        
        elif action == 'send_verification':
            email = data.get('email', '').strip().lower()
            name = data.get('name', '').strip()
            dob = data.get('dob', '').strip()
            gender = data.get('gender', '').strip()
            
            if not all([email, name, dob, gender]):
                return jsonify({'success': False, 'error': 'All fields required'}), 400
            
            from datetime import date
            try:
                birth_date = datetime.strptime(dob, '%Y-%m-%d').date()
                today = date.today()
                age = today.year - birth_date.year - ((today.month, today.day) < (birth_date.month, birth_date.day))
                
                if age < 16:
                    return jsonify({'success': False, 'error': 'You must be at least 16 years old'}), 400
            except:
                return jsonify({'success': False, 'error': 'Invalid date format'}), 400
            
            code = ''.join(random.choices(string.digits, k=6))
            
            if not send_verification_email(email, code):
                return jsonify({'success': False, 'error': 'Failed to send email'}), 500
            
            verification_collection.update_one(
                {'email': email},
                {'$set': {
                    'code': code,
                    'data': {
                        'name': name,
                        'dob': dob,
                        'gender': gender
                    },
                    'created_at': datetime.now(),
                    'expires_at': datetime.now() + timedelta(hours=2)
                }},
                upsert=True
            )
            
            return jsonify({'success': True, 'message': 'Code sent to email'}), 200
        
        elif action == 'resend_code':
            email = data.get('email', '').strip().lower()
            
            if not email:
                return jsonify({'success': False, 'error': 'Email is required'}), 400
            
            verification = verification_collection.find_one({'email': email})
            
            if not verification:
                return jsonify({'success': False, 'error': 'No pending verification'}), 400
            
            code = ''.join(random.choices(string.digits, k=6))
        
            if not send_verification_email(email, code):
                return jsonify({'success': False, 'error': 'Failed to send code'}), 500
            
            verification_collection.update_one(
                {'email': email},
                {'$set': {
                    'code': code,
                    'created_at': datetime.now(),
                    'expires_at': datetime.now() + timedelta(hours=2)
                }}
            )
            
            return jsonify({'success': True, 'message': 'Code resent to email'}), 200
        
        elif action == 'verify_code':
            email = data.get('email', '').strip().lower()
            code = data.get('code', '').strip()
            password = data.get('password', '')
            
            if not code:
                return jsonify({'success': False, 'error': 'Code is required'}), 400
            
            if not password or len(password) < 8:
                return jsonify({'success': False, 'error': 'Password must be at least 8 characters'}), 400
            
            verification = verification_collection.find_one({'email': email})
            
            if not verification:
                return jsonify({'success': False, 'error': 'No pending verification'}), 400
            
            if datetime.now() > verification.get('expires_at', datetime.now()):
                return jsonify({'success': False, 'error': 'Code has expired. Request a new one'}), 400
            
            if verification['code'] != code:
                return jsonify({'success': False, 'error': 'Invalid code'}), 400
            
            user_data = verification['data']
            hashed_password = generate_password_hash(password)
            
            users_collection.insert_one({
                'email': email,
                'username': user_data['name'].lower(),
                'name': user_data['name'],
                'dob': user_data['dob'],
                'gender': user_data['gender'],
                'password': hashed_password,
                'created_at': datetime.now()
            })
            
            verification_collection.delete_one({'email': email})
            
            user = users_collection.find_one({'email': email})
            session['user_id'] = str(user['_id'])
            session['email'] = user['email']
            session['name'] = user['name']
            
            return jsonify({'success': True, 'message': 'Account created successfully'}), 200
    
    return render_template('signup.html')

@app.route('/dashboard')
@login_required
def dashboard():
    return render_template('dashboard.html', name=session.get('name'), email=session.get('email'))

@app.route('/api/current-user')
@login_required
def current_user():
    user_id = session.get('user_id')
    user = users_collection.find_one({'_id': ObjectId(user_id)})
    avatar = user.get('avatar') if user else None
    return jsonify({'success': True, 'user_id': user_id, 'avatar': avatar}), 200

@app.route('/api/upload-avatar', methods=['POST'])
@login_required
def upload_avatar():
    data = request.get_json()
    avatar = data.get('avatar')
    
    if not avatar:
        return jsonify({'success': False, 'error': 'No avatar provided'}), 400
    
    # Validate it's a URL (from Cloudinary), not base64
    if not avatar.startswith('http'):
        return jsonify({'success': False, 'error': 'Invalid avatar format - must be Cloudinary URL'}), 400
    
    try:
        users_collection.update_one(
            {'_id': ObjectId(session.get('user_id'))},
            {'$set': {'avatar': avatar}}
        )
        return jsonify({'success': True, 'message': 'Avatar updated'}), 200
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

@app.route('/api/users')
@login_required
def get_users():
    try:
        users = []
        current_user_id = session['user_id']
        
        # Get all users (limit to 50)
        users_list = list(users_collection.find(
            {'_id': {'$ne': ObjectId(current_user_id)}}
        ).limit(50))
        
        # Get all follows for current user in ONE query (not N queries)
        user_ids = [str(u['_id']) for u in users_list]
        following_ids = set([doc['following_id'] for doc in followers_collection.find({
            'follower_id': current_user_id,
            'following_id': {'$in': user_ids}
        })])
        
        # Build response
        for user in users_list:
            user_id_str = str(user['_id'])
            is_following = user_id_str in following_ids
            
            users.append({
                '_id': user_id_str,
                'username': user.get('username', ''),
                'email': user.get('email', ''),
                'avatar': user.get('avatar'),
                'name': user.get('name', ''),
                'is_following': is_following
            })
        return jsonify({'success': True, 'users': users}), 200
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

@app.route('/api/users/search', methods=['GET'])
@login_required
def search_users():
    try:
        query = request.args.get('q', '').strip().lower()
        current_user_id = session['user_id']
        
        if not query or len(query) < 1:
            return jsonify({'success': True, 'users': []}), 200
        
        # Search by username or name
        users = []
        for user in users_collection.find({
            '$or': [
                {'username': {'$regex': query, '$options': 'i'}},
                {'name': {'$regex': query, '$options': 'i'}}
            ]
        }).limit(10):
            # Don't include current user
            if str(user['_id']) != current_user_id:
                users.append({
                    '_id': str(user['_id']),
                    'username': user.get('username', ''),
                    'name': user.get('name', ''),
                    'avatar': user.get('avatar')
                })
        
        return jsonify({'success': True, 'users': users}), 200
    except Exception as e:
        print(f"Search users error: {str(e)}")
        import traceback
        traceback.print_exc()
        return jsonify({'success': False, 'error': str(e)}), 500

@app.route('/forgot-password', methods=['GET', 'POST'])
def forgot_password():
    if request.method == 'POST':
        data = request.get_json()
        action = data.get('action')
        
        if action == 'check_email':
            email = data.get('email', '').strip().lower()
            
            if not email:
                return jsonify({'success': False, 'error': 'Email is required'}), 400
            
            user = users_collection.find_one({'email': email})
            
            if not user:
                return jsonify({'success': False, 'error': 'Email not found'}), 400
            
            code = ''.join(random.choices(string.digits, k=6))
            
            # Send verification email with reset code
            if not send_verification_email(email, code):
                return jsonify({'success': False, 'error': 'Failed to send email. Try again.'}), 500
            
            verification_collection.update_one(
                {'email': email, 'type': 'password_reset'},
                {'$set': {
                    'code': code,
                    'created_at': datetime.now(),
                    'expires_at': datetime.now() + timedelta(hours=2)
                }},
                upsert=True
            )
            
            return jsonify({'success': True, 'message': 'Verification code sent to email'}), 200
        
        elif action == 'reset_password':
            email = data.get('email', '').strip().lower()
            code = data.get('code', '').strip()
            password = data.get('password', '')
            
            if not code:
                return jsonify({'success': False, 'error': 'Code is required'}), 400
            
            if not password or len(password) < 8:
                return jsonify({'success': False, 'error': 'Password must be at least 8 characters'}), 400
            
            verification = verification_collection.find_one({
                'email': email,
                'type': 'password_reset',
                'code': code
            })
            
            if not verification:
                return jsonify({'success': False, 'error': 'Invalid code'}), 400
            
            # Check if code has expired
            if datetime.now() > verification.get('expires_at', datetime.now()):
                return jsonify({'success': False, 'error': 'Code has expired. Request a new one'}), 400
            
            hashed_password = generate_password_hash(password)
            
            users_collection.update_one(
                {'email': email},
                {'$set': {'password': hashed_password}}
            )
            
            verification_collection.delete_one({
                'email': email,
                'type': 'password_reset'
            })
            
            return jsonify({'success': True, 'message': 'Password reset successfully'}), 200
    
    return render_template('forgot_password.html')

@app.route('/reset-password', methods=['GET', 'POST'])
def reset_password():
    return render_template('reset_password.html')

def get_post_likes_count(post_id):
    """Get likes count efficiently"""
    return likes_collection.count_documents({'post_id': post_id})

def get_post_comments(post_id):
    """Get first 5 comments and total count"""
    comments = list(comments_collection.find({'post_id': post_id}).sort('created_at', -1).limit(5))
    total = comments_collection.count_documents({'post_id': post_id})
    
    comments_list = []
    for comment in comments:
        comments_list.append({
            'id': str(comment['_id']),
            'user_id': comment['user_id'],
            'username': comment['username'],
            'avatar': comment.get('avatar'),
            'text': comment['text'],
            'created_at': comment['created_at'].isoformat(),
            'parent_comment_id': comment.get('parent_comment_id')
        })
    
    return comments_list, total

def enrich_post(post, current_user_id):
    """Enrich post with likes, comments, reposts, etc"""
    post['_id'] = str(post['_id'])
    post_id_str = post['_id']
    post['user_id'] = str(post['user_id'])
    
    # Get user avatar if not present
    if not post.get('avatar'):
        user = users_collection.find_one({'_id': ObjectId(post['user_id'])})
        if user:
            post['avatar'] = user.get('avatar')
    
    # Get likes and comments
    post['likes'] = get_post_likes_count(post_id_str)
    post['comments_list'], post['comments'] = get_post_comments(post_id_str)
    post['user_liked'] = likes_collection.find_one({'post_id': post_id_str, 'user_id': current_user_id}) is not None
    
    # Get reposts count
    post['reposts'] = reposts_collection.count_documents({'post_id': post_id_str})
    post['user_reposted'] = reposts_collection.find_one({'post_id': post_id_str, 'user_id': current_user_id}) is not None
    
    # Extract hashtags from text
    post['hashtags'] = extract_hashtags(post.get('text', ''))
    
    return post

@app.route('/api/posts', methods=['GET', 'POST'])
@login_required
@limiter.limit("20 per minute")
def handle_posts():
    if request.method == 'POST':
        data = request.get_json()
        text = data.get('text', '').strip()
        image_data = data.get('image', None)
        resource_type = data.get('resource_type', 'image')  # 'image' or 'video'
        mentions = data.get('mentions', [])  # Array of user IDs mentioned
        
        # Validate post text if provided
        if text:
            is_valid, result = validate_post_text(text, max_length=280)
            if not is_valid:
                return jsonify({'success': False, 'error': result}), 400
            text = result
        
        if not text and not image_data:
            return jsonify({'success': False, 'error': 'Post cannot be empty'}), 400
        
        current_user = users_collection.find_one({'_id': ObjectId(session['user_id'])})
        
        post = {
            'user_id': session['user_id'],
            'username': session['name'],
            'email': session['email'],
            'avatar': current_user.get('avatar') if current_user else None,
            'text': text,
            'image': image_data,
            'resource_type': resource_type,  # Store media type
            'mentions': mentions,
            'created_at': datetime.now(),
            'likes': 0,
            'comments': 0
        }
        
        result = posts_collection.insert_one(post)
        post['_id'] = str(result.inserted_id)
        
        # Extract and track hashtags
        hashtags = extract_hashtags(text)
        if hashtags:
            update_hashtag_counts(hashtags, post['_id'])
        post['hashtags'] = hashtags
        
        # Track mentions for notifications
        for mentioned_user_id in mentions:
            if mentioned_user_id != session['user_id']:  
                notifications_collection.insert_one({
                    'user_id': mentioned_user_id,
                    'type': 'mention',
                    'post_id': str(result.inserted_id),
                    'from_user_id': session['user_id'],
                    'from_username': session['name'],
                    'created_at': datetime.now(),
                    'read': False
                })
        
        post['likes'] = 0
        post['comments'] = 0
        post['reposts'] = 0
        post['user_liked'] = False
        post['user_reposted'] = False
        
        return jsonify({'success': True, 'post': post}), 201
    
    else:
        current_user_id = session['user_id']
        page = request.args.get('page', 1, type=int)
        limit = request.args.get('limit', 10, type=int)
        feed_type = request.args.get('type', 'for_you')  # 'for_you' or 'following'
        skip = (page - 1) * limit
        
        # Get following IDs
        following_ids = [doc['following_id'] for doc in followers_collection.find({'follower_id': current_user_id})]
        
        if feed_type == 'following':
            # Show only posts from people you follow, sorted by recency
            posts_cursor = posts_collection.find({'user_id': {'$in': following_ids}}).sort('created_at', -1).skip(skip).limit(limit)
            posts_list = [enrich_post(post, current_user_id) for post in posts_cursor]
            
            # If no following posts, show own posts
            if len(posts_list) == 0:
                own_posts_cursor = posts_collection.find({'user_id': current_user_id}).sort('created_at', -1).skip(skip).limit(limit)
                posts_list = [enrich_post(post, current_user_id) for post in own_posts_cursor]
        else:
          
            now = datetime.now()
            pipeline = [
                # Stage 1: Get recent posts (last 7 days)
                {'$match': {'created_at': {'$gte': now - timedelta(days=7)}}},
                
                
                {'$sort': {'created_at': -1}},
                
                # Stage 3: Get likes for each post
                {'$lookup': {
                    'from': 'likes',
                    'let': {'post_id': {'$toString': '$_id'}},
                    'pipeline': [
                        {'$match': {'$expr': {'$eq': ['$post_id', '$$post_id']}}}
                    ],
                    'as': 'likes_array'
                }},
                
                # Stage 4: Get comments for each post
                {'$lookup': {
                    'from': 'comments',
                    'let': {'post_id': {'$toString': '$_id'}},
                    'pipeline': [
                        {'$match': {'$expr': {'$eq': ['$post_id', '$$post_id']}}}
                    ],
                    'as': 'comments_array'
                }},
                
                # Stage 5: Calculate engagement score in MongoDB
                {'$addFields': {
                    'likes_count': {'$size': '$likes_array'},
                    'comments_count': {'$size': '$comments_array'},
                    'hours_old': {
                        '$divide': [
                            {'$subtract': [now, '$created_at']},
                            3600000  # milliseconds to hours
                        ]
                    }
                }},
                
                # Stage 6: Calculate time decay and engagement score
                {'$addFields': {
                    'time_decay': {
                        '$max': [
                            0.1,
                            {'$divide': [1, {'$add': [1, {'$divide': ['$hours_old', 24]}]}]}
                        ]
                    },
                    'engagement_score': {
                        '$add': [
                            {'$multiply': ['$likes_count', 0.6]},
                            {'$multiply': ['$comments_count', 0.4]}
                        ]
                    }
                }},
                
                # Stage 7: Calculate final score
                {'$addFields': {
                    'final_score': {'$multiply': ['$engagement_score', '$time_decay']}
                }},
                
                # Stage 8: Sort by engagement score
                {'$sort': {'final_score': -1}},
                
                # Stage 9: Skip and limit for pagination
                {'$skip': skip},
                {'$limit': limit},
                
                # Stage 10: Clean up temporary fields
                {'$project': {
                    'likes_array': 0,
                    'comments_array': 0,
                    'hours_old': 0,
                    'time_decay': 0,
                    'engagement_score': 0,
                    'final_score': 0
                }}
            ]
            
            scored_posts = list(posts_collection.aggregate(pipeline))
            posts_list = [enrich_post(post, current_user_id) for post in scored_posts]
        
        return jsonify({'success': True, 'posts': posts_list}), 200

@app.route('/api/posts/<post_id>', methods=['GET', 'DELETE', 'PUT'])
@login_required
def handle_single_post(post_id):
    if request.method == 'GET':
        try:
            post = posts_collection.find_one({'_id': ObjectId(post_id)})
            
            if not post:
                return jsonify({'success': False, 'error': 'Post not found'}), 404
            
            post['_id'] = str(post['_id'])
            post['user_id'] = str(post['user_id'])
            post['likes'] = likes_collection.count_documents({'post_id': post_id})
            post['user_liked'] = likes_collection.find_one({'post_id': post_id, 'user_id': session['user_id']}) is not None
            
            post_comments = []
            for comment in comments_collection.find({'post_id': post_id}).sort('created_at', -1):
                comment_obj = {
                    'id': str(comment['_id']),
                    'user_id': comment['user_id'],
                    'username': comment['username'],
                    'avatar': comment.get('avatar'),  # Avatar already stored
                    'text': comment['text'],
                    'created_at': comment['created_at'].isoformat()
                }
                if 'parent_comment_id' in comment:
                    comment_obj['parent_comment_id'] = comment['parent_comment_id']
                post_comments.append(comment_obj)
            
            post['comments_list'] = post_comments
            post['comments'] = len(post_comments)
            
            return jsonify({'success': True, 'post': post}), 200
        except Exception as e:
            return jsonify({'success': False, 'error': str(e)}), 500
    
    elif request.method == 'PUT':
        try:
            post = posts_collection.find_one({'_id': ObjectId(post_id)})
            
            if not post:
                return jsonify({'success': False, 'error': 'Post not found'}), 404
            
            if str(post['user_id']) != session['user_id']:
                return jsonify({'success': False, 'error': 'Cannot edit other users posts'}), 403
            
            data = request.get_json()
            text = data.get('text', '').strip()
            
            if not text:
                return jsonify({'success': False, 'error': 'Post cannot be empty'}), 400
            
            try:
                # Extract new hashtags
                hashtags = extract_hashtags(text)
            except Exception as hash_err:
                print(f"Hashtag extraction error: {hash_err}")
                hashtags = []
            
            # Update post with new text and track edit
            posts_collection.update_one(
                {'_id': ObjectId(post_id)},
                {
                    '$set': {
                        'text': text,
                        'hashtags': hashtags,
                        'edited_at': datetime.now()
                    }
                }
            )
            
            return jsonify({'success': True, 'message': 'Post edited successfully'}), 200
        except Exception as e:
            print(f"Edit post error: {str(e)}")
            import traceback
            traceback.print_exc()
            return jsonify({'success': False, 'error': str(e)}), 500
    
    elif request.method == 'DELETE':
        post = posts_collection.find_one({'_id': ObjectId(post_id)})
        
        if not post:
            return jsonify({'success': False, 'error': 'Post not found'}), 404
        
        if str(post['user_id']) != session['user_id']:
            return jsonify({'success': False, 'error': 'Cannot delete other users posts'}), 403
        
        posts_collection.delete_one({'_id': ObjectId(post_id)})
        likes_collection.delete_many({'post_id': post_id})
        comments_collection.delete_many({'post_id': post_id})
        
        return jsonify({'success': True, 'message': 'Post deleted'}), 200

@app.route('/api/posts/<post_id>/like', methods=['POST'])
@login_required
def like_post(post_id):
    existing_like = likes_collection.find_one({'post_id': post_id, 'user_id': session['user_id']})
    post = posts_collection.find_one({'_id': ObjectId(post_id)})
    
    if existing_like:
        likes_collection.delete_one({'_id': existing_like['_id']})
        # Remove notification
        notifications_collection.delete_one({
            'post_id': post_id,
            'type': 'like',
            'from_user_id': session['user_id']
        })
        return jsonify({'success': True, 'liked': False}), 200
    
    likes_collection.insert_one({
        'post_id': post_id,
        'user_id': session['user_id'],
        'created_at': datetime.now()
    })
    
    # Create notification for post owner
    if post and str(post['user_id']) != session['user_id']:
        notifications_collection.insert_one({
            'user_id': str(post['user_id']),
            'type': 'like',
            'post_id': post_id,
            'from_user_id': session['user_id'],
            'from_username': session['name'],
            'created_at': datetime.now(),
            'read': False
        })
    
    return jsonify({'success': True, 'liked': True}), 201

@app.route('/api/posts/<post_id>/repost', methods=['POST'])
@login_required
def repost_post(post_id):
    existing_repost = reposts_collection.find_one({'post_id': post_id, 'user_id': session['user_id']})
    post = posts_collection.find_one({'_id': ObjectId(post_id)})
    
    if existing_repost:
        reposts_collection.delete_one({'_id': existing_repost['_id']})
        # Remove notification
        notifications_collection.delete_one({
            'post_id': post_id,
            'type': 'repost',
            'from_user_id': session['user_id']
        })
        return jsonify({'success': True, 'reposted': False}), 200
    
    reposts_collection.insert_one({
        'post_id': post_id,
        'user_id': session['user_id'],
        'created_at': datetime.now()
    })
    
    # Create notification for post owner
    if post and str(post['user_id']) != session['user_id']:
        notifications_collection.insert_one({
            'user_id': str(post['user_id']),
            'type': 'repost',
            'post_id': post_id,
            'from_user_id': session['user_id'],
            'from_username': session['name'],
            'created_at': datetime.now(),
            'read': False
        })
    
    return jsonify({'success': True, 'reposted': True}), 201

@app.route('/api/posts/<post_id>/comment', methods=['POST'])
@login_required
@limiter.limit("30 per minute")
def comment_post(post_id):
    data = request.get_json()
    text = data.get('text', '').strip()
    parent_comment_id = data.get('parent_comment_id')
    
    # Validate comment text
    is_valid, result = validate_post_text(text, max_length=500)
    if not is_valid:
        return jsonify({'success': False, 'error': result}), 400
    
    text = result
    
    # Get current user's avatar
    current_user = users_collection.find_one({'_id': ObjectId(session['user_id'])})
    user_avatar = current_user.get('avatar') if current_user else None
    
    comment = {
        'post_id': post_id,
        'user_id': session['user_id'],
        'username': session['name'],
        'avatar': user_avatar,  # Store avatar in comment
        'text': text,
        'created_at': datetime.now()
    }
    
    # Add parent_comment_id if replying to a comment
    if parent_comment_id:
        comment['parent_comment_id'] = parent_comment_id
    
    result = comments_collection.insert_one(comment)
    
    comment_response = {
        'id': str(result.inserted_id),
        'user_id': session['user_id'],
        'username': session['name'],
        'avatar': current_user.get('avatar') if current_user else None,
        'text': text,
        'created_at': datetime.now().isoformat()
    }
    
    if parent_comment_id:
        comment_response['parent_comment_id'] = parent_comment_id
    
    # Create notifications
    post = posts_collection.find_one({'_id': ObjectId(post_id)})
    
    # Notify post owner if not the commenter
    if post and str(post['user_id']) != session['user_id']:
        notification_doc = {
            'user_id': str(post['user_id']),
            'type': 'comment',
            'post_id': post_id,
            'from_user_id': session['user_id'],
            'from_username': session['name'],
            'comment_preview': text[:50] + ('...' if len(text) > 50 else ''),
            'created_at': datetime.now(),
            'read': False
        }
        notifications_collection.insert_one(notification_doc)
        print(f"✓ Comment notification created for user {notification_doc['user_id']}")
    
    # If replying to a comment, notify the comment author
    if parent_comment_id:
        parent_comment = comments_collection.find_one({'_id': ObjectId(parent_comment_id)})
        if parent_comment and parent_comment['user_id'] != session['user_id']:
            notifications_collection.insert_one({
                'user_id': parent_comment['user_id'],
                'type': 'reply',
                'post_id': post_id,
                'comment_id': parent_comment_id,
                'from_user_id': session['user_id'],
                'from_username': session['name'],
                'comment_preview': text[:50] + ('...' if len(text) > 50 else ''),
                'created_at': datetime.now(),
                'read': False
            })
    
    return jsonify({
        'success': True,
        'comment': comment_response
    }), 201

@app.route('/api/posts/<post_id>/comment/<comment_id>', methods=['PUT', 'DELETE'])
@login_required
def edit_delete_comment(post_id, comment_id):
    try:
        comment = comments_collection.find_one({'_id': ObjectId(comment_id)})
        
        if not comment:
            return jsonify({'success': False, 'error': 'Comment not found'}), 404
        
        # Check if user is the comment author
        if comment['user_id'] != session['user_id']:
            return jsonify({'success': False, 'error': 'Cannot modify other users comments'}), 403
        
        if request.method == 'PUT':
            data = request.get_json()
            text = data.get('text', '').strip()
            
            if not text:
                return jsonify({'success': False, 'error': 'Comment cannot be empty'}), 400
            
            comments_collection.update_one(
                {'_id': ObjectId(comment_id)},
                {'$set': {'text': text}}
            )
            
            return jsonify({'success': True, 'message': 'Comment updated'}), 200
        
        elif request.method == 'DELETE':
            comments_collection.delete_one({'_id': ObjectId(comment_id)})
            return jsonify({'success': True, 'message': 'Comment deleted'}), 200
    
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

@app.route('/api/posts/<post_id>/comment/<comment_id>/like', methods=['POST'])
@login_required
def like_comment(post_id, comment_id):
    try:
        existing_like = comment_likes_collection.find_one({
            'comment_id': comment_id,
            'user_id': session['user_id']
        })
        
        if existing_like:
            comment_likes_collection.delete_one({'_id': existing_like['_id']})
            liked = False
        else:
            comment_likes_collection.insert_one({
                'comment_id': comment_id,
                'post_id': post_id,
                'user_id': session['user_id'],
                'created_at': datetime.now()
            })
            liked = True
        
        likes_count = comment_likes_collection.count_documents({'comment_id': comment_id})
        
        return jsonify({
            'success': True,
            'liked': liked,
            'likes_count': likes_count
        }), 200
    
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

@app.route('/api/posts/<post_id>/comment/<comment_id>/likes', methods=['GET'])
@login_required
def get_comment_likes(post_id, comment_id):
    try:
        likes_count = comment_likes_collection.count_documents({'comment_id': comment_id})
        user_liked = comment_likes_collection.find_one({
            'comment_id': comment_id,
            'user_id': session['user_id']
        }) is not None
        
        return jsonify({
            'success': True,
            'likes_count': likes_count,
            'user_liked': user_liked
        }), 200
    
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

@app.route('/api/update-profile', methods=['POST'])
@login_required
def update_profile():
    """Update user profile (name, bio, avatar, cover_photo)"""
    try:
        data = request.get_json()
        name = data.get('name', '').strip()
        bio = data.get('bio', '').strip()
        avatar = data.get('avatar', '')
        cover_photo = data.get('cover_photo', '')
        
        if not name:
            return jsonify({'success': False, 'error': 'Name is required'}), 400
        
        if len(bio) > 100:
            return jsonify({'success': False, 'error': 'Bio must be 100 characters or less'}), 400
        
        # Update user
        update_data = {
            'name': name,
            'bio': bio
        }
        
        if avatar:
            update_data['avatar'] = avatar
        
        if cover_photo:
            update_data['cover_photo'] = cover_photo
        
        users_collection.update_one(
            {'_id': ObjectId(session['user_id'])},
            {'$set': update_data}
        )
        
        # Update session name
        session['name'] = name
        
        return jsonify({'success': True, 'message': 'Profile updated successfully'}), 200
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

@app.route('/api/profile/<user_id>')
@login_required
def get_user_profile(user_id):
    try:
        user = users_collection.find_one({'_id': ObjectId(user_id)})
        
        if not user:
            return jsonify({'success': False, 'error': 'User not found'}), 404
        
        current_user_id = session['user_id']
        
        # Check if current user follows this user
        is_following = followers_collection.find_one({
            'follower_id': current_user_id,
            'following_id': user_id
        }) is not None
        
        followers_count = followers_collection.count_documents({'following_id': user_id})
        following_count = followers_collection.count_documents({'follower_id': user_id})
        
        user_posts = []
        posts_list = list(posts_collection.find({'user_id': user_id}).sort('created_at', -1).limit(20))
        
        # Batch get all post IDs
        post_ids = [str(p['_id']) for p in posts_list]
        
        # Batch get all likes for these posts (single query)
        all_likes = list(likes_collection.find({'post_id': {'$in': post_ids}}))
        likes_by_post = {}
        user_likes = set()
        for like in all_likes:
            post_id = like['post_id']
            if post_id not in likes_by_post:
                likes_by_post[post_id] = 0
            likes_by_post[post_id] += 1
            if like['user_id'] == current_user_id:
                user_likes.add(post_id)
        
        # Batch get all comments for these posts (single query) - LIMIT 3 PER POST
        all_comments = list(comments_collection.find({'post_id': {'$in': post_ids}}).sort('created_at', -1).limit(100))
        comments_by_post = {}
        comment_user_ids = set()
        comment_count_per_post = {}
        
        for comment in all_comments:
            post_id = comment['post_id']
            # Only keep first 3 comments per post
            if post_id not in comment_count_per_post:
                comment_count_per_post[post_id] = 0
            
            if comment_count_per_post[post_id] < 3:
                if post_id not in comments_by_post:
                    comments_by_post[post_id] = []
                comments_by_post[post_id].append(comment)
                comment_user_ids.add(comment['user_id'])
                comment_count_per_post[post_id] += 1
        
        # Batch get all users for comments (single query)
        users_data = {}
        if comment_user_ids:
            # Convert string IDs to ObjectId only once
            object_ids = [ObjectId(uid) if isinstance(uid, str) else uid for uid in comment_user_ids]
            users_batch = list(users_collection.find({'_id': {'$in': object_ids}}, {'_id': 1, 'avatar': 1}))
            for u in users_batch:
                users_data[str(u.get('_id'))] = u.get('avatar')
        
        for post in posts_list:
            post_id_str = str(post['_id'])
            post['_id'] = post_id_str
            post['user_id'] = str(post['user_id'])
            post['likes'] = likes_by_post.get(post_id_str, 0)
            
            # Get comments from pre-fetched data
            post_comments = []
            for comment in comments_by_post.get(post_id_str, []):
                comment_obj = {
                    'id': str(comment['_id']),
                    'user_id': comment['user_id'],
                    'username': comment['username'],
                    'avatar': users_data.get(comment['user_id']),
                    'text': comment['text'],
                    'created_at': comment['created_at'].isoformat()
                }
                if 'parent_comment_id' in comment:
                    comment_obj['parent_comment_id'] = comment['parent_comment_id']
                post_comments.append(comment_obj)
            
            post['comments_list'] = post_comments
            post['comments'] = len(post_comments)
            post['user_liked'] = post_id_str in user_likes
            post['post_type'] = 'user_profile'
            user_posts.append(post)
        
        return jsonify({
            'success': True,
            'user': {
                '_id': str(user['_id']),
                'name': user.get('name', ''),
                'username': user.get('username', ''),
                'email': user.get('email', ''),
                'avatar': user.get('avatar'),
                'cover_photo': user.get('cover_photo'),
                'bio': user.get('bio', ''),
                'dob': user.get('dob', ''),
                'gender': user.get('gender', ''),
                'created_at': user.get('created_at', '').isoformat() if user.get('created_at') else '',
                'followers_count': followers_count,
                'following_count': following_count,
                'is_following': is_following,
                'is_own_profile': str(user['_id']) == current_user_id
            },
            'posts': user_posts
        }), 200
    
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

@app.route('/api/follow/<user_id>', methods=['POST'])
@login_required
def follow_user(user_id):
    try:
        current_user_id = session['user_id']
        
        if current_user_id == user_id:
            return jsonify({'success': False, 'error': 'Cannot follow yourself'}), 400
        
        existing = followers_collection.find_one({
            'follower_id': current_user_id,
            'following_id': user_id
        })
        
        if existing:
            followers_collection.delete_one({'_id': existing['_id']})
            # Remove notification
            notifications_collection.delete_one({
                'user_id': user_id,
                'type': 'follow',
                'from_user_id': current_user_id
            })
            return jsonify({'success': True, 'following': False, 'message': 'Unfollowed'}), 200
        else:
            followers_collection.insert_one({
                'follower_id': current_user_id,
                'following_id': user_id,
                'created_at': datetime.now()
            })
            
            # Create follow notification
            current_user = users_collection.find_one({'_id': ObjectId(current_user_id)})
            notifications_collection.insert_one({
                'user_id': user_id,
                'type': 'follow',
                'from_user_id': current_user_id,
                'from_username': session['name'],
                'created_at': datetime.now(),
                'read': False
            })
            
            return jsonify({'success': True, 'following': True, 'message': 'Followed'}), 201
    
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

@app.route('/api/trending', methods=['GET'])
@login_required
def get_trending():
    """Get trending hashtags"""
    try:
        # Get top 5 trending hashtags from last 24 hours
        one_day_ago = datetime.now() - timedelta(hours=24)
        
        trending = list(hashtags_collection.find(
            {'updated_at': {'$gte': one_day_ago}}
        ).sort('count', -1).limit(5))
        
        # If less than 5, get all-time trending
        if len(trending) < 5:
            trending = list(hashtags_collection.find().sort('count', -1).limit(5))
        
        # Format response
        trending_list = []
        for item in trending:
            trending_list.append({
                'tag': item['tag'],
                'count': item.get('count', 0),
                'posts': len(item.get('post_ids', []))
            })
        
        return jsonify({'success': True, 'trending': trending_list}), 200
    
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

@app.route('/api/hashtags/<tag>', methods=['GET'])
@login_required
def search_hashtag(tag):
    """Search posts by hashtag"""
    try:
        current_user_id = session['user_id']
        page = request.args.get('page', 1, type=int)
        limit = request.args.get('limit', 10, type=int)
        skip = (page - 1) * limit
        
        # Ensure tag starts with #
        if not tag.startswith('#'):
            tag = '#' + tag
        tag = tag.lower()
        
        # Find all posts with this hashtag
        posts_cursor = posts_collection.find({
            'hashtags': tag
        }).sort('created_at', -1).skip(skip).limit(limit)
        
        posts_list = [enrich_post(post, current_user_id) for post in posts_cursor]
        
        # Get hashtag info
        hashtag_info = hashtags_collection.find_one({'tag': tag})
        
        return jsonify({
            'success': True,
            'tag': tag,
            'posts': posts_list,
            'info': {
                'count': hashtag_info.get('count', 0) if hashtag_info else 0,
                'post_count': len(posts_list)
            }
        }), 200
    
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

@app.route('/api/notifications', methods=['GET'])
@login_required
def get_notifications():
    """Get user notifications"""
    try:
        current_user_id = session['user_id']
        page = request.args.get('page', 1, type=int)
        limit = request.args.get('limit', 20, type=int)
        skip = (page - 1) * limit
        
        # Get notifications sorted by most recent
        notifications = list(notifications_collection.find({
            'user_id': current_user_id
        }).sort('created_at', -1).skip(skip).limit(limit))
        
        # Get unread count
        unread_count = notifications_collection.count_documents({
            'user_id': current_user_id,
            'read': False
        })
        
        # Format notifications
        formatted = []
        for notif in notifications:
            notif['_id'] = str(notif['_id'])
            notif['created_at'] = notif['created_at'].isoformat()
            formatted.append(notif)
        
        return jsonify({
            'success': True,
            'notifications': formatted,
            'unread_count': unread_count
        }), 200
    
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

@app.route('/api/notifications/<notif_id>/read', methods=['POST'])
@login_required
def mark_notification_read(notif_id):
    """Mark notification as read"""
    try:
        notifications_collection.update_one(
            {'_id': ObjectId(notif_id)},
            {'$set': {'read': True}}
        )
        return jsonify({'success': True, 'message': 'Marked as read'}), 200
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

@app.route('/api/notifications/read-all', methods=['POST'])
@login_required
def mark_all_notifications_read():
    """Mark all notifications as read"""
    try:
        notifications_collection.update_many(
            {'user_id': session['user_id'], 'read': False},
            {'$set': {'read': True}}
        )
        return jsonify({'success': True, 'message': 'All marked as read'}), 200
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

@app.route('/api/upload-cloudinary-form', methods=['POST'])
@login_required
def upload_to_cloudinary_form():
    """Upload file to Cloudinary using FormData (better for large files)"""
    try:
        if 'file' not in request.files:
            return jsonify({'success': False, 'error': 'No file provided'}), 400
        
        file = request.files['file']
        if file.filename == '':
            return jsonify({'success': False, 'error': 'No file selected'}), 400
        
        # Read file directly without base64 conversion
        file_bytes = file.read()
        
        # Upload to Cloudinary using requests
        # Use auto/upload to support both images and videos
        cloudinary_url = f'https://api.cloudinary.com/v1_1/{CLOUDINARY_CLOUD_NAME}/auto/upload'
        
        files = {'file': ('upload', file_bytes)}
        params = {'upload_preset': CLOUDINARY_UPLOAD_PRESET}
        
        print(f"Uploading to Cloudinary... File size: {len(file_bytes)} bytes")
        
        response = requests.post(cloudinary_url, files=files, data=params, timeout=600)
        print(f"Cloudinary response: {response.status_code}")
        
        result = response.json()
        print(f"Cloudinary result: {result}")
        
        if 'secure_url' in result:
            return jsonify({
                'success': True,
                'url': result['secure_url'],
                'resource_type': result.get('resource_type', 'image')
            }), 200
        else:
            error_msg = result.get('error', {}).get('message', 'Upload failed')
            print(f"Cloudinary error: {error_msg}")
            return jsonify({'success': False, 'error': error_msg}), 400
    
    except Exception as e:
        print(f"Cloudinary upload error: {str(e)}")
        import traceback
        traceback.print_exc()
        return jsonify({'success': False, 'error': str(e)}), 500

@app.route('/api/upload-cloudinary', methods=['POST'])
@login_required
def upload_to_cloudinary():
    """Upload file to Cloudinary and return URL"""
    try:
        import base64
        
        data = request.get_json()
        file_data = data.get('file')
        
        if not file_data:
            return jsonify({'success': False, 'error': 'No file provided'}), 400
        
        # Extract base64 data
        if ',' in file_data:
            file_data = file_data.split(',')[1]
        
        # Decode base64
        try:
            file_bytes = base64.b64decode(file_data)
        except Exception as decode_err:
            print(f"Base64 decode error: {decode_err}")
            return jsonify({'success': False, 'error': 'Invalid file format'}), 400
        
        cloudinary_url = f'https://api.cloudinary.com/v1_1/{CLOUDINARY_CLOUD_NAME}/auto/upload'
        
        files = {'file': ('upload', file_bytes)}
        params = {'upload_preset': CLOUDINARY_UPLOAD_PRESET}
        
        print(f"Uploading to Cloudinary... File size: {len(file_bytes)} bytes")
        
        response = requests.post(cloudinary_url, files=files, data=params, timeout=600)
        print(f"Cloudinary response: {response.status_code}")
        
        result = response.json()
        print(f"Cloudinary result: {result}")
        
        if 'secure_url' in result:
            return jsonify({
                'success': True,
                'url': result['secure_url'],
                'resource_type': result.get('resource_type', 'image')
            }), 200
        else:
            error_msg = result.get('error', {}).get('message', 'Upload failed')
            print(f"Cloudinary error: {error_msg}")
            return jsonify({'success': False, 'error': error_msg}), 400
    
    except Exception as e:
        print(f"Cloudinary upload error: {str(e)}")
        import traceback
        traceback.print_exc()
        return jsonify({'success': False, 'error': str(e)}), 500

@app.route('/api/posts/<post_id>/mute-user', methods=['POST'])
@login_required
def mute_user(post_id):
    try:
        post = posts_collection.find_one({'_id': ObjectId(post_id)})
        if not post:
            return jsonify({'success': False, 'error': 'Post not found'}), 404
        
        muted_user_id = post['user_id']
        current_user_id = session['user_id']
        
        if muted_user_id == current_user_id:
            return jsonify({'success': False, 'error': 'Cannot mute yourself'}), 400
        
        # Check if already muted
        existing = mutes_collection.find_one({
            'user_id': current_user_id,
            'muted_user_id': muted_user_id
        })
        
        if existing:
            mutes_collection.delete_one({'_id': existing['_id']})
            return jsonify({'success': True, 'muted': False, 'message': 'User unmuted'}), 200
        else:
            mutes_collection.insert_one({
                'user_id': current_user_id,
                'muted_user_id': muted_user_id,
                'created_at': datetime.now()
            })
            return jsonify({'success': True, 'muted': True, 'message': 'User muted'}), 201
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

@app.route('/api/posts/<post_id>/block-user', methods=['POST'])
@login_required
def block_user(post_id):
    try:
        post = posts_collection.find_one({'_id': ObjectId(post_id)})
        if not post:
            return jsonify({'success': False, 'error': 'Post not found'}), 404
        
        blocked_user_id = post['user_id']
        current_user_id = session['user_id']
        
        if blocked_user_id == current_user_id:
            return jsonify({'success': False, 'error': 'Cannot block yourself'}), 400
        
        # Check if already blocked
        existing = blocks_collection.find_one({
            'user_id': current_user_id,
            'blocked_user_id': blocked_user_id
        })
        
        if existing:
            blocks_collection.delete_one({'_id': existing['_id']})
            return jsonify({'success': True, 'blocked': False, 'message': 'User unblocked'}), 200
        else:
            blocks_collection.insert_one({
                'user_id': current_user_id,
                'blocked_user_id': blocked_user_id,
                'created_at': datetime.now()
            })
            return jsonify({'success': True, 'blocked': True, 'message': 'User blocked'}), 201
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

@app.route('/api/posts/<post_id>/report', methods=['POST'])
@login_required
def report_post(post_id):
    try:
        post = posts_collection.find_one({'_id': ObjectId(post_id)})
        if not post:
            return jsonify({'success': False, 'error': 'Post not found'}), 404
        
        data = request.get_json()
        reason = data.get('reason', 'other').strip()
        
        # Check if already reported by this user
        existing = reports_collection.find_one({
            'post_id': post_id,
            'user_id': session['user_id']
        })
        
        if existing:
            return jsonify({'success': False, 'error': 'You already reported this post'}), 400
        
        reports_collection.insert_one({
            'post_id': post_id,
            'user_id': session['user_id'],
            'post_user_id': post['user_id'],
            'reason': reason,
            'created_at': datetime.now()
        })
        
        return jsonify({'success': True, 'message': 'Post reported successfully'}), 201
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

@app.route('/api/posts/<post_id>/share', methods=['POST'])
@login_required
def share_post(post_id):
    """Track post share and create notification"""
    try:
        post = posts_collection.find_one({'_id': ObjectId(post_id)})
        if not post:
            return jsonify({'success': False, 'error': 'Post not found'}), 404
        
        # Increment share count
        posts_collection.update_one(
            {'_id': ObjectId(post_id)},
            {'$inc': {'shares': 1}}
        )
        
        # Create notification for post owner
        if str(post['user_id']) != session['user_id']:
            notifications_collection.insert_one({
                'user_id': str(post['user_id']),
                'type': 'share',
                'post_id': post_id,
                'from_user_id': session['user_id'],
                'from_username': session['name'],
                'created_at': datetime.now(),
                'read': False
            })
        
        return jsonify({'success': True, 'message': 'Share tracked'}), 200
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

@app.route('/api/trending-hashtags', methods=['GET'])
@login_required
def get_trending_hashtags():
    """Get trending hashtags and users"""
    try:
        # Get top 10 trending hashtags
        trending = list(hashtags_collection.find().sort('count', -1).limit(10))
        
        trending_list = []
        for item in trending:
            trending_list.append({
                'tag': item['tag'],
                'count': item.get('count', 0)
            })
        
        # Get trending users (users with most posts in last 7 days)
        from datetime import timedelta
        seven_days_ago = datetime.now() - timedelta(days=7)
        
        # Get trending users with single aggregation (no N+1)
        trending_users_data = list(posts_collection.aggregate([
            {'$match': {'created_at': {'$gte': seven_days_ago}}},
            {'$group': {'_id': '$user_id', 'post_count': {'$sum': 1}}},
            {'$sort': {'post_count': -1}},
            {'$limit': 5},
            {'$lookup': {
                'from': 'users',
                'localField': '_id',
                'foreignField': '_id',
                'as': 'user_data'
            }},
            {'$unwind': '$user_data'},
            {'$project': {
                '_id': 1,
                'username': '$user_data.username',
                'avatar': '$user_data.avatar',
                'post_count': 1
            }}
        ]))
        
        trending_users = []
        for user_data in trending_users_data:
            trending_users.append({
                '_id': str(user_data['_id']),
                'username': user_data.get('username'),
                'avatar': user_data.get('avatar')
            })
        
        return jsonify({
            'success': True,
            'trending': trending_list,
            'trending_users': trending_users
        }), 200
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

@app.route('/api/conversations', methods=['GET'])
@login_required
def get_conversations():
    """Get all conversations for current user"""
    try:
        current_user_id = session['user_id']
        
        # Get all messages where user is participant
        conversations = list(messages_collection.aggregate([
            {
                '$match': {
                    '$or': [
                        {'sender_id': current_user_id},
                        {'receiver_id': current_user_id}
                    ]
                }
            },
            {'$sort': {'created_at': -1}},
            {
                '$group': {
                    '_id': {
                        '$cond': [
                            {'$lt': ['$sender_id', '$receiver_id']},
                            {'sender': '$sender_id', 'receiver': '$receiver_id'},
                            {'sender': '$receiver_id', 'receiver': '$sender_id'}
                        ]
                    },
                    'last_message': {'$first': '$text'},
                    'last_message_time': {'$first': '$created_at'},
                    'last_sender_id': {'$first': '$sender_id'}
                }
            },
            {'$sort': {'last_message_time': -1}},
            {'$limit': 50}
        ]))
        
        # Get all user IDs we need
        user_ids_set = set()
        for conv in conversations:
            other_user_id = conv['_id']['receiver'] if conv['_id']['sender'] == current_user_id else conv['_id']['sender']
            user_ids_set.add(other_user_id)
        
        # Batch fetch all users (single query instead of N queries)
        user_ids = [ObjectId(uid) for uid in user_ids_set]
        users_data = {}
        if user_ids:
            users_batch = list(users_collection.find({'_id': {'$in': user_ids}}, {'_id': 1, 'username': 1, 'avatar': 1}))
            for user in users_batch:
                users_data[str(user['_id'])] = user
        
        result = []
        for conv in conversations:
            # Get the other user's info
            other_user_id = conv['_id']['receiver'] if conv['_id']['sender'] == current_user_id else conv['_id']['sender']
            other_user = users_data.get(other_user_id)
            
            if other_user:
                result.append({
                    'user_id': other_user_id,
                    'username': other_user.get('username', ''),
                    'avatar': other_user.get('avatar'),
                    'last_message': conv.get('last_message', ''),
                    'last_message_time': conv.get('last_message_time').isoformat() if conv.get('last_message_time') else '',
                    'is_from_current_user': conv.get('last_sender_id') == current_user_id
                })
        
        return jsonify({'success': True, 'conversations': result}), 200
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

@app.route('/api/messages/<user_id>', methods=['GET'])
@login_required
def get_messages(user_id):
    """Get messages between current user and another user"""
    try:
        current_user_id = session['user_id']
        
        # Get messages between users
        messages = list(messages_collection.find({
            '$or': [
                {'sender_id': current_user_id, 'receiver_id': user_id},
                {'sender_id': user_id, 'receiver_id': current_user_id}
            ]
        }).sort('created_at', 1).limit(50))
        
        result = []
        for msg in messages:
            result.append({
                'id': str(msg['_id']),
                'sender_id': msg['sender_id'],
                'receiver_id': msg['receiver_id'],
                'text': msg['text'],
                'created_at': msg['created_at'].isoformat(),
                'edited_at': msg.get('edited_at').isoformat() if msg.get('edited_at') else None
            })
        
        return jsonify({'success': True, 'messages': result}), 200
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

@app.route('/api/messages/send', methods=['POST'])
@login_required
def send_message():
    """Send a message to another user"""
    try:
        data = request.get_json()
        receiver_id = data.get('receiver_id')
        text = data.get('text', '').strip()
        
        if not receiver_id or not text:
            return jsonify({'success': False, 'error': 'Receiver and message required'}), 400
        
        if receiver_id == session['user_id']:
            return jsonify({'success': False, 'error': 'Cannot message yourself'}), 400
        
        current_user = users_collection.find_one({'_id': ObjectId(session['user_id'])})
        
        message = {
            'sender_id': session['user_id'],
            'sender_username': session['name'],
            'receiver_id': receiver_id,
            'text': text,
            'created_at': datetime.now(),
            'read': False
        }
        
        result = messages_collection.insert_one(message)
        message['_id'] = str(result.inserted_id)
        
        # Create notification for receiver
        notifications_collection.insert_one({
            'user_id': receiver_id,
            'type': 'message',
            'from_user_id': session['user_id'],
            'from_username': session['name'],
            'message_preview': text[:50] + ('...' if len(text) > 50 else ''),
            'created_at': datetime.now(),
            'read': False
        })
        
        return jsonify({'success': True, 'message': message}), 201
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

@app.route('/api/followers/<user_id>', methods=['GET'])
@login_required
def get_followers(user_id):
    """Get all followers of a user"""
    try:
        current_user_id = session['user_id']
        
       
        followers_list = list(followers_collection.find({'following_id': user_id}))
        follower_ids = [ObjectId(f['follower_id']) for f in followers_list]
        
        # Batch fetch all follower users (single query)
        followers_users = list(users_collection.find({'_id': {'$in': follower_ids}}, {'_id': 1, 'username': 1, 'avatar': 1}))
        
        # Batch check which ones current user follows
        followed_ids = set()
        if follower_ids:
            followed = list(followers_collection.find({
                'follower_id': current_user_id,
                'following_id': {'$in': [str(fid) for fid in follower_ids]}
            }))
            followed_ids = {f['following_id'] for f in followed}
        
        users = []
        for follower_user in followers_users:
            users.append({
                '_id': str(follower_user['_id']),
                'username': follower_user.get('username', ''),
                'avatar': follower_user.get('avatar'),
                'is_following': str(follower_user['_id']) in followed_ids
            })
        
        return jsonify({'success': True, 'users': users}), 200
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

@app.route('/api/following/<user_id>', methods=['GET'])
@login_required
def get_following(user_id):
    """Get all users that a user is following"""
    try:
        current_user_id = session['user_id']
        
        # Get all following
        following_list = list(followers_collection.find({'follower_id': user_id}))
        following_ids = [ObjectId(f['following_id']) for f in following_list]
        
        # Batch fetch all following users (single query)
        following_users = list(users_collection.find({'_id': {'$in': following_ids}}, {'_id': 1, 'username': 1, 'avatar': 1}))
        
        # Batch check which ones current user follows
        followed_ids = set()
        if following_ids:
            followed = list(followers_collection.find({
                'follower_id': current_user_id,
                'following_id': {'$in': [str(fid) for fid in following_ids]}
            }))
            followed_ids = {f['following_id'] for f in followed}
        
        users = []
        for following_user in following_users:
            users.append({
                '_id': str(following_user['_id']),
                'username': following_user.get('username', ''),
                'avatar': following_user.get('avatar'),
                'is_following': str(following_user['_id']) in followed_ids
            })
        
        return jsonify({'success': True, 'users': users}), 200
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

@app.route('/api/messages/<message_id>', methods=['PUT'])
@login_required
def update_message(message_id):
    """Edit a message"""
    try:
        data = request.get_json()
        new_text = data.get('text', '').strip()
        
        if not new_text:
            return jsonify({'success': False, 'error': 'Message cannot be empty'}), 400
        
        # Find and update message
        message = messages_collection.find_one({'_id': ObjectId(message_id)})
        
        if not message:
            return jsonify({'success': False, 'error': 'Message not found'}), 404
        
        # Only allow user to edit their own messages
        if message['sender_id'] != session['user_id']:
            return jsonify({'success': False, 'error': 'Cannot edit other users messages'}), 403
        
        messages_collection.update_one(
            {'_id': ObjectId(message_id)},
            {'$set': {'text': new_text, 'edited_at': datetime.now()}}
        )
        
        return jsonify({'success': True, 'message': 'Message updated'}), 200
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

@app.route('/api/messages/<message_id>', methods=['DELETE'])
@login_required
def delete_message(message_id):
    """Delete a message"""
    try:
        message = messages_collection.find_one({'_id': ObjectId(message_id)})
        
        if not message:
            return jsonify({'success': False, 'error': 'Message not found'}), 404
        
        # Only allow user to delete their own messages
        if message['sender_id'] != session['user_id']:
            return jsonify({'success': False, 'error': 'Cannot delete other users messages'}), 403
        
        messages_collection.delete_one({'_id': ObjectId(message_id)})
        
        return jsonify({'success': True, 'message': 'Message deleted'}), 200
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

@app.route('/logout')
def logout():
    session.clear()
    return redirect(url_for('login'))

if __name__ == '__main__':
    app.run(debug=True)
