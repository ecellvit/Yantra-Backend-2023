const express = require("express");
const adminController = require("../controllers/admin/adminController");
const adminRouter = express.Router();

adminRouter.route("/user/reg").get(adminController.getAllCounts);
adminRouter.route("/user/nexus").get(adminController.getNexusRegisteredUsers);
adminRouter.route("/user/t10").get(adminController.getT10RegisteredUsers);
adminRouter.route("/user/devops").get(adminController.getDevopsRegisteredUsers);
adminRouter.route("/user/ignitia").get(adminController.getIgnitiaTeams);

module.exports = adminRouter;