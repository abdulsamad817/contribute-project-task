let currentUserId = null;
let allPosts = [];
let currentAvatarData = null;
let allUsers = [];
let viewingProfile = null;
let currentPanelPostId = null;
let currentPage = 1;
let postsLimit = 10;
let isLoadingMore = false;
let hasMorePosts = true;
let mentionedUsers = [];  // Array of mentioned user IDs in current post
let cloudinaryUrl = '';  // Store uploaded file URL
let currentFeedType = 'for_you';  // Track current feed type
const CLOUDINARY_CLOUD_NAME = 'dfzdjuuwc';
let trendingCache = { data: null, timestamp: 0 };
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes cache

// Pagination and caching for conversations and friends
let conversationsCache = null;
let conversationsCacheTime = 0;
let friendsCache = null;
let friendsCacheTime = 0;
const CACHE_VALID_TIME = 3 * 60 * 1000; // 3 minutes
let conversationsPage = 1;
let friendsPage = 1;
const ITEMS_PER_PAGE = 20;

// Escape HTML to prevent XSS attacks
function escapeHtml(text) {
    if (!text) return '';
    const map = {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#039;'
    };
    return text.replace(/[&<>"']/g, m => map[m]);
}



// Notification system
function showNotification(message, type = 'success') {
    const notification = document.createElement('div');
    notification.className = `notification notification-${type}`;
    notification.textContent = message;
    notification.style.cssText = `
        position: fixed;
        bottom: 20px;
        right: 20px;
        padding: 12px 20px;
        background: ${type === 'error' ? '#ef4444' : '#10b981'};
        color: white;
        border-radius: 8px;
        font-size: 14px;
        z-index: 10000;
        animation: slideIn 0.3s ease-out;
        box-shadow: 0 4px 12px rgba(0,0,0,0.15);
    `;
    
    document.body.appendChild(notification);
    
    setTimeout(() => {
        notification.style.animation = 'slideOut 0.3s ease-out';
        setTimeout(() => notification.remove(), 300);
    }, 3000);
}

// Confirmation dialog system
function showConfirmDialog(title, message, onConfirm, onCancel) {
    // Create overlay
    const overlay = document.createElement('div');
    overlay.className = 'confirm-overlay';
    overlay.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0, 0, 0, 0.5);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 10001;
        animation: fadeIn 0.2s ease-out;
    `;
    
    // Create dialog
    const dialog = document.createElement('div');
    dialog.className = 'confirm-dialog';
    dialog.style.cssText = `
        background: #16181c;
        border: 1px solid #2f3336;
        border-radius: 16px;
        padding: 24px;
        max-width: 400px;
        box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
        animation: slideUp 0.3s ease-out;
    `;
    
    dialog.innerHTML = `
        <div style="text-align: center;">
            <h2 style="color: white; margin: 0 0 12px 0; font-size: 20px; font-weight: 600;">${title}</h2>
            <p style="color: #71767b; margin: 0 0 24px 0; font-size: 15px; line-height: 1.4;">${message}</p>
            <div style="display: flex; gap: 12px; justify-content: center;">
                <button class="confirm-cancel-btn" style="
                    padding: 10px 24px;
                    background: #2f3336;
                    color: white;
                    border: none;
                    border-radius: 24px;
                    font-weight: 600;
                    cursor: pointer;
                    font-size: 15px;
                    transition: all 0.2s;
                ">Cancel</button>
                <button class="confirm-ok-btn" style="
                    padding: 10px 24px;
                    background: #ef4444;
                    color: white;
                    border: none;
                    border-radius: 24px;
                    font-weight: 600;
                    cursor: pointer;
                    font-size: 15px;
                    transition: all 0.2s;
                ">Delete</button>
            </div>
        </div>
    `;
    
    document.body.appendChild(overlay);
    overlay.appendChild(dialog);
    
    // Add hover effects
    const cancelBtn = dialog.querySelector('.confirm-cancel-btn');
    const okBtn = dialog.querySelector('.confirm-ok-btn');
    
    cancelBtn.addEventListener('mouseover', function() {
        this.style.background = '#3d4144';
    });
    cancelBtn.addEventListener('mouseout', function() {
        this.style.background = '#2f3336';
    });
    
    okBtn.addEventListener('mouseover', function() {
        this.style.background = '#dc2626';
    });
    okBtn.addEventListener('mouseout', function() {
        this.style.background = '#ef4444';
    });
    
    // Button handlers
    cancelBtn.onclick = () => {
        overlay.style.animation = 'fadeOut 0.2s ease-out';
        setTimeout(() => overlay.remove(), 200);
        if (onCancel) onCancel();
    };
    
    okBtn.onclick = () => {
        overlay.style.animation = 'fadeOut 0.2s ease-out';
        setTimeout(() => overlay.remove(), 200);
        if (onConfirm) onConfirm();
    };
    
    // Close on overlay click
    overlay.onclick = (e) => {
        if (e.target === overlay) {
            cancelBtn.onclick();
        }
    };
}

function getRelativeTime(date) {
    const seconds = Math.floor((new Date() - date) / 1000);
    let interval = seconds / 31536000;
    
    if (interval > 1) return Math.floor(interval) + 'y';
    interval = seconds / 2592000;
    if (interval > 1) return Math.floor(interval) + 'mo';
    interval = seconds / 86400;
    if (interval > 1) return Math.floor(interval) + 'd';
    interval = seconds / 3600;
    if (interval > 1) return Math.floor(interval) + 'h';
    interval = seconds / 60;
    if (interval > 1) return Math.floor(interval) + 'm';
    return Math.floor(seconds) + 's';
}

function showLoading() {
    document.getElementById('loadingSpinner').classList.add('show');
}


function hideLoading() {
    document.getElementById('loadingSpinner').classList.remove('show');
}


function navigateTo(page) {
    showLoading();
    
    
    document.querySelectorAll('.feed-content').forEach(el => {
        el.classList.remove('active');
    });
    

    document.querySelectorAll('.nav-item').forEach(el => {
        el.classList.remove('active');
    });
    
    
    setTimeout(() => {
        
        const contentId = page + 'Content';
        const content = document.getElementById(contentId);
        if (content) {
            content.classList.add('active');
        }
        
        
        const navItem = document.querySelector(`[onclick*="'${page}'"]`);
        if (navItem) {
            navItem.classList.add('active');
        }
        
        // Load conversations when chat is opened
        if (page === 'chat') {
            loadConversations();
            // Hide right sidebar only in chat
            const rightSidebar = document.querySelector('.right-sidebar');
            if (rightSidebar) rightSidebar.style.display = 'none';
        } else {
            // Show right sidebar for other pages
            const rightSidebar = document.querySelector('.right-sidebar');
            if (rightSidebar) rightSidebar.style.display = 'block';
        }
        
        hideLoading();
        
        
        window.scrollTo(0, 0);
    }, 500);
}


async function loadPosts(page = 1, append = false) {
    try {
        isLoadingMore = true;
        const response = await fetch(`/api/posts?page=${page}&limit=${postsLimit}&type=${currentFeedType}`);
        const data = await response.json();
        
        if (data.success) {
            if (append) {
                allPosts = allPosts.concat(data.posts);
            } else {
                allPosts = data.posts;
                currentPage = 1;
            }
            
            // Check if more posts available
            hasMorePosts = data.posts.length === postsLimit;
            
            renderPosts();
            
            // Remove loading skeletons after posts are rendered
            if (append) {
                removeLoadingSkeletons();
            }
        }
    } catch (err) {
        console.error('Error loading posts:', err);
        removeLoadingSkeletons();  // Remove even on error
    } finally {
        isLoadingMore = false;
    }
}

function switchFeedType(type) {
    if (currentFeedType === type) return;
    
    currentFeedType = type;
    currentPage = 1;
    allPosts = [];
    
    // Update active tab
    document.querySelectorAll('.feed-tab').forEach(btn => {
        btn.classList.remove('active');
    });
    event.target.classList.add('active');
    
    // Reload posts
    loadPosts(1, false);
}

function renderPosts() {
    const container = document.getElementById('postsContainer');
    const emptyFeed = document.getElementById('emptyFeedContainer');
    const skeleton = document.getElementById('skeletonLoader');
    
    if (allPosts.length === 0) {
        if (skeleton) skeleton.style.display = 'none';
        if (emptyFeed) {
            emptyFeed.style.display = 'flex';
        }
        container.innerHTML = '';
        if (emptyFeed) {
            container.appendChild(emptyFeed);
        }
    } else {
        if (skeleton) skeleton.style.display = 'none';
        if (emptyFeed) {
            emptyFeed.style.display = 'none';
        }
        container.innerHTML = '';
        allPosts.forEach(post => {
            const postEl = createPostElement(post);
            container.appendChild(postEl);
        });
    }
}

function renderSinglePost(postId) {
    /**Re-render only a specific post to avoid data mixing*/
    const post = allPosts.find(p => p._id === postId);
    if (!post) return;
    
    const container = document.getElementById('postsContainer');
    const oldPostEl = document.getElementById(`post-${postId}`);
    
    if (oldPostEl) {
        const newPostEl = createPostElement(post);
        oldPostEl.replaceWith(newPostEl);
    }
}

function loadOwnProfile() {
    loadUserProfile(currentUserId);
}

async function loadUserProfile(userId) {
    try {
        showLoading();
        const response = await fetch(`/api/profile/${userId}`);
        const data = await response.json();
        
        if (data.success) {
            viewingProfile = data.user;
             allPosts = data.posts;
             
             const composer = document.querySelector('.post-composer');
             if (!data.user.is_own_profile) {
                 composer.style.display = 'none';
             } else {
                 composer.style.display = 'flex';
             }
             
             // Set cover photo
             const profileCover = document.querySelector('.profile-cover');
             if (data.user.cover_photo) {
                 profileCover.style.backgroundImage = `url('${data.user.cover_photo}')`;
                 profileCover.style.backgroundSize = 'cover';
                 profileCover.style.backgroundPosition = 'center';
                 profileCover.style.backgroundColor = 'transparent';
                 profileCover.style.cursor = 'pointer';
                 profileCover.onclick = () => openCoverPhotoModal(data.user.cover_photo);
             } else {
                 profileCover.style.backgroundImage = 'none';
                 profileCover.style.background = 'linear-gradient(135deg, #6366f1, #8b5cf6)';
                 profileCover.onclick = null;
             }
             
             // Set avatar
             const avatar = data.user.avatar || null;
             const avatarImg = document.querySelector('.profile-pic');
             if (avatar) {
                 avatarImg.src = avatar;
             } else {
                 avatarImg.src = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120"%3E%3Crect fill="%232f3336" width="120" height="120"/%3E%3Ccircle cx="60" cy="40" r="20" fill="%236366f1"/%3E%3Cpath d="M 20 120 Q 20 80 60 80 Q 100 80 100 120" fill="%236366f1"/%3E%3C/svg%3E';
             }
            
            document.querySelector('.profile-details h2').textContent = data.user.name;
            document.querySelector('.profile-details p').textContent = `@${data.user.username}`;
            const bioText = data.user.bio && data.user.bio.trim() ? data.user.bio : 'Add a bio';
            document.getElementById('profileBioDisplay').textContent = bioText;
            
            // Update stats
            document.getElementById('postsCount').textContent = data.posts.length;
            document.getElementById('followersCount').textContent = data.user.followers_count;
            document.getElementById('followingCount').textContent = data.user.following_count;
            
            // Update joined date
            if (data.user.created_at) {
                const joinDate = new Date(data.user.created_at);
                const options = { year: 'numeric', month: 'long' };
                const formattedDate = joinDate.toLocaleDateString('en-US', options);
                document.querySelector('.profile-joined').textContent = `Joined ${formattedDate}`;
            }
            
            // Add action button
            const btnContainer = document.getElementById('profileActionBtn');
            if (data.user.is_own_profile) {
                // Own profile - show Edit button
                btnContainer.innerHTML = `
                    <button onclick="openEditProfileModal()" style="
                        background: #6366f1;
                        color: white;
                        border: none;
                        padding: 10px 24px;
                        border-radius: 20px;
                        cursor: pointer;
                        font-weight: 600;
                        font-size: 14px;
                        transition: all 0.2s;
                    " onmouseover="this.style.background='#7c3aed'" onmouseout="this.style.background='#6366f1'">
                        Edit Profile
                    </button>
                `;
            } else {
                // Other user - show Message and Follow buttons
                const isFollowing = data.user.is_following;
                const btnText = isFollowing ? 'Following' : 'Follow';
                btnContainer.innerHTML = `
                    <button onclick="openProfileMessageChat('${userId}', '${data.user.username}')" style="
                        background: #2f3336;
                        color: #6366f1;
                        border: 1.5px solid #6366f1;
                        padding: 10px 16px;
                        border-radius: 20px;
                        cursor: pointer;
                        font-weight: 600;
                        font-size: 16px;
                        transition: all 0.2s;
                        display: flex;
                        align-items: center;
                        justify-content: center;
                    " title="Send Message" onmouseover="this.style.background='#3d4144'" onmouseout="this.style.background='#2f3336'">
                        <i class="fas fa-envelope"></i>
                    </button>
                    <button id="profile-follow-btn" onclick="handleProfileFollowClick('${userId}', '${data.user.username}')" data-following="${isFollowing}" style="
                        background: ${isFollowing ? 'transparent' : '#6366f1'};
                        color: ${isFollowing ? '#6366f1' : 'white'};
                        border: ${isFollowing ? '1.5px solid #6366f1' : 'none'};
                        padding: 10px 24px;
                        border-radius: 20px;
                        cursor: pointer;
                        font-weight: 600;
                        font-size: 14px;
                        transition: all 0.2s;
                    " onmouseover="this.style.opacity='0.8'" onmouseout="this.style.opacity='1'">
                        ${btnText}
                    </button>
                `;
            }
            
            renderPosts();
            navigateTo('profile');
        }
    } catch (err) {
        console.error('Error loading profile:', err);
    } finally {
        hideLoading();
    }
}

function createPostElement(post) {
    const div = document.createElement('div');
    div.className = 'post';
    div.id = `post-${post._id}`;
    
    const canDelete = post.user_id === currentUserId;
    const likedClass = post.user_liked ? 'liked' : '';
    const repostedClass = post.user_reposted ? 'reposted' : '';
    
    // Format text with clickable hashtags (safe)
    let formattedText = escapeHtml(post.text);
    if (post.hashtags && post.hashtags.length > 0) {
        post.hashtags.forEach(tag => {
            const escapedTag = escapeHtml(tag);
            formattedText = formattedText.replace(new RegExp(escapeHtml(tag), 'g'), `<span class="hashtag-link" onclick="viewHashtag('${escapedTag.replace(/'/g, "\\'")}')" style="cursor: pointer;">${escapedTag}</span>`);
        });
    }
    
    let mediaHTML = '';
    if (post.image) {
        // Use resource_type from backend, or detect from URL
        const isImage = post.resource_type === 'image' || (!post.resource_type && post.image.startsWith('data:image'));
        const tag = isImage ? 'img' : 'video';
        const clickHandler = isImage ? `onclick="openImageModal('${post.image.replace(/'/g, "\\'")}')"` : '';
        const attrs = isImage ? clickHandler : 'controls';
        mediaHTML = `<div style="margin-left: 60px; margin-top: 12px;"><${tag} src="${post.image}" ${attrs} style="max-width: 100%; max-height: 300px; border-radius: 12px; cursor: ${isImage ? 'pointer' : 'default'}; transition: opacity 0.2s;" onmouseover="${isImage ? "this.style.opacity='0.8'" : ''}" onmouseout="${isImage ? "this.style.opacity='1'" : ''}"></${tag}></div>`;
    }
    
    const createdTime = getRelativeTime(new Date(post.created_at));
    const editedLabel = post.edited_at ? `<span style="color: #71767b; font-size: 12px; margin-left: 8px;">(edited)</span>` : '';
    
    div.innerHTML += `
        <div class="post-header">
            <img src="${post.avatar || 'https://via.placeholder.com/48'}" alt="User" onclick="loadUserProfile('${post.user_id}')" style="cursor: pointer;">
            <div class="post-user-info">
                <div class="post-name" onclick="loadUserProfile('${post.user_id}')" style="cursor: pointer;">${escapeHtml(post.username)}</div>
                <div class="post-handle">@${escapeHtml(post.email.split('@')[0])}</div>
                <div class="post-time">${createdTime}${editedLabel}</div>
            </div>
            <i class="fas fa-ellipsis-h" onclick="showPostMenu('${post._id}')" style="cursor: pointer; padding: 5px 10px;"></i>
        </div>
        <div class="post-content">
            ${formattedText}
        </div>
        ${mediaHTML}
        <div class="post-actions">
            <span onclick="openCommentPanel('${post._id}')" style="cursor: pointer;"><i class="fas fa-comment"></i> ${post.comments}</span>
            <span onclick="repostPost('${post._id}')" style="cursor: pointer;" class="repost-btn ${repostedClass}"><i class="fas fa-retweet"></i> <span id="reposts-${post._id}">${post.reposts || 0}</span></span>
            <span onclick="likePost('${post._id}')" style="cursor: pointer;">
                <i class="fas fa-heart ${likedClass}"></i> <span id="likes-${post._id}">${post.likes}</span>
            </span>
            <span onclick="sharePost('${post._id}')" style="cursor: pointer;"><i class="fas fa-share"></i> <span id="shares-${post._id}">${post.shares || 0}</span></span>
        </div>
        

        
        <div class="comments-section" id="comments-${post._id}" style="display: none;">
            <div style="padding: 10px 0; border-bottom: 1px solid #2f3336; display: flex; justify-content: space-between; align-items: center; margin-left: 60px;">
                <span style="color: #71767b; font-size: 13px; font-weight: 500;">${post.comments_list.length} Comments</span>
                <i class="fas fa-times" onclick="closeComments('${post._id}')" style="cursor: pointer; color: #71767b; font-size: 16px;"></i>
            </div>
            ${post.comments_list.filter(c => !c.parent_comment_id).map(comment => `
                <div>
                <div class="comment" style="display: flex; gap: 10px; align-items: flex-start; padding: 10px 0; position: relative; margin-left: 60px;" data-comment-id="${comment.id}">
                    ${comment.avatar ? 
                        `<img src="${comment.avatar}" alt="Commenter" style="width: 32px; height: 32px; border-radius: 50%; object-fit: cover; cursor: pointer; flex-shrink: 0;" onclick="loadUserProfile('${comment.user_id}')">` :
                        `<div style="width: 32px; height: 32px; border-radius: 50%; background: #2f3336; display: flex; align-items: center; justify-content: center; cursor: pointer; flex-shrink: 0;" onclick="loadUserProfile('${comment.user_id}')"><i class="fas fa-user" style="color: #71767b; font-size: 14px;"></i></div>`
                    }
                    <div style="flex: 1;">
                        <div class="comment-user"><strong style="cursor: pointer;" onclick="loadUserProfile('${comment.user_id}')">${escapeHtml(comment.username)}</strong></div>
                        <div class="comment-text">${escapeHtml(comment.text)}</div>
                        <div style="display: flex; gap: 15px; margin-top: 5px;">
                            <span class="comment-time" style="font-size: 12px; color: #71767b;">${getRelativeTime(new Date(comment.created_at))}</span>
                            <span style="font-size: 12px; color: #71767b; cursor: pointer;" onclick="replyToComment('${post._id}', '${comment.id}', '${comment.username}')">Reply</span>
                            ${post.comments_list.filter(r => r.parent_comment_id === comment.id).length > 0 ? 
                                `<span style="font-size: 12px; color: #6366f1; cursor: pointer;">${post.comments_list.filter(r => r.parent_comment_id === comment.id).length} ${post.comments_list.filter(r => r.parent_comment_id === comment.id).length === 1 ? 'Reply' : 'Replies'}</span>` 
                                : ''}
                        </div>
                    </div>
                    ${comment.user_id === currentUserId ? `<i class="fas fa-ellipsis-h" onclick="showCommentMenu('${post._id}', '${comment.id}')" style="cursor: pointer; color: #71767b; font-size: 16px;"></i>` : ''}
                </div>
                ${post.comments_list.filter(reply => reply.parent_comment_id === comment.id).map(reply => `
                    <div class="comment-reply">
                        <div class="comment" style="display: flex; gap: 10px; align-items: flex-start; padding: 10px 0; position: relative;" data-comment-id="${reply.id}">
                            ${reply.avatar ? 
                                `<img src="${reply.avatar}" alt="Commenter" style="width: 32px; height: 32px; border-radius: 50%; object-fit: cover; cursor: pointer; flex-shrink: 0;" onclick="loadUserProfile('${reply.user_id}')">` :
                                `<div style="width: 32px; height: 32px; border-radius: 50%; background: #2f3336; display: flex; align-items: center; justify-content: center; cursor: pointer; flex-shrink: 0;" onclick="loadUserProfile('${reply.user_id}')"><i class="fas fa-user" style="color: #71767b; font-size: 14px;"></i></div>`
                            }
                            <div style="flex: 1;">
                                <div class="comment-user"><strong style="cursor: pointer;" onclick="loadUserProfile('${reply.user_id}')">${escapeHtml(reply.username)}</strong></div>
                                <div class="comment-text">${escapeHtml(reply.text)}</div>
                                <div style="display: flex; gap: 15px; margin-top: 5px;">
                                    <span class="comment-time" style="font-size: 12px; color: #71767b;">${getRelativeTime(new Date(reply.created_at))}</span>
                                    <span style="font-size: 12px; color: #71767b; cursor: pointer;" onclick="replyToComment('${post._id}', '${reply.id}', '${reply.username}')">Reply</span>
                                </div>
                            </div>
                            ${reply.user_id === currentUserId ? `<i class="fas fa-ellipsis-h" onclick="showCommentMenu('${post._id}', '${reply.id}')" style="cursor: pointer; color: #71767b; font-size: 16px;"></i>` : ''}
                        </div>
                    </div>
                `).join('')}
                </div>
            `).join('')}
        </div>
        
        <div class="comment-input-wrapper" id="comment-input-${post._id}" style="display: none;">
            <div id="reply-context-${post._id}" style="font-size: 12px; color: #71767b; margin-bottom: 8px; display: none;"></div>
            <input type="text" class="comment-input" placeholder="Write a comment..." id="comment-text-${post._id}">
            <button onclick="submitComment('${post._id}')" class="comment-btn">Send</button>
        </div>
    `;
    
    return div;
}

