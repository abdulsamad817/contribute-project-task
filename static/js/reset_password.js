document.getElementById('resetForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const code = document.getElementById('code').value.trim();
    const password = document.getElementById('password').value;
    const email = sessionStorage.getItem('reset_email');
    
    clearErrors();
    
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
        const response = await fetch('/forgot-password', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({
                action: 'reset_password',
                email,
                code,
                password
            })
        });
        
        const data = await response.json();
        
        if (response.ok) {
            alert('Password reset successfully! Please log in.');
            sessionStorage.removeItem('reset_email');
            window.location.href = '/login';
        } else {
            showError('code', data.error || 'Reset failed');
        }
    } catch (err) {
        showError('code', 'Network error');
    }
});

function clearErrors() {
    document.getElementById('codeError').textContent = '';
    document.getElementById('passwordError').textContent = '';
    document.getElementById('code').classList.remove('error');
    document.getElementById('password').classList.remove('error');
}

function showError(fieldId, message) {
    const field = document.getElementById(fieldId);
    const errorEl = document.getElementById(fieldId + 'Error');
    
    field.classList.add('error');
    errorEl.textContent = message;
}
