document.getElementById('loginForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const email = document.getElementById('email').value.trim();
    const password = document.getElementById('password').value;
    const submitBtn = e.target.querySelector('.btn');
    
    clearErrors();
    
    if (!email) {
        showError('email', 'Email is required');
        return;
    }
    
    if (!isValidEmail(email)) {
        showError('email', 'Invalid email format');
        return;
    }
    
    if (!password) {
        showError('password', 'Password is required');
        return;
    }
    
    // Show loading in button
    submitBtn.innerHTML = '<span class="btn-spinner"></span> Logging in...';
    submitBtn.disabled = true;
    
    try {
        const response = await fetch('/login', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({email, password})
        });
        
        const data = await response.json();
        
        if (response.ok) {
            window.location.href = '/dashboard';
        } else {
            showError('email', data.error || 'Login failed');
            submitBtn.innerHTML = 'Log In';
            submitBtn.disabled = false;
        }
    } catch (err) {
        showError('email', 'Network error');
        submitBtn.innerHTML = 'Log In';
        submitBtn.disabled = false;
    }
});

function clearErrors() {
    document.getElementById('emailError').textContent = '';
    document.getElementById('passwordError').textContent = '';
    document.getElementById('email').classList.remove('error');
    document.getElementById('password').classList.remove('error');
}

function showError(fieldId, message) {
    const field = document.getElementById(fieldId);
    const errorEl = document.getElementById(fieldId + 'Error');
    
    field.classList.add('error');
    errorEl.textContent = message;
}

function isValidEmail(email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email) && email.length <= 100 && !email.includes('..') && email.indexOf('@') !== 0;
}