function showPostMenu(postId) {
    const post = allPosts.find(p => p._id === postId);
    
    // Return if post not found
    if (!post) {
        console.error('Post not found:', postId);
        return;
    }
    
    const isOwnPost = post && post.user_id === currentUserId;
    
    const menu = document.createElement('div');
    menu.className = 'post-menu';
    menu.style.cssText = `
        position: absolute;
        background: #2f3336;
        border: 1px solid #3d4144;
        border-radius: 8px;
        padding: 8px 0;
        min-width: 180px;
        z-index: 1000;
        top: 40px;
        right: 0;
    `;
    
    if (isOwnPost) {
        // Own post menu
        menu.innerHTML = `
            <button onclick="openEditPostModal('${postId}')" style="
                background: none;
                border: none;
                color: white;
                cursor: pointer;
                font-size: 13px;
                padding: 10px 15px;
                text-align: left;
                width: 100%;
                transition: all 0.2s;
                display: flex;
                align-items: center;
                gap: 10px;
            " onmouseover="this.style.background='#3d4144'" onmouseout="this.style.background='none'">
                <i class="fas fa-edit"></i> Edit Post
            </button>
            <button onclick="deletePost('${postId}'); this.parentElement.remove();" style="
                background: none;
                border: none;
                color: #ef4444;
                cursor: pointer;
                font-size: 13px;
                padding: 10px 15px;
                text-align: left;
                width: 100%;
                transition: all 0.2s;
                display: flex;
                align-items: center;
                gap: 10px;
            " onmouseover="this.style.background='#3d4144'" onmouseout="this.style.background='none'">
                <i class="fas fa-trash"></i> Delete Post
            </button>
        `;
    } else {
        // Other user's post menu (Twitter-like)
        menu.innerHTML = `
            <button onclick="toggleFollowUser('${post.user_id}')" style="
                background: none;
                border: none;
                color: white;
                cursor: pointer;
                font-size: 13px;
                padding: 10px 15px;
                text-align: left;
                width: 100%;
                transition: all 0.2s;
                display: flex;
                align-items: center;
                gap: 10px;
            " onmouseover="this.style.background='#3d4144'" onmouseout="this.style.background='none'">
                <i class="fas fa-user-minus"></i> Unfollow
            </button>
            <button onclick="toggleMuteUser('${postId}')" style="
                background: none;
                border: none;
                color: white;
                cursor: pointer;
                font-size: 13px;
                padding: 10px 15px;
                text-align: left;
                width: 100%;
                transition: all 0.2s;
                display: flex;
                align-items: center;
                gap: 10px;
            " onmouseover="this.style.background='#3d4144'" onmouseout="this.style.background='none'">
                <i class="fas fa-volume-mute"></i> Mute
            </button>
            <button onclick="toggleBlockUser('${postId}')" style="
                background: none;
                border: none;
                color: white;
                cursor: pointer;
                font-size: 13px;
                padding: 10px 15px;
                text-align: left;
                width: 100%;
                transition: all 0.2s;
                display: flex;
                align-items: center;
                gap: 10px;
            " onmouseover="this.style.background='#3d4144'" onmouseout="this.style.background='none'">
                <i class="fas fa-ban"></i> Block
            </button>
            <button onclick="openReportPostModal('${postId}')" style="
                background: none;
                border: none;
                color: #ef4444;
                cursor: pointer;
                font-size: 13px;
                padding: 10px 15px;
                text-align: left;
                width: 100%;
                transition: all 0.2s;
                display: flex;
                align-items: center;
                gap: 10px;
            " onmouseover="this.style.background='#3d4144'" onmouseout="this.style.background='none'">
                <i class="fas fa-flag"></i> Report Post
            </button>
        `;
    }
    
    const postEl = document.getElementById(`post-${postId}`);
    const existing = postEl.querySelector('.post-menu');
    if (existing) existing.remove();
    
    // Append menu to post element and position it absolutely
    menu.style.position = 'absolute';
    menu.style.top = '50px';
    menu.style.right = '20px';
    
    postEl.style.position = 'relative';
    postEl.appendChild(menu);
    
    // Close menu when clicking outside
    document.addEventListener('click', function closeMenuOnClickOutside(e) {
        if (!postEl.contains(e.target)) {
            menu.remove();
            document.removeEventListener('click', closeMenuOnClickOutside);
        }
    });
}

function focusComment(postId) {
    // Show full comments section
    const commentsSection = document.getElementById(`comments-${postId}`);
    if (commentsSection) {
        commentsSection.style.display = 'block';
    }
    
    // Show comment input
    const input = document.getElementById(`comment-input-${postId}`);
    if (input) {
        input.style.display = 'flex';
        document.getElementById(`comment-text-${postId}`).focus();
    }
}


async function likePost(postId) {
    try {
        const heartIcon = document.querySelector(`#post-${postId} .fa-heart`);
        const likesCount = document.getElementById(`likes-${postId}`);
        const post = allPosts.find(p => p._id === postId);
        
        if (!post || !heartIcon || !likesCount) return;
        
        // Optimistic UI - update IMMEDIATELY
        const wasLiked = post.user_liked;
        const oldCount = post.likes;
        
        if (wasLiked) {
            // Unlike
            heartIcon.classList.remove('liked');
            post.likes = Math.max(0, post.likes - 1);
            likesCount.textContent = post.likes;
        } else {
            // Like
            heartIcon.classList.add('liked');
            post.likes = post.likes + 1;
            likesCount.textContent = post.likes;
            
            // Add pop animation
            heartIcon.style.animation = 'none';
            setTimeout(() => {
                heartIcon.style.animation = 'heartPop 0.6s ease-out';
            }, 10);
        }
        
        post.user_liked = !wasLiked;
        
        // Disable button while loading
        heartIcon.style.pointerEvents = 'none';
        heartIcon.style.opacity = '0.6';
        
        // Make API call in background
        const response = await fetch(`/api/posts/${postId}/like`, {
            method: 'POST',
            headers: {'Content-Type': 'application/json'}
        });
        
        const data = await response.json();
        
        // Re-enable button
        heartIcon.style.pointerEvents = 'auto';
        heartIcon.style.opacity = '1';
        
        if (!data.success) {
            // Rollback if failed
            post.likes = oldCount;
            post.user_liked = wasLiked;
            likesCount.textContent = oldCount;
            
            if (wasLiked) {
                heartIcon.classList.add('liked');
            } else {
                heartIcon.classList.remove('liked');
            }
            
            showNotification('Failed to like post', 'error');
        }
    } catch (err) {
        console.error('Error liking post:', err);
        showNotification('Error liking post', 'error');
    }
}

async function sharePost(postId) {
    try {
        const post = allPosts.find(p => p._id === postId);
        
        if (!post) return;
        
        // Show share modal - count only on actual share
        openShareModal(postId, post.username);
    } catch (err) {
        console.error('Error sharing post:', err);
    }
}

async function repostPost(postId) {
    try {
        const repostBtn = document.querySelector(`#post-${postId} .repost-btn`);
        const repostIcon = repostBtn.querySelector('.fa-retweet');
        const repostCount = document.getElementById(`reposts-${postId}`);
        const post = allPosts.find(p => p._id === postId);
        
        if (!post || !repostIcon || !repostCount) return;
        
        // Optimistic UI - update IMMEDIATELY
        const wasReposted = post.user_reposted;
        const oldCount = post.reposts;
        
        if (wasReposted) {
            // Remove repost
            repostIcon.classList.remove('reposted');
            repostBtn.classList.remove('reposted');
            post.reposts = Math.max(0, post.reposts - 1);
            repostCount.textContent = post.reposts;
        } else {
            // Add repost
            repostIcon.classList.add('reposted');
            repostBtn.classList.add('reposted');
            post.reposts = post.reposts + 1;
            repostCount.textContent = post.reposts;
        }
        
        post.user_reposted = !wasReposted;
        
        // Disable button while loading
        repostIcon.style.pointerEvents = 'none';
        repostIcon.style.opacity = '0.6';
        
        // Make API call in background
        const response = await fetch(`/api/posts/${postId}/repost`, {
            method: 'POST',
            headers: {'Content-Type': 'application/json'}
        });
        
        const data = await response.json();
        
        // Re-enable button
        repostIcon.style.pointerEvents = 'auto';
        repostIcon.style.opacity = '1';
        
        if (!data.success) {
            // Rollback if failed
            post.reposts = oldCount;
            post.user_reposted = wasReposted;
            repostCount.textContent = oldCount;
            
            if (wasReposted) {
                repostIcon.classList.add('reposted');
                repostBtn.classList.add('reposted');
            } else {
                repostIcon.classList.remove('reposted');
                repostBtn.classList.remove('reposted');
            }
            
            showNotification('Failed to repost', 'error');
        }
    } catch (err) {
        console.error('Error reposting:', err);
        showNotification('Error reposting', 'error');
    }
}

// Open image in full screen modal
function openImageModal(imageSrc) {
    const overlay = document.createElement('div');
    overlay.className = 'image-modal-overlay';
    overlay.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0, 0, 0, 0.95);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 10002;
        animation: fadeIn 0.2s ease-out;
    `;
    
    overlay.innerHTML = `
        <div style="position: relative; display: flex; align-items: center; justify-content: center; width: 90%; height: 90%;">
            <img src="${imageSrc}" style="max-width: 100%; max-height: 100%; border-radius: 12px; object-fit: contain;">
            <button style="
                position: absolute;
                top: 20px;
                right: 20px;
                background: rgba(255, 255, 255, 0.2);
                border: 1px solid white;
                color: white;
                font-size: 24px;
                width: 44px;
                height: 44px;
                border-radius: 50%;
                cursor: pointer;
                display: flex;
                align-items: center;
                justify-content: center;
                transition: all 0.2s;
            " onmouseover="this.style.background='rgba(255, 255, 255, 0.3)'" onmouseout="this.style.background='rgba(255, 255, 255, 0.2)'" onclick="document.querySelector('.image-modal-overlay').remove()">
                ✕
            </button>
        </div>
    `;
    
    // Close on overlay click
    overlay.addEventListener('click', (e) => {
        if (e.target === overlay) overlay.remove();
    });
    
    // Close on Escape key
    const closeOnEscape = (e) => {
        if (e.key === 'Escape') {
            overlay.remove();
            document.removeEventListener('keydown', closeOnEscape);
        }
    };
    document.addEventListener('keydown', closeOnEscape);
    
    document.body.appendChild(overlay);
}

function openShareModal(postId, username) {
    // Create overlay
    const overlay = document.createElement('div');
    overlay.className = 'share-overlay';
    overlay.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0, 0, 0, 0.5);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 10001;
        animation: fadeIn 0.2s ease-out;
    `;
    
    // Create modal
    const modal = document.createElement('div');
    modal.className = 'share-modal';
    modal.style.cssText = `
        background: #16181c;
        border: 1px solid #2f3336;
        border-radius: 16px;
        padding: 24px;
        max-width: 400px;
        width: 90%;
        box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
        animation: slideUp 0.3s ease-out;
    `;
    
    const postUrl = `${window.location.origin}/dashboard?post=${postId}`;
    
    modal.innerHTML = `
        <div style="text-align: center; margin-bottom: 24px;">
            <h2 style="color: white; margin: 0 0 8px 0; font-size: 20px; font-weight: 600;">Share Post</h2>
            <p style="color: #71767b; margin: 0; font-size: 14px;">from @${username}</p>
        </div>
        
        <div style="display: flex; flex-direction: column; gap: 12px;">
            <button class="share-option" onclick="copyShareLink('${postUrl}', '${postId}');">
                <i class="fas fa-link" style="font-size: 20px; color: #6366f1;"></i>
                <div style="text-align: left;">
                    <div style="font-weight: 600; color: white;">Copy Link</div>
                    <div style="font-size: 12px; color: #71767b;">Copy post link to clipboard</div>
                </div>
                <i class="fas fa-chevron-right" style="color: #71767b; margin-left: auto;"></i>
            </button>
            
            <button class="share-option" onclick="openShareToFriends('${postId}', '${username}');">
                <i class="fas fa-users" style="font-size: 20px; color: #1aa34a;"></i>
                <div style="text-align: left;">
                    <div style="font-weight: 600; color: white;">Share with Friends</div>
                    <div style="font-size: 12px; color: #71767b;">Send to followers</div>
                </div>
                <i class="fas fa-chevron-right" style="color: #71767b; margin-left: auto;"></i>
            </button>
            
            <button class="share-option" onclick="shareToWhatsApp('${postUrl}', '${postId}');">
                <i class="fab fa-whatsapp" style="font-size: 20px; color: #25d366;"></i>
                <div style="text-align: left;">
                    <div style="font-weight: 600; color: white;">Share on WhatsApp</div>
                    <div style="font-size: 12px; color: #71767b;">Share via WhatsApp</div>
                </div>
                <i class="fas fa-chevron-right" style="color: #71767b; margin-left: auto;"></i>
            </button>
            
            <button class="share-option" onclick="shareToTwitter('${postUrl}', '${postId}');">
                <i class="fab fa-twitter" style="font-size: 20px; color: #1da1f2;"></i>
                <div style="text-align: left;">
                    <div style="font-weight: 600; color: white;">Share on Twitter</div>
                    <div style="font-size: 12px; color: #71767b;">Share via Twitter</div>
                </div>
                <i class="fas fa-chevron-right" style="color: #71767b; margin-left: auto;"></i>
            </button>
        </div>
        
        <button onclick="closeShareModal()" style="
            width: 100%;
            margin-top: 20px;
            padding: 12px;
            background: #2f3336;
            color: white;
            border: none;
            border-radius: 24px;
            font-weight: 600;
            cursor: pointer;
            font-size: 15px;
            transition: all 0.2s;
        " onmouseover="this.style.background='#3d4144'" onmouseout="this.style.background='#2f3336'">Cancel</button>
    `;
    
    document.body.appendChild(overlay);
    overlay.appendChild(modal);
    
    // Close on overlay click
    overlay.onclick = (e) => {
        if (e.target === overlay) {
            closeShareModal();
        }
    };
}

function closeShareModal() {
    const overlay = document.querySelector('.share-overlay');
    if (overlay) {
        overlay.style.animation = 'fadeOut 0.2s ease-out';
        setTimeout(() => overlay.remove(), 200);
    }
}

function copyShareLink(url, postId) {
    navigator.clipboard.writeText(url).then(() => {
        // Increment share count only when actually copied
        incrementShareCount(postId);
        showNotification('Link copied & share counted!', 'success');
        closeShareModal();
    }).catch(err => {
        showNotification('Failed to copy link', 'error');
    });
}

function openShareToFriends(postId, username) {
    // Increment share count when sharing to friends
    incrementShareCount(postId);
    showNotification('Shared with friends!', 'success');
    closeShareModal();
}

function incrementShareCount(postId) {
    const post = allPosts.find(p => p._id === postId);
    const shareCount = document.getElementById(`shares-${postId}`);
    
    if (!post || !shareCount) return;
    
    // Increment locally
    post.shares = (post.shares || 0) + 1;
    shareCount.textContent = post.shares;
    
    // Track on backend
    fetch(`/api/posts/${postId}/share`, {
        method: 'POST',
        headers: {'Content-Type': 'application/json'}
    }).catch(err => console.error('Share tracking error:', err));
}

function shareToWhatsApp(url, postId) {
    const text = `Check out this post on Crown: ${url}`;
    // Increment share count
    incrementShareCount(postId);
    showNotification('Shared on WhatsApp!', 'success');
    closeShareModal();
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank');
}

function shareToTwitter(url, postId) {
    const text = `Check out this post on Crown`;
    // Increment share count
    incrementShareCount(postId);
    showNotification('Shared on Twitter!', 'success');
    closeShareModal();
    window.open(`https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(url)}`, '_blank');
}

