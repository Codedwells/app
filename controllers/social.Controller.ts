import { Response } from "express";
import { User, Post, Comment, UserPostHistory } from "../models";
import { Types } from "mongoose";
import { AuthenticatedRequest } from "../middleware/auth";
import { recommendationService } from "../services/recommendationService";

// Get user timeline (posts from followed users + own posts)
export async function getTimeline(
  req: AuthenticatedRequest,
  res: Response
): Promise<void> {
  try {
    const userId = req.user._id;
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;
    const skip = (page - 1) * limit;

    const user = await User.findById(userId);
    if (!user) {
      res.status(404).json({ error: "User not found" });
      return;
    }

    // Get posts from followed users + own posts
    const followingIds = [...user.following, user._id];

    const posts = await Post.find({
      author: { $in: followingIds },
      visibility: { $in: ["public", "followers"] },
    })
      .populate("author", "username fullName profilePicture isVerified")
      .populate("category", "name")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean();

    res.json(posts);
  } catch (error) {
    console.error("Error getting timeline:", error);
    res.status(500).json({ error: "Failed to get timeline" });
  }
}

// Get suggested users to follow
export async function getSuggestedUsers(
  req: AuthenticatedRequest,
  res: Response
): Promise<void> {
  try {
    const userId = req.user._id;
    const limit = parseInt(req.query.limit as string) || 20;

    const user = await User.findById(userId);
    if (!user) {
      res.status(404).json({ error: "User not found" });
      return;
    }

    // Find users with similar interests who are not already followed
    const suggestedUsers = await User.find({
      _id: {
        $ne: user._id,
        $nin: user.following,
      },
      interests: { $in: user.interests },
    })
      .select(
        "username fullName profilePicture bio followers isVerified interests"
      )
      .populate("interests", "name")
      .sort({ followers: -1 })
      .limit(limit)
      .lean();

    res.json(suggestedUsers);
  } catch (error) {
    console.error("Error getting suggested users:", error);
    res.status(500).json({ error: "Failed to get suggested users" });
  }
}

// Like a post
export async function likePost(
  req: AuthenticatedRequest,
  res: Response
): Promise<void> {
  try {
    const { postId } = req.params;
    const userId = req.user._id;

    const post = await Post.findById(postId);
    if (!post) {
      res.status(404).json({ error: "Post not found" });
      return;
    }

    const userObjectId = new Types.ObjectId(userId);
    const hasLiked = post.likes.some((id) => id.equals(userObjectId));

    if (hasLiked) {
      // Unlike
      post.likes = post.likes.filter((id) => !id.equals(userObjectId));
    } else {
      // Like
      post.likes.push(userObjectId);
    }

    await post.save();

    res.json({
      liked: !hasLiked,
      likeCount: post.likes.length,
    });
  } catch (error) {
    console.error("Error liking post:", error);
    res.status(500).json({ error: "Failed to like post" });
  }
}

// Comment on a post
export async function commentOnPost(
  req: AuthenticatedRequest,
  res: Response
): Promise<void> {
  try {
    const { postId } = req.params;
    const { content } = req.body;
    const userId = req.user._id;

    if (!content) {
      res.status(400).json({ error: "Comment content is required" });
      return;
    }

    const post = await Post.findById(postId);
    if (!post) {
      res.status(404).json({ error: "Post not found" });
      return;
    }

    const comment = new Comment({
      post: postId,
      author: userId,
      text: content.trim(),
    });

    await comment.save();

    // Populate the comment with author info
    await comment.populate(
      "author",
      "username fullName profilePicture isVerified"
    );

    res.status(201).json(comment);
  } catch (error) {
    console.error("Error commenting on post:", error);
    res.status(500).json({ error: "Failed to comment on post" });
  }
}

// Get comments for a post
export async function getPostComments(
  req: AuthenticatedRequest,
  res: Response
): Promise<void> {
  try {
    const { postId } = req.params;
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const skip = (page - 1) * limit;

    const comments = await Comment.find({
      post: postId,
      parentComment: { $exists: false }, // Only top-level comments
    })
      .populate("author", "username fullName profilePicture isVerified")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean();

    res.json(comments);
  } catch (error) {
    console.error("Error getting post comments:", error);
    res.status(500).json({ error: "Failed to get post comments" });
  }
}

