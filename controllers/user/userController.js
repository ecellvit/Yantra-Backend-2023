const User = require("../../models/userModel");
const { OAuth2Client } = require("google-auth-library");

const yantraTeams = require("../../models/yantraTeamModel");
const yantraPendingApprovals = require("../../models/yantraPendingApprovalsModel");
const yantraTeamLeaderApprovalsModel = require("../../models/yantraTeamLeaderPendingApprovalsModel");

var mongoose = require("mongoose");
const AppError = require("../../utils/appError");
const catchAsync = require("../../utils/catchAsync");
const {
  errorCodes,
  requestStatusTypes,
  teamRole,
  objectIdLength,
  registerTypes,
  eventCodes,
  approvalStatusTypes,
} = require("../../utils/constants");

const {
  joinTeamViaTokenBodyValidation,
  fillUserDetailsBodyValidation,
  hasFilledDetailsBodyValidation,
  registerEventBodyValidation,
  updateRequestBodyValidation,
} = require("./validationSchema");
const { verifyTeamToken } = require("./utils");
const client = new OAuth2Client(process.env.CLIENT_ID);
const path = require("path");
require("dotenv").config({ path: path.resolve(__dirname, "../.env") });
const { transporter } = require("../../utils/nodemailer");

exports.registerEvent = catchAsync(async (req, res, next) => {
  const { error } = registerEventBodyValidation(req.body);
  if (error) {
    return next(
      new AppError(
        error.details[0].message,
        400,
        errorCodes.INPUT_PARAMS_INVALID
      )
    );
  }

  const user = await User.findById({ _id: req.user._id });

  //to register
  if (req.body.op === 0) {
    if (
      user.registeredEvents[req.body.eventCode] === registerTypes.REGISTERED //already registered
    ) {
      return next(
        new AppError(
          "Already Registered to event",
          412,
          errorCodes.ALREADY_REGISTERED
        )
      );
    }

    //registering
    await User.findOneAndUpdate(
      {
        _id: req.user._id,
      },
      {
        $set: {
          [`registeredEvents.${req.body.eventCode}`]: registerTypes.REGISTERED,
        },
      }
    );
  }

  // to unregister
  else {
    //for team events
    if (
      user.registeredEvents[req.body.eventCode] === registerTypes.NOT_REGISTERED // not registered
    ) {
      return next(
        new AppError("Not Registered to event", 412, errorCodes.NOT_REGISTERED)
      );
    }

    //part of teams check
    if (req.body.eventCode === eventCodes.YANTRA) {
      if (user.yantraTeamId) {
        return next(
          new AppError(
            "Part of team. Cant unregister",
            412,
            errorCodes.PART_OF_TEAM_CANT_UNREGSITER
          )
        );
      }
    }

    await User.findOneAndUpdate(
      {
        _id: req.user._id,
      },
      {
        $set: {
          [`registeredEvents.${req.body.eventCode}`]:
            registerTypes.NOT_REGISTERED,
        },
      }
    );
  }

  res.status(201).json({
    message: "Done successfully",
    userId: user._id,
  });
});

