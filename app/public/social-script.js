// Social Media Platform JavaScript
class SocialApp {
  constructor() {
    this.currentUser = null;
    this.init();
  }

  init() {
    this.checkAuthStatus();
    this.bindEvents();
  }

  checkAuthStatus() {
    const token = localStorage.getItem("authToken");
    if (token) {
      this.currentUser = JSON.parse(localStorage.getItem("currentUser"));

      // Check if we're on the login page, redirect to main app if already logged in
      if (window.location.pathname.includes("login.html")) {
        window.location.href = "index.html";
        return;
      }

      this.renderUserInfo();

      // Load content based on current page
      if (window.location.pathname.includes("profile.html")) {
        this.loadUserProfile();
      } else {
        this.loadTimeline();
        this.loadSuggestedUsers();
      }
    } else {
      // Redirect to login page if not logged in and not already on login page
      if (!window.location.pathname.includes("login.html")) {
        window.location.href = "login.html";
      }
    }
  }

  bindEvents() {
    // Login form - only on login page
    const loginForm = document.getElementById("loginForm");
    if (loginForm) {
      loginForm.addEventListener("submit", (e) => this.handleLogin(e));
    }

    // Tweet composition area - only on main app
    const tweetComposeInput = document.getElementById("tweet-compose");
    const tweetBtnSmall = document.querySelector(".tweet-btn-small");
    if (tweetComposeInput && tweetBtnSmall) {
      tweetBtnSmall.addEventListener("click", () => {
        const content = tweetComposeInput.textContent;
        if (content.trim()) {
          this.createPost(content);
          tweetComposeInput.textContent = "";
        }
      });
    }

    // Logout button
    const logoutBtn = document.getElementById("logoutBtn");
    if (logoutBtn) {
      logoutBtn.addEventListener("click", () => this.handleLogout());
    }

    // Modal close buttons
    document.addEventListener("click", (e) => {
      if (
        e.target.classList.contains("modal") ||
        e.target.classList.contains("close")
      ) {
        this.closeModal();
      }
    });

    // Close modal with Escape key
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape") {
        const modal = document.getElementById("modal");
        if (modal && modal.style.display === "block") {
          this.closeModal();
        }
      }
    });

    // Create post button
    const createPostBtn = document.getElementById("createPostBtn");
    if (createPostBtn) {
      createPostBtn.addEventListener("click", () => this.showCreatePostModal());
    }

    // Navigation events
    const navItems = document.querySelectorAll(".nav-item");
    navItems.forEach((item) => {
      const link = item.querySelector("a");
      if (link && link.textContent.includes("Explore")) {
        link.addEventListener("click", (e) => {
          e.preventDefault();
          this.showExploreView();
        });
      } else if (link && link.textContent.includes("Home")) {
        link.addEventListener("click", (e) => {
          e.preventDefault();
          this.showHomeView();
        });
      }
    });
  }

  async handleLogin(e) {
    e.preventDefault();
    const formData = new FormData(e.target);
    const credentials = {
      username: formData.get("username"),
      password: formData.get("password"),
    };

    try {
      const response = await fetch("/api/v1/auth/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(credentials),
      });

      const data = await response.json();

      if (response.ok) {
        localStorage.setItem("authToken", data.token);
        localStorage.setItem("currentUser", JSON.stringify(data.user));
        this.currentUser = data.user;

        // Redirect to main app
        window.location.href = "index.html";
      } else {
        this.showError(data.message || "Login failed");
      }
    } catch (error) {
      this.showError("Network error. Please try again.");
    }
  }

  async handleCreatePost(e) {
    e.preventDefault();
    const formData = new FormData(e.target);
    const postData = {
      content: formData.get("content"),
      hashtags: this.extractHashtags(formData.get("content")),
    };

    try {
      const response = await fetch("/api/v1/posts", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${localStorage.getItem("authToken")}`,
        },
        body: JSON.stringify(postData),
      });

      if (response.ok) {
        this.closeModal();
        document.getElementById("postForm").reset();
        this.loadTimeline(); // Refresh timeline
        this.showSuccess("Post created successfully!");
      } else {
        const error = await response.json();
        this.showError(error.message || "Failed to create post");
      }
    } catch (error) {
      this.showError("Network error. Please try again.");
    }
  }

  async createPost(content) {
    const postData = {
      content: content,
      hashtags: this.extractHashtags(content),
    };

    try {
      const response = await fetch("/api/v1/posts", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${localStorage.getItem("authToken")}`,
        },
        body: JSON.stringify(postData),
      });

      if (response.ok) {
        this.loadTimeline(); // Refresh timeline
        this.showSuccess("Tweet posted successfully!");
      } else {
        const error = await response.json();
        this.showError(error.message || "Failed to post tweet");
      }
    } catch (error) {
      this.showError("Network error. Please try again.");
    }
  }

  async loadTimeline() {
    try {
      // Try AI-powered timeline first
      let response = await fetch("/api/v1/ai/timeline", {
        headers: {
          Authorization: `Bearer ${localStorage.getItem("authToken")}`,
        },
      });

      // If AI service is unavailable, fallback to traditional timeline
      if (!response.ok) {
        response = await fetch("/api/v1/timeline", {
          headers: {
            Authorization: `Bearer ${localStorage.getItem("authToken")}`,
          },
        });
      }

      if (response.ok) {
        const posts = await response.json();
        this.renderTimeline(posts);

        // Show AI indicator if we got AI recommendations
        const isAI = response.url.includes("/ai/timeline");
        this.showAIIndicator(isAI, "timeline");
      }
    } catch (error) {
      console.error("Failed to load timeline:", error);
    }
  }

  async loadSuggestedUsers() {
    try {
      // Try AI-powered user recommendations first
      let response = await fetch("/api/v1/ai/users/recommended", {
        headers: {
          Authorization: `Bearer ${localStorage.getItem("authToken")}`,
        },
      });

      // If AI service is unavailable, fallback to traditional suggestions
      if (!response.ok) {
        response = await fetch("/api/v1/users/suggested", {
          headers: {
            Authorization: `Bearer ${localStorage.getItem("authToken")}`,
          },
        });
      }

      if (response.ok) {
        const users = await response.json();
        this.renderSuggestedUsers(users);

        // Show AI indicator if we got AI recommendations
        const isAI = response.url.includes("/ai/users/recommended");
        this.showAIIndicator(isAI, "users");
      }
    } catch (error) {
      console.error("Failed to load suggested users:", error);
    }
  }

  async loadExplorePosts() {
    try {
      const response = await fetch("/api/v1/ai/explore", {
        headers: {
          Authorization: `Bearer ${localStorage.getItem("authToken")}`,
        },
      });

      if (response.ok) {
        const posts = await response.json();
        this.renderExplorePosts(posts);
        this.showAIIndicator(true, "explore");
      }
    } catch (error) {
      console.error("Failed to load explore posts:", error);
    }
  }

  async loadUserProfile() {
    try {
      // Default to current user's profile if no userId is provided in URL
      const urlParams = new URLSearchParams(window.location.search);
      const userId = urlParams.get("userId") || this.currentUser._id;

      console.log("Loading profile for user ID:", userId);

      const response = await fetch(`/api/v1/users/${userId}`, {
        headers: {
          Authorization: `Bearer ${localStorage.getItem("authToken")}`,
        },
      });

      if (response.ok) {
        const profileData = await response.json();
        console.log("Profile data received:", profileData);

        if (profileData.user) {
          this.renderProfileInfo(profileData.user);
          this.renderUserPosts(profileData.posts || []);
        } else {
          this.showError("Invalid profile data received");
          console.error("Invalid profile data:", profileData);
        }
      } else {
        const errorData = await response.json().catch(() => ({}));
        this.showError(errorData.message || "Failed to load profile");
        console.error("API error:", response.status, errorData);
      }
    } catch (error) {
      console.error("Failed to load user profile:", error);
      this.showError("Failed to load profile data");
    }
  }

  renderProfileInfo(user) {
    console.log("Rendering profile info:", user);

    // Update profile header
    document.getElementById("profile-name").textContent =
      user.fullName || user.username;
    document.getElementById("profile-username").textContent = `@${user.username
      .toLowerCase()
      .replace(/\s+/g, "")}`;

    if (user.bio) {
      document.getElementById("profile-bio").textContent = user.bio;
    }

    // Update profile avatar
    const profileAvatar = document.getElementById("profile-avatar");
    if (profileAvatar) {
      if (user.profilePicture) {
        // Create an image element if there's a profile picture URL
        profileAvatar.innerHTML = `<img src="${user.profilePicture}" alt="${user.username}" />`;
        profileAvatar.classList.add("has-image");
      } else {
        profileAvatar.textContent = user.username.charAt(0).toUpperCase();
        profileAvatar.classList.remove("has-image");
      }
    }

    // Update stats - use followerCount and followingCount if available
    document.getElementById("followers-count").textContent =
      user.followerCount || (user.followers ? user.followers.length : 0);
    document.getElementById("following-count").textContent =
      user.followingCount || (user.following ? user.following.length : 0);

    // Post count will be updated when posts are rendered
  }

  renderUserPosts(posts) {
    const userPosts = document.getElementById("userPosts");
    if (!userPosts) return;

    console.log("Rendering user posts:", posts);

    if (!posts || posts.length === 0) {
      userPosts.innerHTML = `
        <div class="empty-timeline">
          <div class="empty-message">
            <h3>No posts yet</h3>
            <p>When this user creates posts, they'll appear here.</p>
          </div>
        </div>
      `;
      return;
    }

    userPosts.innerHTML = posts
      .map(
        (post) => `
            <div class="post" data-post-id="${post._id}">
                <div class="post-avatar">
                    <div class="user-avatar">
                        ${
                          post.author.username
                            ? post.author.username.charAt(0).toUpperCase()
                            : ""
                        }
                    </div>
                </div>
                <div class="post-body">
                    <div class="post-header">
                        <div class="post-user-info">
                            <a href="profile.html?userId=${
                              post.author._id
                            }" class="post-author">
                                ${post.author.username || post.author}
                            </a>
                            <span class="post-username">@${
                              typeof post.author === "object" &&
                              post.author.username
                                ? post.author.username
                                    .toLowerCase()
                                    .replace(/\s+/g, "")
                                : "user"
                            }</span>
                            <span class="post-time">· ${this.formatDate(
                              post.createdAt
                            )}</span>
                        </div>
                        <div class="post-more">
                            <span>•••</span>
                        </div>
                    </div>
                    <div class="post-content">
                        <p>${this.formatContent(post.text || post.content)}</p>
                        ${
                          post.media &&
                          Array.isArray(post.media) &&
                          post.media.length > 0
                            ? `<div class="post-media">
                                <img src="${post.media[0].url}" alt="Post image" class="post-image">
                              </div>`
                            : post.media &&
                              typeof post.media === "object" &&
                              post.media.url
                            ? `<div class="post-media">
                                ${
                                  post.media.type === "video"
                                    ? `<video controls class="post-video">
                                      <source src="${post.media.url}" type="video/mp4">
                                    </video>`
                                    : `<img src="${post.media.url}" alt="Post image" class="post-image">`
                                }
                              </div>`
                            : ""
                        }
                    </div>
                    <div class="post-actions">
                        <button class="action-btn reply-btn" onclick="app.showComments('${
                          post._id
                        }')">
                            <i>💬</i> <span>${post.commentCount || 0}</span>
                        </button>
                        <button class="action-btn retweet-btn">
                            <i>🔄</i> <span>${post.shareCount || 0}</span>
                        </button>
                        <button class="action-btn like-btn ${
                          post.likes &&
                          this.currentUser &&
                          post.likes.includes(this.currentUser._id)
                            ? "liked"
                            : ""
                        }" onclick="app.toggleLike('${post._id}')">
                            <i>${
                              post.likes &&
                              this.currentUser &&
                              post.likes.includes(this.currentUser._id)
                                ? "❤️"
                                : "🤍"
                            }</i> <span>${
          post.likeCount || (post.likes ? post.likes.length : 0)
        }</span>
                        </button>
                        <button class="action-btn share-btn">
                            <i>📤</i>
                        </button>
                    </div>
                </div>
            </div>
        `
      )
      .join("");

    // Update the post count in the profile
    document.getElementById("post-count").textContent = posts.length;

    // Initialize post view tracking for all rendered posts
    if (typeof SocialUtils !== "undefined" && SocialUtils.postViewTracker) {
      SocialUtils.postViewTracker.observeAllPosts();
    }
  }

  renderTimeline(posts) {
    const timeline = document.getElementById("timeline");
    if (!timeline) return;

    if (posts.length === 0) {
      timeline.innerHTML = `
        <div class="empty-timeline">
          <div class="empty-message">
            <h3>Welcome to WhatIDo</h3>
            <p>When you follow people, you'll see their posts here.</p>
          </div>
        </div>
      `;
      return;
    }

    timeline.innerHTML = posts
      .map(
        (post) => `
            <div class="post" data-post-id="${post._id}">
                <div class="post-avatar">
                    <div class="user-avatar">
                        ${post.author.username.charAt(0).toUpperCase()}
                    </div>
                </div>
                <div class="post-body">
                    <div class="post-header">
                        <div class="post-user-info">
                            <a href="profile.html?userId=${
                              post.author._id
                            }" class="post-author">${post.author.username}</a>
                            <span class="post-username">@${post.author.username
                              .toLowerCase()
                              .replace(/\s+/g, "")}</span>
                            <span class="post-time">· ${this.formatDate(
                              post.createdAt
                            )}</span>
                        </div>
                        <div class="post-more">
                            <span>•••</span>
                        </div>
                    </div>
                    <div class="post-content">
                        <p>${this.formatContent(post.text || post.content)}</p>
                        ${
                          post.media && post.media.type === "video"
                            ? `<div class="post-media">
                                <video controls class="post-video">
                                  <source src="${post.media.url}" type="video/mp4">
                                </video>
                              </div>`
                            : post.media && post.media.type === "image"
                            ? `<div class="post-media">
                                  <img src="${post.media.url}" alt="Post image" class="post-image">
                                </div>`
                            : ""
                        }
                    </div>
                    <div class="post-actions">
                        <button class="action-btn reply-btn" onclick="app.showComments('${
                          post._id
                        }')">
                            <i>💬</i> <span>${
                              post.comments ? post.comments.length : 0
                            }</span>
                        </button>
                        <button class="action-btn retweet-btn">
                            <i>🔄</i> <span>0</span>
                        </button>
                        <button class="action-btn like-btn ${
                          post.likes &&
                          post.likes.includes(this.currentUser._id)
                            ? "liked"
                            : ""
                        }" onclick="app.toggleLike('${post._id}')">
                            <i>${
                              post.likes &&
                              post.likes.includes(this.currentUser._id)
                                ? "❤️"
                                : "🤍"
                            }</i> <span>${
          post.likes ? post.likes.length : 0
        }</span>
                        </button>
                        <button class="action-btn share-btn">
                            <i>📤</i>
                        </button>
                    </div>
                </div>
            </div>
        `
      )
      .join("");

    // Initialize post view tracking for all rendered posts
    if (typeof SocialUtils !== "undefined" && SocialUtils.postViewTracker) {
      SocialUtils.postViewTracker.observeAllPosts();
    }
  }

  renderExplorePosts(posts) {
    const exploreContent = document.getElementById("exploreContent");
    if (!exploreContent) return;

    if (posts.length === 0) {
      exploreContent.innerHTML = `
        <div class="empty-timeline">
          <div class="empty-message">
            <h3>No recommendations yet</h3>
            <p>Start interacting with posts to get personalized recommendations.</p>
          </div>
        </div>
      `;
      return;
    }

    exploreContent.innerHTML = posts
      .map(
        (post) => `
            <div class="post" data-post-id="${post.post_id || post._id}">
                <div class="post-avatar">
                    <div class="user-avatar">
                        ${String(post.author || "?")
                          .charAt(0)
                          .toUpperCase()}
                    </div>
                </div>
                <div class="post-body">
                    <div class="post-header">
                        <div class="post-user-info">
                            <span class="post-author">${String(
                              post.author || "Unknown"
                            )}</span>
                            <span class="post-username">@${String(
                              post.author || "unknown"
                            )
                              .toLowerCase()
                              .replace(/\s+/g, "")}</span>
                            <span class="post-time">· ${this.formatDate(
                              post.createdAt
                            )}</span>
                            ${
                              post.score
                                ? `<span class="ai-score">📊 ${Math.round(
                                    post.score * 100
                                  )}% match</span>`
                                : ""
                            }
                        </div>
                    </div>
                    <div class="post-content">
                        <p>${this.formatContent(
                          post.text || post.content || ""
                        )}</p>
                        ${
                          post.media && post.media.length > 0
                            ? `
                          <div class="post-media">
                            ${post.media
                              .map(
                                (m) => `
                              ${
                                m.type === "image"
                                  ? `<img src="${m.url}" alt="Post image" />`
                                  : ""
                              }
                              ${
                                m.type === "video"
                                  ? `<video controls><source src="${m.url}" type="video/mp4"></video>`
                                  : ""
                              }
                            `
                              )
                              .join("")}
                          </div>
                        `
                            : ""
                        }
                        ${
                          post.hashtags && post.hashtags.length > 0
                            ? `
                          <div class="post-hashtags">
                            ${post.hashtags
                              .map(
                                (tag) => `<span class="hashtag">#${tag}</span>`
                              )
                              .join(" ")}
                          </div>
                        `
                            : ""
                        }
                    </div>
                    <div class="post-actions">
                        <button class="action-btn comment-btn" onclick="socialApp.showComments('${
                          post.post_id || post._id
                        }')">
                            <span>💬</span> ${post.commentCount || 0}
                        </button>
                        <button class="action-btn like-btn" onclick="socialApp.toggleLike('${
                          post.post_id || post._id
                        }')">
                            <span>❤️</span> ${post.likeCount || 0}
                        </button>
                        <button class="action-btn share-btn">
                            <span>🔄</span> ${post.shareCount || 0}
                        </button>
                    </div>
                </div>
            </div>
        `
      )
      .join("");

    // Initialize post view tracking for all rendered posts
    if (typeof SocialUtils !== "undefined" && SocialUtils.postViewTracker) {
      SocialUtils.postViewTracker.observeAllPosts();
    }
  }

  async toggleLike(postId) {
    try {
      const response = await fetch(`/api/v1/posts/${postId}/like`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${localStorage.getItem("authToken")}`,
        },
      });

      if (response.ok) {
        this.loadTimeline(); // Refresh to show updated likes
      }
    } catch (error) {
      console.error("Failed to toggle like:", error);
    }
  }

  async followUser(userId) {
    try {
      const response = await fetch(`/api/v1/users/${userId}/follow`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${localStorage.getItem("authToken")}`,
        },
      });

      if (response.ok) {
        this.loadSuggestedUsers(); // Refresh suggested users
        this.showSuccess("User followed successfully!");
      }
    } catch (error) {
      console.error("Failed to follow user:", error);
    }
  }

  async showComments(postId) {
    try {
      const response = await fetch(`/api/v1/posts/${postId}/comments`, {
        headers: {
          Authorization: `Bearer ${localStorage.getItem("authToken")}`,
        },
      });

      if (response.ok) {
        const comments = await response.json();
        this.renderCommentsModal(postId, comments);
      }
    } catch (error) {
      console.error("Failed to load comments:", error);
    }
  }

  renderCommentsModal(postId, comments) {
    console.log("Rendering comments:", comments);
    const modal = document.getElementById("modal");
    modal.innerHTML = `
            <div class="modal-content reply-modal">
                <div class="modal-header">
                    <span class="close">&times;</span>
                    <h3>Comments</h3>
                </div>
                <div class="modal-body">
                    <div class="comments-list">
                        ${comments
                          .map(
                            (comment) => `
                            <div class="comment" data-comment-id="${
                              comment._id
                            }">
                                <div class="comment-avatar">
                                    <div class="user-avatar ${
                                      comment.author.profilePicture
                                        ? "has-image"
                                        : ""
                                    }">
                                        ${
                                          comment.author.profilePicture
                                            ? `<img src="${comment.author.profilePicture}" alt="${comment.author.username}" />`
                                            : comment.author.username
                                                .charAt(0)
                                                .toUpperCase()
                                        }
                                    </div>
                                    ${
                                      comment.author.isVerified
                                        ? '<span class="verified-badge">✓</span>'
                                        : ""
                                    }
                                </div>
                                <div class="comment-body">
                                    <div class="comment-header">
                                        <div class="comment-author-info">
                                            <a href="profile.html?userId=${
                                              comment.author._id
                                            }" class="comment-author">${
                              comment.author.fullName || comment.author.username
                            }</a>
                                            <span class="comment-username">@${comment.author.username
                                              .toLowerCase()
                                              .replace(/\s+/g, "")}</span>
                                            <span class="comment-time">· ${this.formatDate(
                                              comment.createdAt
                                            )}</span>
                                        </div>
                                    </div>
                                    <div class="comment-content">
                                        ${this.formatContent(
                                          comment.text || comment.content
                                        )}
                                    </div>
                                    <div class="comment-actions">
                                        <button class="action-btn reply-btn">
                                            <i>💬</i>
                                            ${
                                              comment.replies &&
                                              comment.replies.length > 0
                                                ? `<span>${comment.replies.length}</span>`
                                                : "<span>0</span>"
                                            }
                                        </button>
                                        <button class="action-btn retweet-btn">
                                            <i>🔄</i> <span>0</span>
                                        </button>
                                        <button class="action-btn like-btn ${
                                          comment.likes &&
                                          this.currentUser &&
                                          comment.likes.includes(
                                            this.currentUser._id
                                          )
                                            ? "liked"
                                            : ""
                                        }" onclick="app.toggleCommentLike('${
                              comment._id
                            }')">
                                            <i>${
                                              comment.likes &&
                                              this.currentUser &&
                                              comment.likes.includes(
                                                this.currentUser._id
                                              )
                                                ? "❤️"
                                                : "🤍"
                                            }</i> <span>${
                              comment.likeCount ||
                              (comment.likes ? comment.likes.length : 0)
                            }</span>
                                        </button>
                                        <button class="action-btn share-btn">
                                            <i>📤</i>
                                        </button>
                                    </div>
                                </div>
                            </div>
                        `
                          )
                          .join("")}
                    </div>
                    <div class="reply-composer">
                        <div class="user-avatar ${
                          this.currentUser.profilePicture ? "has-image" : ""
                        }">
                            ${
                              this.currentUser.profilePicture
                                ? `<img src="${this.currentUser.profilePicture}" alt="${this.currentUser.username}" />`
                                : this.currentUser.username
                                    .charAt(0)
                                    .toUpperCase()
                            }
                        </div>
                        <form class="comment-form" onsubmit="app.handleCreateComment(event, '${postId}')">
                            <textarea name="content" placeholder="Write your reply" required></textarea>
                            <div class="reply-actions">
                                <div class="reply-tools">
                                    <button type="button" class="reply-tool-btn">📷</button>
                                    <button type="button" class="reply-tool-btn">😀</button>
                                </div>
                                <button type="submit" class="reply-btn">Reply</button>
                            </div>
                        </form>
                    </div>
                </div>
            </div>
        `;
    modal.style.display = "block";
    document.body.style.overflow = "hidden"; // Prevent scrolling on body when modal is open

    // Focus the textarea for better UX
    setTimeout(() => {
      const textarea = modal.querySelector("textarea");
      if (textarea) textarea.focus();
    }, 100);
  }

  async handleCreateComment(e, postId) {
    e.preventDefault();
    const formData = new FormData(e.target);
    const commentData = {
      content: formData.get("content"),
      text: formData.get("content"), // Adding text as some endpoints might use text instead of content
    };

    try {
      const response = await fetch(`/api/v1/posts/${postId}/comments`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${localStorage.getItem("authToken")}`,
        },
        body: JSON.stringify(commentData),
      });

      if (response.ok) {
        // Clear the textarea
        e.target.reset();
        this.showSuccess("Comment posted successfully!");
        this.showComments(postId); // Refresh comments
      } else {
        const error = await response.json();
        this.showError(error.message || "Failed to post comment");
      }
    } catch (error) {
      console.error("Failed to create comment:", error);
      this.showError("Network error. Please try again.");
    }
  }

  async toggleCommentLike(commentId) {
    try {
      const response = await fetch(`/api/v1/comments/${commentId}/like`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${localStorage.getItem("authToken")}`,
        },
      });

      if (response.ok) {
        // Get the response data
        const likeData = await response.json();
        console.log("Like response:", likeData);

        // Find the current post to refresh comments
        const modal = document.getElementById("modal");
        const commentForm = modal.querySelector(".comment-form");
        const postId = commentForm
          .getAttribute("onsubmit")
          .match(/'([^']+)'/)[1];

        // Update the UI without refreshing all comments
        const likeBtn = modal.querySelector(
          `.comment[data-comment-id="${commentId}"] .like-btn`
        );
        const likeIcon = likeBtn?.querySelector("i");
        const likeCount = likeBtn?.querySelector("span");

        if (likeBtn && likeIcon && likeCount) {
          // Update the like button based on the response
          likeBtn.classList.toggle("liked", likeData.liked);
          likeIcon.textContent = likeData.liked ? "❤️" : "🤍";
          likeCount.textContent = likeData.likeCount;
        } else {
          // If we couldn't find the button, refresh all comments
          this.showComments(postId);
        }
      }
    } catch (error) {
      console.error("Failed to toggle comment like:", error);
    }
  }

  showCreatePostModal() {
    const modal = document.getElementById("modal");
    modal.innerHTML = `
            <div class="modal-content tweet-modal">
                <div class="modal-header">
                    <span class="close">&times;</span>
                    <h3>Create a new post</h3>
                </div>
                <div class="modal-body">
                    <div class="compose-tweet">
                        <div class="user-avatar">
                            ${this.currentUser.username.charAt(0).toUpperCase()}
                        </div>
                        <form id="postForm" class="tweet-form">
                            <textarea name="content" placeholder="What's happening?" required></textarea>
                            <div class="tweet-form-actions">
                                <div class="tweet-form-tools">
                                    <button type="button" class="tweet-tool-btn">📷</button>
                                    <button type="button" class="tweet-tool-btn">📊</button>
                                    <button type="button" class="tweet-tool-btn">😀</button>
                                    <button type="button" class="tweet-tool-btn">📅</button>
                                </div>
                                <button type="submit" class="tweet-submit-btn">Tweet</button>
                            </div>
                        </form>
                    </div>
                </div>
            </div>
        `;
    modal.style.display = "block";
    document.body.style.overflow = "hidden"; // Prevent scrolling on body when modal is open

    // Focus the textarea for better UX
    setTimeout(() => {
      const textarea = modal.querySelector("textarea");
      if (textarea) textarea.focus();
    }, 100);

    // Re-bind the form event
    const postForm = document.getElementById("postForm");
    postForm.addEventListener("submit", (e) => this.handleCreatePost(e));
  }

  closeModal() {
    const modal = document.getElementById("modal");
    modal.style.display = "none";
    document.body.style.overflow = "auto"; // Re-enable scrolling on body
  }

  renderUserInfo() {
    // Update user info in sidebar
    const userInfo = document.getElementById("userInfo");
    if (userInfo && this.currentUser) {
      userInfo.innerHTML = `
        <div class="user-avatar">${this.currentUser.username
          .charAt(0)
          .toUpperCase()}</div>
        <div class="user-details">
          <h3>${this.currentUser.username}</h3>
          <p>@${this.currentUser.username.toLowerCase().replace(/\s+/g, "")}</p>
        </div>
      `;
    }

    // Update avatar in compose area
    const composeAvatar = document.getElementById("compose-avatar");
    if (composeAvatar && this.currentUser) {
      composeAvatar.innerText = this.currentUser.username
        .charAt(0)
        .toUpperCase();
    }
  }

  handleLogout() {
    localStorage.removeItem("authToken");
    localStorage.removeItem("currentUser");
    this.currentUser = null;
    // Redirect to login page
    window.location.href = "login.html";
  }

  extractHashtags(content) {
    const hashtags = content.match(/#[\w]+/g);
    return hashtags ? hashtags.map((tag) => tag.substring(1)) : [];
  }

  formatContent(content) {
    if (!content) return "";
    // Convert hashtags to clickable links
    return content.replace(/#([\w]+)/g, '<span class="hashtag">#$1</span>');
  }

  formatDate(dateString) {
    const date = new Date(dateString);
    const now = new Date();
    const diff = now - date;

    if (diff < 60000) return "now";
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}h`;
    return `${Math.floor(diff / 86400000)}d`;
  }

  showError(message) {
    this.showNotification(message, "error");
  }

  showSuccess(message) {
    this.showNotification(message, "success");
  }

  showNotification(message, type) {
    const notification = document.createElement("div");
    notification.className = `notification ${type}`;
    notification.textContent = message;
    document.body.appendChild(notification);

    setTimeout(() => {
      notification.remove();
    }, 3000);
  }

  showAIIndicator(isAI, section) {
    // Find or create AI indicator
    let indicator = document.getElementById(`ai-indicator-${section}`);
    if (!indicator) {
      indicator = document.createElement("div");
      indicator.id = `ai-indicator-${section}`;
      indicator.className = "ai-indicator";

      // Find appropriate container based on section
      let container;
      if (section === "timeline") {
        container = document.querySelector(".feed-header");
      } else if (section === "users") {
        container = document.querySelector(".suggested-users h3");
      } else if (section === "explore") {
        container = document.querySelector(".explore-header");
      }

      if (container) {
        container.appendChild(indicator);
      }
    }

    if (isAI) {
      indicator.innerHTML = '<span class="ai-badge">🤖 AI Powered</span>';
      indicator.style.display = "block";
    } else {
      indicator.innerHTML =
        '<span class="fallback-badge">📊 Traditional</span>';
      indicator.style.display = "block";
    }
  }

  showHomeView() {
    // Update active nav item
    document
      .querySelectorAll(".nav-item")
      .forEach((item) => item.classList.remove("active"));
    const homeNavItem = document.querySelector(
      '.nav-item a[href="index.html"]'
    );
    if (homeNavItem) {
      homeNavItem.parentElement.classList.add("active");
    }

    // Show home content, hide explore
    const homeContent = document.querySelector(".main-feed");
    const exploreContent = document.getElementById("exploreView");

    if (homeContent) homeContent.style.display = "block";
    if (exploreContent) exploreContent.style.display = "none";

    this.loadTimeline();
    this.loadSuggestedUsers();
  }

  showExploreView() {
    // Update active nav item
    document
      .querySelectorAll(".nav-item")
      .forEach((item) => item.classList.remove("active"));
    const exploreNavItem = Array.from(
      document.querySelectorAll(".nav-item a")
    ).find((a) => a.textContent.includes("Explore"));
    if (exploreNavItem) exploreNavItem.parentElement.classList.add("active");

    // Hide home content, show or create explore
    const homeContent = document.querySelector(".main-feed");
    let exploreContent = document.getElementById("exploreView");

    if (homeContent) homeContent.style.display = "none";

    if (!exploreContent) {
      exploreContent = this.createExploreView();
      const mainContent = document.querySelector(".app-main");
      if (mainContent) mainContent.appendChild(exploreContent);
    }

    exploreContent.style.display = "block";
    this.loadExplorePosts();
  }

  createExploreView() {
    const exploreView = document.createElement("div");
    exploreView.id = "exploreView";
    exploreView.className = "explore-view";
    exploreView.innerHTML = `
      <div class="explore-header">
        <h2>Explore</h2>
        <p>Discover new content you might like</p>
      </div>
      <div id="exploreContent" class="explore-content">
        <div class="loading">Loading recommendations...</div>
      </div>
    `;
    return exploreView;
  }
}

// Initialize the app when the DOM is loaded
let socialApp;
document.addEventListener("DOMContentLoaded", () => {
  socialApp = new SocialApp();
});
