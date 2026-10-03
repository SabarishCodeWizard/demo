 document.addEventListener('DOMContentLoaded', function() {
            const loginForm = document.getElementById('loginForm');
            const usernameInput = document.getElementById('username');
            const passwordInput = document.getElementById('password');
            const errorMessage = document.getElementById('errorMessage');
            const loginBtn = document.querySelector('.login-btn');
            // btnLoader is no longer needed as a separate element since we use a class on loginBtn

            // Focus on username field when page loads
            usernameInput.focus();

            // Form submission handler
            loginForm.addEventListener('submit', function(e) {
                e.preventDefault();
                authenticateUser();
            });

            // Clear error when user starts typing
            [usernameInput, passwordInput].forEach(input => {
                input.addEventListener('input', function() {
                    if (errorMessage.style.display !== 'none') {
                        hideError();
                    }
                });
            });

            function authenticateUser() {
                const username = usernameInput.value.trim();
                const password = passwordInput.value;

                // Show loading state
                setLoading(true);

                // Simulate API call delay
                setTimeout(() => {
                    // Obfuscated check using base64 to prevent casual inspection
                    if (btoa(username) === 'U1NKU05Z' && btoa(password) === 'MjcxODE1') {
                        // Successful login
                        localStorage.setItem('isAuthenticated', 'true');
                        localStorage.setItem('username', username);
                        localStorage.setItem('loginTime', new Date().toISOString());
                        
                        // Redirect to main application
                        window.location.href='index.html';
                    } else {
                        // Failed login
                        setLoading(false);
                        showError();
                        passwordInput.value = '';
                        usernameInput.focus();
                    }
                }, 1000);
            }

            function setLoading(isLoading) {
                if (isLoading) {
                    loginBtn.classList.add('loading');
                    loginBtn.disabled = true;
                } else {
                    loginBtn.classList.remove('loading');
                    loginBtn.disabled = false;
                }
            }

            function showError() {
                errorMessage.style.display = 'flex';
                // Apply the shake animation to the form
                loginForm.style.animation = 'shake 0.5s ease-in-out';
                setTimeout(() => {
                    loginForm.style.animation = '';
                }, 500);
            }

            function hideError() {
                errorMessage.style.display = 'none';
            }

            // Enter key navigation
            usernameInput.addEventListener('keypress', function(e) {
                if (e.key === 'Enter') {
                    e.preventDefault(); // Prevent form submission
                    passwordInput.focus();
                }
            });

            passwordInput.addEventListener('keypress', function(e) {
                if (e.key === 'Enter') {
                    e.preventDefault(); // Prevent default Enter key behavior
                    authenticateUser();
                }
            });
        });
