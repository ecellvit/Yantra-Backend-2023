const mongoose = require("mongoose");
const app = require("./app");

const path = require("path");
const connectToMongo = require("./db");
require("dotenv").config({ path: path.resolve(__dirname, "./.env") });

mongoose.set("strictQuery", true);

connectToMongo();

const PORT = process.env.PORT || 8080;
app.listen(PORT, () => console.log(`Server Up and Running on port ${PORT}...`));