// Follow a user
export async function followUser(
  req: AuthenticatedRequest,
  res: Response
): Promise<void> {
  try {
    const { userIdToFollow } = req.params;
    const userId = req.user._id;

    if (userId.toString() === userIdToFollow) {
      res.status(400).json({ error: "Cannot follow yourself" });
      return;
    }

    const [user, userToFollow] = await Promise.all([
      User.findById(userId),
      User.findById(userIdToFollow),
    ]);

    if (!user || !userToFollow) {
      res.status(404).json({ error: "User not found" });
      return;
    }

    const userObjectId = new Types.ObjectId(userId);
    const userToFollowObjectId = new Types.ObjectId(userIdToFollow);

    const isFollowing = user.following.some((id) =>
      id.equals(userToFollowObjectId)
    );

    if (isFollowing) {
      // Unfollow
      user.following = user.following.filter(
        (id) => !id.equals(userToFollowObjectId)
      );
      userToFollow.followers = userToFollow.followers.filter(
        (id) => !id.equals(userObjectId)
      );
    } else {
      // Follow
      user.following.push(userToFollowObjectId);
      userToFollow.followers.push(userObjectId);
    }

    await Promise.all([user.save(), userToFollow.save()]);

    res.json({
      following: !isFollowing,
      followerCount: userToFollow.followers.length,
      followingCount: user.following.length,
    });
  } catch (error) {
    console.error("Error following user:", error);
    res.status(500).json({ error: "Failed to follow user" });
  }
}

// Get user profile
export async function getUserProfile(
  req: AuthenticatedRequest,
  res: Response
): Promise<void> {
  try {
    const { userId } = req.params;

    const user = await User.findById(userId)
      .populate("interests", "name")
      .select("-password")
      .lean();

    if (!user) {
      res.status(404).json({ error: "User not found" });
      return;
    }

    // Get user's recent posts
    const posts = await Post.find({ author: userId })
      .populate("category", "name")
      .sort({ createdAt: -1 })
      .limit(10)
      .lean();

    res.json({
      user,
      posts,
    });
  } catch (error) {
    console.error("Error getting user profile:", error);
    res.status(500).json({ error: "Failed to get user profile" });
  }
}

// Create a new post
export async function createPost(
  req: AuthenticatedRequest,
  res: Response
): Promise<void> {
  try {
    const { content, media, categoryId, hashtags } = req.body;
    const userId = req.user._id;

    if (!content) {
      res.status(400).json({ error: "Post content is required" });
      return;
    }

    // Map content to text as expected by the Post model
    const post = new Post({
      author: userId,
      text: content.trim(), // Map content from request to text field in model
      media,
      category: categoryId,
      hashtags: hashtags || [],
      visibility: "public",
    });

    await post.save();
    await post.populate([
      { path: "author", select: "username fullName profilePicture isVerified" },
      { path: "category", select: "name" },
    ]);

    res.status(201).json(post);
  } catch (error) {
    console.error("Error creating post:", error);
    res.status(500).json({ error: "Failed to create post" });
  }
}

// Like a comment
export async function likeComment(
  req: AuthenticatedRequest,
  res: Response
): Promise<void> {
  try {
    const { commentId } = req.params;
    const userId = req.user._id;

    const comment = await Comment.findById(commentId);
    if (!comment) {
      res.status(404).json({ error: "Comment not found" });
      return;
    }

    const userObjectId = new Types.ObjectId(userId);
    const hasLiked = comment.likes.some((id) => id.equals(userObjectId));

    if (hasLiked) {
      // Unlike
      comment.likes = comment.likes.filter((id) => !id.equals(userObjectId));
    } else {
      // Like
      comment.likes.push(userObjectId);
    }

    await comment.save();

    res.json({
      liked: !hasLiked,
      likeCount: comment.likes.length,
    });
  } catch (error) {
    console.error("Error liking comment:", error);
    res.status(500).json({ error: "Failed to like comment" });
  }
}

// AI-powered recommendation endpoints

