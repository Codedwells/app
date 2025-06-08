from fastapi import FastAPI
from pymongo import MongoClient
from bson import ObjectId
from app.model import RecommendationModel
from app.utils import oid_str, get_user_seen_posts, get_time_filtered_query
import os
import logging
import numpy as np
from datetime import datetime, timedelta
import os

MONGODB_URI = os.getenv("MONGODB_URI", "mongodb://localhost:27017")
MONGO_INITDB_DATABASE = os.getenv("MONGO_INITDB_DATABASE", "your_database_name")
client = MongoClient(MONGODB_URI)
db = client[MONGO_INITDB_DATABASE]

app = FastAPI()
model = RecommendationModel()

@app.post("/train")
def train_model():
    """
    Train the recommendation model using historical interaction data.
    Collects positive interactions (likes) and creates negative samples.
    """
    interactions = []
    
    # Collect positive interactions from likes
    for post in db.posts.find({"likeCount": {"$gt": 0}}, limit=1000):
        for uid in post.get("likes", []):
            interactions.append({
                "user_id": oid_str(uid),
                "post_id": oid_str(post["_id"]),
                "label": 1
            })
    
    # Create negative samples (users who didn't like posts they could have seen)
    # This is important for training the model to distinguish between liked and not-liked content
    users = list(db.users.find({}, {"_id": 1}).limit(100))
    posts = list(db.posts.find({"visibility": "public"}, {"_id": 1, "likes": 1}).limit(500))
    
    negative_count = 0
    max_negatives = len(interactions) // 2  # Balance positive and negative samples
    
    for user in users:
        user_id = oid_str(user["_id"])
        for post in posts:
            post_id = oid_str(post["_id"])
            # If user didn't like this post, it's a negative sample
            if user["_id"] not in post.get("likes", []):
                interactions.append({
                    "user_id": user_id,
                    "post_id": post_id,
                    "label": 0
                })
                negative_count += 1
                if negative_count >= max_negatives:
                    break
        if negative_count >= max_negatives:
            break

    if interactions:
        model.train(interactions)
        return {
            "status": "trained",
            "total_samples": len(interactions),
            "positive_samples": len([i for i in interactions if i["label"] == 1]),
            "negative_samples": len([i for i in interactions if i["label"] == 0])
        }
    else:
        return {"status": "no_data", "message": "No interaction data found for training"}

@app.get("/predict/{user_id}")
def predict_likes(user_id: str, limit: int = 10):
    # Get user to check their interests for better recommendations
    user = db.users.find_one({"_id": ObjectId(user_id)})
    if not user:
        return {"error": "User not found"}
    
    # Get user's seen posts to filter them out
    seen_post_ids = get_user_seen_posts(db, user_id)
    seen_object_ids = [ObjectId(pid) for pid in seen_post_ids if ObjectId.is_valid(pid)]
    
    # Build query to exclude seen posts and apply time filtering
    # First try posts from past 3 days
    three_days_query = get_time_filtered_query(3)
    base_query = {
        "visibility": "public",
        "author": {"$ne": ObjectId(user_id)},
        "_id": {"$nin": seen_object_ids}  # Exclude seen posts
    }
    
    # Combine base query with time filter
    query_3_days = {**base_query, **three_days_query}
    
    # Get candidate posts from past 3 days first
    posts = list(db.posts.find(query_3_days).limit(limit * 3))
    
    # If not enough posts, try past 5 days
    if len(posts) < limit:
        five_days_query = get_time_filtered_query(5)
        query_5_days = {**base_query, **five_days_query}
        
        # Get additional posts, excluding what we already have
        existing_post_ids = [p["_id"] for p in posts]
        query_5_days["_id"]["$nin"].extend(existing_post_ids)
        
        additional_posts = list(db.posts.find(query_5_days).limit(limit * 3))
        posts.extend(additional_posts)
    
    if not posts:
        return {"predictions": []}
    
    post_ids = [oid_str(p["_id"]) for p in posts]

    # Use ML model if trained
    if model.trained:
        scores = model.predict(user_id, post_ids)
        ranked = sorted(zip(posts, scores), key=lambda x: x[1], reverse=True)
    else:
        # Fallback: simple scoring based on engagement and user interests
        user_interests = set(str(i) for i in user.get("interests", []))
        scored_posts = []
        
        for post in posts:
            score = 0.0
            # Interest match bonus
            if post.get("category") and str(post["category"]) in user_interests:
                score += 0.5
            
            # Engagement score
            engagement = (
                post.get("likeCount", 0) * 0.5 +
                post.get("commentCount", 0) * 0.3 +
                post.get("shareCount", 0) * 0.2
            )
            score += min(engagement / 100, 0.5)  # Normalize engagement
            
            scored_posts.append((post, score))
        
        ranked = sorted(scored_posts, key=lambda x: x[1], reverse=True)

    # Return top predictions
    return {
        "predictions": [{
            "post_id": oid_str(p["_id"]),
            "text": p["text"],
            "author": oid_str(p["author"]),
            "category": oid_str(p["category"]) if p.get("category") else None,
            "likeCount": p.get("likeCount", 0),
            "commentCount": p.get("commentCount", 0),
            "shareCount": p.get("shareCount", 0),
            "hashtags": p.get("hashtags", []),
            "createdAt": p["createdAt"],
            "score": float(score)
        } for p, score in ranked[:limit]]
    }

