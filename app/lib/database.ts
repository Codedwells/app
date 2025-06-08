import mongoose from "mongoose";
import { ENV } from "./environments";
import { Logger } from "borgen";

mongoose.set("strictQuery", true);

console.log("Connecting to MongoDB..." + ENV.MONGODB_URI);

const connectDB = (server: () => void): void => {
  mongoose
    .connect(ENV.MONGODB_URI)
    .then(() => {
      Logger.info({ message: "Database connected successfully" });
      server(); // Start the server after successful DB connection
    })
    .catch((err) => {
      Logger.error({ message: "connectDb" + err.message });
      console.log(err);
    });
};

export default connectDB;