function openEditPostModal(postId) {
    const post = allPosts.find(p => p._id === postId);
    if (!post) return;
    
    // Create overlay
    const overlay = document.createElement('div');
    overlay.className = 'edit-post-overlay';
    overlay.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0, 0, 0, 0.5);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 10001;
        animation: fadeIn 0.2s ease-out;
    `;
    
    // Create modal
    const modal = document.createElement('div');
    modal.className = 'edit-post-modal';
    modal.style.cssText = `
        background: #16181c;
        border: 1px solid #2f3336;
        border-radius: 16px;
        padding: 24px;
        max-width: 550px;
        width: 90%;
        box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
        animation: slideUp 0.3s ease-out;
    `;
    
    modal.innerHTML = `
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
            <h2 style="color: white; margin: 0; font-size: 20px; font-weight: 600;">Edit Post</h2>
            <button onclick="closeEditPostModal()" style="
                background: none;
                border: none;
                color: #71767b;
                cursor: pointer;
                font-size: 24px;
                padding: 0;
            ">&times;</button>
        </div>
        
        <textarea id="editPostText" style="
            width: 100%;
            padding: 12px;
            background: #2f3336;
            border: 1px solid #3d4144;
            border-radius: 8px;
            color: white;
            font-family: inherit;
            font-size: 15px;
            resize: vertical;
            min-height: 120px;
            box-sizing: border-box;
        ">${post.text}</textarea>
        
        <div style="display: flex; gap: 12px; margin-top: 20px; justify-content: flex-end;">
            <button onclick="closeEditPostModal()" style="
                padding: 12px 24px;
                background: #2f3336;
                color: white;
                border: none;
                border-radius: 24px;
                font-weight: 600;
                cursor: pointer;
                font-size: 15px;
                transition: all 0.2s;
            " onmouseover="this.style.background='#3d4144'" onmouseout="this.style.background='#2f3336'">Cancel</button>
            <button onclick="saveEditPost('${postId}')" style="
                padding: 12px 24px;
                background: #6366f1;
                color: white;
                border: none;
                border-radius: 24px;
                font-weight: 600;
                cursor: pointer;
                font-size: 15px;
                transition: all 0.2s;
            " onmouseover="this.style.background='#4f46e5'" onmouseout="this.style.background='#6366f1'">Save Changes</button>
        </div>
    `;
    
    document.body.appendChild(overlay);
    overlay.appendChild(modal);
    
    // Focus and select text
    const textarea = document.getElementById('editPostText');
    textarea.focus();
    textarea.select();
    
    // Close on overlay click
    overlay.onclick = (e) => {
        if (e.target === overlay) {
            closeEditPostModal();
        }
    };
}

function closeEditPostModal() {
    const overlay = document.querySelector('.edit-post-overlay');
    if (overlay) {
        overlay.style.animation = 'fadeOut 0.2s ease-out';
        setTimeout(() => overlay.remove(), 200);
    }
    
    // Remove menu if open
    document.querySelectorAll('.post-menu').forEach(menu => menu.remove());
}

async function saveEditPost(postId) {
    const textarea = document.getElementById('editPostText');
    const newText = textarea.value.trim();
    
    if (!newText) {
        showNotification('Post cannot be empty', 'error');
        return;
    }
    
    try {
        const response = await fetch(`/api/posts/${postId}`, {
            method: 'PUT',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({text: newText})
        });
        
        const data = await response.json();
        
        if (data.success) {
            // Update post in memory
            const post = allPosts.find(p => p._id === postId);
            if (post) {
                post.text = newText;
                post.edited_at = new Date().toISOString();
            }
            
            // Re-render the post
            renderPosts();
            
            closeEditPostModal();
            showNotification('Post updated successfully', 'success');
        } else {
            showNotification(data.error || 'Failed to update post', 'error');
        }
    } catch (err) {
        console.error('Error editing post:', err);
        showNotification('Error updating post', 'error');
    }
}

async function toggleFollowUser(userId) {
    try {
        // Close menu immediately
        document.querySelectorAll('.post-menu').forEach(menu => menu.remove());
        showNotification('Processing...', 'success');
        
        const response = await fetch(`/api/follow/${userId}`, {
            method: 'POST',
            headers: {'Content-Type': 'application/json'}
        });
        
        const data = await response.json();
        
        if (data.success) {
            showNotification(data.following ? 'User followed' : 'User unfollowed', 'success');
        } else {
            showNotification(data.error || 'Failed to follow user', 'error');
        }
    } catch (err) {
        console.error('Error:', err);
        showNotification('Error', 'error');
    }
}

async function toggleMuteUser(postId) {
    try {
        // Close menu immediately
        document.querySelectorAll('.post-menu').forEach(menu => menu.remove());
        showNotification('Muting...', 'success');
        
        const response = await fetch(`/api/posts/${postId}/mute-user`, {
            method: 'POST',
            headers: {'Content-Type': 'application/json'}
        });
        
        const data = await response.json();
        
        if (data.success) {
            showNotification(data.muted ? 'User muted' : 'User unmuted', 'success');
        } else {
            showNotification(data.error || 'Failed to mute user', 'error');
        }
    } catch (err) {
        console.error('Error:', err);
        showNotification('Error', 'error');
    }
}

async function toggleBlockUser(postId) {
    try {
        // Close menu immediately
        document.querySelectorAll('.post-menu').forEach(menu => menu.remove());
        showNotification('Blocking...', 'success');
        
        const response = await fetch(`/api/posts/${postId}/block-user`, {
            method: 'POST',
            headers: {'Content-Type': 'application/json'}
        });
        
        const data = await response.json();
        
        if (data.success) {
            showNotification(data.blocked ? 'User blocked' : 'User unblocked', 'success');
        } else {
            showNotification(data.error || 'Failed to block user', 'error');
        }
    } catch (err) {
        console.error('Error:', err);
        showNotification('Error', 'error');
    }
}

function openReportPostModal(postId) {
    const overlay = document.createElement('div');
    overlay.className = 'report-overlay';
    overlay.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0, 0, 0, 0.5);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 10001;
        animation: fadeIn 0.2s ease-out;
    `;
    
    const modal = document.createElement('div');
    modal.className = 'report-modal';
    modal.style.cssText = `
        background: #16181c;
        border: 1px solid #2f3336;
        border-radius: 16px;
        padding: 24px;
        max-width: 450px;
        width: 90%;
        box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
        animation: slideUp 0.3s ease-out;
    `;
    
    modal.innerHTML = `
        <h2 style="color: white; margin: 0 0 16px 0; font-size: 20px; font-weight: 600;">Report Post</h2>
        <p style="color: #71767b; margin: 0 0 20px 0; font-size: 14px;">Tell us why you think this post should be reviewed</p>
        
        <div style="display: flex; flex-direction: column; gap: 12px; margin-bottom: 20px;">
            <label style="display: flex; align-items: center; gap: 10px; cursor: pointer; color: white;">
                <input type="radio" name="reason" value="spam" style="cursor: pointer;">
                <span>Spam or abuse</span>
            </label>
            <label style="display: flex; align-items: center; gap: 10px; cursor: pointer; color: white;">
                <input type="radio" name="reason" value="hate_speech" style="cursor: pointer;">
                <span>Hate speech</span>
            </label>
            <label style="display: flex; align-items: center; gap: 10px; cursor: pointer; color: white;">
                <input type="radio" name="reason" value="violent" style="cursor: pointer;">
                <span>Violent or harmful</span>
            </label>
            <label style="display: flex; align-items: center; gap: 10px; cursor: pointer; color: white;">
                <input type="radio" name="reason" value="false_info" style="cursor: pointer;">
                <span>Misinformation</span>
            </label>
            <label style="display: flex; align-items: center; gap: 10px; cursor: pointer; color: white;">
                <input type="radio" name="reason" value="other" checked style="cursor: pointer;">
                <span>Other</span>
            </label>
        </div>
        
        <div style="display: flex; gap: 12px; justify-content: flex-end;">
            <button onclick="closeReportModal()" style="
                padding: 12px 24px;
                background: #2f3336;
                color: white;
                border: none;
                border-radius: 24px;
                font-weight: 600;
                cursor: pointer;
                font-size: 15px;
                transition: all 0.2s;
            " onmouseover="this.style.background='#3d4144'" onmouseout="this.style.background='#2f3336'">Cancel</button>
            <button onclick="submitReport('${postId}')" style="
                padding: 12px 24px;
                background: #ef4444;
                color: white;
                border: none;
                border-radius: 24px;
                font-weight: 600;
                cursor: pointer;
                font-size: 15px;
                transition: all 0.2s;
            " onmouseover="this.style.background='#dc2626'" onmouseout="this.style.background='#ef4444'">Report</button>
        </div>
    `;
    
    document.body.appendChild(overlay);
    overlay.appendChild(modal);
    
    overlay.onclick = (e) => {
        if (e.target === overlay) closeReportModal();
    };
}

function closeReportModal() {
    const overlay = document.querySelector('.report-overlay');
    if (overlay) {
        overlay.style.animation = 'fadeOut 0.2s ease-out';
        setTimeout(() => overlay.remove(), 200);
    }
}

async function submitReport(postId) {
    const reason = document.querySelector('input[name="reason"]:checked').value;
    
    try {
        const response = await fetch(`/api/posts/${postId}/report`, {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({reason})
        });
        
        const data = await response.json();
        
        if (data.success) {
            showNotification('Thank you. We will review this post.', 'success');
            closeReportModal();
            document.querySelectorAll('.post-menu').forEach(menu => menu.remove());
        } else {
            showNotification(data.error || 'Failed to report post', 'error');
        }
    } catch (err) {
        console.error('Error:', err);
        showNotification('Error reporting post', 'error');
    }
}

let commentSubmitting = {};  // Track which comments are submitting

async function submitComment(postId) {
     const input = document.getElementById(`comment-text-${postId}`);
     const submitBtn = document.querySelector(`#comment-input-${postId} .comment-btn`);
     const text = input.value.trim();
     const replyContext = document.getElementById(`reply-context-${postId}`);
     const parentCommentId = replyContext?.dataset.commentId || null;
     
     if (!text) {
         showNotification('Please write a comment', 'error');
         return;
     }
     
     // If editing a comment, call updateComment instead
     if (editingCommentId) {
         await updateComment(postId, editingCommentId, text);
         return;
     }
     
     // Prevent duplicate submissions
     if (commentSubmitting[postId]) {
         return;
     }
     
     try {
         // Mark as submitting FIRST (before any visual changes)
         commentSubmitting[postId] = true;
         
         // Show loading state
         submitBtn.disabled = true;
         submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';
         const originalValue = input.value;
         
         // Clear input immediately for better UX
         input.value = '';
         input.disabled = true;
         
         // Show optimistic comment in panel if comment panel open
         const post = allPosts.find(p => p._id === postId);
         if (post) {
             post.comments += 1;
         }
        
        const body = {text};
        if (parentCommentId) {
            body.parent_comment_id = parentCommentId;
        }
        
        const response = await fetch(`/api/posts/${postId}/comment`, {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify(body)
        });
        
        const data = await response.json();
        
        if (data.success) {
             const post = allPosts.find(p => p._id === postId);
             if (post) {
                 // Add comment to post's comments_list to keep data in sync
                 const newComment = {
                     id: data.comment.id,
                     user_id: data.comment.user_id,
                     username: data.comment.username,
                     avatar: data.comment.avatar,
                     text: data.comment.text,
                     created_at: data.comment.created_at
                 };
                 
                 if (parentCommentId) {
                     newComment.parent_comment_id = parentCommentId;
                 }
                 
                 post.comments_list.push(newComment);
                 
                 // Update comment count display
                 const commentSpan = document.querySelector(`#post-${postId} .fa-comment`)?.parentElement;
                 if (commentSpan) {
                     commentSpan.innerHTML = `<i class="fas fa-comment" onclick="openCommentPanel('${postId}')" style="cursor: pointer;"></i> ${post.comments}`;
                 }
             }
            
             clearReplyContext(postId);
             document.getElementById(`comment-input-${postId}`).style.display = 'none';
        } else {
            // Restore on error
            input.value = originalValue;
            const post = allPosts.find(p => p._id === postId);
            if (post) {
                post.comments -= 1;
            }
            showNotification(data.error || 'Failed to post comment', 'error');
        }
        } catch (err) {
        console.error('Error submitting comment:', err);
        // Restore on error
        input.value = originalValue;
        const post = allPosts.find(p => p._id === postId);
        if (post) {
            post.comments -= 1;
        }
        showNotification('Error posting comment - check connection', 'error');
        } finally {
        // Re-enable button
        commentSubmitting[postId] = false;
        submitBtn.disabled = false;
        submitBtn.innerHTML = '<i class="fas fa-paper-plane"></i>';
        input.disabled = false;
        }
}

async function deletePost(postId) {
    showConfirmDialog(
        'Delete Post?',
        'This action cannot be undone. Your post will be permanently deleted.',
        async () => {
            try {
                const response = await fetch(`/api/posts/${postId}`, {
                    method: 'DELETE'
                });
                
                const data = await response.json();
                
                if (data.success) {
                    const postEl = document.getElementById(`post-${postId}`);
                    if (postEl) {
                        postEl.style.animation = 'fadeOut 0.3s ease-out';
                        setTimeout(() => {
                            postEl.remove();
                            allPosts = allPosts.filter(p => p._id !== postId);
                            showNotification('Post deleted successfully', 'success');
                        }, 300);
                    }
                } else {
                    showNotification('Failed to delete post', 'error');
                }
            } catch (err) {
                console.error('Error deleting post:', err);
                showNotification('Error deleting post', 'error');
            }
        }
    );
}

function previewFile() {
    // Preview multiple files in responsive grid
    const files = document.getElementById('postFile').files;
    const preview = document.getElementById('postPreview');
    
    if (!files || files.length === 0) {
        preview.innerHTML = '';
        return;
    }
    
    // Limit to 10 files
    if (files.length > 10) {
        showNotification('Maximum 10 files allowed', 'error');
        document.getElementById('postFile').value = '';
        preview.innerHTML = '';
        return;
    }
    
    // Check individual file sizes
    for (let i = 0; i < files.length; i++) {
        if (files[i].size > 100 * 1024 * 1024) {
            showNotification(`File "${files[i].name}" too large (max 100MB)`, 'error');
            document.getElementById('postFile').value = '';
            preview.innerHTML = '';
            return;
        }
    }
    
    // Create responsive grid
    let html = `<div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 10px; margin-top: 12px;">`;
    
    // Track loaded files
    let loadedCount = 0;
    
    for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const isImage = file.type.startsWith('image/');
        const tag = isImage ? 'img' : 'video';
        
        const reader = new FileReader();
        reader.onload = function(e) {
            loadedCount++;
            const attrs = isImage ? '' : 'controls';
            const mediaHtml = `<${tag} src="${e.target.result}" ${attrs} style="width: 100%; height: 150px; object-fit: cover; border-radius: 8px; cursor: pointer;" onclick="this.style.objectFit = this.style.objectFit === 'cover' ? 'contain' : 'cover';"></${tag}>`;
            
            // Find the container for this file
            const containers = document.querySelectorAll('[data-file-index]');
            if (containers[i]) {
                containers[i].innerHTML = mediaHtml;
            }
            
            // If all files loaded, update grid
            if (loadedCount === files.length) {
                const gridContainer = preview.querySelector('[data-grid="true"]');
                if (gridContainer) {
                    gridContainer.style.display = 'grid';
                }
            }
        };
        reader.readAsDataURL(file);
        
        html += `<div data-file-index="${i}" style="background: #2f3336; border-radius: 8px; overflow: hidden;"></div>`;
    }
    
    html += `</div>`;
    
    preview.innerHTML = `<div data-grid="true" style="display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 10px; margin-top: 12px;">${Array.from(files).map((_, i) => `<div data-file-index="${i}" style="background: #2f3336; border-radius: 8px; overflow: hidden;"><div style="padding: 60px 10px; text-align: center;"><i class="fas fa-spinner fa-spin" style="color: #6366f1; font-size: 20px;"></i></div></div>`).join('')}</div>`;
    
    // Load all files
    Array.from(files).forEach((file, i) => {
        const reader = new FileReader();
        reader.onload = function(e) {
            const isImage = file.type.startsWith('image/');
            const tag = isImage ? 'img' : 'video';
            const attrs = isImage ? '' : 'controls';
            const container = preview.querySelector(`[data-file-index="${i}"]`);
            if (container) {
                container.innerHTML = `<${tag} src="${e.target.result}" ${attrs} style="width: 100%; height: 150px; object-fit: cover; border-radius: 8px; cursor: pointer;" onclick="this.style.objectFit = this.style.objectFit === 'cover' ? 'contain' : 'cover';"></${tag}>`;
            }
        };
        reader.readAsDataURL(file);
    });
}

function displayCloudinaryPreview(data) {
    const preview = document.getElementById('postPreview');
    const isVideo = data.resource_type === 'video';
    const mediaUrl = data.url;
    
    if (isVideo) {
        preview.innerHTML = `<video src="${mediaUrl}" controls style="max-width: 100%; max-height: 300px; border-radius: 12px; margin-top: 12px;"></video>`;
    } else {
        preview.innerHTML = `<img src="${mediaUrl}" style="max-width: 100%; max-height: 300px; border-radius: 12px; margin-top: 12px;">`;
    }
}

function previewFileOld() {
    const file = document.getElementById('postFile').files[0];
    const preview = document.getElementById('postPreview');
    
    if (!file) {
        preview.innerHTML = '';
        return;
    }
    
    const reader = new FileReader();
    reader.onload = function(e) {
        const isImage = file.type.startsWith('image/');
        const tag = isImage ? 'img' : 'video';
        const attrs = isImage ? '' : 'controls';
        preview.innerHTML = `<${tag} src="${e.target.result}" ${attrs} style="max-width: 100%; border-radius: 12px;"></${tag}>`;
    };
    reader.readAsDataURL(file);
}

// Modal Post Functions
function openPostModal() {
    const modal = document.getElementById('postModalOverlay');
    modal.style.display = 'flex';
    document.getElementById('modalPostText').focus();
    
    // Load user avatar in modal
    if (currentAvatarData) {
        document.getElementById('modalAvatar').src = currentAvatarData;
        document.getElementById('modalAvatar').style.display = 'block';
        document.getElementById('modalAvatarIcon').style.display = 'none';
    }
}

function closePostModal(event) {
    // Only close if clicking overlay, not content
    if (event && event.target.id !== 'postModalOverlay') return;
    
    const modal = document.getElementById('postModalOverlay');
    modal.style.display = 'none';
    
    // Clear modal form
    document.getElementById('modalPostText').value = '';
    document.getElementById('modalPostFile').value = '';
    document.getElementById('modalPostPreview').innerHTML = '';
}

