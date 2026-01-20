document.getElementById('forgotForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const email = document.getElementById('email').value.trim().toLowerCase();
    
    clearErrors();
    
    if (!email) {
        showError('email', 'Email is required');
        return;
    }
    
    try {
        const response = await fetch('/forgot-password', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({action: 'check_email', email})
        });
        
        const data = await response.json();
        
        if (response.ok) {
            sessionStorage.setItem('reset_email', email);
            window.location.href = '/reset-password';
        } else {
            showError('email', data.error || 'Email not found');
        }
    } catch (err) {
        showError('email', 'Network error');
    }
});

function clearErrors() {
    document.getElementById('emailError').textContent = '';
    document.getElementById('email').classList.remove('error');
}

function showError(fieldId, message) {
    const field = document.getElementById(fieldId);
    const errorEl = document.getElementById(fieldId + 'Error');
    
    field.classList.add('error');
    errorEl.textContent = message;
}
