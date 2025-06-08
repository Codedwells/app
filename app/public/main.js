class MainApp {
  constructor() {
    this.currentUser = null;
    this.timelinePage = 1;
    this.timelineLoading = false;
    this.timelineHasMore = true;
    this.init();
  }

  init() {
    // Check authentication first
    if (!SocialUtils.isAuthenticated()) {
      SocialUtils.redirectToLogin();
      return;
    }

    this.currentUser = SocialUtils.getCurrentUser();

    // Initialize post view tracking
    SocialUtils.postViewTracker.init();

    this.bindEvents();
    this.loadInitialContent();
  }

  bindEvents() {
    // Tweet composition
    const tweetComposeInput = document.getElementById("tweet-compose");
    const tweetBtnSmall = document.querySelector(".tweet-btn-small");
    if (tweetComposeInput && tweetBtnSmall) {
      tweetBtnSmall.addEventListener("click", (e) => this.handleCreatePost(e));

      tweetComposeInput.addEventListener("keypress", (e) => {
        if (e.key === "Enter" && !e.shiftKey) {
          e.preventDefault();
          this.handleCreatePost(e);
        }
      });
    }

    // Create post modal
    const createPostBtn = document.getElementById("createPostBtn");
    if (createPostBtn) {
      createPostBtn.addEventListener("click", () => this.showCreatePostModal());
    }

    // Logout button
    const logoutBtn = document.getElementById("logoutBtn");
    if (logoutBtn) {
      logoutBtn.addEventListener("click", () => this.handleLogout());
    }

    // Modal close events
    document.addEventListener("click", (e) => {
      if (
        e.target.classList.contains("modal") ||
        e.target.classList.contains("close-modal")
      ) {
        this.closeModal();
      }
    });

    // Navigation events
    this.bindNavigationEvents();
  }

  bindNavigationEvents() {
    // Home navigation
    const homeNav = document.querySelector('.nav-item a[href="index.html"]');
    if (homeNav) {
      homeNav.addEventListener("click", (e) => {
        e.preventDefault();
        this.showHomeView();
      });
    }

    // Explore navigation
    const exploreNavs = document.querySelectorAll(".nav-item a");
    exploreNavs.forEach((nav) => {
      if (nav.textContent.includes("Explore")) {
        nav.addEventListener("click", (e) => {
          e.preventDefault();
          this.showExploreView();
        });
      }
    });
  }

  async loadInitialContent() {
    this.renderUserInfo();
    this.loadTimeline();
    this.loadSuggestedUsers();
  }

  renderUserInfo() {
    const userInfo = document.getElementById("userInfo");
    if (userInfo && this.currentUser) {
      userInfo.innerHTML = `
        <div class="user-details">
          <div class="user-avatar">
            ${
              this.currentUser.username
                ? this.currentUser.username.charAt(0).toUpperCase()
                : "U"
            }
          </div>
          <div class="user-text">
            <div class="user-name">${this.currentUser.username || "User"}</div>
            <div class="user-handle">@${
              this.currentUser.username || "user"
            }</div>
          </div>
          <button id="logoutBtn" class="logout-btn">•••</button>
        </div>
      `;

      // Re-bind logout button after rendering
      const logoutBtn = document.getElementById("logoutBtn");
      if (logoutBtn) {
        logoutBtn.addEventListener("click", () => this.handleLogout());
      }
    }
  }

  async loadTimeline(append = false) {
    if (this.timelineLoading || (!append && !this.timelineHasMore)) return;

    this.timelineLoading = true;
    try {
      const page = append ? this.timelinePage : 1;
      const posts = await SocialUtils.makeApiCall(
        `/api/v1/timeline?page=${page}&limit=20`
      );

      if (append) {
        this.appendToTimeline(posts);
      } else {
        this.timelinePage = 1;
        this.timelineHasMore = true;
        this.renderTimeline(posts);
      }

      if (posts.length < 20) {
        this.timelineHasMore = false;
      } else {
        this.timelinePage++;
      }

      SocialUtils.showAIIndicator(false, "timeline");
    } catch (error) {
      console.error("Error loading timeline:", error);
      SocialUtils.showError("Failed to load timeline");
    } finally {
      this.timelineLoading = false;
    }
  }

  async loadSuggestedUsers() {
    try {
      const users = await SocialUtils.makeApiCall("/api/v1/users/suggested");
      this.renderSuggestedUsers(users);
    } catch (error) {
      console.error("Error loading suggested users:", error);
    }
  }
  renderTimeline(posts) {
    const timeline = document.querySelector(".timeline");
    if (!timeline) return;

    if (!posts || posts.length === 0) {
      timeline.innerHTML = `
        <div class="empty-timeline">
          <div class="empty-message">
            <h3>Welcome to WhatIDo!</h3>
            <p>Follow some users to see their posts in your timeline.</p>
          </div>
        </div>
      `;
      return;
    }

    timeline.innerHTML = posts.map((post) => this.renderPost(post)).join("");

    // Add loading indicator for infinite scroll
    if (this.timelineHasMore) {
      timeline.innerHTML += `
        <div id="timeline-loading" class="loading-more" style="display: none;">
          <div class="loading-spinner">Loading more posts...</div>
        </div>
      `;
    }

    // Initialize post view tracking for all rendered posts
    SocialUtils.postViewTracker.observeAllPosts();

    // Setup infinite scroll
    this.setupInfiniteScroll();
  }

  appendToTimeline(posts) {
    const timeline = document.querySelector(".timeline");
    const loadingIndicator = document.getElementById("timeline-loading");

    if (!timeline || !posts || posts.length === 0) return;

    // Remove loading indicator temporarily
    if (loadingIndicator) {
      loadingIndicator.remove();
    }

    // Append new posts
    const newPostsHtml = posts.map((post) => this.renderPost(post)).join("");
    timeline.insertAdjacentHTML("beforeend", newPostsHtml);

    // Re-add loading indicator if there are more posts
    if (this.timelineHasMore) {
      timeline.insertAdjacentHTML(
        "beforeend",
        `
        <div id="timeline-loading" class="loading-more" style="display: none;">
          <div class="loading-spinner">Loading more posts...</div>
        </div>
      `
      );
    }

    // Initialize post view tracking for new posts
    SocialUtils.postViewTracker.observeAllPosts();
  }

  setupInfiniteScroll() {
    // Remove existing scroll listener to avoid duplicates
    if (this.scrollHandler) {
      window.removeEventListener("scroll", this.scrollHandler);
    }

    this.scrollHandler = () => {
      if (this.timelineLoading || !this.timelineHasMore) return;

      const { scrollTop, scrollHeight, clientHeight } =
        document.documentElement;

      // Load more when user is 80% down the page
      if (scrollTop + clientHeight >= scrollHeight * 0.8) {
        const loadingIndicator = document.getElementById("timeline-loading");
        if (loadingIndicator) {
          loadingIndicator.style.display = "block";
        }
        this.loadTimeline(true);
      }
    };

    window.addEventListener("scroll", this.scrollHandler);
  }

  renderPost(post) {
    return `
      <div class="post" data-post-id="${post._id}">
        <div class="post-avatar">
          ${
            post.author.profilePicture
              ? `<div class="user-avatar has-image">
                  <img src="${post.author.profilePicture}" alt="${post.author.username}">
                </div>`
              : `<div class="user-avatar">
                  ${
                    post.author.username
                      ? post.author.username.charAt(0).toUpperCase()
                      : ""
                  }
                </div>`
          }
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
                typeof post.author === "object" && post.author.username
                  ? post.author.username.toLowerCase().replace(/\s+/g, "")
                  : "user"
              }</span>
              <span class="post-time">· ${SocialUtils.formatDate(
                post.createdAt
              )}</span>
              ${
                post.category
                  ? `<span class="post-category">${post.category.name}</span>`
                  : ""
              }
            </div>
          </div>
          <div class="post-content">
            <p>${SocialUtils.formatContent(post.text || post.content)}</p>
            ${this.renderPostMedia(post.media)}
          </div>
          <div class="post-actions">
            <button class="action-btn reply-btn" onclick="mainApp.showComments('${
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
            }" onclick="mainApp.toggleLike('${post._id}')">
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
    `;
  }

  renderPostMedia(media) {
    if (!media) return "";

    if (Array.isArray(media) && media.length > 0) {
      return `<div class="post-media">
        <img src="${media[0].url}" alt="Post image" class="post-image">
      </div>`;
    }

    if (typeof media === "object" && media.url) {
      return `<div class="post-media">
        ${
          media.type === "video"
            ? `<video controls class="post-video">
              <source src="${media.url}" type="video/mp4">
            </video>`
            : `<img src="${media.url}" alt="Post image" class="post-image">`
        }
      </div>`;
    }

    return "";
  }

  renderSuggestedUsers(users) {
    const followContainer = document.querySelector(".follow-container");
    if (!followContainer || !users || users.length === 0) return;

    const suggestedUsersHtml = users
      .slice(0, 5) // Show more suggestions since we have scrolling
      .map(
        (user) => `
        <div class="user-suggestion" data-user-id="${user._id}">
          ${
            user.profilePicture
              ? `<div class="user-avatar has-image">
                <img src="${user.profilePicture}" alt="${user.username}">
              </div>`
              : `<div class="user-avatar">
                ${user.username ? user.username.charAt(0).toUpperCase() : "U"}
              </div>`
          }
          <div class="user-suggestion-info">
            <div class="user-name">${user.username}</div>
            <div class="user-handle">@${user.username}</div>
          </div>
          <button class="follow-btn" onclick="mainApp.followUser('${
            user._id
          }')">
            Follow
          </button>
        </div>
      `
      )
      .join("");

    followContainer.innerHTML = `
      <h2>Who to follow</h2>
      <div class="suggested-users">
        ${suggestedUsersHtml}
      </div>
    `;
  }

  async handleCreatePost(e) {
    e.preventDefault();

    const tweetInput = document.getElementById("tweet-compose");
    const content = tweetInput ? tweetInput.textContent.trim() : "";

    if (!content) {
      SocialUtils.showError("Please enter some content");
      return;
    }

    await this.createPost(content);

    if (tweetInput) {
      tweetInput.textContent = "";
    }
  }

  async createPost(content) {
    try {
      const hashtags = SocialUtils.extractHashtags(content);

      const post = await SocialUtils.makeApiCall("/api/v1/posts", {
        method: "POST",
        body: JSON.stringify({
          text: content,
          hashtags: hashtags,
        }),
      });

      SocialUtils.showSuccess("Post created successfully!");
      this.loadTimeline(); // Refresh timeline
      this.closeModal();
    } catch (error) {
      console.error("Error creating post:", error);
      SocialUtils.showError("Failed to create post");
    }
  }

  async toggleLike(postId) {
    try {
      await SocialUtils.makeApiCall(`/api/v1/posts/${postId}/like`, {
        method: "POST",
      });

      this.loadTimeline(); // Refresh to show updated like count
    } catch (error) {
      console.error("Error toggling like:", error);
      SocialUtils.showError("Failed to update like");
    }
  }

  async followUser(userId) {
    try {
      await SocialUtils.makeApiCall(`/api/v1/users/${userId}/follow`, {
        method: "POST",
      });

      SocialUtils.showSuccess("User followed successfully!");
      this.loadSuggestedUsers(); // Refresh suggested users
    } catch (error) {
      console.error("Error following user:", error);
      SocialUtils.showError("Failed to follow user");
    }
  }

  async showComments(postId) {
    try {
      const comments = await SocialUtils.makeApiCall(
        `/api/v1/posts/${postId}/comments`
      );
      this.renderCommentsModal(postId, comments);
    } catch (error) {
      console.error("Error loading comments:", error);
      SocialUtils.showError("Failed to load comments");
    }
  }

  renderCommentsModal(postId, comments) {
    const modal = document.getElementById("modal");
    if (!modal) return;

    const commentsHtml = comments
      .map(
        (comment) => `
        <div class="comment" data-comment-id="${comment._id}">
          <div class="comment-avatar">
            <div class="user-avatar">
              ${
                comment.author.username
                  ? comment.author.username.charAt(0).toUpperCase()
                  : "U"
              }
            </div>
          </div>
          <div class="comment-body">
            <div class="comment-header">
              <span class="comment-author">${comment.author.username}</span>
              <span class="comment-time">${SocialUtils.formatDate(
                comment.createdAt
              )}</span>
            </div>
            <div class="comment-content">${comment.text}</div>
            <div class="comment-actions">
              <button class="action-btn like-btn ${
                comment.likes &&
                this.currentUser &&
                comment.likes.includes(this.currentUser._id)
                  ? "liked"
                  : ""
              }" onclick="mainApp.toggleCommentLike('${comment._id}')">
                <i>${
                  comment.likes &&
                  this.currentUser &&
                  comment.likes.includes(this.currentUser._id)
                    ? "❤️"
                    : "🤍"
                }</i> <span>${comment.likes ? comment.likes.length : 0}</span>
              </button>
            </div>
          </div>
        </div>
      `
      )
      .join("");

    modal.innerHTML = `
      <div class="modal-content">
        <div class="modal-header">
          <h3>Comments</h3>
          <button class="close-modal">&times;</button>
        </div>
        <div class="modal-body">
          <div class="comments-list">
            ${commentsHtml || "<p>No comments yet.</p>"}
          </div>
          <form class="comment-form" onsubmit="mainApp.handleCreateComment(event, '${postId}')">
            <div class="comment-input">
              <textarea placeholder="Tweet your reply" required></textarea>
              <button type="submit">Reply</button>
            </div>
          </form>
        </div>
      </div>
    `;

    modal.style.display = "block";
  }

  async handleCreateComment(e, postId) {
    e.preventDefault();

    const textarea = e.target.querySelector("textarea");
    const content = textarea.value.trim();

    if (!content) {
      SocialUtils.showError("Please enter a comment");
      return;
    }

    try {
      await SocialUtils.makeApiCall(`/api/v1/posts/${postId}/comments`, {
        method: "POST",
        body: JSON.stringify({ text: content }),
      });

      SocialUtils.showSuccess("Comment added successfully!");
      this.showComments(postId); // Refresh comments
    } catch (error) {
      console.error("Error creating comment:", error);
      SocialUtils.showError("Failed to add comment");
    }
  }

  async toggleCommentLike(commentId) {
    try {
      await SocialUtils.makeApiCall(`/api/v1/comments/${commentId}/like`, {
        method: "POST",
      });

      // Find the current post ID to refresh comments
      const modal = document.getElementById("modal");
      const commentForm = modal.querySelector(".comment-form");
      if (commentForm) {
        const postId = commentForm
          .getAttribute("onsubmit")
          .match(/'([^']+)'/)[1];
        this.showComments(postId);
      }
    } catch (error) {
      console.error("Error toggling comment like:", error);
      SocialUtils.showError("Failed to update like");
    }
  }

  showCreatePostModal() {
    const modal = document.getElementById("modal");
    if (!modal) return;

    modal.innerHTML = `
      <div class="modal-content">
        <div class="modal-header">
          <h3>Create Post</h3>
          <button class="close-modal">&times;</button>
        </div>
        <div class="modal-body">
          <form class="create-post-form" onsubmit="mainApp.handleCreatePost(event)">
            <div class="post-input">
              <textarea placeholder="What's happening?" required></textarea>
              <button type="submit">Tweet</button>
            </div>
          </form>
        </div>
      </div>
    `;

    modal.style.display = "block";
  }

  closeModal() {
    const modal = document.getElementById("modal");
    if (modal) {
      modal.style.display = "none";
    }
  }

  handleLogout() {
    SocialUtils.clearAuth();
    SocialUtils.showSuccess("Logged out successfully!");
    setTimeout(() => {
      SocialUtils.redirectToLogin();
    }, 1000);
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
    // Navigate to explore page
    window.location.href = "explore.html";
  }
}

// Initialize the main app when the DOM is loaded
let mainApp;
document.addEventListener("DOMContentLoaded", () => {
  mainApp = new MainApp();
});
