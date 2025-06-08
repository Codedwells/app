import { recommendationService } from "../services/recommendationService";
import connectDB from "../lib/database";
import { User } from "../models";

/**
 * Script to train the recommendation model
 *
 * This script connects to the database and calls the trainModel endpoint
 * of the recommendation service. It can be used to trigger model training
 * without going through the API.
 *
 * Usage:
 * - Run this script: `npx ts-node app/scripts/trainModel.ts`
 * - Use environment variables to configure behavior:
 *   - LOG_LEVEL=verbose for more detailed output
 */

// Configuration
const VERBOSE = process.env.LOG_LEVEL === "verbose";

/**
 * Main function that trains the recommendation model
 */
async function trainRecommendationModel(): Promise<void> {
  try {
    console.log("🧠 Starting recommendation model training...");

    // Connect to the database (required for the script to run properly)
    connectDB(() => {
      // This is a no-op callback for compatibility with the DB connection function
    });

    // Check if we have sufficient data for training
    console.log("📊 Checking database for training data...");

    const userCount = await User.countDocuments();
    if (userCount === 0) {
      console.error(
        "❌ No users found in the database. Make sure to run the seed script first."
      );
      process.exit(1);
    }

    if (VERBOSE) {
      console.log(`Found ${userCount} users in the database`);
    }

    console.log("🔄 Training recommendation model...");
    console.log("This may take a few minutes depending on data size.");

    // Call the recommendation service to train the model
    const result = await recommendationService.trainModel();

    if (result.status === "trained") {
      console.log("✅ Model training completed successfully!");
      console.log(`📈 Training statistics:`);
      console.log(`- Total samples: ${result.total_samples}`);
      console.log(`- Positive samples: ${result.positive_samples}`);
      console.log(`- Negative samples: ${result.negative_samples}`);
    } else {
      console.warn(`⚠️ Training status: ${result.status}`);
      if (result.message) {
        console.warn(`Message: ${result.message}`);
      }
    }

    // Get and display model status
    try {
      const status = await recommendationService.getModelStatus();
      console.log("\n📊 Model Status:");
      console.log(`- Trained: ${status.trained}`);
      console.log(`- User features: ${status.user_features}`);
      console.log(`- Post features: ${status.post_features}`);

      if (status.accuracy) {
        console.log(`- Accuracy: ${(status.accuracy * 100).toFixed(2)}%`);
      }

      if (status.precision) {
        console.log(`- Precision: ${(status.precision * 100).toFixed(2)}%`);
      }

      if (status.recall) {
        console.log(`- Recall: ${(status.recall * 100).toFixed(2)}%`);
      }
    } catch (error) {
      console.warn("Could not fetch model status:", error);
    }
  } catch (error) {
    console.error("❌ Error training recommendation model:", error);
    process.exit(1);
  } finally {
    // Close any open connections
    setTimeout(() => {
      process.exit(0);
    }, 1000);
  }
}

// Execute the main function if this script is being run directly
if (require.main === module) {
  trainRecommendationModel();
}

export default trainRecommendationModel;
