const express = require("express");
const userController = require("../controllers/user/userController");
const userRouter = express.Router();
const auth = require("../middleware/authMiddleware");

userRouter.route("/details").patch(userController.hasFilledDetails);
userRouter.route("/details").post(auth, userController.fillUserDetails);
userRouter.route("/register").patch(auth, userController.registerEvent);
userRouter.route("/").get(auth, userController.getDetails);

userRouter
  .route("/yantra/join")
  .patch(auth, userController.yantraJoinTeamViaToken);

userRouter.route("/yantra/:teamId").patch(auth, userController.yantraLeaveTeam);
userRouter.route("/yantra/requests").get(auth, userController.yantraGetRequest);

userRouter
  .route("/yantra/requests/:teamId")
  .post(auth, userController.yantraSendRequest);

userRouter
  .route("/yantra/requests/:teamId")
  .delete(auth, userController.yantraRemoveRequest);

userRouter
  .route("/yantra/addMember")
  .get(auth, userController.yantraGetMemberRequest);

userRouter
  .route("/yantra/addMember/:teamId")
  .post(auth, userController.yantraUpdateMemberRequest);

module.exports = userRouter;
