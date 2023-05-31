const express = require("express");
const adminController = require("../controllers/admin/adminController");
const adminRouter = express.Router();

adminRouter.route("/user/reg").get(adminController.getAllCounts);