function previewModalFile() {
    // Same as previewFile but for modal
    const files = document.getElementById('modalPostFile').files;
    const preview = document.getElementById('modalPostPreview');
    
    if (!files || files.length === 0) {
        preview.innerHTML = '';
        return;
    }
    
    if (files.length > 10) {
        showNotification('Maximum 10 files allowed', 'error');
        document.getElementById('modalPostFile').value = '';
        preview.innerHTML = '';
        return;
    }
    
    for (let i = 0; i < files.length; i++) {
        if (files[i].size > 100 * 1024 * 1024) {
            showNotification(`File "${files[i].name}" too large (max 100MB)`, 'error');
            document.getElementById('modalPostFile').value = '';
            preview.innerHTML = '';
            return;
        }
    }
    
    preview.innerHTML = `<div data-grid="true" style="display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 10px; margin-top: 12px;">${Array.from(files).map((_, i) => `<div data-file-index="${i}" style="background: #2f3336; border-radius: 8px; overflow: hidden;"><div style="padding: 60px 10px; text-align: center;"><i class="fas fa-spinner fa-spin" style="color: #6366f1; font-size: 20px;"></i></div></div>`).join('')}</div>`;
    
    Array.from(files).forEach((file, i) => {
        const reader = new FileReader();
        reader.onload = function(e) {
            const isImage = file.type.startsWith('image/');
            const tag = isImage ? 'img' : 'video';
            const attrs = isImage ? '' : 'controls';
            const container = preview.querySelector(`[data-file-index="${i}"]`);
            if (container) {
                container.innerHTML = `<${tag} src="${e.target.result}" ${attrs} style="width: 100%; height: 150px; object-fit: cover; border-radius: 8px; cursor: pointer;" onclick="this.style.objectFit = this.style.objectFit === 'cover' ? 'contain' : 'cover';"></${tag}>`;
            }
        };
        reader.readAsDataURL(file);
    });
}

let isSubmittingPost = false;  // Prevent duplicate submissions

async function submitModalPost() {
    // Same as submitPost but for modal
    const postText = document.getElementById('modalPostText').value.trim();
    const fileInput = document.getElementById('modalPostFile');
    const submitBtn = document.getElementById('modalPostSubmitBtn');
    
    if (!postText && !fileInput.files[0]) {
        showNotification('Please write something or select a file to post', 'error');
        return;
    }
    
    if (isSubmittingPost) {
        showNotification('Please wait, your post is being submitted...', 'error');
        return;
    }
    
    try {
        isSubmittingPost = true;
        submitBtn.disabled = true;
        submitBtn.style.opacity = '0.6';
        submitBtn.style.cursor = 'not-allowed';
        submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin" style="margin-right: 6px;"></i>Posting...';
        
        let mediaUrls = [];
        
        // Upload files to Cloudinary if selected
        if (fileInput.files && fileInput.files.length > 0) {
            const uploadPromises = Array.from(fileInput.files).map((file) => {
                return new Promise((resolve, reject) => {
                    const formData = new FormData();
                    formData.append('file', file);
                    
                    fetch('/api/upload-cloudinary-form', {
                        method: 'POST',
                        body: formData
                    })
                    .then(res => res.json())
                    .then(cloudinaryData => {
                        if (cloudinaryData.success) {
                            mediaUrls.push({
                                url: cloudinaryData.url,
                                resource_type: cloudinaryData.resource_type
                            });
                            showNotification(`File uploaded successfully`, 'success');
                            resolve();
                        } else {
                            showNotification(`Upload failed: ${cloudinaryData.error}`, 'error');
                            reject(new Error('Cloudinary upload failed'));
                        }
                    })
                    .catch(err => {
                        showNotification('Upload error', 'error');
                        reject(err);
                    });
                });
            });
            
            await Promise.all(uploadPromises);
        }
        
        const mediaData = mediaUrls.length > 0 ? mediaUrls[0] : { url: '', resource_type: 'image' };
        
        // Create post
        const response = await fetch('/api/posts', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({
                text: postText,
                image: mediaData.url,
                resource_type: mediaData.resource_type,
                mentions: mentionedUsers
            })
        });
        
        const data = await response.json();
        
        if (data.success) {
            const newPost = data.post;
            newPost.likes = 0;
            newPost.comments = 0;
            newPost.comments_list = [];
            newPost.user_liked = false;
            
            allPosts.unshift(newPost);
            renderPosts();
            
            // Clear modal
            document.getElementById('modalPostText').value = '';
            document.getElementById('modalPostFile').value = '';
            document.getElementById('modalPostPreview').innerHTML = '';
            mentionedUsers = [];
            
            closePostModal();
            showNotification('Post published successfully', 'success');
        } else {
            showNotification(data.error || 'Failed to post', 'error');
        }
    } catch (err) {
        console.error('Error submitting post:', err);
        showNotification('Error posting - check your connection', 'error');
    } finally {
        isSubmittingPost = false;
        submitBtn.disabled = false;
        submitBtn.style.opacity = '1';
        submitBtn.style.cursor = 'pointer';
        submitBtn.textContent = 'Post';
    }
}

async function submitPost() {
    const postText = document.getElementById('postText').value.trim();
    const fileInput = document.getElementById('postFile');
    const submitBtn = document.getElementById('postSubmitBtn');
    
    if (!postText && !fileInput.files[0]) {
        showNotification('Please write something or select a file to post', 'error');
        return;
    }
    
    // Prevent duplicate submissions
    if (isSubmittingPost) {
        showNotification('Please wait, your post is being submitted...', 'error');
        return;
    }
    
    try {
        // Disable button and show loading state
        isSubmittingPost = true;
        submitBtn.disabled = true;
        submitBtn.style.opacity = '0.6';
        submitBtn.style.cursor = 'not-allowed';
        submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin" style="margin-right: 6px;"></i>Posting...';
        
        let mediaUrls = [];
        
        // Step 1: If files selected, upload to Cloudinary first
         if (fileInput.files && fileInput.files.length > 0) {
             // Upload all files
             const uploadPromises = Array.from(fileInput.files).map((file) => {
                 return new Promise((resolve, reject) => {
                     const formData = new FormData();
                     formData.append('file', file);
                     
                     fetch('/api/upload-cloudinary-form', {
                         method: 'POST',
                         body: formData
                     })
                     .then(res => res.json())
                     .then(cloudinaryData => {
                         if (cloudinaryData.success) {
                             mediaUrls.push({
                                 url: cloudinaryData.url,
                                 resource_type: cloudinaryData.resource_type
                             });
                             resolve();
                         } else {
                             reject(new Error('Cloudinary upload failed'));
                         }
                     })
                     .catch(err => reject(err));
                 });
             });
             
             await Promise.all(uploadPromises);
         }
        
        // Use first media URL for now (or join them if you want to store multiple)
        const mediaData = mediaUrls.length > 0 ? mediaUrls[0] : { url: '', resource_type: 'image' };
        
        // Step 2: Create the post with media URL
        const response = await fetch('/api/posts', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({
                text: postText,
                image: mediaData.url,  // URL from Cloudinary or empty
                resource_type: mediaData.resource_type,
                mentions: mentionedUsers  // Include mentioned user IDs
            })
        });
        
        const data = await response.json();
        
        if (data.success) {
            const newPost = data.post;
            newPost.likes = 0;
            newPost.comments = 0;
            newPost.comments_list = [];
            newPost.user_liked = false;
            
            allPosts.unshift(newPost);
            renderPosts();
            
            // Clear form
            document.getElementById('postText').value = '';
            document.getElementById('postFile').value = '';
            document.getElementById('postPreview').innerHTML = '';
            mentionedUsers = [];  // Clear mentions after posting
            
            showNotification('Post published successfully', 'success');
        } else {
            showNotification(data.error || 'Failed to post', 'error');
        }
    } catch (err) {
        console.error('Error submitting post:', err);
        showNotification('Error posting - check your connection', 'error');
    } finally {
        // Re-enable button
        isSubmittingPost = false;
        submitBtn.disabled = false;
        submitBtn.style.opacity = '1';
        submitBtn.style.cursor = 'pointer';
        submitBtn.textContent = 'Post';
    }
}


function toggleTheme() {
    const body = document.body;
    const isLightMode = body.classList.contains('light-mode');
    const icon = document.querySelector('.theme-toggle button i');
    
    if (isLightMode) {
        body.classList.remove('light-mode');
        localStorage.setItem('theme', 'dark');
        if (icon) {
            icon.classList.remove('fa-sun');
            icon.classList.add('fa-moon');
        }
    } else {
        body.classList.add('light-mode');
        localStorage.setItem('theme', 'light');
        if (icon) {
            icon.classList.remove('fa-moon');
            icon.classList.add('fa-sun');
        }
    }
}


function openAvatarModal() {
    document.getElementById('avatarModal').classList.add('show');
    setupDragDrop();
}

function closeAvatarModal() {
    document.getElementById('avatarModal').classList.remove('show');
    cancelAvatarPreview();
}

function openStickerModal() {
    document.getElementById('stickerModal').classList.add('show');
}

function closeStickerModal() {
    document.getElementById('stickerModal').classList.remove('show');
}

function insertSticker(sticker) {
    const textarea = document.getElementById('postText');
    textarea.value += ' ' + sticker;
    textarea.focus();
    closeStickerModal();
}

function setupDragDrop() {
    const dropZone = document.getElementById('avatarDropZone');
    
    dropZone.addEventListener('dragover', (e) => {
        e.preventDefault();
        dropZone.classList.add('drag-over');
    });
    
    dropZone.addEventListener('dragleave', () => {
        dropZone.classList.remove('drag-over');
    });
    
    dropZone.addEventListener('drop', (e) => {
        e.preventDefault();
        dropZone.classList.remove('drag-over');
        const files = e.dataTransfer.files;
        if (files.length > 0) {
            document.getElementById('avatarFile').files = files;
            previewAvatar();
        }
    });
}

function previewAvatar() {
    const file = document.getElementById('avatarFile').files[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = function(e) {
        currentAvatarData = e.target.result;
        document.getElementById('previewImg').src = currentAvatarData;
        document.getElementById('avatarDropZone').style.display = 'none';
        document.getElementById('avatarPreview').style.display = 'block';
    };
    reader.readAsDataURL(file);
}

function cancelAvatarPreview() {
    document.getElementById('avatarDropZone').style.display = 'block';
    document.getElementById('avatarPreview').style.display = 'none';
    document.getElementById('avatarFile').value = '';
    currentAvatarData = null;
}

async function uploadAvatar() {
    if (!currentAvatarData) return;
    
    try {
        showNotification('Uploading avatar...', 'success');
        
        // Step 1: Upload to Cloudinary first
        const cloudinaryResponse = await fetch('/api/upload-cloudinary', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({file: currentAvatarData})
        });
        
        const cloudinaryData = await cloudinaryResponse.json();
        
        if (!cloudinaryData.success) {
            showNotification('Failed to upload image', 'error');
            return;
        }
        
        // Step 2: Save Cloudinary URL to user profile (not base64)
        const avatarResponse = await fetch('/api/upload-avatar', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({avatar: cloudinaryData.url})  // Send URL, not base64
        });
        
        const avatarData = await avatarResponse.json();
        
        if (avatarData.success) {
            // Update UI with Cloudinary URL (same visual result)
            const cloudinaryUrl = cloudinaryData.url;
            
            document.getElementById('sidebarAvatar').src = cloudinaryUrl;
            document.getElementById('sidebarAvatar').style.display = 'block';
            document.getElementById('sidebarAvatarIcon').style.display = 'none';
            
            document.getElementById('composerAvatar').src = cloudinaryUrl;
            document.getElementById('composerAvatar').style.display = 'block';
            document.getElementById('composerAvatarIcon').style.display = 'none';
            
            closeAvatarModal();
            showNotification('Avatar updated successfully', 'success');
        } else {
            showNotification(avatarData.error || 'Failed to update avatar', 'error');
        }
    } catch (err) {
        console.error('Error uploading avatar:', err);
        showNotification('Error uploading avatar', 'error');
    }
}

async function getCurrentUser() {
    try {
        const response = await fetch('/api/current-user');
        const data = await response.json();
        if (data.success) {
            currentUserId = data.user_id;
            if (data.avatar) {
                
                document.getElementById('sidebarAvatar').src = data.avatar;
                document.getElementById('sidebarAvatar').style.display = 'block';
                document.getElementById('sidebarAvatarIcon').style.display = 'none';
                
                document.getElementById('composerAvatar').src = data.avatar;
                document.getElementById('composerAvatar').style.display = 'block';
                document.getElementById('composerAvatarIcon').style.display = 'none';
            } else {
                
                document.getElementById('sidebarAvatar').style.display = 'none';
                document.getElementById('sidebarAvatarIcon').style.display = 'block';
                
                document.getElementById('composerAvatar').style.display = 'none';
                document.getElementById('composerAvatarIcon').style.display = 'block';
            }
        }
    } catch (err) {
        console.error('Error getting current user:', err);
    }
}


async function loadFriendsSuggestions(page = 1) {
    try {
        const now = Date.now();
        
        // Use cache if valid
        if (friendsCache && (now - friendsCacheTime) < CACHE_VALID_TIME) {
            allUsers = friendsCache;
            displayFriendsSuggestions();
            return;
        }
        
        // Fetch with pagination
        const response = await fetch(`/api/users?page=${page}&limit=${ITEMS_PER_PAGE * 2}`);
        const data = await response.json();
        if (data.success) {
            allUsers = data.users.filter(u => u._id !== currentUserId);
            friendsCache = allUsers;
            friendsCacheTime = now;
            friendsPage = page;
            displayFriendsSuggestions();
            
            // Setup infinite scroll if more users exist
            if (allUsers.length >= ITEMS_PER_PAGE * 2) {
                setupFriendsInfiniteScroll();
            }
        }
    } catch (err) {
        console.error('Error loading users:', err);
    }
}

function setupFriendsInfiniteScroll() {
    const container = document.getElementById('friendsSuggestions');
    if (!container) return;
    
    container.onscroll = function() {
        if (container.scrollTop + container.clientHeight >= container.scrollHeight - 100) {
            // Reached bottom, load more
            loadFriendsSuggestions(friendsPage + 1);
            container.onscroll = null; // Prevent multiple triggers
        }
    };
}

function displayFriendsSuggestions() {
    const container = document.getElementById('friendsSuggestions');
    const noMsg = document.getElementById('noFriendsMessage');
    
    if (allUsers.length === 0) {
        noMsg.style.display = 'block';
        container.innerHTML = '';
        return;
    }
    
    noMsg.style.display = 'none';
    const shuffled = allUsers.sort(() => Math.random() - 0.5).slice(0, 10);
    
    container.innerHTML = shuffled.map(user => {
        const isFollowing = user.is_following ? true : false;
        const buttonText = isFollowing ? 'Following' : 'Follow';
        return `
        <div class="friend-card" data-user-id="${user._id}">
            <div class="friend-card-avatar" onclick="loadUserProfile('${user._id}')" style="cursor: pointer;">
                ${user.avatar ? `<img src="${user.avatar}">` : '<i class="fas fa-user"></i>'}
            </div>
            <div class="friend-card-info" onclick="loadUserProfile('${user._id}')" style="cursor: pointer;">
                <div class="friend-card-name">${user.username}</div>
                <div class="friend-card-handle">@${user.username}</div>
            </div>
            <button class="friend-card-btn" id="follow-btn-${user._id}" onclick="handleFollowClick('${user._id}', '${user.username}')" data-following="${isFollowing}">${buttonText}</button>
        </div>
    `;
    }).join('');
}

function searchFriends() {
    const query = document.getElementById('searchInput').value.toLowerCase();
    const resultsDiv = document.getElementById('searchResults');
    
    if (!query) {
        resultsDiv.style.display = 'none';
        return;
    }
    
    const results = allUsers.filter(u => 
        u.username.toLowerCase().includes(query)
    );
    
    if (results.length === 0) {
        resultsDiv.innerHTML = '<div class="search-no-results">No friends found</div>';
        resultsDiv.style.display = 'block';
        return;
    }
    
    resultsDiv.innerHTML = results.map(user => `
        <div class="search-result-item">
            <div class="search-result-avatar">
                ${user.avatar ? `<img src="${user.avatar}">` : '<i class="fas fa-user"></i>'}
            </div>
            <div class="search-result-info">
                <div class="search-result-name">${user.username}</div>
            </div>
        </div>
    `).join('');
    
    resultsDiv.style.display = 'block';
}

function handleFollowClick(userId, username) {
    const btn = document.getElementById(`follow-btn-${userId}`);
    const isFollowing = btn.getAttribute('data-following') === 'true';
    
    if (isFollowing) {
        // Show unfollow confirmation
        showUnfollowConfirmation(userId, username);
    } else {
        // Update UI instantly (optimistic update)
        btn.textContent = 'Following';
        btn.setAttribute('data-following', 'true');
        btn.disabled = true;
        
        // Show notification IMMEDIATELY
        showNotification(`You followed @${username}`, 'success');
        
        // Then call server in background
        followUser(userId, username);
    }
}