exports.yantraSendRequest = catchAsync(async (req, res, next) => {
  const user = await User.findById({ _id: req.user._id });

  //validate team id
  if (req.params.teamId.length !== objectIdLength) {
    return next(
      new AppError("Invalid TeamId", 412, errorCodes.INVALID_TEAM_ID)
    );
  }

  //validating teamid
  const yantraTeam = await yantraTeams.findById({ _id: req.params.teamId });

  if (!yantraTeam) {
    return next(
      new AppError("Invalid TeamId", 412, errorCodes.INVALID_TEAM_ID)
    );
  }

  if (user.yantraPendingRequests >= 5) {
    return next(
      new AppError(
        "Can't send more than 5 requests",
        412,
        errorCodes.PENDING_REQUESTS_LIMIT_REACHED
      )
    );
  }

  //checking whether user is already a part of team
  if (user.yantraTeamId) {
    return next(
      new AppError(
        "User already part of a Team",
        412,
        errorCodes.USER_ALREADY_IN_TEAM
      )
    );
  }

  if (yantraTeam.members.length === 4) {
    return next(
      new AppError(
        "Team is Full. Can't Send Request",
        412,
        errorCodes.TEAM_IS_FULL
      )
    );
  }

  const isReqSentAlready = await yantraTeamLeaderApprovalsModel.findOne({
    userId: req.user._id,
    teamId: req.params.teamId,
    status: requestStatusTypes.PENDING_APPROVAL,
  });

  if (isReqSentAlready) {
    return next(
      new AppError(
        "Request already sent in other way. Approval Pending",
        412,
        errorCodes.PENDING_REQUEST_OTHER_MODEL
      )
    );
  }

  //checking whether request is already sent and is pending
  const request = await yantraPendingApprovals.findOne({
    userId: req.user._id,
    teamId: req.params.teamId,
    status: requestStatusTypes.PENDING_APPROVAL,
  });

  if (request) {
    return next(
      new AppError(
        "Request already sent. Approval Pending",
        412,
        errorCodes.REQUEST_ALREADY_SENT
      )
    );
  }

  const newRequest = await new yantraPendingApprovals({
    teamId: req.params.teamId,
    userId: req.user._id,
    status: requestStatusTypes.PENDING_APPROVAL,
  }).save();

  await User.findOneAndUpdate(
    {
      _id: req.user._id,
    },
    {
      $inc: { yantraPendingRequests: 1 },
    }
  );

  // const teamLeader = await User.findById({ _id: yantraTeam.teamLeaderId });
  // transporter.sendMail({
  //   from: process.env.NODEMAILER_EMAIL,
  //   to: teamLeader.email,
  //   subject:
  //     "ESUMMIT'23-ECELL-VIT. Pending Approval From a Participant for E-Hack Event",
  //   html:
  //     user.firstName +
  //     " " +
  //     user.lastName +
  //     " " +
  //     "has sent a request to join your E-Hack team " +
  //     yantraTeam.teamName +
  //     ".<br>" +
  //     "To Approve or reject the request click on the link https://esummit.ecellvit.com  <br>" +
  //     user.firstName +
  //     " " +
  //     user.lastName +
  //     "'s Mobile Number: " +
  //     user.mobileNumber +
  //     "<br>" +
  //     user.firstName +
  //     " " +
  //     user.lastName +
  //     "'s Email: " +
  //     user.email,
  //   auth: {
  //     user: process.env.NODEMAILER_EMAIL,
  //     refreshToken: process.env.NODEMAILER_REFRESH_TOKEN,
  //     accessToken: process.env.NODEMAILER_ACCESS_TOKEN,
  //     expires: 3599,
  //   },
  // });

  res.status(201).json({
    message: "Sent request successfully",
    requestId: newRequest._id,
  });
});

exports.yantraGetRequest = catchAsync(async (req, res, next) => {
  const user = await User.findById({ _id: req.user._id });

  //checking whether user is already a part of team
  if (user.yantraTeamId) {
    return next(
      new AppError(
        "User already part of a Team",
        412,
        errorCodes.USER_ALREADY_IN_TEAM
      )
    );
  }

  const requests = await yantraPendingApprovals
    .find({
      userId: req.user._id,
      status: requestStatusTypes.PENDING_APPROVAL,
    })
    .populate({
      path: "teamId",
      select: "teamName teamLeaderId members",
      populate: {
        path: "teamName teamLeaderId",
        select: "email firstName lastName mobileNumber yantraTeamRole",
      },
    });

  res.status(200).json({
    message: "Get User Requests Successfull",
    requests,
  });
});

exports.yantraRemoveRequest = catchAsync(async (req, res, next) => {
  const user = await User.findById({ _id: req.user._id });

  //validate team id
  if (req.params.teamId.length !== objectIdLength) {
    return next(
      new AppError("Invalid TeamId", 412, errorCodes.INVALID_TEAM_ID)
    );
  }

  //validating teamid
  const yantraTeam = await yantraTeams.findById({ _id: req.params.teamId });

  if (!yantraTeam) {
    return next(
      new AppError("Invalid TeamId", 412, errorCodes.INVALID_TEAM_ID)
    );
  }

  //checking whether user is already a part of team
  if (user.yantraTeamId) {
    return next(
      new AppError(
        "User already part of a Team",
        412,
        errorCodes.USER_ALREADY_IN_TEAM
      )
    );
  }

  //checking whether pending request is found
  const request = await yantraPendingApprovals.findOne({
    userId: req.user._id,
    teamId: req.params.teamId,
    status: requestStatusTypes.PENDING_APPROVAL,
  });

  if (!request) {
    return next(
      new AppError(
        "No Pending Request Found",
        412,
        errorCodes.NO_PENDING_REQUESTS
      )
    );
  }

  await yantraPendingApprovals.findOneAndDelete(
    {
      userId: req.user._id,
      teamId: req.params.teamId,
      status: requestStatusTypes.PENDING_APPROVAL,
    }
    // { $set: { status: requestStatusTypes.REQUEST_TAKEN_BACK } }
  );

  await User.findOneAndUpdate(
    {
      _id: req.user._id,
    },
    {
      $inc: { yantraPendingRequests: -1 },
    }
  );

  res.status(201).json({
    message: "Removed Request Successfully",
  });
});

