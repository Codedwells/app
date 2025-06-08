import { Request, Response } from "express";
import jwt from "jsonwebtoken";
import { User, Category } from "../models";

// Login user
export async function loginUser(req: Request, res: Response): Promise<void> {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      res.status(400).json({ error: "Username and password are required" });
      return;
    }

    // Find user by username or email
    const user = await User.findOne({
      $or: [
        { username: username.toLowerCase() },
        { email: username.toLowerCase() },
      ],
    }).populate("interests", "name");

    if (!user) {
      res.status(401).json({ error: "Invalid credentials" });
      return;
    }

    // Check password
    const isPasswordValid = await user.comparePassword(password);
    if (!isPasswordValid) {
      res.status(401).json({ error: "Invalid credentials" });
      return;
    }

    // Generate JWT token
    const token = jwt.sign(
      { userId: user._id },
      process.env.JWT_SECRET || "your-secret-key",
      { expiresIn: "7d" }
    );

    // Return user data and token (password is already excluded by toJSON method)
    res.json({
      user,
      token,
      message: "Login successful",
    });
  } catch (error) {
    console.error("Error logging in user:", error);
    res.status(500).json({ error: "Failed to login" });
  }
}

// Get all users (for demo purposes)
export async function getAllUsers(req: Request, res: Response): Promise<void> {
  try {
    const limit = parseInt(req.query.limit as string) || 50;
    const search = req.query.search as string;

    let query = {};
    if (search) {
      query = {
        $or: [
          { username: { $regex: search, $options: "i" } },
          { fullName: { $regex: search, $options: "i" } },
        ],
      };
    }

    const users = await User.find(query)
      .select(
        "username fullName profilePicture bio followerCount followingCount isVerified"
      )
      .sort({ followerCount: -1 })
      .limit(limit)
      .lean();

    res.json({ users });
  } catch (error) {
    console.error("Error getting all users:", error);
    res.status(500).json({ error: "Failed to get users" });
  }
}

// Get all categories
export async function getAllCategories(
  req: Request,
  res: Response
): Promise<void> {
  try {
    const categories = await Category.find({}).sort({ name: 1 }).lean();

    res.json({ categories });
  } catch (error) {
    console.error("Error getting categories:", error);
    res.status(500).json({ error: "Failed to get categories" });
  }
}