@app.get("/recommend/timeline/{user_id}")
def recommend_timeline(user_id: str, limit: int = 20):
    user = db.users.find_one({"_id": ObjectId(user_id)})
    if not user:
        return {"error": "User not found"}

    following = user.get("following", [])
    category_ids = user.get("interests", [])
    
    # Get user's seen posts to filter them out
    seen_post_ids = get_user_seen_posts(db, user_id)
    seen_object_ids = [ObjectId(pid) for pid in seen_post_ids if ObjectId.is_valid(pid)]
    
    # Build query to exclude seen posts and apply time filtering
    # First try posts from past 3 days
    three_days_query = get_time_filtered_query(3)
    base_query = {
        "$or": [
            {"author": {"$in": following}},
            {"category": {"$in": category_ids}}
        ],
        "visibility": "public",
        "_id": {"$nin": seen_object_ids}  # Exclude seen posts
    }
    
    # Combine with time filter for 3 days
    query_3_days = {**base_query, **three_days_query}
    posts = list(db.posts.find(query_3_days).sort("createdAt", -1).limit(limit * 2))
    
    # If not enough posts, try past 5 days
    if len(posts) < limit:
        five_days_query = get_time_filtered_query(5)
        query_5_days = {**base_query, **five_days_query}
        
        # Get additional posts, excluding what we already have
        existing_post_ids = [p["_id"] for p in posts]
        query_5_days["_id"]["$nin"].extend(existing_post_ids)
        
        additional_posts = list(db.posts.find(query_5_days).sort("createdAt", -1).limit(limit * 2))
        posts.extend(additional_posts)
    
    # If we have a trained model, use ML recommendations
    if model.trained and posts:
        post_ids = [oid_str(p["_id"]) for p in posts]
        scores = model.predict(user_id, post_ids)
        
        # Combine ML scores with recency and engagement
        enhanced_posts = []
        for post, ml_score in zip(posts, scores):
            # Calculate engagement score
            engagement_score = (
                post.get("likeCount", 0) * 0.5 +
                post.get("commentCount", 0) * 0.3 +
                post.get("shareCount", 0) * 0.2
            ) / max(1, post.get("likeCount", 0) + post.get("commentCount", 0) + post.get("shareCount", 0))
            
            # Combine scores: 60% ML, 30% engagement, 10% recency boost for recent posts
            from datetime import datetime, timedelta
            recency_boost = 0.1 if post.get("createdAt") and \
                (datetime.now() - post["createdAt"]).days < 1 else 0
            
            final_score = ml_score * 0.6 + engagement_score * 0.3 + recency_boost
            enhanced_posts.append((post, final_score))
        
        # Sort by final score
        enhanced_posts.sort(key=lambda x: x[1], reverse=True)
        posts = [p[0] for p in enhanced_posts[:limit]]
    else:
        # Fallback to basic recommendation
        posts = posts[:limit]

    result = [{
        "post_id": oid_str(p["_id"]),
        "text": p["text"],
        "author": oid_str(p["author"]),
        "category": oid_str(p["category"]) if p.get("category") else None,
        "likeCount": p.get("likeCount", 0),
        "commentCount": p.get("commentCount", 0),
        "shareCount": p.get("shareCount", 0),
        "createdAt": p["createdAt"],
        "hashtags": p.get("hashtags", []),
        "media": p.get("media", [])
    } for p in posts]

    return {"timeline": result}

