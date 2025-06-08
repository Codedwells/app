class LoginApp {
  constructor() {
    this.init();
  }

  init() {
    // Redirect to main app if already logged in
    if (SocialUtils.isAuthenticated()) {
      SocialUtils.redirectToMain();
      return;
    }

    this.bindEvents();
  }

  bindEvents() {
    const loginForm = document.getElementById("loginForm");
    if (loginForm) {
      loginForm.addEventListener("submit", (e) => this.handleLogin(e));
    }
  }

  async handleLogin(e) {
    e.preventDefault();

    const username = document.getElementById("username")?.value;
    const password = document.getElementById("password")?.value;

    if (!username || !password) {
      SocialUtils.showError("Please fill in all fields");
      return;
    }

    try {
      const response = await SocialUtils.makeApiCall("/api/v1/auth/login", {
        method: "POST",
        body: JSON.stringify({ username, password }),
      });

      if (response.token) {
        SocialUtils.setAuthToken(response.token);
        SocialUtils.setCurrentUser(response.user);
        SocialUtils.showSuccess("Login successful!");

        // Redirect to main app
        setTimeout(() => {
          SocialUtils.redirectToMain();
        }, 1000);
      } else {
        throw new Error("Invalid response format");
      }
    } catch (error) {
      console.error("Login error:", error);
      SocialUtils.showError("Login failed. Please check your credentials.");
    }
  }
}

// Initialize the login app when the DOM is loaded
document.addEventListener("DOMContentLoaded", () => {
  new LoginApp();
});
