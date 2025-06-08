import { Request, Response, Router } from "express";
import {
  listVideos,
  transcodeAndUpload,
} from "../controllers/upload.Controller";
import {
  getTimeline,
  getSuggestedUsers,
  likePost,
  commentOnPost,
  getPostComments,
  followUser,
  getUserProfile,
  createPost,
  likeComment,
  getRecommendedTimeline,
  getExplorePosts,
  getRecommendedUsers,
  trainRecommendationModel,
  getRecommendationModelStatus,
} from "../controllers/social.Controller";
import {
  recordSeenPosts,
  getUserSeenPosts,
  clearSeenPosts,
} from "../controllers/userHistory.Controller";
import {
  loginUser,
  getAllUsers,
  getAllCategories,
} from "../controllers/auth.Controller";
import { authenticateToken } from "../middleware/auth";
import multer from "multer";

const router = Router();
const upload = multer({ dest: "uploads/" });

router.post(
  "/upload",
  upload.single("video"),
  async (req: Request, res: Response): Promise<void> => {
    try {
      if (!req.file) {
        res.status(400).json({ error: "No file uploaded" });
        return;
      }
      // Get the packager type from the form data (default to ffmpeg if not provided)
      const packager = req.body.packager || "ffmpeg";
      await transcodeAndUpload(req.file.path, req.file.originalname, packager);
      res.redirect("/");
    } catch (err) {
      console.error(err);
      // Provide more detailed error message
      const errorMessage =
        err instanceof Error ? err.message : "Failed to upload video";
      res.status(500).json({
        error: errorMessage,
        packager: req.body.packager || "ffmpeg",
      });
    }
  }
);

router.get("/videos", async (_, res) => {
  const videos = await listVideos();
  res.status(200).json(videos);
});

// Authentication routes (public)
router.post("/auth/login", loginUser);
router.get("/users", getAllUsers);
router.get("/categories", getAllCategories);

// Social media routes (protected)
router.get("/timeline", authenticateToken, getTimeline);
router.get("/users/suggested", authenticateToken, getSuggestedUsers);
router.get("/users/:userId", authenticateToken, getUserProfile);
router.post("/posts", authenticateToken, createPost);
router.post("/posts/:postId/like", authenticateToken, likePost);
router.post("/posts/:postId/comments", authenticateToken, commentOnPost);
router.get("/posts/:postId/comments", authenticateToken, getPostComments);
router.post("/comments/:commentId/like", authenticateToken, likeComment);
router.post("/users/:userIdToFollow/follow", authenticateToken, followUser);

// AI-powered recommendation routes (protected)
router.get("/ai/timeline", authenticateToken, getRecommendedTimeline);
router.get("/ai/explore", authenticateToken, getExplorePosts);
router.get("/ai/users/recommended", authenticateToken, getRecommendedUsers);
router.get("/ai/model/status", authenticateToken, getRecommendationModelStatus);
router.post("/ai/model/train", authenticateToken, trainRecommendationModel);

// User post history routes (protected)
router.post("/user/seen-posts", authenticateToken, recordSeenPosts);
router.get("/user/seen-posts", authenticateToken, getUserSeenPosts);
router.delete("/user/seen-posts", authenticateToken, clearSeenPosts);

export default router;