exports.fillUserDetails = catchAsync(async (req, res, next) => {
  //body validation
  const { error } = fillUserDetailsBodyValidation(req.body);
  if (error) {
    return next(
      new AppError(
        error.details[0].message,
        400,
        errorCodes.INPUT_PARAMS_INVALID
      )
    );
  }

  await User.updateOne(
    { _id: req.user._id },
    {
      $set: {
        firstName: req.body.firstName,
        lastName: req.body.lastName,
        mobileNumber: req.body.mobileNumber,
        regNo: req.body.regNo,
        hasFilledDetails: true,
      },
    }
  );

  res.status(201).json({
    message: "User Details Filled successfully",
    userId: req.user._id,
  });
});

exports.hasFilledDetails = catchAsync(async (req, res, next) => {
  const { error } = hasFilledDetailsBodyValidation(req.body);
  if (error) {
    return next(
      new AppError(
        error.details[0].message,
        400,
        errorCodes.INPUT_PARAMS_INVALID
      )
    );
  }

  const token = req.body.token;
  const emailFromClient = req.body.email;

  const ticket = await client.verifyIdToken({
    idToken: token,
    audience: process.env.GOOGLE_CLIENT_ID,
  });

  if (!ticket) {
    return next(
      new AppError(
        "Please SignOut and SignIn Again",
        401,
        errorCodes.INVALID_TOKEN
      )
    );
  }

  const { email } = ticket.getPayload();
  if (email !== emailFromClient) {
    return next(
      new AppError(
        "Please SignOut and SignIn Again",
        401,
        errorCodes.INVALID_TOKEN
      )
    );
  }

  const user = await User.findOne({ email: emailFromClient });

  return res.status(201).json({
    message: "Checking User Successfull",
    yantraTeamId: user.yantraTeamId,
    hasFilledDetails: user.hasFilledDetails,
  });
});

exports.yantraLeaveTeam = catchAsync(async (req, res, next) => {
  //validating teamid
  if (req.params.teamId.length !== objectIdLength) {
    return next(
      new AppError("Invalid TeamId", 412, errorCodes.INVALID_TEAM_ID)
    );
  }

  const yantraTeam = await yantraTeams
    .findById({ _id: req.params.teamId })
    .populate(["teamLeaderId", "members"]);

  //validate team id
  if (!yantraTeam) {
    return next(
      new AppError("Invalid TeamId", 412, errorCodes.INVALID_TEAM_ID)
    );
  }

  const user = await User.findById({ _id: req.user._id });

  //check if user is part of given team
  if (
    user.yantraTeamId == null ||
    user.yantraTeamId.toString() !== req.params.teamId
  ) {
    return next(
      new AppError(
        "User is not part of given TeamID or user isn't part of any Team",
        412,
        errorCodes.INVALID_USERID_FOR_TEAMID
      )
    );
  }

  //check the role. Leader can leave team remove members and delete team.
  if (user.yantraTeamRole === teamRole.LEADER) {
    return next(
      new AppError(
        "Leader can't Leave the Team",
        412,
        errorCodes.USER_IS_LEADER
      )
    );
  }

  await User.findOneAndUpdate(
    { _id: req.user._id },
    { yantraTeamId: null, yantraTeamRole: null }
  );

  await yantraTeams.findOneAndUpdate(
    { _id: req.params.teamId },
    { $pull: { members: req.user._id } }
  );

  // await yantraPendingApprovals.findOneAndUpdate(
  //   {
  //     userId: req.user._id,
  //     teamId: req.params.teamId,
  //     $or: [
  //       { status: requestStatusTypes.APPROVED },
  //       { status: requestStatusTypes.JOINED_VIA_TOKEN },
  //     ],
  //   },
  //   {
  //     $set: { status: requestStatusTypes.LEFT_TEAM },
  //   }
  // );

  res.status(201).json({
    message: "Leaving Team Successfull",
  });
});