// Get AI-recommended timeline
export async function getRecommendedTimeline(
  req: AuthenticatedRequest,
  res: Response
): Promise<void> {
  try {
    const userId = req.user._id.toString();
    const limit = parseInt(req.query.limit as string) || 20;

    // Get user's seen posts history
    const userHistory = await UserPostHistory.findOne({ user: userId });
    const seenPostIds = userHistory?.seenPosts || [];

    // Try to get AI recommendations first
    try {
      const aiRecommendations =
        await recommendationService.getRecommendedTimeline(userId, limit * 2);

      if (aiRecommendations.timeline && aiRecommendations.timeline.length > 0) {
        // Filter out seen posts from AI recommendations
        const unseenRecommendations = aiRecommendations.timeline.filter(
          (p) => !seenPostIds.some((seenId) => seenId.toString() === p.post_id)
        );

        if (unseenRecommendations.length > 0) {
          // Get full post details from MongoDB using the recommended post IDs
          const postIds = unseenRecommendations.map((p) => p.post_id);
          const posts = await Post.find({ _id: { $in: postIds } })
            .populate("author", "username fullName profilePicture isVerified")
            .populate("category", "name")
            .lean();

          // Merge AI scores with full post data
          const enrichedPosts = posts.map((post) => {
            const aiPost = unseenRecommendations.find(
              (p) => p.post_id === post._id.toString()
            );
            return {
              ...post,
              aiScore: aiPost?.score || 0,
            };
          });

          // Sort by AI score and limit results
          enrichedPosts.sort((a, b) => (b.aiScore || 0) - (a.aiScore || 0));

          res.json(enrichedPosts.slice(0, limit));
          return;
        }
      }
    } catch (aiError) {
      console.warn(
        "AI recommendation service unavailable, falling back to traditional timeline:",
        aiError
      );
    }

    // Fallback to traditional timeline if AI service fails
    await getTimeline(req, res);
  } catch (error) {
    console.error("Error getting recommended timeline:", error);
    res.status(500).json({ error: "Failed to get recommended timeline" });
  }
}

// Helper function to get time-filtered posts
async function getTimeFilteredPosts(
  userId: string,
  userInterests: Types.ObjectId[],
  seenPostIds: Types.ObjectId[],
  limit: number
): Promise<any[]> {
  const now = new Date();

  // First try: Posts from past 3 days
  const threeDaysAgo = new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000);

  let posts = await Post.find({
    visibility: "public",
    author: { $ne: userId },
    _id: { $nin: seenPostIds }, // Exclude seen posts
    createdAt: { $gte: threeDaysAgo },
    ...(userInterests?.length ? { category: { $in: userInterests } } : {}),
  })
    .populate("author", "username fullName profilePicture isVerified")
    .populate("category", "name")
    .sort({ likeCount: -1, createdAt: -1 })
    .limit(limit * 2) // Get more to account for filtering
    .lean();

  // If we don't have enough posts, try past 5 days
  if (posts.length < limit) {
    const fiveDaysAgo = new Date(now.getTime() - 5 * 24 * 60 * 60 * 1000);

    const additionalPosts = await Post.find({
      visibility: "public",
      author: { $ne: userId },
      _id: { $nin: [...seenPostIds, ...posts.map((p) => p._id)] }, // Exclude seen posts and already fetched posts
      createdAt: { $gte: fiveDaysAgo, $lt: threeDaysAgo }, // Only posts from 3-5 days ago
      ...(userInterests?.length ? { category: { $in: userInterests } } : {}),
    })
      .populate("author", "username fullName profilePicture isVerified")
      .populate("category", "name")
      .sort({ likeCount: -1, createdAt: -1 })
      .limit(limit * 2)
      .lean();

    posts = [...posts, ...additionalPosts];
  }

  return posts.slice(0, limit);
}

