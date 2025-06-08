import mongoose, { Document, Schema, Types } from "mongoose";

export interface IUserPostHistory extends Document {
  _id: Types.ObjectId;
  user: Types.ObjectId; // Reference to User
  seenPosts: Types.ObjectId[]; // Array of Post IDs that the user has seen
  lastUpdated: Date;
  createdAt: Date;
  updatedAt: Date;
}

const userPostHistorySchema = new Schema<IUserPostHistory>(
  {
    user: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      unique: true, // Each user has only one history record
    },
    seenPosts: [
      {
        type: Schema.Types.ObjectId,
        ref: "Post",
      },
    ],
    lastUpdated: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true,
  }
);

// Indexes for better performance
userPostHistorySchema.index({ user: 1 });
userPostHistorySchema.index({ seenPosts: 1 });
userPostHistorySchema.index({ lastUpdated: -1 });

// Update lastUpdated when seenPosts is modified
userPostHistorySchema.pre("save", function (next) {
  if (this.isModified("seenPosts")) {
    this.lastUpdated = new Date();
  }
  next();
});

export const UserPostHistory = mongoose.model<IUserPostHistory>(
  "UserPostHistory",
  userPostHistorySchema
);
