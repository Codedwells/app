// Shared utilities for social media app

class SocialUtils {
  static formatDate(dateString) {
    const date = new Date(dateString);
    const now = new Date();
    const diffTime = Math.abs(now - date);
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays === 1) return "1d";
    if (diffDays < 7) return `${diffDays}d`;
    if (diffDays < 30) return `${Math.ceil(diffDays / 7)}w`;
    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
    });
  }

  static formatContent(content) {
    if (!content) return "";

    // Convert hashtags to links
    return content.replace(/#(\w+)/g, '<span class="hashtag">#$1</span>');
  }

  static extractHashtags(content) {
    const hashtags = content.match(/#\w+/g);
    return hashtags ? hashtags.map((tag) => tag.slice(1)) : [];
  }

  static showNotification(message, type = "success") {
    const notification = document.createElement("div");
    notification.className = `notification ${type}`;
    notification.textContent = message;
    document.body.appendChild(notification);

    setTimeout(() => {
      notification.remove();
    }, 3000);
  }

  static showError(message) {
    this.showNotification(message, "error");
  }

  static showSuccess(message) {
    this.showNotification(message, "success");
  }

  static showAIIndicator(isAI, section) {
    const indicator = document.querySelector(`.ai-indicator.${section}`);
    if (!indicator) return;

    if (isAI) {
      indicator.innerHTML = '<span class="ai-badge">Recommendations</span>';
      indicator.style.display = "block";
    } else {
      indicator.innerHTML =
        '<span class="fallback-badge">📊 Traditional</span>';
      indicator.style.display = "block";
    }
  }

  static async makeApiCall(url, options = {}) {
    const token = localStorage.getItem("authToken");
    const defaultOptions = {
      headers: {
        "Content-Type": "application/json",
        ...(token && { Authorization: `Bearer ${token}` }),
      },
    };

    const mergedOptions = {
      ...defaultOptions,
      ...options,
      headers: {
        ...defaultOptions.headers,
        ...options.headers,
      },
    };

    try {
      const response = await fetch(url, mergedOptions);
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      return await response.json();
    } catch (error) {
      console.error("API call failed:", error);
      throw error;
    }
  }

  static getCurrentUser() {
    return JSON.parse(localStorage.getItem("currentUser") || "null");
  }

  static setCurrentUser(user) {
    localStorage.setItem("currentUser", JSON.stringify(user));
  }

  static getAuthToken() {
    return localStorage.getItem("authToken");
  }

  static setAuthToken(token) {
    localStorage.setItem("authToken", token);
  }

  static clearAuth() {
    localStorage.removeItem("authToken");
    localStorage.removeItem("currentUser");
  }

  static isAuthenticated() {
    return !!this.getAuthToken();
  }

  static redirectToLogin() {
    if (!window.location.pathname.includes("login.html")) {
      window.location.href = "login.html";
    }
  }

  static redirectToMain() {
    if (!window.location.pathname.includes("index.html")) {
      window.location.href = "index.html";
    }
  }

  // Post view tracking functionality
  static postViewTracker = {
    seenPosts: new Set(),
    pendingPosts: new Set(),
    observer: null,
    batchTimeout: null,
    BATCH_DELAY: 2000, // Send seen posts every 2 seconds

    init() {
      if (!this.observer) {
        this.observer = new IntersectionObserver(
          (entries) => {
            entries.forEach((entry) => {
              if (entry.isIntersecting) {
                const postElement = entry.target.closest(".post");
                if (postElement) {
                  const postId = postElement.dataset.postId;
                  if (postId && !this.seenPosts.has(postId)) {
                    this.seenPosts.add(postId);
                    this.pendingPosts.add(postId);
                    this.scheduleBatch();
                  }
                }
              }
            });
          },
          {
            threshold: 0.5, // Post is considered "seen" when 50% is visible
            rootMargin: "0px 0px -50px 0px", // Add some margin to ensure post is truly in view
          }
        );
      }
    },

    observePost(postElement) {
      if (this.observer && postElement) {
        // Look for the post content area to track visibility
        const postBody = postElement.querySelector(".post-body") || postElement;
        this.observer.observe(postBody);
      }
    },

    observeAllPosts() {
      const posts = document.querySelectorAll(".post[data-post-id]");
      posts.forEach((post) => this.observePost(post));
    },

    scheduleBatch() {
      if (this.batchTimeout) {
        clearTimeout(this.batchTimeout);
      }

      this.batchTimeout = setTimeout(() => {
        this.sendSeenPosts();
      }, this.BATCH_DELAY);
    },

    async sendSeenPosts() {
      if (this.pendingPosts.size === 0) return;

      const postIds = Array.from(this.pendingPosts);
      this.pendingPosts.clear();

      try {
        await SocialUtils.makeApiCall("/api/v1/user/seen-posts", {
          method: "POST",
          body: JSON.stringify({ postIds }),
        });
        console.log(`Tracked ${postIds.length} posts as seen`);
      } catch (error) {
        console.error("Failed to send seen posts:", error);
        // Add posts back to pending if failed
        postIds.forEach((id) => this.pendingPosts.add(id));
      }
    },

    reset() {
      this.seenPosts.clear();
      this.pendingPosts.clear();
      if (this.batchTimeout) {
        clearTimeout(this.batchTimeout);
        this.batchTimeout = null;
      }
    },

    disconnect() {
      if (this.observer) {
        this.observer.disconnect();
      }
      this.reset();
    },
  };
}

// Make SocialUtils available globally
window.SocialUtils = SocialUtils;
