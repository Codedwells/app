import { faker } from "@faker-js/faker";
import connectDB from "../lib/database";
import { User, Post, Comment, Category } from "../models";
import { listVideos } from "../controllers/upload.Controller";
import bcrypt from "bcryptjs";

// Sample categories for interests
const categoryNames = [
  "Technology",
  "Sports",
  "Music",
  "Art",
  "Food",
  "Travel",
  "Fashion",
  "Gaming",
  "Movies",
  "Books",
  "Photography",
  "Fitness",
  "Science",
  "Politics",
  "Business",
  "Health",
  "Education",
  "Nature",
  "Cooking",
  "DIY",
  "Comedy",
  "News",
  "History",
  "Animals",
  "Cars",
];

// Sample post texts
const postTexts = [
  "Just finished an amazing workout! 💪 #fitness #motivation",
  "Beautiful sunset today! Nature never fails to amaze me 🌅 #nature #photography",
  "Working on a new project and loving every moment of it! #coding #technology",
  "Coffee and coding - the perfect combination ☕ #developer #life",
  "Amazing concert last night! The energy was incredible 🎵 #music #live",
  "Just tried a new recipe and it turned out great! #cooking #food",
  "Weekend vibes are the best vibes 🌟 #weekend #relax",
  "Learning something new every day keeps life interesting 📚 #education #growth",
  "The future is bright with all these technological advances! #tech #innovation",
  "Good friends make everything better 👥 #friendship #life",
];

const PASSWORD = "helloadmin1";

// Pre-hash the password for efficiency since we're using insertMany
let HASHED_PASSWORD: string;

async function initializeHashedPassword() {
  HASHED_PASSWORD = await bcrypt.hash(PASSWORD, 10);
}

async function createCategories() {
  console.log("Creating categories...");
  const categories = [];

  for (const name of categoryNames) {
    const category = new Category({
      name,
      description: faker.lorem.sentence(),
    });
    categories.push(category);
  }

  await Category.insertMany(categories);
  console.log(`Created ${categories.length} categories`);
  return await Category.find({});
}

async function createUsers(categories: any[]) {
  console.log("Creating 500 users...");
  const users = [];

  for (let i = 0; i < 500; i++) {
    // Select 5 random interests for each user
    const shuffledCategories = faker.helpers.shuffle(categories);
    const interests = shuffledCategories.slice(0, 5).map((cat) => cat._id);

    // Generate a username that only contains alphanumeric characters and underscores
    const baseUsername = faker.internet.username().toLowerCase();
    const cleanUsername = baseUsername.replace(/[^a-zA-Z0-9_]/g, "_");

    const user = new User({
      username: cleanUsername,
      email: faker.internet.email().toLowerCase(),
      password: HASHED_PASSWORD, // Use pre-hashed password
      fullName: faker.person.fullName(),
      bio: faker.lorem.paragraph(),
      profilePicture: faker.image.avatar(), // Add random profile picture
      interests,
      isVerified: faker.datatype.boolean(0.1), // 10% chance of being verified
    });

    users.push(user);
  }

  await User.insertMany(users);
  console.log(`Created ${users.length} users`);
  return await User.find({});
}

async function createFollowRelationships(users: any[]) {
  console.log("Creating follow relationships...");

  for (const user of users) {
    // Each user follows at least 30 people
    const otherUsers = users.filter(
      (u) => u._id.toString() !== user._id.toString()
    );
    const shuffledUsers = faker.helpers.shuffle(otherUsers);
    const followingCount = faker.number.int({ min: 30, max: 100 });
    const usersToFollow = shuffledUsers.slice(0, followingCount);

    // Update following list
    user.following = usersToFollow.map((u) => u._id);

    // Update followers for each followed user
    for (const followedUser of usersToFollow) {
      if (!followedUser.followers.includes(user._id)) {
        followedUser.followers.push(user._id);
      }
    }
  }

  // Bulk update all users
  const bulkOps = users.map((user) => ({
    updateOne: {
      filter: { _id: user._id },
      update: {
        following: user.following,
        followers: user.followers,
        followingCount: user.following.length,
        followerCount: user.followers.length,
      },
    },
  }));

  await User.bulkWrite(bulkOps);
  console.log("Follow relationships created");
}

