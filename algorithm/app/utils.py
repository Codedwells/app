from bson import ObjectId
from datetime import datetime, timedelta

def oid_str(x):
    return str(x) if isinstance(x, ObjectId) else x

def get_user_seen_posts(db, user_id):
    """Get list of post IDs that the user has already seen"""
    try:
        user_history = db.userposthistories.find_one({"user": ObjectId(user_id)})
        if user_history and "seenPosts" in user_history:
            return [oid_str(post_id) for post_id in user_history["seenPosts"]]
        return []
    except Exception as e:
        print(f"Error fetching user seen posts: {e}")
        return []

def get_time_filtered_query(days_back=3):
    """Get MongoDB query filter for posts within specified days"""
    cutoff_date = datetime.now() - timedelta(days=days_back)
    return {"createdAt": {"$gte": cutoff_date}}
