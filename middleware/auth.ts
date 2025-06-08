import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { User } from "../models";

export interface AuthenticatedRequest extends Request {
  user?: any;
}

export async function authenticateToken(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  const authHeader = req.headers["authorization"];
  const token = authHeader && authHeader.split(" ")[1]; // Bearer TOKEN

  if (!token) {
    res.status(401).json({ error: "Access token required" });
    return;
  }

  try {
    const decoded = jwt.verify(
      token,
      process.env.JWT_SECRET || "your-secret-key"
    ) as any;
    const user = await User.findById(decoded.userId);

    if (!user) {
      res.status(401).json({ error: "Invalid token" });
      return;
    }

    req.user = user;
    next();
  } catch (error) {
    res.status(403).json({ error: "Invalid token" });
    return;
  }
}