// Get explore page (predicted likes)
export async function getExplorePosts(
  req: AuthenticatedRequest,
  res: Response
): Promise<void> {
  try {
    const userId = req.user._id.toString();
    const limit = parseInt(req.query.limit as string) || 15;

    // Get user's seen posts history
    const userHistory = await UserPostHistory.findOne({ user: userId });
    const seenPostIds = userHistory?.seenPosts || [];

    // Try to get AI predictions first
    try {
      const aiPredictions = await recommendationService.getPredictedLikes(
        userId,
        limit * 2 // Get more predictions to account for filtering
      );

      if (aiPredictions.predictions && aiPredictions.predictions.length > 0) {
        // Filter out seen posts from AI predictions
        const unseenPredictions = aiPredictions.predictions.filter(
          (p) => !seenPostIds.some((seenId) => seenId.toString() === p.post_id)
        );

        if (unseenPredictions.length > 0) {
          // Get full post details from MongoDB
          const postIds = unseenPredictions.map((p) => p.post_id);
          const posts = await Post.find({ _id: { $in: postIds } })
            .populate("author", "username fullName profilePicture isVerified")
            .populate("category", "name")
            .lean();

          // Merge AI scores with full post data
          const enrichedPosts = posts.map((post) => {
            const aiPost = unseenPredictions.find(
              (p) => p.post_id === post._id.toString()
            );
            return {
              ...post,
              predictedScore: aiPost?.score || 0,
            };
          });

          // Sort by predicted score and limit results
          enrichedPosts.sort(
            (a, b) => (b.predictedScore || 0) - (a.predictedScore || 0)
          );

          res.json(enrichedPosts.slice(0, limit));
          return;
        }
      }
    } catch (aiError) {
      console.warn(
        "AI prediction service unavailable, falling back to time-filtered posts:",
        aiError
      );
    }

    // Fallback: Get time-filtered posts
    const user = await User.findById(userId);
    const fallbackPosts = await getTimeFilteredPosts(
      userId,
      user?.interests || [],
      seenPostIds,
      limit
    );

    res.json(fallbackPosts);
  } catch (error) {
    console.error("Error getting explore posts:", error);
    res.status(500).json({ error: "Failed to get explore posts" });
  }
}

// Get AI-recommended users to follow
export async function getRecommendedUsers(
  req: AuthenticatedRequest,
  res: Response
): Promise<void> {
  try {
    const userId = req.user._id.toString();
    const limit = parseInt(req.query.limit as string) || 10;

    // Try to get AI recommendations first
    try {
      const aiRecommendations = await recommendationService.getRecommendedUsers(
        userId,
        limit
      );

      if (
        aiRecommendations.suggested_users &&
        aiRecommendations.suggested_users.length > 0
      ) {
        // Get full user details from MongoDB
        const userIds = aiRecommendations.suggested_users.map((u) => u.user_id);
        const users = await User.find({ _id: { $in: userIds } })
          .select(
            "username fullName profilePicture bio followerCount followingCount isVerified interests"
          )
          .populate("interests", "name")
          .lean();

        // Merge AI scores with full user data
        const enrichedUsers = users.map((user) => {
          const aiUser = aiRecommendations.suggested_users.find(
            (u) => u.user_id === user._id.toString()
          );
          return {
            ...user,
            recommendationScore: aiUser?.score || 0,
            sharedInterests: aiUser?.shared_interests || 0,
          };
        });

        // Sort by recommendation score
        enrichedUsers.sort(
          (a, b) => (b.recommendationScore || 0) - (a.recommendationScore || 0)
        );

        res.json(enrichedUsers);
        return;
      }
    } catch (aiError) {
      console.warn(
        "AI recommendation service unavailable, falling back to traditional suggestions:",
        aiError
      );
    }

    // Fallback to traditional user suggestions
    await getSuggestedUsers(req, res);
  } catch (error) {
    console.error("Error getting recommended users:", error);
    res.status(500).json({ error: "Failed to get recommended users" });
  }
}

// Train the recommendation model (admin endpoint)
export async function trainRecommendationModel(
  req: AuthenticatedRequest,
  res: Response
): Promise<void> {
  try {
    // Check if user is admin (you might want to add admin role check here)
    const trainingResult = await recommendationService.trainModel();
    res.json(trainingResult);
  } catch (error) {
    console.error("Error training recommendation model:", error);
    res.status(500).json({ error: "Failed to train recommendation model" });
  }
}

// Get recommendation model status
export async function getRecommendationModelStatus(
  req: AuthenticatedRequest,
  res: Response
): Promise<void> {
  try {
    const status = await recommendationService.getModelStatus();
    res.json(status);
  } catch (error) {
    console.error("Error getting model status:", error);
    res.status(500).json({ error: "Failed to get model status" });
  }
}