function showUnfollowConfirmation(userId, username) {
    // Create overlay
    const overlay = document.createElement('div');
    overlay.className = 'unfollow-overlay';
    overlay.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0, 0, 0, 0.7);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 10001;
    `;
    
    // Create modal
    const modal = document.createElement('div');
    modal.className = 'unfollow-modal';
    modal.style.cssText = `
        background: #16181c;
        border: 1px solid #2f3336;
        border-radius: 16px;
        padding: 32px;
        max-width: 400px;
        text-align: center;
        box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
    `;
    
    modal.innerHTML = `
        <h2 style="color: white; margin: 0 0 12px 0; font-size: 20px; font-weight: 600;">Unfollow @${username}?</h2>
        <p style="color: #71767b; margin: 0 0 24px 0; font-size: 15px; line-height: 1.4;">Their posts will no longer show up in your Following timeline. You can still view their profile, unless their posts are protected.</p>
        
        <div style="display: flex; flex-direction: column; gap: 12px;">
            <button id="unfollow-confirm-btn" style="
                padding: 12px 24px;
                background: white;
                color: black;
                border: none;
                border-radius: 24px;
                font-weight: 600;
                cursor: pointer;
                font-size: 15px;
                transition: all 0.2s;
            " onmouseover="this.style.opacity='0.8'" onmouseout="this.style.opacity='1'">Unfollow</button>
            
            <button id="unfollow-cancel-btn" style="
                padding: 12px 24px;
                background: transparent;
                color: white;
                border: 1.5px solid #2f3336;
                border-radius: 24px;
                font-weight: 600;
                cursor: pointer;
                font-size: 15px;
                transition: all 0.2s;
            " onmouseover="this.style.borderColor='#6366f1'" onmouseout="this.style.borderColor='#2f3336'">Cancel</button>
        </div>
    `;
    
    document.body.appendChild(overlay);
    overlay.appendChild(modal);
    
    // Button handlers
    document.getElementById('unfollow-confirm-btn').onclick = () => {
        overlay.remove();
        // Show notification IMMEDIATELY before server call
        showNotification(`You unfollowed @${username}`, 'success');
        unfollowUser(userId, username);
    };
    
    document.getElementById('unfollow-cancel-btn').onclick = () => {
        overlay.remove();
    };
    
    // Close on overlay click
    overlay.onclick = (e) => {
        if (e.target === overlay) {
            overlay.remove();
        }
    };
}

async function followUser(userId, username) {
    try {
        const response = await fetch(`/api/follow/${userId}`, {
            method: 'POST',
            headers: {'Content-Type': 'application/json'}
        });
        
        const data = await response.json();
        
        if (data.success) {
            // Button already updated optimistically
            const btn = document.getElementById(`follow-btn-${userId}`);
            if (btn) btn.disabled = false;
            
            // Update user in allUsers
            const user = allUsers.find(u => u._id === userId);
            if (user) user.is_following = true;
            
            showNotification(`You followed @${username}`, 'success');
            
            if (viewingProfile && viewingProfile._id === userId) {
                await loadUserProfile(userId);
            }
        } else {
            // Failed - revert button
            const btn = document.getElementById(`follow-btn-${userId}`);
            if (btn) {
                btn.textContent = 'Follow';
                btn.setAttribute('data-following', 'false');
                btn.disabled = false;
            }
            showNotification('Failed to follow user', 'error');
        }
    } catch (err) {
        console.error('Error following user:', err);
        // Revert button on error
        const btn = document.getElementById(`follow-btn-${userId}`);
        if (btn) {
            btn.textContent = 'Follow';
            btn.setAttribute('data-following', 'false');
            btn.disabled = false;
        }
        showNotification('Failed to follow user', 'error');
    }
}

async function unfollowUser(userId, username) {
    try {
        // Update button instantly (optimistic update)
        const btn = document.getElementById(`follow-btn-${userId}`);
        if (btn) {
            btn.textContent = 'Follow';
            btn.setAttribute('data-following', 'false');
            btn.disabled = true;
        }
        
        const response = await fetch(`/api/follow/${userId}`, {
            method: 'POST',
            headers: {'Content-Type': 'application/json'}
        });
        
        const data = await response.json();
        
        if (data.success) {
            // Update user in allUsers
            const user = allUsers.find(u => u._id === userId);
            if (user) user.is_following = false;
            
            if (btn) btn.disabled = false;
            showNotification(`You unfollowed @${username}`, 'success');
            
            if (viewingProfile && viewingProfile._id === userId) {
                await loadUserProfile(userId);
            }
        } else {
            // Failed - revert button
            if (btn) {
                btn.textContent = 'Following';
                btn.setAttribute('data-following', 'true');
                btn.disabled = false;
            }
            showNotification('Failed to unfollow user', 'error');
        }
    } catch (err) {
        console.error('Error unfollowing user:', err);
        // Revert button on error
        const btn = document.getElementById(`follow-btn-${userId}`);
        if (btn) {
            btn.textContent = 'Following';
            btn.setAttribute('data-following', 'true');
            btn.disabled = false;
        }
        showNotification('Failed to unfollow user', 'error');
    }
}

function closeCommentPanel() {
    const panel = document.getElementById('commentPanel');
    const overlay = document.getElementById('commentPanelOverlay');
    
    panel.classList.remove('show');
    overlay.classList.remove('show');
    currentPanelPostId = null;
}

function openCommentPanel(postId) {
    currentPanelPostId = postId;
    const post = allPosts.find(p => p._id === postId);
    if (!post) return;
    
    // Show panel and overlay
    const panel = document.getElementById('commentPanel');
    const overlay = document.getElementById('commentPanelOverlay');
    panel.classList.add('show');
    overlay.classList.add('show');
    
    // Render post preview
    renderPanelPostPreview(post);
    
    // Fetch all comments for this post to ensure we have all old and new comments
    fetch(`/api/posts/${postId}`)
        .then(r => r.json())
        .then(data => {
            if (data.success && data.posts && data.posts.length > 0) {
                const updatedPost = data.posts[0];
                post.comments_list = updatedPost.comments_list || [];
                post.comments = updatedPost.comments || 0;
                renderPanelComments(post);
            } else {
                renderPanelComments(post);
            }
        })
        .catch(err => {
            console.error('Error fetching comments:', err);
            renderPanelComments(post);
        });
}

function renderPanelPostPreview(post) {
    const preview = document.getElementById('panelPostPreview');
    const createdTime = getRelativeTime(new Date(post.created_at));
    
    preview.innerHTML = `
        <div class="post-header">
            <img src="${post.avatar || 'https://via.placeholder.com/48'}" alt="User" onclick="loadUserProfile('${post.user_id}')" style="cursor: pointer;">
            <div class="post-user-info">
                <div class="post-name" onclick="loadUserProfile('${post.user_id}')">${post.username}</div>
                <div class="post-handle">@${post.email.split('@')[0]}</div>
                <div class="post-time">${createdTime}</div>
            </div>
        </div>
        <div class="post-content">${post.text}</div>
        ${post.image ? `<img src="${post.image}" style="max-width: 100%; border-radius: 12px; margin-bottom: 10px;">` : ''}
    `;
}

function renderPanelComments(post) {
    const commentsList = document.getElementById('panelCommentsList');
    const parentComments = post.comments_list.filter(c => !c.parent_comment_id);
    
    commentsList.innerHTML = parentComments.map(comment => {
        const replies = post.comments_list.filter(r => r.parent_comment_id === comment.id);
        const MAX_VISIBLE_REPLIES = 2;
        const visibleReplies = replies.slice(0, MAX_VISIBLE_REPLIES);
        const hiddenReplies = replies.slice(MAX_VISIBLE_REPLIES);
        
        return `
            <div class="panel-comment-item">
                ${comment.avatar ? 
                    `<img src="${comment.avatar}" alt="Commenter" onclick="loadUserProfile('${comment.user_id}')">` :
                    `<div class="panel-comment-avatar" onclick="loadUserProfile('${comment.user_id}')"><i class="fas fa-user"></i></div>`
                }
                <div class="panel-comment-content">
                    <div class="panel-comment-user" onclick="loadUserProfile('${comment.user_id}')">${comment.username}</div>
                    <div class="panel-comment-text">${comment.text}</div>
                    <div class="panel-comment-time">${getRelativeTime(new Date(comment.created_at))}</div>
                    <div style="display: flex; gap: 15px; margin-top: 8px; font-size: 12px; align-items: center;">
                        <span style="color: #71767b; cursor: pointer;" onclick="likeCommentPanel('${post._id}', '${comment.id}')">
                            <i class="fas fa-heart" id="like-${comment.id}" style="color: #71767b;"></i> <span id="like-count-${comment.id}">0</span> Like
                        </span>
                        <span style="color: #71767b; cursor: pointer;" onclick="replyToCommentPanel('${post._id}', '${comment.id}', '${comment.username}')">Reply</span>
                        ${replies.length > 0 ? `<span style="color: #6366f1;">${replies.length} ${replies.length === 1 ? 'Reply' : 'Replies'}</span>` : ''}
                        ${comment.user_id === currentUserId ? `<span style="color: #71767b; cursor: pointer; margin-left: auto;" onclick="showPanelCommentMenu('${post._id}', '${comment.id}')">...</span>` : ''}
                    </div>
                    ${visibleReplies.map(reply => `
                        <div class="panel-comment-reply" style="border-left: 2px solid #2f3336; margin-left: 20px; padding-left: 12px; margin-top: 12px;">
                            <div class="panel-comment-item" style="margin: 0; gap: 8px;">
                                ${reply.avatar ? 
                                    `<img src="${reply.avatar}" alt="Commenter" onclick="loadUserProfile('${reply.user_id}')" style="width: 28px; height: 28px;">` :
                                    `<div class="panel-comment-avatar" onclick="loadUserProfile('${reply.user_id}')" style="width: 28px; height: 28px;"><i class="fas fa-user" style="font-size: 12px;"></i></div>`
                                }
                                <div class="panel-comment-content">
                                    <div class="panel-comment-user" onclick="loadUserProfile('${reply.user_id}')" style="font-size: 12px;">${reply.username}</div>
                                    <div class="panel-comment-text" style="font-size: 12px;">@${comment.username} ${reply.text}</div>
                                    <div style="display: flex; gap: 12px; margin-top: 6px; font-size: 11px; align-items: center;">
                                        <span class="panel-comment-time">${getRelativeTime(new Date(reply.created_at))}</span>
                                        <span style="color: #71767b; cursor: pointer;" onclick="likeCommentPanel('${post._id}', '${reply.id}')">
                                            <i class="fas fa-heart" id="like-${reply.id}" style="color: #71767b;"></i> <span id="like-count-${reply.id}">0</span>
                                        </span>
                                        <span style="color: #71767b; cursor: pointer;" onclick="replyToCommentPanel('${post._id}', '${reply.id}', '${reply.username}')">Reply</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    `).join('')}
                    ${hiddenReplies.length > 0 ? `
                        <div style="margin-top: 12px; margin-left: 20px;">
                            <span style="color: #6366f1; cursor: pointer; font-size: 12px;" onclick="toggleShowMoreReplies('${post._id}', '${comment.id}')">
                                Show ${hiddenReplies.length} more ${hiddenReplies.length === 1 ? 'reply' : 'replies'}
                            </span>
                        </div>
                    ` : ''}
                    <div id="more-replies-${comment.id}" style="display: none;">
                        ${hiddenReplies.map(reply => `
                            <div class="panel-comment-reply" style="border-left: 2px solid #2f3336; margin-left: 20px; padding-left: 12px; margin-top: 12px;">
                                <div class="panel-comment-item" style="margin: 0; gap: 8px;">
                                    ${reply.avatar ? 
                                        `<img src="${reply.avatar}" alt="Commenter" onclick="loadUserProfile('${reply.user_id}')" style="width: 28px; height: 28px;">` :
                                        `<div class="panel-comment-avatar" onclick="loadUserProfile('${reply.user_id}')" style="width: 28px; height: 28px;"><i class="fas fa-user" style="font-size: 12px;"></i></div>`
                                    }
                                    <div class="panel-comment-content">
                                        <div class="panel-comment-user" onclick="loadUserProfile('${reply.user_id}')" style="font-size: 12px;">${reply.username}</div>
                                        <div class="panel-comment-text" style="font-size: 12px;">@${comment.username} ${reply.text}</div>
                                        <div style="display: flex; gap: 12px; margin-top: 6px; font-size: 11px; align-items: center;">
                                            <span class="panel-comment-time">${getRelativeTime(new Date(reply.created_at))}</span>
                                            <span style="color: #71767b; cursor: pointer;" onclick="likeCommentPanel('${post._id}', '${reply.id}')">
                                                <i class="fas fa-heart" id="like-${reply.id}" style="color: #71767b;"></i> <span id="like-count-${reply.id}">0</span>
                                            </span>
                                            <span style="color: #71767b; cursor: pointer;" onclick="replyToCommentPanel('${post._id}', '${reply.id}', '${reply.username}')">Reply</span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        `).join('')}
                    </div>
                </div>
            </div>
        `;
    }).join('');
}

function toggleShowMoreReplies(postId, commentId) {
    const moreRepliesDiv = document.getElementById(`more-replies-${commentId}`);
    if (moreRepliesDiv.style.display === 'none') {
        moreRepliesDiv.style.display = 'block';
    } else {
        moreRepliesDiv.style.display = 'none';
    }
}

function closeComments(postId) {
    const commentsSection = document.getElementById(`comments-${postId}`);
    const commentInput = document.getElementById(`comment-input-${postId}`);
    const commentPreview = document.querySelector(`#post-${postId} .comment-preview`);
    
    if (commentsSection) {
        commentsSection.style.display = 'none';
    }
    if (commentInput) {
        commentInput.style.display = 'none';
    }
    if (commentPreview) {
        commentPreview.style.display = 'block';
    }
}

function replyToComment(postId, commentId, username) {
    const input = document.getElementById(`comment-input-${postId}`);
    const replyContext = document.getElementById(`reply-context-${postId}`);
    const textInput = document.getElementById(`comment-text-${postId}`);
    
    if (input) {
        input.style.display = 'flex';
        replyContext.style.display = 'block';
        replyContext.innerHTML = `Replying to <strong>@${username}</strong> <span style="cursor: pointer; color: #6366f1;" onclick="clearReplyContext('${postId}')">✕</span>`;
        replyContext.dataset.commentId = commentId;
        textInput.focus();
    }
}

function clearReplyContext(postId) {
    const replyContext = document.getElementById(`reply-context-${postId}`);
    const textInput = document.getElementById(`comment-text-${postId}`);
    
    if (replyContext) {
        replyContext.style.display = 'none';
        replyContext.dataset.commentId = '';
    }
    if (textInput) {
        textInput.value = '';
    }
}

function showCommentMenu(postId, commentId) {
    const commentEl = document.querySelector(`[data-comment-id="${commentId}"]`);
    const existing = commentEl.querySelector('.comment-menu');
    
    if (existing) {
        existing.remove();
        return;
    }
    
    const menu = document.createElement('div');
    menu.className = 'comment-menu';
    menu.innerHTML = `
        <button onclick="editComment('${postId}', '${commentId}')">Edit</button>
        <button class="delete" onclick="deleteComment('${postId}', '${commentId}')">Delete</button>
    `;
    
    commentEl.appendChild(menu);
}

let editingCommentId = null;
let originalCommentText = null;

async function editComment(postId, commentId) {
    const post = allPosts.find(p => p._id === postId);
    const comment = post?.comments_list.find(c => c.id === commentId);
    
    if (!comment) return;
    
    // Get the input field
    const input = document.getElementById(`comment-text-${postId}`);
    const submitBtn = document.querySelector(`#comment-input-${postId} .comment-btn`);
    
    if (!input) return;
    
    // Show input field if hidden
    document.getElementById(`comment-input-${postId}`).style.display = 'flex';
    
    // Set edit mode
    editingCommentId = commentId;
    originalCommentText = comment.text;
    
    // Put comment text in input
    input.value = comment.text;
    input.focus();
    
    // Change button text to "Update"
    submitBtn.textContent = 'Update';
    submitBtn.style.background = '#6366f1';
    
    // Add cancel button
    let cancelBtn = document.getElementById(`cancel-edit-${postId}`);
    if (!cancelBtn) {
        cancelBtn = document.createElement('button');
        cancelBtn.id = `cancel-edit-${postId}`;
        cancelBtn.textContent = 'Cancel';
        cancelBtn.style.cssText = `
            padding: 8px 16px;
            background: #2f3336;
            color: white;
            border: none;
            border-radius: 20px;
            cursor: pointer;
            font-size: 14px;
            transition: all 0.2s;
        `;
        cancelBtn.onmouseover = function() { this.style.background = '#3d4144'; };
        cancelBtn.onmouseout = function() { this.style.background = '#2f3336'; };
        cancelBtn.onclick = () => cancelEditComment(postId);
        document.querySelector(`#comment-input-${postId}`).appendChild(cancelBtn);
    }
    cancelBtn.style.display = 'inline-block';
}

function cancelEditComment(postId) {
    const input = document.getElementById(`comment-text-${postId}`);
    const submitBtn = document.querySelector(`#comment-input-${postId} .comment-btn`);
    const cancelBtn = document.getElementById(`cancel-edit-${postId}`);
    
    // Reset to normal state
    editingCommentId = null;
    originalCommentText = null;
    input.value = '';
    input.placeholder = 'Write a comment...';
    submitBtn.textContent = 'Send';
    submitBtn.style.background = '#6366f1';
    cancelBtn.style.display = 'none';
}

async function updateComment(postId, commentId, newText) {
    try {
        const submitBtn = document.querySelector(`#comment-input-${postId} .comment-btn`);
        
        submitBtn.disabled = true;
        submitBtn.style.opacity = '0.6';
        submitBtn.textContent = 'Updating...';
        
        const response = await fetch(`/api/posts/${postId}/comment/${commentId}`, {
            method: 'PUT',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({text: newText})
        });
        
        const data = await response.json();
        
        if (data.success) {
            const post = allPosts.find(p => p._id === postId);
            const comment = post?.comments_list.find(c => c.id === commentId);
            if (comment) {
                comment.text = newText;
                renderSinglePost(postId);
            }
            showNotification('Comment updated successfully', 'success');
            cancelEditComment(postId);
        } else {
            showNotification(data.error || 'Failed to edit comment', 'error');
        }
    } catch (err) {
        console.error('Error updating comment:', err);
        showNotification('Error updating comment', 'error');
    } finally {
        const submitBtn = document.querySelector(`#comment-input-${postId} .comment-btn`);
        submitBtn.disabled = false;
        submitBtn.style.opacity = '1';
        submitBtn.textContent = editingCommentId ? 'Update' : 'Send';
    }
}

async function deleteComment(postId, commentId) {
    showConfirmDialog(
        'Delete Comment?',
        'This action cannot be undone.',
        async () => {
            try {
                const response = await fetch(`/api/posts/${postId}/comment/${commentId}`, {
                    method: 'DELETE',
                    headers: {'Content-Type': 'application/json'}
                });
                
                const data = await response.json();
                
                if (data.success) {
                     const post = allPosts.find(p => p._id === postId);
                     if (post) {
                         post.comments_list = post.comments_list.filter(c => c.id !== commentId);
                         post.comments -= 1;
                         
                         // Update comment count display INSTANTLY (before re-render)
                         const commentSpan = document.querySelector(`#post-${postId} .fa-comment`)?.parentElement;
                         if (commentSpan) {
                             commentSpan.innerHTML = `<i class="fas fa-comment" onclick="openCommentPanel('${postId}')" style="cursor: pointer;"></i> ${post.comments}`;
                         }
                         
                         renderSinglePost(postId);
                     }
                     showNotification('Comment deleted successfully', 'success');
                } else {
                    showNotification(data.error || 'Failed to delete comment', 'error');
                }
            } catch (err) {
                console.error('Error deleting comment:', err);
                showNotification('Error deleting comment', 'error');
            }
        }
    );
}

let panelCommentSubmitting = false;

