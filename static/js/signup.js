let currentStep = 1;

function showStep(step) {
    document.getElementById('step1').classList.remove('active');
    document.getElementById('step2').classList.remove('active');
    document.getElementById('step3').classList.remove('active');
    document.getElementById(`step${step}`).classList.add('active');
    currentStep = step;
    clearAllErrors();
}

function clearAllErrors() {
    document.querySelectorAll('.error-message').forEach(el => el.textContent = '');
    document.querySelectorAll('input').forEach(el => el.classList.remove('error'));
}

function showError(fieldId, message) {
    const field = document.getElementById(fieldId);
    const errorEl = document.getElementById(fieldId + 'Error');
    
    if (field) {
        field.classList.add('error');
    }
    if (errorEl) {
        errorEl.textContent = message;
    }
}

function isValidEmail(email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email) && email.length <= 100 && !email.includes('..') && email.indexOf('@') !== 0;
}

function isValidUsername(username) {
    // Allow letters, numbers, underscores. Min 3 chars, max 30
    const usernameRegex = /^[a-zA-Z0-9_]{3,30}$/;
    return usernameRegex.test(username);
}

function showLoading() {
    let loadBar = document.getElementById('topLoadBar');
    if (!loadBar) {
        loadBar = document.createElement('div');
        loadBar.id = 'topLoadBar';
        loadBar.className = 'top-load-bar';
        document.body.appendChild(loadBar);
    }
    loadBar.style.display = 'block';
}

function prevStep() {
    if (currentStep > 1) {
        showStep(currentStep - 1);
    }
}

async function nextStep1() {
    const email = document.getElementById('email').value.trim();
    const name = document.getElementById('name').value.trim();
    const button = event.target;
    
    clearAllErrors();
    
    let hasError = false;
    
    if (!email) {
        showError('email', 'Email is required');
        hasError = true;
    } else if (!isValidEmail(email)) {
        showError('email', 'Invalid email format');
        hasError = true;
    }
    
    if (!name) {
        showError('name', 'Username is required');
        hasError = true;
    } else if (!isValidUsername(name)) {
        showError('name', 'Username must be 3-30 characters (letters, numbers, underscores only)');
        hasError = true;
    }
    
    if (hasError) return;
    
    showLoading();
    button.disabled = true;
    button.textContent = 'Checking...';
    
    try {
        const response = await fetch('/signup', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({action: 'check_email', email})
        });
        
        const data = await response.json();
        
        if (!response.ok) {
            hideLoading();
            button.disabled = false;
            button.textContent = 'Next';
            showError('email', data.error || 'Email error');
            return;
        }
        
        const nameResponse = await fetch('/signup', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({action: 'check_name', name})
        });
        
        const nameData = await nameResponse.json();
        
        if (!nameResponse.ok) {
            hideLoading();
            button.disabled = false;
            button.textContent = 'Next';
            showError('name', nameData.error || 'Name error');
            return;
        }
        
        hideLoading();
        setTimeout(() => {
            showStep(2);
            button.disabled = false;
            button.textContent = 'Next';
        }, 300);
    } catch (err) {
        hideLoading();
        button.disabled = false;
        button.textContent = 'Next';
        showError('email', 'Network error');
    }
}

async function nextStep2() {
    const dob = document.getElementById('dob').value.trim();
    const gender = document.querySelector('input[name="gender"]:checked');
    
    clearAllErrors();
    
    if (!dob) {
        showError('dob', 'Date of birth is required');
        return;
    }
    
    // Check age - must be at least 16 years old
    const today = new Date();
    const birthDate = new Date(dob);
    let age = today.getFullYear() - birthDate.getFullYear();
    const monthDiff = today.getMonth() - birthDate.getMonth();
    
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
        age--;
    }
    
    if (age < 16) {
        showError('dob', 'You must be at least 16 years old');
        return;
    }
    
    if (!gender) {
        showError('gender', 'Please select a gender');
        return;
    }
    
    const email = document.getElementById('email').value.trim();
    const name = document.getElementById('name').value.trim();
    
    showLoading();
    
    try {
        const response = await fetch('/signup', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({
                action: 'send_verification',
                email,
                name,
                dob,
                gender: gender.value
            })
        });
        
        const data = await response.json();
        
        hideLoading();
        
        if (response.ok) {
            setTimeout(() => {
                showStep(3);
                showStep3Message('Code sent successfully to ' + email, 'success');
            }, 300);
        } else {
            setTimeout(() => {
                showStep(3);
                showStep3Message(data.error || 'Failed to send code', 'error');
            }, 300);
        }
    } catch (err) {
        hideLoading();
        setTimeout(() => {
            showStep(3);
            showStep3Message('Network error. Please try again', 'error');
        }, 300);
    }
}

function showStep3Message(message, type) {
    const statusEl = document.getElementById('step3Status');
    
    if (type === 'success') {
        statusEl.textContent = 'We sent a verification code to your email';
        statusEl.style.color = '#22c55e';
    } else {
        statusEl.textContent = message;
        statusEl.style.color = '#ff6b6b';
    }
}

function hideLoading() {
    const loadBar = document.getElementById('topLoadBar');
    if (loadBar) {
        loadBar.style.display = 'none';
    }
}

async function resendCode() {
    const email = document.getElementById('email').value.trim();
    const button = event.target;
    
    button.disabled = true;
    button.textContent = 'Sending...';
    
    try {
        const response = await fetch('/signup', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({
                action: 'resend_code',
                email: email
            })
        });
        
        const data = await response.json();
        
        if (response.ok) {
            showStep3Message('New code sent to ' + email, 'success');
            button.disabled = false;
            button.textContent = 'Resend Code';
        } else {
            showStep3Message(data.error || 'Failed to resend code', 'error');
            button.disabled = false;
            button.textContent = 'Resend Code';
        }
    } catch (err) {
        showStep3Message('Network error. Please try again', 'error');
        button.disabled = false;
        button.textContent = 'Resend Code';
    }
}

async function submitSignup() {
    const code = document.getElementById('code').value.trim();
    const password = document.getElementById('password').value;
    const email = document.getElementById('email').value.trim();
    
    clearAllErrors();
    
    let hasError = false;
    
    if (!code) {
        showError('code', 'Verification code is required');
        hasError = true;
    }
    
    if (!password) {
        showError('password', 'Password is required');
        hasError = true;
    } else if (password.length < 8) {
        showError('password', 'Password must be at least 8 characters');
        hasError = true;
    }
    
    if (hasError) return;
    
    try {
        const response = await fetch('/signup', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({
                action: 'verify_code',
                email,
                code,
                password
            })
        });
        
        const data = await response.json();
        
        if (response.ok) {
            showLoading();
            setTimeout(() => {
                window.location.href = '/dashboard';
            }, 1000);
        } else {
            showError('code', data.error || 'Verification failed');
        }
    } catch (err) {
        showError('code', 'Network error');
    }
}