exports.yantraJoinTeamViaToken = catchAsync(async (req, res, next) => {
  //body validation
  const { error } = joinTeamViaTokenBodyValidation(req.body);
  if (error) {
    return next(
      new AppError(
        error.details[0].message,
        400,
        errorCodes.INPUT_PARAMS_INVALID
      )
    );
  }

  const user = await User.findById({ _id: req.user._id });

  // if user  is already in a team
  if (user.yantraTeamId) {
    return next(
      new AppError(
        "User already part of a Team",
        412,
        errorCodes.USER_ALREADY_IN_TEAM
      )
    );
  }

  verifyTeamToken(req.body.token)
    .then(async ({ teamTokenDetails }) => {
      const yantraTeam = await yantraTeams.findById({
        _id: teamTokenDetails._id,
      });

      if (yantraTeam.members.length === 4) {
        return next(new AppError("Team is Full", 412, errorCodes.TEAM_IS_FULL));
      }

      //updating users teamid and role
      await User.findOneAndUpdate(
        {
          _id: req.user._id,
        },
        {
          $set: {
            yantraTeamId: yantraTeam._id,
            yantraTeamRole: teamRole.MEMBER,
            yantraPendingRequests: 0,
          },
        }
      );

      //updating pending approvals model of particular team id to a status
      await yantraPendingApprovals.deleteMany(
        {
          // teamId: yantraTeam._id,
          userId: req.user._id,
          status: requestStatusTypes.PENDING_APPROVAL,
        }
        // { $set: { status: requestStatusTypes.JOINED_VIA_TOKEN } }
      );

      await yantraTeamLeaderApprovalsModel.deleteMany({
        userId: req.user._id,
        status: requestStatusTypes.PENDING_APPROVAL,
      });

      //updating pending approvals model of all other team ids to added to other team
      // await yantraPendingApprovals.updateMany(
      //   {
      //     userId: req.user._id,
      //     status: requestStatusTypes.PENDING_APPROVAL,
      //   },
      //   { $set: { status: requestStatusTypes.ADDED_TO_OTHER_TEAM } }
      // );

      //updating team
      await yantraTeams.findOneAndUpdate(
        {
          _id: yantraTeam._id,
        },
        {
          $push: { members: req.user._id },
        }
      );

      res.status(201).json({
        message: "Joined Team Successfully",
        teamId: yantraTeam._id,
      });
    })
    .catch((err) => {
      return next(
        new AppError("Invalid Team Token", 412, errorCodes.INVALID_TEAM_TOKEN)
      );
    });
});

//--------------------------------------------------------->

exports.getDetails = catchAsync(async (req, res, next) => {
  const user = await User.findById(
    { _id: req.user._id },
    {
      email: 1,
      firstName: 1,
      lastName: 1,
      mobileNumber: 1,
      registeredEvents: 1,
      yantraTeamRole: 1,
      yantraPendingRequests: 1,
    }
  ).populate([
    {
      path: "yantraTeamId",
      select: { teamName: 1 },
      populate: {
        path: "members",
        model: "Users",
        select: {
          email: 1,
          firstName: 1,
          lastName: 1,
          mobileNumber: 1,
          yantraTeamRole: 1,
        },
      },
    },
  ]);
  res.status(200).json({
    message: "Getting User Details Successfull",
    user,
  });
});

exports.yantraGetMemberRequest = catchAsync(async (req, res, next) => {
  const user = await User.findById({ _id: req.user._id });

  if (user.yantraTeamId) {
    return next(
      new AppError(
        "User already part of a Team",
        412,
        errorCodes.USER_ALREADY_IN_TEAM
      )
    );
  }

  const requests = await yantraTeamLeaderApprovalsModel
    .find({
      userId: req.user._id,
      status: requestStatusTypes.PENDING_APPROVAL,
    })
    .populate({
      path: "teamId",
      select: "teamName teamLeaderId members",
      populate: {
        path: "teamName teamLeaderId",
        select: "email firstName lastName mobileNumber",
      },
    });

  res.status(200).json({
    message: "Get Yantra add members Requests Successfull",
    requests,
  });
});