async function submitPanelComment() {
    const input = document.getElementById('panelCommentInput');
    const submitBtn = document.querySelector('.comment-btn');
    const text = input.value.trim();
    const parentCommentId = input.dataset.parentCommentId || null;
    
    if (!text || !currentPanelPostId) {
        showNotification('Please write a comment', 'error');
        return;
    }
    
    // Prevent duplicate submissions
    if (panelCommentSubmitting) {
        showNotification('Please wait, submitting comment...', 'error');
        return;
    }
    
    try {
        // Disable button and show loading
        panelCommentSubmitting = true;
        submitBtn.disabled = true;
        submitBtn.style.opacity = '0.6';
        submitBtn.style.cursor = 'not-allowed';
        const originalText = submitBtn.textContent;
        submitBtn.textContent = 'Sending...';
        
        const body = { text };
        if (parentCommentId) {
            body.parent_comment_id = parentCommentId;
        }
        
        const response = await fetch(`/api/posts/${currentPanelPostId}/comment`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body)
        });
        
        const data = await response.json();
        
        if (data.success) {
            const post = allPosts.find(p => p._id === currentPanelPostId);
            if (post) {
                const newComment = {
                    id: data.comment.id,
                    user_id: data.comment.user_id,
                    username: data.comment.username,
                    avatar: data.comment.avatar,
                    text: data.comment.text,
                    created_at: data.comment.created_at
                };
                
                if (parentCommentId) {
                    newComment.parent_comment_id = parentCommentId;
                }
                
                post.comments_list.push(newComment);
                post.comments += 1;
                
                // Update main post comment count display INSTANTLY
                const commentSpan = document.querySelector(`#post-${currentPanelPostId} .fa-comment`)?.parentElement;
                if (commentSpan) {
                    commentSpan.innerHTML = `<i class="fas fa-comment" onclick="openCommentPanel('${currentPanelPostId}')" style="cursor: pointer;"></i> ${post.comments}`;
                }
                
                // Re-render comments in panel
                renderPanelComments(post);
                }
                
                input.value = '';
                input.placeholder = 'Write a comment...';
                delete input.dataset.parentCommentId;
                
                showNotification('Comment posted successfully', 'success');
        } else {
            showNotification(data.error || 'Failed to post comment', 'error');
        }
    } catch (err) {
        console.error('Error submitting comment:', err);
        showNotification('Error posting comment - check connection', 'error');
    } finally {
        // Re-enable button
        panelCommentSubmitting = false;
        submitBtn.disabled = false;
        submitBtn.style.opacity = '1';
        submitBtn.style.cursor = 'pointer';
        submitBtn.textContent = 'Send';
    }
}

async function likeCommentPanel(postId, commentId) {
    try {
        const response = await fetch(`/api/posts/${postId}/comment/${commentId}/like`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' }
        });
        
        const data = await response.json();
        
        if (data.success) {
            const likeIcon = document.getElementById(`like-${commentId}`);
            const likeCount = document.getElementById(`like-count-${commentId}`);
            
            if (data.liked) {
                likeIcon.style.color = '#e0245e';
            } else {
                likeIcon.style.color = '#71767b';
            }
            likeCount.textContent = data.likes_count;
        }
    } catch (err) {
        console.error('Error liking comment:', err);
    }
}

function replyToCommentPanel(postId, commentId, username) {
    const input = document.getElementById('panelCommentInput');
    input.placeholder = `Reply to @${username}`;
    input.dataset.parentCommentId = commentId;
    input.focus();
}

function showPanelCommentMenu(postId, commentId) {
    const post = allPosts.find(p => p._id === postId);
    if (!post) return;
    
    const comment = post.comments_list.find(c => c.id === commentId);
    if (!comment) return;
    
    // Remove existing menu if any
    const existingMenu = document.querySelector('.panel-comment-menu-' + commentId);
    if (existingMenu) {
        existingMenu.remove();
        return;
    }
    
    const menu = document.createElement('div');
    menu.className = 'panel-comment-menu-' + commentId;
    menu.style.position = 'fixed';
    menu.style.background = '#2f3336';
    menu.style.borderRadius = '8px';
    menu.style.padding = '8px 0';
    menu.style.minWidth = '120px';
    menu.style.border = '1px solid #3d4144';
    menu.style.zIndex = '10001';
    menu.innerHTML = `
        <button onclick="editPanelComment('${postId}', '${commentId}')" style="background: none; border: none; color: white; cursor: pointer; font-size: 13px; padding: 8px 15px; text-align: left; width: 100%; transition: all 0.2s;" onmouseover="this.style.background='#3d4144'" onmouseout="this.style.background='none'">Edit</button>
        <button onclick="deletePanelComment('${postId}', '${commentId}')" style="background: none; border: none; color: #ef4444; cursor: pointer; font-size: 13px; padding: 8px 15px; text-align: left; width: 100%; transition: all 0.2s;" onmouseover="this.style.background='#3d4144'" onmouseout="this.style.background='none'">Delete</button>
    `;
    
    document.body.appendChild(menu);
    
    // Position menu near the three dots
    const dots = event.target;
    const rect = dots.getBoundingClientRect();
    menu.style.top = (rect.bottom + 5) + 'px';
    menu.style.left = (rect.left - 120) + 'px';
}

function editPanelComment(postId, commentId) {
    const post = allPosts.find(p => p._id === postId);
    if (!post) return;
    
    const comment = post.comments_list.find(c => c.id === commentId);
    if (!comment) return;
    
    // Create edit dialog
    const editOverlay = document.createElement('div');
    editOverlay.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0, 0, 0, 0.5);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 10001;
        animation: fadeIn 0.2s ease-out;
    `;
    
    const editDialog = document.createElement('div');
    editDialog.style.cssText = `
        background: #16181c;
        border: 1px solid #2f3336;
        border-radius: 16px;
        padding: 24px;
        max-width: 500px;
        width: 90%;
        box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
        animation: slideUp 0.3s ease-out;
    `;
    
    editDialog.innerHTML = `
        <h2 style="color: white; margin: 0 0 16px 0; font-size: 18px; font-weight: 600;">Edit Comment</h2>
        <textarea id="editCommentText" style="
            width: 100%;
            padding: 12px;
            background: #2f3336;
            border: 1px solid #3d4144;
            border-radius: 8px;
            color: white;
            font-family: inherit;
            font-size: 15px;
            resize: vertical;
            min-height: 80px;
            box-sizing: border-box;
        ">${comment.text}</textarea>
        <div style="display: flex; gap: 12px; margin-top: 16px; justify-content: flex-end;">
            <button style="
                padding: 10px 24px;
                background: #2f3336;
                color: white;
                border: none;
                border-radius: 24px;
                font-weight: 600;
                cursor: pointer;
                font-size: 15px;
                transition: all 0.2s;
            " onmouseover="this.style.background='#3d4144'" onmouseout="this.style.background='#2f3336'">Cancel</button>
            <button style="
                padding: 10px 24px;
                background: #6366f1;
                color: white;
                border: none;
                border-radius: 24px;
                font-weight: 600;
                cursor: pointer;
                font-size: 15px;
                transition: all 0.2s;
            " onmouseover="this.style.background='#4f46e5'" onmouseout="this.style.background='#6366f1'">Save</button>
        </div>
    `;
    
    editOverlay.appendChild(editDialog);
    document.body.appendChild(editOverlay);
    
    const textarea = editDialog.querySelector('#editCommentText');
    const buttons = editDialog.querySelectorAll('button');
    const cancelBtn = buttons[0];
    const saveBtn = buttons[1];
    
    textarea.focus();
    textarea.select();
    
    const closeEdit = () => {
        editOverlay.style.animation = 'fadeOut 0.2s ease-out';
        setTimeout(() => editOverlay.remove(), 200);
        document.querySelector('.panel-comment-menu-' + commentId)?.remove();
    };
    
    cancelBtn.onclick = closeEdit;
    editOverlay.onclick = (e) => {
        if (e.target === editOverlay) closeEdit();
    };
    
    saveBtn.onclick = async () => {
        const newText = textarea.value.trim();
        
        if (!newText) {
            showNotification('Comment cannot be empty', 'error');
            return;
        }
        
        if (newText === comment.text) {
            closeEdit();
            return;
        }
        
        try {
            saveBtn.disabled = true;
            saveBtn.style.opacity = '0.6';
            saveBtn.textContent = 'Saving...';
            
            const response = await fetch(`/api/posts/${postId}/comment/${commentId}`, {
                method: 'PUT',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({text: newText})
            });
            
            const data = await response.json();
            
            if (data.success) {
                comment.text = newText;
                renderPanelComments(post);
                showNotification('Comment updated successfully', 'success');
                closeEdit();
            } else {
                showNotification(data.error || 'Failed to edit comment', 'error');
            }
        } catch (err) {
            console.error('Error editing comment:', err);
            showNotification('Error editing comment', 'error');
        } finally {
            saveBtn.disabled = false;
            saveBtn.style.opacity = '1';
            saveBtn.textContent = 'Save';
        }
    };
}

function deletePanelComment(postId, commentId) {
    showConfirmDialog(
        'Delete Comment?',
        'This action cannot be undone.',
        async () => {
            try {
                const response = await fetch(`/api/posts/${postId}/comment/${commentId}`, {
                    method: 'DELETE',
                    headers: {'Content-Type': 'application/json'}
                });
                
                const data = await response.json();
                
                if (data.success) {
                     const post = allPosts.find(p => p._id === postId);
                     if (post) {
                         post.comments_list = post.comments_list.filter(c => c.id !== commentId);
                         post.comments -= 1;
                         
                         // Update main post comment count display INSTANTLY
                         const commentSpan = document.querySelector(`#post-${postId} .fa-comment`)?.parentElement;
                         if (commentSpan) {
                             commentSpan.innerHTML = `<i class="fas fa-comment" onclick="openCommentPanel('${postId}')" style="cursor: pointer;"></i> ${post.comments}`;
                         }
                     }
                     renderPanelComments(post);
                     showNotification('Comment deleted successfully', 'success');
                } else {
                    showNotification(data.error || 'Failed to delete comment', 'error');
                }
            } catch (err) {
                console.error('Error deleting comment:', err);
                showNotification('Error deleting comment', 'error');
            }
        }
    );
    document.querySelector('.panel-comment-menu-' + commentId)?.remove();
}

function setupMentionFeature() {
    const postText = document.getElementById('postText');
    if (!postText) return;
    
    postText.addEventListener('input', handleMentionInput);
}

function handleMentionInput(e) {
    const text = e.target.value;
    const lastAtSymbol = text.lastIndexOf('@');
    
    if (lastAtSymbol === -1) {
        closeMentionDropdown();
        return;
    }
    
    // Get text after @
    const afterAt = text.substring(lastAtSymbol + 1);
    
    // If there's a space after @, close dropdown
    if (afterAt.includes(' ')) {
        closeMentionDropdown();
        return;
    }
    
    // Search for users matching the query
    if (afterAt.length >= 1) {
        searchAndShowMentions(afterAt);
    } else {
        showMentionDropdown([]);
    }
}

async function searchAndShowMentions(query) {
    try {
        const response = await fetch(`/api/users/search?q=${encodeURIComponent(query)}`);
        const data = await response.json();
        
        if (data.success) {
            showMentionDropdown(data.users);
        }
    } catch (err) {
        console.error('Error searching users:', err);
    }
}

function showMentionDropdown(users) {
    let dropdown = document.getElementById('mentionDropdown');
    
    if (!dropdown) {
        dropdown = document.createElement('div');
        dropdown.id = 'mentionDropdown';
        dropdown.style.cssText = `
            position: absolute;
            top: 0;
            left: 0;
            background: var(--bg-secondary);
            border: 1px solid var(--border-color);
            border-radius: 8px;
            z-index: 1000;
            max-height: 300px;
            overflow-y: auto;
            min-width: 250px;
            box-shadow: 0 4px 12px rgba(0,0,0,0.15);
        `;
        document.body.appendChild(dropdown);
    }
    
    if (users.length === 0) {
        dropdown.style.display = 'none';
        return;
    }
    
    dropdown.innerHTML = users.map(user => `
        <div class="mention-item" onclick="selectMention('${user._id}', '@${user.username}')">
            ${user.avatar ? `<img src="${user.avatar}" style="width: 32px; height: 32px; border-radius: 50%; object-fit: cover; margin-right: 10px;">` : `<div style="width: 32px; height: 32px; border-radius: 50%; background: #6366f1; display: flex; align-items: center; justify-content: center; margin-right: 10px;"><i class="fas fa-user" style="color: white; font-size: 14px;"></i></div>`}
            <div>
                <div style="font-weight: 500;">${user.name}</div>
                <div style="font-size: 12px; opacity: 0.7;">@${user.username}</div>
            </div>
        </div>
    `).join('');
    
    // Style mention items
    const items = dropdown.querySelectorAll('.mention-item');
    items.forEach(item => {
        item.style.cssText = `
            padding: 10px;
            cursor: pointer;
            display: flex;
            align-items: center;
            border-bottom: 1px solid var(--border-color);
            transition: background 0.2s;
        `;
        item.addEventListener('mouseover', function() {
            this.style.background = 'var(--hover-color)';
        });
        item.addEventListener('mouseout', function() {
            this.style.background = 'transparent';
        });
    });
    
    // Position dropdown near cursor
    const postText = document.getElementById('postText');
    const rect = postText.getBoundingClientRect();
    dropdown.style.top = (rect.bottom + 5) + 'px';
    dropdown.style.left = rect.left + 'px';
    dropdown.style.display = 'block';
}

function closeMentionDropdown() {
    const dropdown = document.getElementById('mentionDropdown');
    if (dropdown) {
        dropdown.style.display = 'none';
    }
}

function selectMention(userId, username) {
    const postText = document.getElementById('postText');
    let text = postText.value;
    
    // Find last @ and replace from there
    const lastAtSymbol = text.lastIndexOf('@');
    if (lastAtSymbol !== -1) {
        text = text.substring(0, lastAtSymbol) + username + ' ';
        postText.value = text;
    }
    
    // Add user to mentioned users list if not already there
    if (!mentionedUsers.includes(userId)) {
        mentionedUsers.push(userId);
    }
    
    closeMentionDropdown();
    postText.focus();
}

async function loadTrending() {
    try {
        const response = await fetch('/api/trending');
        const data = await response.json();
        
        if (data.success && data.trending) {
            const newsBox = document.querySelector('.news-box');
            if (!newsBox) return;
            
            // Find the news items container
            const newsItemsContainer = newsBox.querySelector('div:not(.news-box > h3)');
            if (!newsItemsContainer) {
                // Create container if doesn't exist
                const container = document.createElement('div');
                newsBox.appendChild(container);
            }
            
            // Update trending items
            let html = '';
            data.trending.forEach((trend, index) => {
                html += `
                    <div class="news-item" style="cursor: pointer;" onclick="viewHashtag('${trend.tag}')">
                        <div class="news-category">Trending · Worldwide</div>
                        <div class="news-title">${trend.tag}</div>
                        <div class="news-count">${trend.posts.toLocaleString()} posts</div>
                    </div>
                `;
            });
            
            // Replace old content
            const oldItems = newsBox.querySelectorAll('.news-item');
            oldItems.forEach(item => item.remove());
            
            const fragment = document.createRange().createContextualFragment(html);
            newsBox.appendChild(fragment);
        }
    } catch (err) {
        console.error('Error loading trending:', err);
    }
}

async function viewHashtag(tag) {
    try {
        showLoading();
        
        // Ensure tag starts with #
        if (!tag.startsWith('#')) {
            tag = '#' + tag;
        }
        
        const response = await fetch(`/api/hashtags/${encodeURIComponent(tag)}`);
        const data = await response.json();
        
        if (data.success) {
            // Store posts and prepare view
            allPosts = data.posts;
            
            // Update hashtag page UI
            document.getElementById('hashtagName').textContent = data.tag;
            document.getElementById('hashtagStats').textContent = `${data.info.post_count} Posts`;
            
            // Render posts on hashtag page
            const container = document.getElementById('hashtagPostsContainer');
            container.innerHTML = '';
            
            if (allPosts.length === 0) {
                container.innerHTML = `
                    <div style="padding: 40px 20px; text-align: center; color: #71767b;">
                        <p>No posts found with ${data.tag}</p>
                    </div>
                `;
            } else {
                allPosts.forEach(post => {
                    const postEl = createPostElement(post);
                    container.appendChild(postEl);
                });
            }
            
            // Switch to hashtag page
            document.querySelectorAll('.feed-content').forEach(el => {
                el.classList.remove('active');
            });
            document.getElementById('hashtagContent').classList.add('active');
            
            // Update nav
            document.querySelectorAll('.nav-item').forEach(el => {
                el.classList.remove('active');
            });
            
            hideLoading();
            window.scrollTo(0, 0);
        } else {
            showNotification('Hashtag not found', 'error');
            hideLoading();
        }
    } catch (err) {
        console.error('Error viewing hashtag:', err);
        showNotification('Error loading hashtag', 'error');
        hideLoading();
    }
}

async function loadNotifications() {
    try {
        const response = await fetch('/api/notifications');
        const data = await response.json();
        
        if (data.success) {
            const container = document.getElementById('notificationsContainer');
            const badge = document.getElementById('notificationBadge');
            const sidebarBadge = document.getElementById('sidebarNotificationBadge');
            const unreadCount = data.unread_count;
            
            // Update both badges (right sidebar bell + left sidebar notifications)
            if (unreadCount > 0) {
                const displayCount = unreadCount > 99 ? '99+' : unreadCount;
                
                // Right sidebar badge
                badge.textContent = displayCount;
                badge.style.display = 'flex';
                
                // Left sidebar badge
                sidebarBadge.textContent = displayCount;
                sidebarBadge.style.display = 'flex';
            } else {
                // Hide both badges
                badge.style.display = 'none';
                sidebarBadge.style.display = 'none';
            }
            
            // Render notifications
            if (data.notifications.length === 0) {
                container.innerHTML = `
                    <div style="padding: 40px 20px; text-align: center; color: #71767b;">
                        <i class="fas fa-bell-slash" style="font-size: 40px; margin-bottom: 10px; opacity: 0.5;"></i>
                        <p>No notifications yet</p>
                    </div>
                `;
            } else {
                container.innerHTML = '';
                data.notifications.forEach(notif => {
                    const notifEl = createNotificationElement(notif);
                    container.appendChild(notifEl);
                });
            }
        }
    } catch (err) {
        console.error('Error loading notifications:', err);
    }
}

