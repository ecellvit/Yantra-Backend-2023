const mongoose = require("mongoose");
const path = require("path");
require("dotenv").config({ path: path.resolve(__dirname, "./.env") });

const connectToMongo = async () => {
  try {
    mongoose.set("strictQuery", false);
    mongoose.connect(process.env.DB_CONNECTION, {
      useNewUrlParser: true,
      maxPoolSize: 100,
      minPoolSize: 2,
    });
    console.log("Mongo connected");
  } catch (error) {
    console.log(error);
    process.exit();
  }
};
module.exports = connectToMongo;