exports.yantraUpdateMemberRequest = catchAsync(async (req, res, next) => {
  //body validation
  const { error } = updateRequestBodyValidation(req.body);
  if (error) {
    return next(
      new AppError(
        error.details[0].message,
        400,
        errorCodes.INPUT_PARAMS_INVALID
      )
    );
  }

  const user = await User.findById({ _id: req.user._id });

  if (user.yantraTeamId) {
    return next(
      new AppError(
        "User already part of a Team",
        412,
        errorCodes.USER_ALREADY_IN_TEAM
      )
    );
  }

  if (req.params.teamId.length !== objectIdLength) {
    return next(
      new AppError("Invalid TeamId", 412, errorCodes.INVALID_TEAM_ID)
    );
  }

  //validating teamid
  const yantraTeam = await yantraTeams.findById({
    _id: req.params.teamId,
  });

  const teamLeaderId = yantraTeam.teamLeaderId;

  if (!yantraTeam) {
    return next(
      new AppError("Invalid TeamId", 412, errorCodes.INVALID_TEAM_ID)
    );
  }

  //searching for pending request
  const request = await yantraTeamLeaderApprovalsModel.findOne({
    userId: req.user._id,
    teamId: req.params.teamId,
    status: requestStatusTypes.PENDING_APPROVAL,
  });

  if (!request) {
    return next(
      new AppError(
        "No Pending Request Found",
        412,
        errorCodes.NO_PENDING_REQUESTS
      )
    );
  }

  //checking status and updtaing
  if (req.body.status === approvalStatusTypes.REJECTED) {
    await yantraTeamLeaderApprovalsModel.findOneAndDelete(
      {
        userId: req.user._id,
        teamId: req.params.teamId,
        status: requestStatusTypes.PENDING_APPROVAL,
      }
      // { $set: { status: requestStatusTypes.REJECTED } }
    );

    await yantraTeams.findOneAndUpdate(
      {
        _id: req.params.teamId,
      },
      {
        $inc: { noOfPendingRequests: -1 },
      }
    );
  }

  if (req.body.status === approvalStatusTypes.APPROVED) {
    if (yantraTeam.members.length === 4) {
      return next(
        new AppError("E Hack Team is Full", 412, errorCodes.TEAM_IS_FULL)
      );
    }
    //updating users teamid and role
    await User.findOneAndUpdate(
      {
        _id: req.user._id,
      },
      {
        $set: {
          yantraTeamId: req.params.teamId,
          yantraTeamRole: teamRole.MEMBER,
          yantraPendingRequests: 0,
        },
      }
    );

    //updating pending approvals model of particular yantraTeam id to approved
    await yantraTeamLeaderApprovalsModel.deleteMany(
      {
        userId: req.user._id,
        // teamId: req.params.teamId,
        status: requestStatusTypes.PENDING_APPROVAL,
      }
      // { $set: { status: requestStatusTypes.APPROVED } }
    );

    //updating pending approvals model of all other yantra ids to added to other yantraTeam
    // await yantraPendingApprovals.updateMany(
    //   {
    //     userId: req.body.userId,
    //     status: requestStatusTypes.PENDING_APPROVAL,
    //   },
    //   { $set: { status: requestStatusTypes.ADDED_TO_OTHER_TEAM } }
    // );

    await yantraTeams.findOneAndUpdate(
      {
        _id: req.params.teamId,
      },
      {
        $push: { members: req.user._id },
      }
    );

    if (yantraTeam.members.length === 3) {
      await yantraTeamLeaderApprovalsModel.deleteMany({
        teamId: req.params.teamId,
        status: requestStatusTypes.PENDING_APPROVAL,
      });

      await yantraTeams.findOneAndUpdate(
        {
          _id: req.params.teamId,
        },
        {
          $set: { noOfPendingRequests: 0 },
        }
      );
    } else {
      await yantraTeams.findOneAndUpdate(
        {
          _id: req.params.teamId,
        },
        {
          $inc: { noOfPendingRequests: -1 },
        }
      );
    }

    const teamLeader = await User.findById({ _id: teamLeaderId });
    transporter.sendMail({
      from: process.env.NODEMAILER_EMAIL,
      to: teamLeader.email,
      subject:
        "ESUMMIT'23 ECELL-VIT. Request Approved By the E-Hack Participant",
      html:
        teamLeader.firstName +
        " " +
        teamLeader.lastName +
        " " +
        "your request is approved by the E-Hack Participant " +
        user.firstName +
        " " +
        user.lastName +
        ".<br>" +
        "Click on the link to view the team details https://esummit.ecellvit.com  <br>",
      auth: {
        user: process.env.NODEMAILER_EMAIL,
        refreshToken: process.env.NODEMAILER_REFRESH_TOKEN,
        accessToken: process.env.NODEMAILER_ACCESS_TOKEN,
        expires: 3599,
      },
    });
  }

  res.status(201).json({
    message: "Updated Request Successfully",
  });
});