async function createPosts(users: any[], categories: any[]) {
  console.log("Creating posts...");

  // Get available videos
  let availableVideos: any[] = [];
  try {
    availableVideos = await listVideos();
    console.log(`Found ${availableVideos.length} available videos`);
  } catch (error) {
    console.log("No videos available, posts will be text and images only");
  }

  const posts = [];

  for (const user of users) {
    // Each user creates 20 posts
    for (let i = 0; i < 20; i++) {
      const postType = faker.helpers.weightedArrayElement([
        { weight: 40, value: "text" },
        { weight: 30, value: "text_image" },
        { weight: 30, value: "text_video" },
      ]);

      let media: any[] = [];

      // Add media based on post type
      if (postType === "text_image") {
        media.push({
          type: "image",
          url: faker.image.url(),
          thumbnail: faker.image.url(),
        });
      } else if (postType === "text_video" && availableVideos.length > 0) {
        const randomVideo = faker.helpers.arrayElement(availableVideos);
        media.push({
          type: "video",
          url: randomVideo.url,
          thumbnail: faker.image.url(),
        });
      }

      const post = new Post({
        author: user._id,
        text:
          faker.helpers.arrayElement(postTexts) + " " + faker.lorem.sentence(),
        media: media.length > 0 ? media : undefined,
        category: faker.helpers.arrayElement(categories)._id,
        visibility: faker.helpers.weightedArrayElement([
          { weight: 80, value: "public" },
          { weight: 15, value: "followers" },
          { weight: 5, value: "private" },
        ]),
        createdAt: faker.date.recent({ days: 30 }),
      });

      posts.push(post);
    }
  }

  await Post.insertMany(posts);
  console.log(`Created ${posts.length} posts`);
  return await Post.find({});
}

async function createCommentsAndLikes(users: any[], posts: any[]) {
  console.log("Creating comments and likes...");

  const BATCH_SIZE = 100; // Process posts in batches to avoid memory issues
  let totalComments = 0;

  for (let i = 0; i < posts.length; i += BATCH_SIZE) {
    const postBatch = posts.slice(i, i + BATCH_SIZE);
    const comments = [];
    const bulkPostOps = [];

    console.log(
      `Processing posts batch ${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(
        posts.length / BATCH_SIZE
      )}`
    );

    for (const post of postBatch) {
      // Add likes to posts (random number of users)
      const likerCount = faker.number.int({
        min: 0,
        max: Math.min(100, users.length),
      });
      const shuffledUsers = faker.helpers.shuffle(users);
      const likers = shuffledUsers.slice(0, likerCount);

      post.likes = likers.map((u) => u._id);
      post.likeCount = likers.length;

      // Create comments for each post (reduced to 20-30 comments per post to save memory)
      const commentCount = faker.number.int({ min: 20, max: 30 });
      let postComments = [];

      for (let j = 0; j < commentCount; j++) {
        const commenter = faker.helpers.arrayElement(users);

        const comment = {
          post: post._id,
          author: commenter._id,
          text: faker.lorem.sentence(),
          createdAt: faker.date.between({
            from: post.createdAt,
            to: new Date(),
          }),
        };

        comments.push(comment);
        postComments.push(comment);
      }

      // Add likes to comments
      for (const comment of postComments) {
        const commentLikerCount = faker.number.int({ min: 0, max: 10 });
        const commentLikers = faker.helpers
          .shuffle(users)
          .slice(0, commentLikerCount);
        (comment as any).likes = commentLikers.map((u) => u._id);
        (comment as any).likeCount = commentLikers.length;
      }

      post.commentCount = postComments.length;

      bulkPostOps.push({
        updateOne: {
          filter: { _id: post._id },
          update: {
            likes: post.likes,
            likeCount: post.likeCount,
            commentCount: post.commentCount,
          },
        },
      });
    }

    // Insert comments for this batch
    if (comments.length > 0) {
      await Comment.insertMany(comments);
      totalComments += comments.length;
    }

    // Update posts for this batch
    if (bulkPostOps.length > 0) {
      await Post.bulkWrite(bulkPostOps);
    }

    // Clear memory
    comments.length = 0;
    bulkPostOps.length = 0;
  }

  console.log(`Created ${totalComments} comments and added likes to posts`);
}

async function seedDatabase() {
  try {
    console.log("🌱 Starting database seeding...");

    // Initialize hashed password
    await initializeHashedPassword();

    // Connect to the database
    connectDB(() => {});

    // Clear existing data
    console.log("Clearing existing data...");
    await Promise.all([
      User.deleteMany({}),
      Post.deleteMany({}),
      Comment.deleteMany({}),
      Category.deleteMany({}),
    ]);

    // Create data
    const categories = await createCategories();
    const users = await createUsers(categories);
    await createFollowRelationships(users);
    const posts = await createPosts(users, categories);
    await createCommentsAndLikes(users, posts);

    console.log("✅ Database seeding completed successfully!");
    console.log(`📊 Summary:
    - Categories: ${categories.length}
    - Users: ${users.length} (with hashed passwords and profile pictures)
    - Posts: ${posts.length}
    - Each user follows at least 30 people
    - Each post has 20-30 comments (reduced for memory efficiency)
    - Random likes distributed across posts and comments
    `);

    process.exit(0);
  } catch (error) {
    console.error("❌ Error seeding database:", error);
    process.exit(1);
  }
}

// Run the seeder
if (require.main === module) {
  seedDatabase();
}

export default seedDatabase;
