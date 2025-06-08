import axios from "axios";
import { ENV } from "../lib/environments";

// Configuration for the Python recommendation service
const RECOMMENDATION_SERVICE_URL = ENV.RECOMMENDATION_SERVICE_URL;

export interface RecommendationPost {
  post_id: string;
  text: string;
  author: string;
  category?: string;
  likeCount: number;
  commentCount: number;
  shareCount: number;
  hashtags: string[];
  createdAt: Date;
  media?: any[];
  score?: number;
}

export interface RecommendationUser {
  user_id: string;
  username: string;
  fullName: string;
  bio: string;
  followerCount: number;
  followingCount: number;
  isVerified: boolean;
  profilePicture?: string;
  score: number;
  shared_interests: number;
}

export interface TimelineResponse {
  timeline: RecommendationPost[];
}

export interface PredictionsResponse {
  predictions: RecommendationPost[];
}

export interface SuggestedUsersResponse {
  suggested_users: RecommendationUser[];
}

export interface ExploreResponse {
  explore: RecommendationPost[];
}

export interface TrainingResponse {
  status: string;
  total_samples?: number;
  positive_samples?: number;
  negative_samples?: number;
  message?: string;
}

export interface ModelStatusResponse {
  trained: boolean;
  user_features: number;
  post_features: number;
  accuracy?: number;
  precision?: number;
  recall?: number;
  training_samples?: number;
}

class RecommendationService {
  private baseURL: string;

  constructor() {
    this.baseURL = RECOMMENDATION_SERVICE_URL;
  }

  async getRecommendedTimeline(
    userId: string,
    limit: number = 20
  ): Promise<TimelineResponse> {
    try {
      const response = await axios.get(
        `${this.baseURL}/recommend/timeline/${userId}?limit=${limit}`,
        {
          timeout: 10000, // 10 second timeout
        }
      );
      return response.data;
    } catch (error) {
      console.error("Error fetching recommended timeline:", error);
      throw new Error("Failed to fetch recommended timeline");
    }
  }

  async getPredictedLikes(
    userId: string,
    limit: number = 10
  ): Promise<PredictionsResponse> {
    try {
      const response = await axios.get(
        `${this.baseURL}/predict/${userId}?limit=${limit}`,
        {
          timeout: 10000,
        }
      );
      return response.data;
    } catch (error) {
      console.error("Error fetching predicted likes:", error);
      throw new Error("Failed to fetch predicted likes");
    }
  }

  async getExploreRecommendations(
    userId: string,
    limit: number = 30
  ): Promise<ExploreResponse> {
    try {
      const response = await axios.get(
        `${this.baseURL}/recommend/explore/${userId}?limit=${limit}`,
        {
          timeout: 10000,
        }
      );
      return response.data;
    } catch (error) {
      console.error("Error fetching explore recommendations:", error);
      throw new Error("Failed to fetch explore recommendations");
    }
  }

  async getRecommendedUsers(
    userId: string,
    limit: number = 10
  ): Promise<SuggestedUsersResponse> {
    try {
      const response = await axios.get(
        `${this.baseURL}/recommend/users/${userId}?limit=${limit}`,
        {
          timeout: 10000,
        }
      );
      return response.data;
    } catch (error) {
      console.error("Error fetching recommended users:", error);
      throw new Error("Failed to fetch recommended users");
    }
  }

  async trainModel(): Promise<TrainingResponse> {
    try {
      const response = await axios.post(
        `${this.baseURL}/train`,
        {},
        {
          timeout: 60000, // 60 second timeout for training
        }
      );
      return response.data;
    } catch (error) {
      console.error("Error training model:", error);
      throw new Error("Failed to train model");
    }
  }

  async getModelStatus(): Promise<ModelStatusResponse> {
    try {
      const response = await axios.get(`${this.baseURL}/model/status`, {
        timeout: 5000,
      });
      return response.data;
    } catch (error) {
      console.error("Error getting model status:", error);
      throw new Error("Failed to get model status");
    }
  }

  async healthCheck(): Promise<{
    status: string;
    model_trained: boolean;
    database_connected: boolean;
  }> {
    try {
      const response = await axios.get(`${this.baseURL}/health`, {
        timeout: 5000,
      });
      return response.data;
    } catch (error) {
      console.error("Error checking recommendation service health:", error);
      throw new Error("Recommendation service is not available");
    }
  }
}

export const recommendationService = new RecommendationService();
