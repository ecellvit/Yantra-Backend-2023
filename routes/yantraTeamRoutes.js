const express = require("express");
const yantraTeamController = require("../controllers/yantraTeam/yantraTeamController");
const yantraTeamRouter = express.Router();
const auth = require("../middleware/authMiddleware");
const {
  pagination,
  paginateAddMembers,
} = require("../controllers/yantraTeam/pagination");

yantraTeamRouter
  .route("/")
  .get(auth, pagination(), yantraTeamController.getAllTeams);
yantraTeamRouter.route("/team").post(auth, yantraTeamController.createTeam);
yantraTeamRouter
  .route("/team/:teamId")
  .get(auth, yantraTeamController.getTeamDetails);
yantraTeamRouter
  .route("/team/:teamId")
  .patch(auth, yantraTeamController.updateTeam);
yantraTeamRouter
  .route("/team/:teamId")
  .delete(auth, yantraTeamController.deleteTeam);

yantraTeamRouter
  .route("/requests/:teamId")
  .get(auth, yantraTeamController.getTeamRequests);
yantraTeamRouter
  .route("/requests/:teamId")
  .post(auth, yantraTeamController.updateRequest);

yantraTeamRouter
  .route("/token/:teamId")
  .get(auth, yantraTeamController.getTeamToken);

yantraTeamRouter
  .route("/remove/:teamId")
  .patch(auth, yantraTeamController.removeMember);
yantraTeamRouter
  .route("/user")
  .get(auth, paginateAddMembers(), yantraTeamController.getAllMembers);

yantraTeamRouter
  .route("/addMember")
  .get(auth, yantraTeamController.getMemberRequests);
yantraTeamRouter
  .route("/addMember/:userId")
  .post(auth, yantraTeamController.addMemberRequest);
yantraTeamRouter
  .route("/addMember/:userId")
  .delete(auth, yantraTeamController.removeMemberRequest);

yantraTeamRouter
  .route("/roundOne")
  .post(auth, yantraTeamController.yantraUploadFile);
yantraTeamRouter
  .route("/roundOne")
  .get(auth, yantraTeamController.yantraGetFile);

module.exports = yantraTeamRouter;