function createNotificationElement(notif) {
    const div = document.createElement('div');
    div.className = 'notification-item';
    div.style.cssText = `
        padding: 15px 20px;
        border-bottom: 1px solid #2f3336;
        cursor: pointer;
        transition: all 0.2s;
        background: ${notif.read ? '#000' : '#1a1f26'};
    `;
    
    let icon = '';
    let message = '';
    let action = '';
    
    switch(notif.type) {
        case 'like':
            icon = '<i class="fas fa-heart" style="color: #ef4444;"></i>';
            message = `<strong>${notif.from_username}</strong> liked your post`;
            action = `onclick="navigateTo('home')"`;
            break;
        case 'comment':
            icon = '<i class="fas fa-comment" style="color: #6366f1;"></i>';
            message = `<strong>${notif.from_username}</strong> commented on your post<br><span style="font-size: 12px; color: #71767b;">\"${notif.comment_preview}\"</span>`;
            action = `onclick="navigateTo('home')"`;
            break;
        case 'reply':
            icon = '<i class="fas fa-reply" style="color: #1aa34a;"></i>';
            message = `<strong>${notif.from_username}</strong> replied to your comment<br><span style="font-size: 12px; color: #71767b;">\"${notif.comment_preview}\"</span>`;
            action = `onclick="navigateTo('home')"`;
            break;
        case 'repost':
            icon = '<i class="fas fa-retweet" style="color: #1aa34a;"></i>';
            message = `<strong>${notif.from_username}</strong> reposted your post`;
            action = `onclick="navigateTo('home')"`;
            break;
        case 'follow':
            icon = '<i class="fas fa-user-plus" style="color: #6366f1;"></i>';
            message = `<strong>${notif.from_username}</strong> started following you`;
            action = ``;
            break;
        case 'mention':
            icon = '<i class="fas fa-at" style="color: #f59e0b;"></i>';
            message = `<strong>${notif.from_username}</strong> mentioned you`;
            action = `onclick="navigateTo('home')"`;
            break;
        case 'message':
            icon = '<i class="fas fa-envelope" style="color: #6366f1;"></i>';
            message = `<strong>${notif.from_username}</strong> sent you a message<br><span style="font-size: 12px; color: #71767b;">\"${notif.message_preview}\"</span>`;
            action = `onclick="openProfileMessageChat('${notif.from_user_id}', '${notif.from_username}')"`;
            break;
    }
    
    const time = getRelativeTime(new Date(notif.created_at));
    
    div.innerHTML = `
        <div style="display: flex; gap: 12px;">
            <div style="font-size: 20px; color: white; min-width: 24px; text-align: center;">
                ${icon}
            </div>
            <div style="flex: 1;">
                <p style="margin: 0 0 5px 0; color: white; font-size: 14px;">
                    ${message}
                </p>
                <p style="margin: 0; color: #71767b; font-size: 12px;">
                    ${time}
                </p>
            </div>
            ${!notif.read ? '<div style="width: 8px; height: 8px; background: #6366f1; border-radius: 50%; margin-top: 4px;"></div>' : ''}
        </div>
    `;
    
    div.addEventListener('click', async (e) => {
        // Mark as read
        if (!notif.read) {
            try {
                await fetch(`/api/notifications/${notif._id}/read`, {
                    method: 'POST'
                });
                notif.read = true;
                div.style.background = '#000';
                loadNotifications(); // Refresh to update badge
            } catch (err) {
                console.error('Error marking notification as read:', err);
            }
        }
        
        // Navigate to post if applicable
        if (action) {
            eval(action.replace('onclick="', '').replace('"', ''));
        }
    });
    
    div.addEventListener('mouseover', function() {
        this.style.background = '#1a1f26';
    });
    
    div.addEventListener('mouseout', function() {
        this.style.background = notif.read ? '#000' : '#1a1f26';
    });
    
    return div;
}

async function markAllNotificationsRead() {
    try {
        await fetch('/api/notifications/read-all', {
            method: 'POST'
        });
        showNotification('All marked as read', 'success');
        loadNotifications();
    } catch (err) {
        console.error('Error:', err);
        showNotification('Error', 'error');
    }
}

// Trending is loaded from the first loadTrending function above (line 2702)
// Removed duplicate broken loadTrending function

document.addEventListener('DOMContentLoaded', async function () {
    
    await getCurrentUser();
    setTimeout(() => loadFriendsSuggestions(), 500);
    setTimeout(() => loadTrending(), 500);
    setTimeout(() => loadNotifications(), 500);
    
    const savedTheme = localStorage.getItem('theme');
    if (savedTheme === 'light') {
        document.body.classList.add('light-mode');
        const icon = document.querySelector('.theme-toggle button i');
        if (icon) {
            icon.classList.remove('fa-moon');
            icon.classList.add('fa-sun');
        }
    }
    
    const homeNav = document.querySelector('[onclick*="home"]');
    if (homeNav) homeNav.classList.add('active');
    
    const homeContent = document.getElementById('homeContent');
    if (homeContent) homeContent.classList.add('active');
    
    loadPosts();
    
    // Auto-refresh notifications every 5 seconds (FIX #3)
    setInterval(() => {
        loadNotifications();
    }, 5000);
    
    window.addEventListener('scroll', handleInfiniteScroll);
    

    setupMentionFeature();
});

function handleInfiniteScroll() {
    // Only trigger on home feed
    if (!document.getElementById('homeContent').classList.contains('active')) return;
    
    const scrollPosition = window.innerHeight + window.scrollY;
    const threshold = document.body.offsetHeight - 500;
    
    if (scrollPosition >= threshold && hasMorePosts && !isLoadingMore) {
        currentPage++;
        showLoadingSkeletons(3);  // Show 3 skeleton loaders
        loadPosts(currentPage, true);  // true = append to existing posts
    }
}

function showLoadingSkeletons(count = 3) {
    const container = document.getElementById('postsContainer');
    
    for (let i = 0; i < count; i++) {
        const skeleton = document.createElement('div');
        skeleton.className = 'skeleton-post loading-skeleton';
        skeleton.innerHTML = `
            <div class="skeleton-post-header">
                <div class="skeleton skeleton-avatar"></div>
                <div class="skeleton-user-info">
                    <div class="skeleton skeleton-name"></div>
                    <div class="skeleton skeleton-handle"></div>
                </div>
            </div>
            <div class="skeleton-post-content">
                <div class="skeleton skeleton-text-line"></div>
                <div class="skeleton skeleton-text-line short"></div>
            </div>
            <div class="skeleton skeleton-image"></div>
            <div class="skeleton-actions">
                <div class="skeleton skeleton-action"></div>
                <div class="skeleton skeleton-action"></div>
                <div class="skeleton skeleton-action"></div>
            </div>
        `;
        container.appendChild(skeleton);
    }
}

function removeLoadingSkeletons() {
    const skeletons = document.querySelectorAll('.loading-skeleton');
    skeletons.forEach(skeleton => skeleton.remove());
}

// ===== PROFILE FUNCTIONS =====

function handleProfileFollowClick(userId, username) {
    const btn = document.getElementById('profile-follow-btn');
    const isFollowing = btn.getAttribute('data-following') === 'true';
    
    if (isFollowing) {
        showUnfollowConfirmation(userId, username);
    } else {
        btn.textContent = 'Following';
        btn.setAttribute('data-following', 'true');
        btn.style.background = 'transparent';
        btn.style.color = '#6366f1';
        btn.style.border = '1.5px solid #6366f1';
        btn.disabled = true;
        
        // Show notification IMMEDIATELY
        showNotification(`You followed @${username}`, 'success');
        
        profileFollowUser(userId, username);
    }
}

async function profileFollowUser(userId, username) {
    try {
        const response = await fetch(`/api/follow/${userId}`, {
            method: 'POST',
            headers: {'Content-Type': 'application/json'}
        });
        
        const data = await response.json();
        
        if (data.success) {
            const btn = document.getElementById('profile-follow-btn');
            if (btn) btn.disabled = false;
            
            showNotification(`You followed @${username}`, 'success');
            
            // Reload profile to update follower count
            if (viewingProfile && viewingProfile._id === userId) {
                await loadUserProfile(userId);
            }
        } else {
            const btn = document.getElementById('profile-follow-btn');
            btn.textContent = 'Follow';
            btn.setAttribute('data-following', 'false');
            btn.style.background = '#6366f1';
            btn.style.color = 'white';
            btn.style.border = 'none';
            btn.disabled = false;
            showNotification('Failed to follow user', 'error');
        }
    } catch (err) {
        const btn = document.getElementById('profile-follow-btn');
        btn.textContent = 'Follow';
        btn.setAttribute('data-following', 'false');
        btn.style.background = '#6366f1';
        btn.style.color = 'white';
        btn.style.border = 'none';
        btn.disabled = false;
        showNotification('Failed to follow user', 'error');
    }
}

function openEditProfileModal() {
     const modal = document.getElementById('editProfileModal');
     if (!modal) return;
     
     // Load current user data
     const nameInput = document.getElementById('editNameInput');
     const bioInput = document.getElementById('editBioInput');
     const avatarImg = document.getElementById('editProfilePicPreview');
     const coverPreview = document.getElementById('editCoverPreview');
     
     // Set current values
     if (viewingProfile) {
         nameInput.value = viewingProfile.name || '';
         bioInput.value = viewingProfile.bio || '';
         if (viewingProfile.avatar) {
             avatarImg.src = viewingProfile.avatar;
         }
         // Display current cover photo if exists
         if (viewingProfile.cover_photo) {
             coverPreview.style.backgroundImage = `url('${viewingProfile.cover_photo}')`;
             coverPreview.style.backgroundSize = 'cover';
             coverPreview.style.backgroundPosition = 'center';
             coverPreview.innerHTML = '';
         }
     }
     
     updateBioCounter();
     modal.style.display = 'block';
}

function closeEditProfileModal() {
    document.getElementById('editProfileModal').style.display = 'none';
}

function previewEditProfile() {
    const file = document.getElementById('profilePhotoInput').files[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = function(e) {
        document.getElementById('editProfilePicPreview').src = e.target.result;
    };
    reader.readAsDataURL(file);
}

function previewEditCover() {
     const file = document.getElementById('coverPhotoInput').files[0];
     if (!file) return;
     
     const reader = new FileReader();
     reader.onload = function(e) {
         const cover = document.getElementById('editCoverPreview');
         cover.style.backgroundImage = `url('${e.target.result}')`;
         cover.style.backgroundSize = 'cover';
         cover.style.backgroundPosition = 'center';
         // Keep camera icon visible for re-uploading
     };
     reader.readAsDataURL(file);
}

function openCoverPhotoModal(imageUrl) {
     // Create overlay
     const overlay = document.createElement('div');
     overlay.style.cssText = `
         position: fixed;
         top: 0;
         left: 0;
         width: 100%;
         height: 100%;
         background: rgba(0, 0, 0, 0.8);
         display: flex;
         align-items: center;
         justify-content: center;
         z-index: 99999;
     `;
     
     // Create modal
     const modal = document.createElement('div');
     modal.style.cssText = `
         position: relative;
         max-width: 90vw;
         max-height: 90vh;
     `;
     
     modal.innerHTML = `
         <img src="${imageUrl}" style="max-width: 90vw; max-height: 90vh; border-radius: 12px;">
         <button onclick="this.closest('[style*=position: fixed]').remove()" style="
             position: absolute;
             top: 10px;
             right: 10px;
             background: rgba(0, 0, 0, 0.7);
             color: white;
             border: none;
             font-size: 28px;
             width: 40px;
             height: 40px;
             border-radius: 50%;
             cursor: pointer;
             display: flex;
             align-items: center;
             justify-content: center;
             transition: all 0.2s;
         " onmouseover="this.style.background='rgba(0, 0, 0, 0.9)'" onmouseout="this.style.background='rgba(0, 0, 0, 0.7)'">×</button>
     `;
     
     overlay.appendChild(modal);
     document.body.appendChild(overlay);
     
     // Close on overlay click
     overlay.onclick = (e) => {
         if (e.target === overlay) overlay.remove();
     };
}

function updateBioCounter() {
    const bioInput = document.getElementById('editBioInput');
    const counter = document.getElementById('bioCharCount');
    counter.textContent = bioInput.value.length;
}

async function saveProfileChanges() {
    // Get fresh references - use getElementById directly
    const saveBtn = document.getElementById('saveProfileBtn');
    const nameInput = document.getElementById('editNameInput');
    const bioInput = document.getElementById('editBioInput');
    const profilePhotoInput = document.getElementById('profilePhotoInput');
    const coverPhotoInput = document.getElementById('coverPhotoInput');
    
    if (!nameInput || !nameInput.value.trim()) {
        showNotification('Name is required', 'error');
        return;
    }
    
    // Show loading state
    saveBtn.disabled = true;
    saveBtn.innerHTML = '<i class="fas fa-spinner fa-spin" style="margin-right: 8px;"></i>Saving...';
    
    try {
        let avatarUrl = viewingProfile.avatar;
        let coverPhotoUrl = viewingProfile.cover_photo || null;
        
        // Upload profile photo if changed
        if (profilePhotoInput && profilePhotoInput.files && profilePhotoInput.files.length > 0) {
            const file = profilePhotoInput.files[0];
            const reader = new FileReader();
            
            const uploadPromise = new Promise((resolve, reject) => {
                reader.onload = async function(e) {
                    try {
                        const cloudinaryResponse = await fetch('/api/upload-cloudinary', {
                            method: 'POST',
                            headers: {'Content-Type': 'application/json'},
                            body: JSON.stringify({file: e.target.result})
                        });
                        const cloudinaryData = await cloudinaryResponse.json();
                        if (cloudinaryData.success) {
                            resolve(cloudinaryData.url);
                        } else {
                            reject(new Error(cloudinaryData.error || 'Upload failed'));
                        }
                    } catch (err) {
                        reject(err);
                    }
                };
                reader.onerror = () => reject(new Error('File read failed'));
                reader.readAsDataURL(file);
            });
            
            avatarUrl = await uploadPromise;
        }
        
        // Upload cover photo if changed
        if (coverPhotoInput && coverPhotoInput.files && coverPhotoInput.files.length > 0) {
            const file = coverPhotoInput.files[0];
            const reader = new FileReader();
            
            const uploadPromise = new Promise((resolve, reject) => {
                reader.onload = async function(e) {
                    try {
                        const cloudinaryResponse = await fetch('/api/upload-cloudinary', {
                            method: 'POST',
                            headers: {'Content-Type': 'application/json'},
                            body: JSON.stringify({file: e.target.result})
                        });
                        const cloudinaryData = await cloudinaryResponse.json();
                        if (cloudinaryData.success) {
                            resolve(cloudinaryData.url);
                        } else {
                            reject(new Error(cloudinaryData.error || 'Upload failed'));
                        }
                    } catch (err) {
                        reject(err);
                    }
                };
                reader.onerror = () => reject(new Error('File read failed'));
                reader.readAsDataURL(file);
            });
            
            coverPhotoUrl = await uploadPromise;
        }
        
        // Update profile after image uploads complete
        const response = await fetch('/api/update-profile', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({
                name: nameInput.value.trim(),
                bio: bioInput.value.trim(),
                avatar: avatarUrl,
                cover_photo: coverPhotoUrl
            })
        });
        
        const data = await response.json();
        
        if (data.success) {
            // Reload profile to show changes
            await loadUserProfile(currentUserId);
            closeEditProfileModal();
            showNotification('Profile updated successfully', 'success');
        } else {
            showNotification(data.error || 'Failed to update profile', 'error');
        }
    } catch (err) {
        console.error('Error saving profile:', err);
        showNotification('Error updating profile: ' + err.message, 'error');
    } finally {
        saveBtn.disabled = false;
        saveBtn.textContent = 'Save';
    }
}

async function showFollowersModal() {
    if (!viewingProfile) return;
    
    try {
        const response = await fetch(`/api/followers/${viewingProfile._id}`);
        const data = await response.json();
        
        if (data.success) {
            showUserListModal('Followers', data.users, viewingProfile._id);
        }
    } catch (err) {
        console.error('Error loading followers:', err);
        showNotification('Failed to load followers', 'error');
    }
}

async function showFollowingModal() {
    if (!viewingProfile) return;
    
    try {
        const response = await fetch(`/api/following/${viewingProfile._id}`);
        const data = await response.json();
        
        if (data.success) {
            showUserListModal('Following', data.users, viewingProfile._id);
        }
    } catch (err) {
        console.error('Error loading following:', err);
        showNotification('Failed to load following', 'error');
    }
}