@app.get("/recommend/explore/{user_id}")
def recommend_explore(user_id: str, limit: int = 30):
    """
    Recommend posts for explore page - diverse content excluding seen posts
    """
    user = db.users.find_one({"_id": ObjectId(user_id)})
    if not user:
        return {"error": "User not found"}

    # Get user's seen posts to filter them out
    seen_post_ids = get_user_seen_posts(db, user_id)
    seen_object_ids = [ObjectId(pid) for pid in seen_post_ids if ObjectId.is_valid(pid)]
    
    # Build query to exclude seen posts and user's own posts
    # First try posts from past 3 days
    three_days_query = get_time_filtered_query(3)
    base_query = {
        "visibility": "public",
        "author": {"$ne": ObjectId(user_id)},  # Exclude user's own posts
        "_id": {"$nin": seen_object_ids}  # Exclude seen posts
    }
    
    # Combine with time filter for 3 days
    query_3_days = {**base_query, **three_days_query}
    posts = list(db.posts.find(query_3_days).sort("likeCount", -1).limit(limit * 3))
    
    # If not enough posts, try past 5 days
    if len(posts) < limit:
        five_days_query = get_time_filtered_query(5)
        query_5_days = {**base_query, **five_days_query}
        
        # Get additional posts, excluding what we already have
        existing_post_ids = [p["_id"] for p in posts]
        query_5_days["_id"]["$nin"].extend(existing_post_ids)
        
        additional_posts = list(db.posts.find(query_5_days).sort("likeCount", -1).limit(limit * 3))
        posts.extend(additional_posts)
    
    # If we have a trained model, use ML recommendations for diverse content
    if model.trained and posts:
        post_ids = [oid_str(p["_id"]) for p in posts]
        scores = model.predict(user_id, post_ids)
        
        # For explore, we want diverse content, so we'll mix high-scoring and randomly selected posts
        scored_posts = list(zip(posts, scores))
        scored_posts.sort(key=lambda x: x[1], reverse=True)
        
        # Take top 70% by ML score and 30% with high engagement but diverse content
        top_ml = scored_posts[:int(limit * 0.7)]
        remaining_posts = scored_posts[int(limit * 0.7):]
        
        # From remaining, select posts with good engagement for diversity
        engagement_sorted = sorted(remaining_posts, key=lambda x: (
            x[0].get("likeCount", 0) + 
            x[0].get("commentCount", 0) * 2 + 
            x[0].get("shareCount", 0) * 3
        ), reverse=True)
        
        diverse_posts = engagement_sorted[:int(limit * 0.3)]
        
        final_posts = [p[0] for p in top_ml] + [p[0] for p in diverse_posts]
        posts = final_posts[:limit]
    else:
        # Fallback: sort by engagement and recency
        posts.sort(key=lambda x: (
            x.get("likeCount", 0) + 
            x.get("commentCount", 0) * 2 + 
            x.get("shareCount", 0) * 3
        ), reverse=True)
        posts = posts[:limit]

    result = [{
        "post_id": oid_str(p["_id"]),
        "text": p["text"],
        "author": oid_str(p["author"]),
        "category": oid_str(p["category"]) if p.get("category") else None,
        "likeCount": p.get("likeCount", 0),
        "commentCount": p.get("commentCount", 0),
        "shareCount": p.get("shareCount", 0),
        "createdAt": p["createdAt"],
        "hashtags": p.get("hashtags", []),
        "media": p.get("media", [])
    } for p in posts]

    return {"explore": result}

