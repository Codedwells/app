class ProfileApp {
  constructor() {
    this.currentUser = null;
    this.profileUser = null;
    this.profileUserId = null;
    this.init();
  }

  init() {
    // Check authentication first
    if (!SocialUtils.isAuthenticated()) {
      SocialUtils.redirectToLogin();
      return;
    }

    this.currentUser = SocialUtils.getCurrentUser();
    this.profileUserId = this.getProfileUserIdFromUrl();
    this.bindEvents();
    this.loadInitialContent();
  }

  getProfileUserIdFromUrl() {
    const urlParams = new URLSearchParams(window.location.search);
    return urlParams.get("userId") || this.currentUser?._id;
  }

  bindEvents() {
    // Navigation events
    this.bindNavigationEvents();

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
  }

  bindNavigationEvents() {
    // Home navigation
    const homeNav = document.querySelector('.nav-item a[href="index.html"]');
    if (homeNav) {
      homeNav.addEventListener("click", (e) => {
        e.preventDefault();
        window.location.href = "index.html";
      });
    }

    // Explore navigation
    const exploreNavs = document.querySelectorAll(".nav-item a");
    exploreNavs.forEach((nav) => {
      if (nav.textContent.includes("Explore")) {
        nav.addEventListener("click", (e) => {
          e.preventDefault();
          window.location.href = "explore.html";
        });
      }
    });
  }

  async loadInitialContent() {
    this.renderUserInfo();
    await this.loadUserProfile();
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

  async loadUserProfile() {
    try {
      const response = await SocialUtils.makeApiCall(
        `/api/v1/users/${this.profileUserId}`
      );
      this.profileUser = response.user;
      const posts = response.posts || [];

      this.renderProfileInfo(this.profileUser);
      this.renderUserPosts(posts);
    } catch (error) {
      console.error("Error loading user profile:", error);
      SocialUtils.showError("Failed to load profile");

      const appMain = document.querySelector(".app-main");
      if (appMain) {
        appMain.innerHTML = `
          <div class="error-message">
            <h3>Profile not found</h3>
            <p>The user you're looking for doesn't exist or has been removed.</p>
            <a href="index.html" class="btn">Go back to home</a>
          </div>
        `;
      }
    }
  }

  renderProfileInfo(user) {
    const appMain = document.querySelector(".app-main");
    if (!appMain || !user) return;

    const isOwnProfile = this.currentUser && this.currentUser._id === user._id;

    appMain.innerHTML = `
      <header class="app-header">
        <h2>Profile</h2>
      </header>
      <div class="profile-info">
        <div class="profile-header">
          <div class="profile-avatar">
            <div class="user-avatar large">
              ${user.username ? user.username.charAt(0).toUpperCase() : "U"}
            </div>
          </div>
          <div class="profile-details">
            <div class="profile-names">
              <h1>${user.fullName || user.username}</h1>
              <span class="profile-username">@${user.username}</span>
            </div>
            ${user.bio ? `<div class="profile-bio">${user.bio}</div>` : ""}
            <div class="profile-stats">
              <span><strong>${user.followerCount || 0}</strong> Followers</span>
              <span><strong>${
                user.followingCount || 0
              }</strong> Following</span>
              <span><strong>${user.postsCount || 0}</strong> Posts</span>
            </div>
            ${
              user.interests && user.interests.length > 0
                ? `<div class="profile-interests">
                    <h4>Interests</h4>
                    <div class="interest-tags">
                      ${user.interests
                        .map(
                          (interest) =>
                            `<span class="interest-tag">${interest.name}</span>`
                        )
                        .join("")}
                    </div>
                  </div>`
                : ""
            }
            ${
              !isOwnProfile
                ? `
              <div class="profile-actions">
                <button class="follow-btn ${
                  user.isFollowing ? "following" : ""
                }" 
                        onclick="profileApp.toggleFollow('${user._id}')">
                  ${user.isFollowing ? "Following" : "Follow"}
                </button>
              </div>
            `
                : ""
            }
          </div>
        </div>
      </div>
      <div class="profile-tabs">
        <div class="tab-list">
          <button class="tab-btn active" data-tab="posts">Posts</button>
          <button class="tab-btn" data-tab="replies">Replies</button>
          <button class="tab-btn" data-tab="media">Media</button>
          <button class="tab-btn" data-tab="likes">Likes</button>
        </div>
      </div>
      <main class="timeline" id="userPosts">
        <div class="loading">Loading posts...</div>
      </main>
    `;

    // Bind tab events
    const tabBtns = document.querySelectorAll(".tab-btn");
    tabBtns.forEach((btn) => {
      btn.addEventListener("click", (e) => {
        tabBtns.forEach((b) => b.classList.remove("active"));
        e.target.classList.add("active");
        // For now, only posts tab is implemented
        if (e.target.dataset.tab === "posts") {
          this.loadUserProfile();
        }
      });
    });
  }

  renderUserPosts(posts) {
    const userPosts = document.getElementById("userPosts");
    if (!userPosts) return;

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

    userPosts.innerHTML = posts.map((post) => this.renderPost(post)).join("");

    // Initialize post view tracking for all rendered posts
    SocialUtils.postViewTracker.observeAllPosts();
  }

  renderPost(post) {
    return `
      <div class="post" data-post-id="${post._id}">
        <div class="post-avatar">
          ${
            post.author &&
            typeof post.author === "object" &&
            post.author.profilePicture
              ? `<div class="user-avatar has-image">
                <img src="${
                  post.author.profilePicture
                }" alt="${this.getAuthorUsername(post.author)}">
              </div>`
              : `<div class="user-avatar">
                ${this.getAuthorInitial(post.author)}
              </div>`
          }
        </div>
        <div class="post-body">
          <div class="post-header">
            <div class="post-user-info">
              <a href="profile.html?userId=${this.getAuthorId(
                post.author
              )}" class="post-author">
                ${this.getAuthorName(post.author)}
              </a>
              <span class="post-username">@${this.getAuthorUsername(
                post.author
              )}</span>
              <span class="post-time">· ${SocialUtils.formatDate(
                post.createdAt
              )}</span>
              ${
                post.category
                  ? `<span class="post-category">${post.category.name}</span>`
                  : ""
              }
            </div>
            <div class="post-more">
              <span>•••</span>
            </div>
          </div>
          <div class="post-content">
            <p>${SocialUtils.formatContent(post.text || post.content)}</p>
            ${this.renderPostMedia(post.media)}
          </div>
          <div class="post-actions">
            <button class="action-btn reply-btn" onclick="profileApp.showComments('${
              post._id
            }')">
              <i>💬</i> <span>${post.commentCount || 0}</span>
            </button>
            <button class="action-btn retweet-btn">
              <i>🔄</i> <span>${post.shareCount || 0}</span>
            </button>
            <button class="action-btn like-btn ${
              this.isPostLiked(post) ? "liked" : ""
            }" 
                    onclick="profileApp.toggleLike('${post._id}')">
              <i>${this.isPostLiked(post) ? "❤️" : "🤍"}</i> 
              <span>${
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

  getAuthorInitial(author) {
    if (typeof author === "string") return author.charAt(0).toUpperCase();
    return author?.username ? author.username.charAt(0).toUpperCase() : "U";
  }

  getAuthorName(author) {
    if (typeof author === "string") return author;
    return author?.username || "Unknown User";
  }

  getAuthorUsername(author) {
    if (typeof author === "string")
      return author.toLowerCase().replace(/\s+/g, "");
    return author?.username
      ? author.username.toLowerCase().replace(/\s+/g, "")
      : "user";
  }

  getAuthorId(author) {
    if (typeof author === "string") return author;
    return author?._id || "";
  }

  isPostLiked(post) {
    return (
      post.likes &&
      this.currentUser &&
      post.likes.includes(this.currentUser._id)
    );
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

  async toggleFollow(userId) {
    try {
      await SocialUtils.makeApiCall(`/api/v1/users/${userId}/follow`, {
        method: "POST",
      });

      SocialUtils.showSuccess("Follow status updated!");
      this.loadUserProfile(); // Refresh profile to show updated follow status
    } catch (error) {
      console.error("Error toggling follow:", error);
      SocialUtils.showError("Failed to update follow status");
    }
  }

  async toggleLike(postId) {
    try {
      await SocialUtils.makeApiCall(`/api/v1/posts/${postId}/like`, {
        method: "POST",
      });

      this.loadUserProfile(); // Refresh to show updated like count
    } catch (error) {
      console.error("Error toggling like:", error);
      SocialUtils.showError("Failed to update like");
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
              }" onclick="profileApp.toggleCommentLike('${comment._id}')">
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
          <form class="comment-form" onsubmit="profileApp.handleCreateComment(event, '${postId}')">
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

  closeModal() {
    const modal = document.getElementById("modal");
    if (modal) {
      modal.style.display = "none";
    }
  }

  showCreatePostModal() {
    const modal = document.getElementById("modal");
    modal.innerHTML = `
      <div class="modal-content create-post-modal">
        <div class="modal-header">
          <h3>Create Post</h3>
          <button class="close-modal">&times;</button>
        </div>
        <div class="modal-body">
          <div class="compose-area">
            <div class="compose-avatar">
              <div class="user-avatar">${this.currentUser.username
                .charAt(0)
                .toUpperCase()}</div>
            </div>
            <div class="compose-input">
              <div
                contenteditable="true"
                id="modal-tweet-compose"
                class="tweet-compose-input"
                placeholder="What's happening?"
              ></div>
            </div>
          </div>
        </div>
        <div class="modal-footer">
          <button class="tweet-btn" onclick="app.handleCreatePostFromModal()">Post</button>
        </div>
      </div>
    `;
    modal.style.display = "flex";

    // Focus on the input
    const composeInput = document.getElementById("modal-tweet-compose");
    if (composeInput) {
      composeInput.focus();
    }
  }

  async handleCreatePostFromModal() {
    const composeInput = document.getElementById("modal-tweet-compose");
    if (!composeInput) return;

    const content = composeInput.textContent.trim();
    if (!content) {
      SocialUtils.showError("Please enter some content");
      return;
    }

    try {
      await SocialUtils.makeApiCall("/api/v1/posts", {
        method: "POST",
        body: JSON.stringify({ text: content }),
      });

      SocialUtils.showSuccess("Post created successfully!");
      this.closeModal();
      this.loadInitialContent(); // Refresh the content
    } catch (error) {
      console.error("Error creating post:", error);
      SocialUtils.showError("Failed to create post");
    }
  }

  handleLogout() {
    SocialUtils.clearAuth();
    SocialUtils.showSuccess("Logged out successfully!");
    setTimeout(() => {
      SocialUtils.redirectToLogin();
    }, 1000);
  }
}

// Initialize the profile app when the DOM is loaded
let profileApp;
document.addEventListener("DOMContentLoaded", () => {
  profileApp = new ProfileApp();
});