function showUserListModal(title, users, profileUserId) {
    const overlay = document.createElement('div');
    overlay.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0, 0, 0, 0.7);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 10001;
    `;
    
    const modal = document.createElement('div');
    modal.style.cssText = `
        background: #16181c;
        border: 1px solid #2f3336;
        border-radius: 16px;
        width: 90%;
        max-width: 400px;
        max-height: 80vh;
        overflow-y: auto;
        box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
    `;
    
    if (users.length === 0) {
        modal.innerHTML = `
            <div style="padding: 40px 20px; text-align: center;">
                <h2 style="color: white; font-size: 24px; margin-bottom: 12px;">Looking for ${title}?</h2>
                <p style="color: #71767b; margin: 0;">When someone ${title.toLowerCase()} this account, they'll show up here.</p>
            </div>
        `;
    } else {
        modal.innerHTML = `
            <div style="padding: 15px 20px; border-bottom: 1px solid #2f3336;">
                <h2 style="color: white; margin: 0;">${title}</h2>
            </div>
            <div>
                ${users.map(user => `
                    <div style="padding: 12px 16px; border-bottom: 1px solid #2f3336; display: flex; gap: 12px; align-items: center;">
                        <div style="width: 40px; height: 40px; border-radius: 50%; background: #2f3336; display: flex; align-items: center; justify-content: center; flex-shrink: 0;">
                            ${user.avatar ? `<img src="${user.avatar}" style="width: 100%; height: 100%; border-radius: 50%; object-fit: cover;">` : '<i class="fas fa-user" style="color: #6366f1;"></i>'}
                        </div>
                        <div style="flex: 1; min-width: 0;">
                            <div style="color: white; font-weight: 600; font-size: 14; cursor: pointer;" onclick="loadUserProfile('${user._id}'); overlay.remove();">${user.username}</div>
                            <div style="color: #71767b; font-size: 13;">@${user.username}</div>
                        </div>
                        ${user._id !== currentUserId ? `
                            <button onclick="followUserFromModal('${user._id}', '${user.username}', this)" style="
                                background: ${user.is_following ? 'transparent' : '#6366f1'};
                                color: ${user.is_following ? '#6366f1' : 'white'};
                                border: ${user.is_following ? '1.5px solid #6366f1' : 'none'};
                                padding: 6px 16px;
                                border-radius: 20px;
                                cursor: pointer;
                                font-weight: 600;
                                font-size: 12px;
                                transition: all 0.2s;
                            ">${user.is_following ? 'Following' : 'Follow'}</button>
                        ` : ''}
                    </div>
                `).join('')}
            </div>
        `;
    }
    
    document.body.appendChild(overlay);
    overlay.appendChild(modal);
    
    overlay.onclick = (e) => {
        if (e.target === overlay) overlay.remove();
    };
}

async function followUserFromModal(userId, username, btn) {
    try {
        const response = await fetch(`/api/follow/${userId}`, {
            method: 'POST',
            headers: {'Content-Type': 'application/json'}
        });
        
        const data = await response.json();
        
        if (data.success) {
            // Update button
            if (data.following) {
                btn.textContent = 'Following';
                btn.style.background = 'transparent';
                btn.style.color = '#6366f1';
                btn.style.border = '1.5px solid #6366f1';
            } else {
                btn.textContent = 'Follow';
                btn.style.background = '#6366f1';
                btn.style.color = 'white';
                btn.style.border = 'none';
            }
            showNotification(data.message, 'success');
        }
    } catch (err) {
        console.error('Error toggling follow:', err);
        showNotification('Failed to update follow status', 'error');
    }
}

// ===== CHAT FUNCTIONS =====

let currentChatUserId = null;

async function loadConversations(page = 1) {
     try {
         const now = Date.now();
         
         // Use cache if valid
         if (conversationsCache && (now - conversationsCacheTime) < CACHE_VALID_TIME) {
             displayConversations(conversationsCache);
             updateChatBadge(conversationsCache);
             return;
         }
         
         // Fetch with pagination
         const response = await fetch(`/api/conversations?page=${page}&limit=${ITEMS_PER_PAGE}`);
         const data = await response.json();
         
         if (data.success) {
             conversationsCache = data.conversations;
             conversationsCacheTime = now;
             conversationsPage = page;
             displayConversations(data.conversations);
             updateChatBadge(data.conversations);
             
             // Setup infinite scroll if more conversations exist
             if (data.conversations.length === ITEMS_PER_PAGE) {
                 setupConversationsInfiniteScroll();
             }
         }
     } catch (err) {
         console.error('Error loading conversations:', err);
     }
 }

 function setupConversationsInfiniteScroll() {
     const container = document.getElementById('conversationsContainer');
     if (!container) return;
     
     container.onscroll = function() {
         if (container.scrollTop + container.clientHeight >= container.scrollHeight - 100) {
             // Reached bottom, load more
             loadConversations(conversationsPage + 1);
             container.onscroll = null; // Prevent multiple triggers
         }
     };
 }

 function updateChatBadge(conversations) {
     // Count unread messages (messages from other users that haven't been seen)
     const chatBadge = document.getElementById('chatBadge');
     const unreadCount = conversations.filter(conv => !conv.is_from_current_user).length;
     
     if (unreadCount > 0) {
         chatBadge.textContent = unreadCount;
         chatBadge.style.display = 'flex';
     } else {
         chatBadge.style.display = 'none';
     }
 }

function displayConversations(conversations) {
    const container = document.getElementById('conversationsContainer');
    
    if (conversations.length === 0) {
        container.innerHTML = '<div style="padding: 20px; text-align: center; color: #71767b;">No conversations yet</div>';
        return;
    }
    
    container.innerHTML = conversations.map(conv => {
        // Format time: if today show time (9:49 AM), if past days show date (1/18/26)
        const lastMsgTime = new Date(conv.last_message_time);
        const today = new Date();
        const isToday = lastMsgTime.toDateString() === today.toDateString();
        
        let timeStr;
        if (isToday) {
            timeStr = lastMsgTime.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
        } else {
            timeStr = lastMsgTime.toLocaleDateString('en-US', { month: 'numeric', day: 'numeric', year: '2-digit' });
        }
        
        // Unread count badge
        const unreadBadge = conv.unread_count > 0 ? `<div class="conversation-item-badge">${conv.unread_count}</div>` : '';
        
        // Message status (✓ or ✓✓)
        const statusIndicator = conv.last_message_read ? '<span class="message-status">✓✓</span>' : '<span class="message-status">✓</span>';
        
        return `
             <div style="
                 padding: 15px;
                 border-bottom: 1px solid #2f3336;
                 transition: all 0.2s;
                 display: flex;
                 gap: 12px;
                 align-items: center;
                 cursor: pointer;
             " onclick="openConversation('${conv.user_id}', '${conv.username}', '${conv.avatar || ''}')" data-conv-user="${conv.user_id}" onmouseover="this.style.background='rgba(99,102,241,0.1)'" onmouseout="this.style.background='transparent'">
                 <div style="width: 50px; height: 50px; border-radius: 50%; background: #2f3336; display: flex; align-items: center; justify-content: center; flex-shrink: 0;">
                     ${conv.avatar ? `<img src="${conv.avatar}" style="width: 100%; height: 100%; border-radius: 50%; object-fit: cover;">` : '<i class="fas fa-user" style="color: #6366f1; font-size: 20px;"></i>'}
                 </div>
                 <div style="flex: 1; min-width: 0;">
                     <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 5px;">
                         <div style="color: white; font-weight: 600; font-size: 14;">${conv.username}</div>
                         <div style="font-size: 12px; color: #71767b; margin-left: 10px; white-space: nowrap;">${timeStr}</div>
                     </div>
                     <div style="color: #71767b; font-size: 13px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; display: flex; align-items: center; gap: 5px;">
                         ${statusIndicator}
                         <span>${conv.last_message}</span>
                     </div>
                 </div>
                 ${unreadBadge}
             </div>
         `;
    }).join('');
}

async function openConversation(userId, username, avatar = null) {
    currentChatUserId = userId;
    
    // Show chat UI
    document.getElementById('chatHeader').style.display = 'block';
    document.getElementById('chatInputArea').style.display = 'block';
    document.getElementById('noConversationSelected').style.display = 'none';
    
    // Fetch user profile to get avatar if not provided
    let userAvatar = avatar;
    let userInfo = null;
    if (!userAvatar) {
        try {
            const response = await fetch(`/api/profile/${userId}`);
            const data = await response.json();
            if (data.success) {
                userAvatar = data.user.avatar;
                userInfo = data.user;
            }
        } catch (err) {
            console.error('Error fetching user info:', err);
        }
    }
    
    // Update header with user avatar and info
    const isMobile = window.innerWidth <= 768;
    const backBtn = isMobile ? `<button class="mobile-chat-back-btn" onclick="closeChatOnMobile()">←</button>` : '';
    const avatarHtml = userAvatar 
        ? `<img src="${userAvatar}" alt="${username}" style="width: 40px; height: 40px; border-radius: 50%; object-fit: cover; cursor: pointer;" onclick="loadUserProfile('${userId}')" title="View profile">`
        : `<div style="width: 40px; height: 40px; border-radius: 50%; background: #2f3336; display: flex; align-items: center; justify-content: center; cursor: pointer;" onclick="loadUserProfile('${userId}')" title="View profile"><i class="fas fa-user" style="color: #6366f1; font-size: 20px;"></i></div>`;
    
    document.getElementById('chatHeader').innerHTML = `
        ${backBtn}
        ${avatarHtml}
        <div style="flex: 1; margin-left: 12px;">
            <h3 id="chatUserName" style="margin: 0; font-size: 15px; font-weight: 600; cursor: pointer;" onclick="loadUserProfile('${userId}')" title="View profile">${username}</h3>
            <p style="margin: 0; font-size: 12px; color: #71767b;">Active now</p>
        </div>
    `;
    
    // Switch to chat view on mobile
    if (isMobile) {
        document.getElementById('chatContent').classList.add('chat-active');
    }
    
    // Load messages
    await loadMessages(userId);
}

// Close chat and return to conversations list on mobile
function closeChatOnMobile() {
    const isMobile = window.innerWidth <= 768;
    if (isMobile) {
        document.getElementById('chatContent').classList.remove('chat-active');
        document.getElementById('chatHeader').style.display = 'none';
        document.getElementById('chatInputArea').style.display = 'none';
        document.getElementById('noConversationSelected').style.display = 'flex';
    }
}

async function loadMessages(userId) {
    try {
        const response = await fetch(`/api/messages/${userId}`);
        const data = await response.json();
        
        if (data.success) {
            displayMessages(data.messages);
        }
    } catch (err) {
        console.error('Error loading messages:', err);
    }
}

function displayMessages(messages) {
     const container = document.getElementById('messagesContainer');
     
     container.innerHTML = messages.map(msg => {
         const isOwn = msg.sender_id === currentUserId;
         const time = new Date(msg.created_at);
         const today = new Date();
         const isToday = time.toDateString() === today.toDateString();
         
         // Format time based on date (respects user's local timezone)
         let timeStr;
         if (isToday) {
             timeStr = time.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
         } else {
             timeStr = time.toLocaleDateString('en-US', { month: 'numeric', day: 'numeric', year: '2-digit' }) + ' ' + 
                       time.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
         }
         
         return `
             <div style="display: flex; ${isOwn ? 'justify-content: flex-end' : 'justify-content: flex-start'}; margin-bottom: 8px; align-items: flex-end; gap: 8px;" class="message-row">
                 <div style="
                     background: ${isOwn ? '#6366f1' : '#2f3336'};
                     color: white;
                     padding: 12px 16px;
                     border-radius: 18px;
                     max-width: 60%;
                     word-wrap: break-word;
                     line-height: 1.4;
                 " id="msg-${msg.id}">
                     <div style="font-size: 14px;">${msg.text}</div>
                     <div style="font-size: 11px; color: ${isOwn ? 'rgba(255,255,255,0.7)' : '#999'}; margin-top: 4px;">
                         ${timeStr}
                         ${msg.edited_at ? '<span style="margin-left: 8px;">(edited)</span>' : ''}
                     </div>
                 </div>
                 ${isOwn ? `
                     <div class="message-actions" style="display: none; gap: 8px; opacity: 0.7;">
                         <button class="msg-edit-btn" data-msg-id="${msg.id}" data-msg-text="${msg.text.replace(/"/g, '&quot;').replace(/'/g, '&#39;')}" style="background: #4f46e5; color: white; border: none; border-radius: 50%; width: 32px; height: 32px; cursor: pointer; display: flex; align-items: center; justify-content: center; font-size: 14px;" title="Edit">
                             <i class="fas fa-edit"></i>
                         </button>
                         <button class="msg-delete-btn" data-msg-id="${msg.id}" style="background: #ef4444; color: white; border: none; border-radius: 50%; width: 32px; height: 32px; cursor: pointer; display: flex; align-items: center; justify-content: center; font-size: 14px;" title="Delete">
                             <i class="fas fa-trash"></i>
                         </button>
                     </div>
                 ` : ''}
             </div>
         `;
     }).join('');
     
     // Add hover listeners to show/hide actions
     document.querySelectorAll('.message-row').forEach(row => {
         row.addEventListener('mouseenter', function() {
             const actions = this.querySelector('.message-actions');
             if (actions) actions.style.display = 'flex';
         });
         row.addEventListener('mouseleave', function() {
             const actions = this.querySelector('.message-actions');
             if (actions) actions.style.display = 'none';
         });
     });
     
     // Add event listeners for edit and delete buttons
     document.querySelectorAll('.msg-edit-btn').forEach(btn => {
         btn.addEventListener('click', function() {
             const msgId = this.dataset.msgId;
             const msgText = this.dataset.msgText;
             editMessage(msgId, msgText);
         });
     });
     
     document.querySelectorAll('.msg-delete-btn').forEach(btn => {
         btn.addEventListener('click', function() {
             const msgId = this.dataset.msgId;
             deleteMessage(msgId);
         });
     });
     
     // Scroll to bottom
     container.scrollTop = container.scrollHeight;
 }

async function sendMessage() {
    const input = document.getElementById('messageInput');
    const text = input.value.trim();
    
    if (!text || !currentChatUserId) return;
    
    // Disable input immediately for UX
    input.disabled = true;
    const originalValue = input.value;
    input.value = '';
    
    // Show message instantly (optimistic update)
    const container = document.getElementById('messagesContainer');
    const tempMsg = document.createElement('div');
    tempMsg.style.cssText = 'display: flex; justify-content: flex-end; margin-bottom: 8px; align-items: flex-end; gap: 8px;';
    tempMsg.innerHTML = `
        <div style="
            background: #6366f1;
            color: white;
            padding: 12px 16px;
            border-radius: 18px;
            max-width: 60%;
            word-wrap: break-word;
            line-height: 1.4;
            opacity: 0.7;
        ">
            <div style="font-size: 14px;">${text}</div>
            <div style="font-size: 11px; color: rgba(255,255,255,0.7); margin-top: 4px;">Sending...</div>
        </div>
    `;
    container.appendChild(tempMsg);
    container.scrollTop = container.scrollHeight;
    
    try {
        const response = await fetch('/api/messages/send', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({
                receiver_id: currentChatUserId,
                text: text
            })
        });
        
        const data = await response.json();
        
        if (data.success) {
            // Reload messages to get the sent message from DB
            await loadMessages(currentChatUserId);
            input.disabled = false;
        } else {
            input.value = originalValue;
            input.disabled = false;
            showNotification('Failed to send message', 'error');
            tempMsg.remove();
        }
    } catch (err) {
        console.error('Error sending message:', err);
        input.value = originalValue;
        input.disabled = false;
        showNotification('Failed to send message', 'error');
        tempMsg.remove();
    }
}

// Profile Image Modal Functions
function openProfileImageModal() {
    const imgSrc = document.querySelector('.profile-pic').src;
    if (imgSrc) {
        document.getElementById('profileImageDisplay').src = imgSrc;
        document.getElementById('profileImageModal').style.display = 'block';
    }
}

function closeProfileImageModal() {
    document.getElementById('profileImageModal').style.display = 'none';
}

// Message from Profile Function
function openProfileMessageChat(userId, username) {
    currentChatUserId = userId;
    
    // Navigate to chat tab
    navigateTo('chat');
    
    // Show chat UI
    setTimeout(() => {
        document.getElementById('chatHeader').style.display = 'block';
        document.getElementById('chatInputArea').style.display = 'block';
        document.getElementById('noConversationSelected').style.display = 'none';
        document.getElementById('chatUserName').textContent = username;
        
        // Load messages with this user
        loadMessages(userId);
        
        // Load conversations list
         loadConversations();
        }, 300);
        }

        async function editMessage(messageId, currentText) {
             const newText = prompt('Edit message:', currentText);
             if (!newText || newText === currentText) return;
             
             try {
                 const response = await fetch(`/api/messages/${messageId}`, {
                     method: 'PUT',
                     headers: {'Content-Type': 'application/json'},
                     body: JSON.stringify({text: newText.trim()})
                 });
                 
                 const data = await response.json();
                 if (data.success) {
                     // Update message in DOM
                     const msgEl = document.getElementById(`msg-${messageId}`);
                     if (msgEl) {
                         msgEl.querySelector('div').textContent = newText.trim();
                     }
                     showNotification('Message updated', 'success');
                     // Reload messages
                     if (currentChatUserId) loadMessages(currentChatUserId);
                 } else {
                     showNotification(data.error || 'Failed to edit message', 'error');
                 }
             } catch (err) {
                 console.error('Error editing message:', err);
                 showNotification('Error editing message', 'error');
             }
         }

         function deleteMessage(messageId) {
             // Create custom confirmation dialog
             const overlay = document.createElement('div');
             overlay.className = 'delete-msg-overlay';
             overlay.style.cssText = `
                 position: fixed;
                 top: 0;
                 left: 0;
                 width: 100%;
                 height: 100%;
                 background: rgba(0, 0, 0, 0.7);
                 display: flex;
                 align-items: center;
                 justify-content: center;
                 z-index: 10001;
             `;
             
             const dialog = document.createElement('div');
             dialog.style.cssText = `
                 background: #16181c;
                 border: 1px solid #2f3336;
                 border-radius: 16px;
                 padding: 24px;
                 max-width: 400px;
                 text-align: center;
                 box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
             `;
             
             dialog.innerHTML = `
                 <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
                     <h2 style="color: white; margin: 0; font-size: 20px; flex: 1;">Delete message</h2>
                     <button class="close-delete-modal" style="background: none; border: none; color: white; font-size: 24px; cursor: pointer; width: 30px; height: 30px;">×</button>
                 </div>
                 <p style="color: #71767b; margin-bottom: 24px; font-size: 15px;">Are you sure you want to delete this message?</p>
                 <div style="display: flex; flex-direction: column; gap: 12px;">
                     <button class="confirm-delete-btn" data-msg-id="${messageId}" style="
                         background: #ef4444;
                         color: white;
                         border: none;
                         padding: 12px 24px;
                         border-radius: 24px;
                         font-weight: 600;
                         cursor: pointer;
                         font-size: 15px;
                         transition: all 0.2s;
                     " onmouseover="this.style.background='#dc2626'" onmouseout="this.style.background='#ef4444'">Delete for me</button>
                     <button class="cancel-delete-btn" style="
                         background: transparent;
                         color: white;
                         border: 1px solid #2f3336;
                         padding: 12px 24px;
                         border-radius: 24px;
                         font-weight: 600;
                         cursor: pointer;
                         font-size: 15px;
                         transition: all 0.2s;
                     " onmouseover="this.style.background='#2f3336'" onmouseout="this.style.background='transparent'">Cancel</button>
                 </div>
             `;
             
             overlay.appendChild(dialog);
             document.body.appendChild(overlay);
             
             // Add event listeners
             overlay.querySelector('.close-delete-modal').addEventListener('click', () => overlay.remove());
             overlay.querySelector('.cancel-delete-btn').addEventListener('click', () => overlay.remove());
             overlay.querySelector('.confirm-delete-btn').addEventListener('click', function() {
                 confirmDeleteMessage(this.dataset.msgId);
                 overlay.remove();
             });
             
             // Close on overlay click
             overlay.addEventListener('click', (e) => {
                 if (e.target === overlay) overlay.remove();
             });
         }

         async function confirmDeleteMessage(messageId) {
             try {
                 const response = await fetch(`/api/messages/${messageId}`, {
                     method: 'DELETE'
                 });
                 
                 const data = await response.json();
                 if (data.success) {
                     // Remove message from DOM
                     const msgEl = document.getElementById(`msg-${messageId}`);
                     if (msgEl) {
                         msgEl.parentElement.style.animation = 'fadeOut 0.3s ease-out';
                         setTimeout(() => msgEl.parentElement.remove(), 300);
                     }
                     showNotification('Message deleted', 'success');
                     // Reload messages
                     if (currentChatUserId) loadMessages(currentChatUserId);
                 } else {
                     showNotification(data.error || 'Failed to delete message', 'error');
                 }
             } catch (err) {
                 console.error('Error deleting message:', err);
                 showNotification('Error deleting message', 'error');
             }
         }

         // Auto-refresh conversations every 3 seconds to update chat badge
         setInterval(() => {
             if (document.getElementById('chatContent').classList.contains('active')) {
                 loadConversations();
             }
         }, 3000);

         // Mobile Search Functions
         function openMobileSearch() {
         const modal = document.getElementById('mobileSearchModal');
         const input = document.getElementById('mobileSearchInput');
         modal.style.display = 'flex';
         setTimeout(() => input.focus(), 100);
         }

         function closeMobileSearch() {
         document.getElementById('mobileSearchModal').style.display = 'none';
         document.getElementById('mobileSearchInput').value = '';
         document.getElementById('mobileSearchResults').innerHTML = '';
         }

         async function searchUsersOnMobile() {
         const query = document.getElementById('mobileSearchInput').value.trim();
         const resultsContainer = document.getElementById('mobileSearchResults');
         
         if (!query) {
         resultsContainer.innerHTML = '';
         return;
         }
         
         try {
         const response = await fetch(`/api/users/search?q=${encodeURIComponent(query)}`);
         const data = await response.json();
         
         if (data.success && data.users.length > 0) {
           resultsContainer.innerHTML = data.users.map(user => `
               <div class="mobile-search-result-item" onclick="viewUserProfile('${user._id}'); closeMobileSearch();">
                   <div class="mobile-search-result-avatar">
                       ${user.avatar ? `<img src="${user.avatar}" alt="${user.name}">` : `<i class="fas fa-user-circle"></i>`}
                   </div>
                   <div class="mobile-search-result-info">
                       <div class="mobile-search-result-name">${escapeHtml(user.name)}</div>
                       <div class="mobile-search-result-handle">@${escapeHtml(user.username || user.name.toLowerCase().replace(/\s/g, ''))}</div>
                   </div>
               </div>
           `).join('');
         } else {
           resultsContainer.innerHTML = '<div style="padding: 20px; text-align: center; color: #71767b;">No users found</div>';
         }
         } catch (err) {
         console.error('Search error:', err);
         resultsContainer.innerHTML = '<div style="padding: 20px; text-align: center; color: #ef4444;">Error searching users</div>';
         }
         }

         function viewUserProfile(userId) {
         viewingProfile = userId;
         loadUserProfile(userId);
         navigateTo('profile');
         }