@app.get("/recommend/users/{user_id}")
def recommend_users(user_id: str, limit: int = 10):
    """
    Recommend users to follow based on:
    1. Similar interests (higher priority)
    2. People followed by users they follow
    3. Popular users in their interest categories
    """
    user = db.users.find_one({"_id": ObjectId(user_id)})
    if not user:
        return {"error": "User not found"}

    following = set(str(uid) for uid in user.get("following", []))
    user_id_str = str(user["_id"])
    interest_ids = user.get("interests", [])
    user_interests = set(str(i) for i in interest_ids)

    recommended = []
    
    # 1. HIGHEST PRIORITY: Users with similar interests
    interest_candidates = list(db.users.find({
        "_id": {"$ne": ObjectId(user_id)},
        "interests": {"$in": interest_ids}
    }))

    for candidate in interest_candidates:
        cid = str(candidate["_id"])
        if cid not in following:
            candidate_interests = set(str(i) for i in candidate.get("interests", []))
            interest_overlap = len(candidate_interests.intersection(user_interests))
            
            if interest_overlap > 0:  # Only recommend if there's actual overlap
                # Higher weight for interest overlap
                follower_score = min(candidate.get("followerCount", 0) / 1000, 1.0)
                # Interest overlap gets 80% weight, follower count gets 20%
                final_score = interest_overlap * 0.8 + follower_score * 0.2
                
                recommended.append({
                    "user_id": cid,
                    "username": candidate["username"],
                    "fullName": candidate["fullName"],
                    "bio": candidate.get("bio", ""),
                    "followerCount": candidate.get("followerCount", 0),
                    "followingCount": candidate.get("followingCount", 0),
                    "isVerified": candidate.get("isVerified", False),
                    "profilePicture": candidate.get("profilePicture"),
                    "score": final_score,
                    "shared_interests": interest_overlap,
                    "recommendation_reason": "similar_interests"
                })

    # 2. MEDIUM PRIORITY: People followed by users you follow (friend-of-friend)
    if len(recommended) < limit:
        following_users = list(db.users.find({"_id": {"$in": user.get("following", [])}}))
        friend_of_friend_ids = set()
        
        for followed_user in following_users:
            for fof_id in followed_user.get("following", []):
                fof_id_str = str(fof_id)
                if fof_id_str != user_id_str and fof_id_str not in following:
                    friend_of_friend_ids.add(fof_id)
        
        if friend_of_friend_ids:
            fof_candidates = list(db.users.find({"_id": {"$in": list(friend_of_friend_ids)}}))
            
            for candidate in fof_candidates:
                cid = str(candidate["_id"])
                if not any(r["user_id"] == cid for r in recommended):  # Avoid duplicates
                    # Check for interest overlap bonus
                    candidate_interests = set(str(i) for i in candidate.get("interests", []))
                    interest_overlap = len(candidate_interests.intersection(user_interests))
                    
                    # Base score for friend-of-friend, bonus for shared interests
                    base_score = 0.3
                    interest_bonus = interest_overlap * 0.1
                    follower_bonus = min(candidate.get("followerCount", 0) / 2000, 0.2)
                    
                    final_score = base_score + interest_bonus + follower_bonus
                    
                    recommended.append({
                        "user_id": cid,
                        "username": candidate["username"],
                        "fullName": candidate["fullName"],
                        "bio": candidate.get("bio", ""),
                        "followerCount": candidate.get("followerCount", 0),
                        "followingCount": candidate.get("followingCount", 0),
                        "isVerified": candidate.get("isVerified", False),
                        "profilePicture": candidate.get("profilePicture"),
                        "score": final_score,
                        "shared_interests": interest_overlap,
                        "recommendation_reason": "followed_by_friends"
                    })

    # 3. LOWER PRIORITY: Popular users in interest categories (if still need more)
    if len(recommended) < limit:
        popular_candidates = list(db.users.find({
            "_id": {"$ne": ObjectId(user_id)},
            "followerCount": {"$gte": 10}  # At least some followers
        }).sort("followerCount", -1).limit(50))
        
        for candidate in popular_candidates:
            cid = str(candidate["_id"])
            if cid not in following and not any(r["user_id"] == cid for r in recommended):
                candidate_interests = set(str(i) for i in candidate.get("interests", []))
                interest_overlap = len(candidate_interests.intersection(user_interests))
                
                # Only add if there's some interest overlap or very high follower count
                if interest_overlap > 0 or candidate.get("followerCount", 0) > 1000:
                    follower_score = min(candidate.get("followerCount", 0) / 5000, 0.4)
                    interest_score = interest_overlap * 0.1
                    final_score = follower_score + interest_score
                    
                    recommended.append({
                        "user_id": cid,
                        "username": candidate["username"],
                        "fullName": candidate["fullName"],
                        "bio": candidate.get("bio", ""),
                        "followerCount": candidate.get("followerCount", 0),
                        "followingCount": candidate.get("followingCount", 0),
                        "isVerified": candidate.get("isVerified", False),
                        "profilePicture": candidate.get("profilePicture"),
                        "score": final_score,
                        "shared_interests": interest_overlap,
                        "recommendation_reason": "popular_in_interests"
                    })
    
    # Sort by score (highest first) and limit results
    recommended.sort(key=lambda x: x["score"], reverse=True)
    recommended = recommended[:limit]

    return {"suggested_users": recommended}

@app.get("/health")
def health_check():
    """Health check endpoint to verify the service is running."""
    return {
        "status": "healthy",
        "model_trained": model.trained,
        "database_connected": True if db else False
    }

@app.get("/model/status")
def model_status():
    """Get the current status of the recommendation model."""
    status = {
        "trained": model.trained,
        "user_features": len(model.mlb_user.classes_) if model.trained else 0,
        "post_features": len(model.mlb_post.classes_) if model.trained else 0
    }
    
    # Add training metrics if available
    if model.trained and hasattr(model, 'training_metrics'):
        status.update(model.training_metrics)
    
    return status
