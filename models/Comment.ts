import mongoose, { Document, Schema, Types } from "mongoose";

export interface IComment extends Document {
  _id: Types.ObjectId;
  post: Types.ObjectId; // Reference to Post
  author: Types.ObjectId; // Reference to User
  text: string;
  likes: Types.ObjectId[]; // References to Users who liked
  likeCount: number;
  replies: Types.ObjectId[]; // References to other Comments (for nested comments)
  parentComment?: Types.ObjectId; // Reference to parent Comment if this is a reply
  mentions: Types.ObjectId[]; // References to mentioned Users
  createdAt: Date;
  updatedAt: Date;
}

const commentSchema = new Schema<IComment>(
  {
    post: {
      type: Schema.Types.ObjectId,
      ref: "Post",
      required: true,
    },
    author: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    text: {
      type: String,
      required: true,
      maxlength: 280,
      trim: true,
    },
    likes: [
      {
        type: Schema.Types.ObjectId,
        ref: "User",
      },
    ],
    likeCount: {
      type: Number,
      default: 0,
    },
    replies: [
      {
        type: Schema.Types.ObjectId,
        ref: "Comment",
      },
    ],
    parentComment: {
      type: Schema.Types.ObjectId,
      ref: "Comment",
    },
    mentions: [
      {
        type: Schema.Types.ObjectId,
        ref: "User",
      },
    ],
  },
  {
    timestamps: true,
  }
);

// Indexes for better performance
commentSchema.index({ post: 1, createdAt: -1 });
commentSchema.index({ author: 1, createdAt: -1 });
commentSchema.index({ parentComment: 1 });
commentSchema.index({ createdAt: -1 });

// Update like count before saving
commentSchema.pre("save", function (next) {
  this.likeCount = this.likes.length;
  next();
});

// Extract mentions from text
commentSchema.pre("save", function (next) {
  // Extract mentions (@username)
  const mentionRegex = /@([a-zA-Z0-9_]+)/g;
  const mentions = [];
  let match;
  while ((match = mentionRegex.exec(this.text)) !== null) {
    mentions.push(match[1].toLowerCase());
  }
  // Note: In a real app, you'd want to resolve usernames to user IDs

  next();
});

export const Comment = mongoose.model<IComment>("Comment", commentSchema);
