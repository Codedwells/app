import mongoose, { Document, Schema, Types } from "mongoose";

export interface IMedia {
  type: "image" | "video";
  url: string;
  thumbnail?: string;
}

export interface IPost extends Document {
  _id: Types.ObjectId;
  author: Types.ObjectId; // Reference to User
  text: string;
  media?: IMedia[];
  likes: Types.ObjectId[]; // References to Users who liked
  likeCount: number;
  commentCount: number;
  shareCount: number;
  isRepost: boolean;
  originalPost?: Types.ObjectId; // Reference to original Post if repost
  category?: Types.ObjectId; // Reference to Category
  hashtags: string[];
  mentions: Types.ObjectId[]; // References to mentioned Users
  visibility: "public" | "private" | "followers";
  createdAt: Date;
  updatedAt: Date;
}

const mediaSchema = new Schema<IMedia>(
  {
    type: {
      type: String,
      enum: ["image", "video"],
      required: true,
    },
    url: {
      type: String,
      required: true,
    },
    thumbnail: {
      type: String,
    },
  },
  { _id: false }
);

const postSchema = new Schema<IPost>(
  {
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
    media: [mediaSchema],
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
    commentCount: {
      type: Number,
      default: 0,
    },
    shareCount: {
      type: Number,
      default: 0,
    },
    isRepost: {
      type: Boolean,
      default: false,
    },
    originalPost: {
      type: Schema.Types.ObjectId,
      ref: "Post",
    },
    category: {
      type: Schema.Types.ObjectId,
      ref: "Category",
    },
    hashtags: [
      {
        type: String,
        trim: true,
        match: /^[a-zA-Z0-9_]+$/,
      },
    ],
    mentions: [
      {
        type: Schema.Types.ObjectId,
        ref: "User",
      },
    ],
    visibility: {
      type: String,
      enum: ["public", "private", "followers"],
      default: "public",
    },
  },
  {
    timestamps: true,
  }
);

// Indexes for better performance
postSchema.index({ author: 1, createdAt: -1 });
postSchema.index({ createdAt: -1 });
postSchema.index({ likes: 1 });
postSchema.index({ hashtags: 1 });
postSchema.index({ category: 1 });
postSchema.index({ visibility: 1 });

// Update like count before saving
postSchema.pre("save", function (next) {
  this.likeCount = this.likes.length;
  next();
});

// Extract hashtags and mentions from text
postSchema.pre("save", function (next) {
  // Extract hashtags
  const hashtagRegex = /#([a-zA-Z0-9_]+)/g;
  const hashtags = [];
  let match;
  while ((match = hashtagRegex.exec(this.text)) !== null) {
    hashtags.push(match[1].toLowerCase());
  }
  this.hashtags = [...new Set(hashtags)]; // Remove duplicates

  next();
});

export const Post = mongoose.model<IPost>("Post", postSchema);
