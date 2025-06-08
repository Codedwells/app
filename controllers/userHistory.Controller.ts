import { Response } from "express";
import { UserPostHistory } from "../models";
import { Types } from "mongoose";
import { AuthenticatedRequest } from "../middleware/auth";

// Record that a user has seen specific posts
export async function recordSeenPosts(
  req: AuthenticatedRequest,
  res: Response
): Promise<void> {
  try {
    const userId = req.user._id;
    const { postIds } = req.body;

    if (!postIds || !Array.isArray(postIds) || postIds.length === 0) {
      res.status(400).json({ error: "postIds array is required" });
      return;
    }

    // Convert string IDs to ObjectIds and validate
    const validPostIds: Types.ObjectId[] = [];
    for (const postId of postIds) {
      if (Types.ObjectId.isValid(postId)) {
        validPostIds.push(new Types.ObjectId(postId));
      }
    }

    if (validPostIds.length === 0) {
      res.status(400).json({ error: "No valid post IDs provided" });
      return;
    }

    // Find or create user post history
    let userHistory = await UserPostHistory.findOne({ user: userId });

    if (!userHistory) {
      // Create new history record
      userHistory = new UserPostHistory({
        user: userId,
        seenPosts: validPostIds,
      });
    } else {
      // Add new post IDs to existing history, avoiding duplicates
      const existingPostIds = new Set(
        userHistory.seenPosts.map((id) => id.toString())
      );
      const newPostIds = validPostIds.filter(
        (id) => !existingPostIds.has(id.toString())
      );

      if (newPostIds.length > 0) {
        userHistory.seenPosts.push(...newPostIds);

        // Optional: Limit history size to prevent unlimited growth
        // Keep only the last 10,000 seen posts
        if (userHistory.seenPosts.length > 10000) {
          userHistory.seenPosts = userHistory.seenPosts.slice(-10000);
        }
      }
    }

    await userHistory.save();

    res.json({
      success: true,
      message: `Recorded ${validPostIds.length} posts as seen`,
      totalSeenPosts: userHistory.seenPosts.length,
    });
  } catch (error) {
    console.error("Error recording seen posts:", error);
    res.status(500).json({ error: "Failed to record seen posts" });
  }
}

// Get user's seen posts (for debugging or analytics)
export async function getUserSeenPosts(
  req: AuthenticatedRequest,
  res: Response
): Promise<void> {
  try {
    const userId = req.user._id;
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 50;
    const skip = (page - 1) * limit;

    const userHistory = await UserPostHistory.findOne({
      user: userId,
    }).populate({
      path: "seenPosts",
      options: {
        sort: { createdAt: -1 },
        skip,
        limit,
      },
      populate: {
        path: "author",
        select: "username fullName profilePicture isVerified",
      },
    });

    if (!userHistory) {
      res.json({
        seenPosts: [],
        totalCount: 0,
        page,
        hasMore: false,
      });
      return;
    }

    const totalCount = userHistory.seenPosts.length;
    const hasMore = skip + limit < totalCount;

    res.json({
      seenPosts: userHistory.seenPosts.slice(skip, skip + limit),
      totalCount,
      page,
      hasMore,
      lastUpdated: userHistory.lastUpdated,
    });
  } catch (error) {
    console.error("Error getting user seen posts:", error);
    res.status(500).json({ error: "Failed to get seen posts" });
  }
}

// Clear user's seen posts history (for testing or user request)
export async function clearSeenPosts(
  req: AuthenticatedRequest,
  res: Response
): Promise<void> {
  try {
    const userId = req.user._id;

    await UserPostHistory.findOneAndUpdate(
      { user: userId },
      { $set: { seenPosts: [], lastUpdated: new Date() } },
      { upsert: true }
    );

    res.json({
      success: true,
      message: "Seen posts history cleared",
    });
  } catch (error) {
    console.error("Error clearing seen posts:", error);
    res.status(500).json({ error: "Failed to clear seen posts" });
  }
}
