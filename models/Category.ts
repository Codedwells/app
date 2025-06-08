import mongoose, { Document, Schema } from "mongoose";

export interface ICategory extends Document {
  name: string;
  description?: string;
  createdAt: Date;
  updatedAt: Date;
}

const categorySchema = new Schema<ICategory>(
  {
    name: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      maxlength: 50,
    },
    description: {
      type: String,
      maxlength: 200,
    },
  },
  {
    timestamps: true,
  }
);

export const Category = mongoose.model<ICategory>("Category", categorySchema);
