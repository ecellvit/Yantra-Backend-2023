const User = require("../../models/userModel");
const yantraTeams = require("../../models/yantraTeamModel");
const yantraPendingApprovals = require("../../models/yantraPendingApprovalsModel");
const yantraTeamLeaderApprovalsModel = require("../../models/yantraTeamLeaderPendingApprovalsModel");
const AppError = require("../../utils/appError");
const catchAsync = require("../../utils/catchAsync");
const {
  errorCodes,
  requestStatusTypes,
  teamRole,
  approvalStatusTypes,
  objectIdLength,
  eventCodes,
} = require("../../utils/constants");
const {
  createTeamBodyValidation,
  updateTeamBodyValidation,
  updateRequestBodyValidation,
  removeMemberBodyValidation,
  fileUploadBodyValidation,
} = require("./validationSchema");
const { generateTeamToken } = require("./utils");
const path = require("path");
require("dotenv").config({ path: path.resolve(__dirname, "../.env") });
// const AWS = require("aws-sdk");
const { transporter } = require("../../utils/nodemailer");

exports.createTeam = catchAsync(async (req, res, next) => {
  //body validation
  const { error } = createTeamBodyValidation(req.body);
  if (error) {
    return next(
      new AppError(
        error.details[0].message,
        400,
        errorCodes.INPUT_PARAMS_INVALID
      )
    );
  }

  if (req.body.teamMate2Email) {
    if (req.body.teamMate1Email == req.body.teamMate2Email) {
      return next(
        new AppError(
          "Team members should have different emails",
          412,
          errorCodes.TEAM_MEMBERS_SAME_EMAIL
        )
      );
    }
  }

  if (req.body.teamMate3Email) {
    if (
      req.body.teamMate1Email == req.body.teamMate2Email ||
      req.body.teamMate1Email == req.body.teamMate3Email ||
      req.body.teamMate2Email == req.body.teamMate3Email
    ) {
      return next(
        new AppError(
          "Team members should have different emails",
          412,
          errorCodes.TEAM_MEMBERS_SAME_EMAIL
        )
      );
    }
  }

  //check whether teamname already taken
  const yantraTeam = await yantraTeams.findOne({
    teamName: req.body.teamName,
  });
  if (yantraTeam) {
    return next(
      new AppError("TeamName Already Exists", 412, errorCodes.TEAM_NAME_EXISTS)
    );
  }

  const user = await User.findById({ _id: req.user._id });

  if (user.registeredEvents[eventCodes.YANTRA] === 0) {
    return next(
      new AppError(
        "User not registered for yantra",
        412,
        errorCodes.USER_NOT_REGISTERED_FOR_EVENT
      )
    );
  }

  //if user is already in a yantraTeam
  if (user.yantraTeamId || user.yantraTeamRole) {
    return next(
      new AppError(
        "User Already Part of a yantraTeams",
        412,
        errorCodes.USER_ALREADY_IN_TEAM
      )
    );
  }

  if (
    user.email == req.body.teamMate1Email ||
    user.email == req.body.teamMate2Email ||
    user.email == req.body.teamMate3Email
  ) {
    return next(
      new AppError(
        "Team Leader cannot be a team member",
        412,
        errorCodes.TEAM_LEADER_CANNOT_BE_TEAM_MEMBER
      )
    );
  }
  const request = await yantraPendingApprovals.findOne({
    userId: req.user._id,
    status: requestStatusTypes.PENDING_APPROVAL,
  });

  const requestByLeader = await yantraTeamLeaderApprovalsModel.findOne({
    userId: req.user._id,
    status: requestStatusTypes.PENDING_APPROVAL,
  });

  //user shouldnt have pending requests
  if (request) {
    return next(
      new AppError(
        "Remove Requests Sent to other Teams to Create a NewTeam",
        412,
        errorCodes.USER_HAS_PENDING_REQUESTS
      )
    );
  }

  //user shouldnt have pending requests sent by other team leader
  if (requestByLeader) {
    return next(
      new AppError(
        "Remove Requests by other Leaders to Create a NewTeam",
        412,
        errorCodes.USER_HAS_PENDING_REQUESTS
      )
    );
  }

  let teamMate1 = null;
  let teamMate2 = null;
  let teamMate3 = null;

  if (req.body.teamMate1Email) {
    teamMate1 = await User.findOne({
      email: req.body.teamMate1Email,
    });

    if (!teamMate1) {
      transporter.sendMail(
        {
          from: process.env.NODEMAILER_EMAIL,
          to: req.body.teamMate1Email,
          subject: "Ignitia: Account Creation Required",
          html:
            "Greetings!" +
            "<br>" +
            "You have been invited to join a team for Ignitia!" +
            "<br>" +
            "Unfortunately, it has come to our attention that you have not yet created an account on the Ignitia website. In order to facilitate your participation, we kindly request you to create an account as soon as possible." +
            "<br>" +
            "To create an Ignitia account, please follow these steps:" +
            "<br>" +
            "     1.Visit the Ignitia website at [insert Ignitia website]." +
            "<br>" +
            '     2.Click on the "Sign Up" or "Register" button.' +
            "<br>" +
            "     3.Provide the required information, such as your name, email address, and a secure password." +
            "<br>" +
            "On successful creation of your account, you will receive an e-mail confirming the same." +
            "<br>" +
            "Once your account is created, please reach out to your team leader and ask them to re-register the team to confirm your participation." +
            "<br>" +
            "Regards," +
            "<br>" +
            "Team Ignitia",
          auth: {
            user: process.env.NODEMAILER_EMAIL,
            refreshToken: process.env.NODEMAILER_REFRESH_TOKEN,
            accessToken: process.env.NODEMAILER_ACCESS_TOKEN,
            expires: 3599,
          },
        },
        (err, success) => {
          if (err) {
            console.log(err);
          }
        }
      );

      return next(
        new AppError(
          `${req.body.teamMate1Email} email is incorrect or the teammate hasn't singed up`,
          412,
          errorCodes.NOT_SIGNED_UP
        )
      );
    }

    if (teamMate1.registeredEvents[eventCodes.YANTRA] === 0) {
      return next(
        new AppError(
          `${req.body.teamMate1Email} not registered for yantra`,
          412,
          errorCodes.ONE_OF_THE_TEAM_MATES_NOT_REGISTERED_FOR_YANTRA
        )
      );
    }

    if (teamMate1.yantraTeamId || teamMate1.yantraTeamRole) {
      return next(
        new AppError(
          `${req.body.teamMate1Email} already Part of a yantraTeam`,
          412,
          errorCodes.ONE_OF_THE_TEAM_MATES_ALREADY_IN_YANTRA_TEAM
        )
      );
    }

    const request = await yantraPendingApprovals.findOne({
      userId: teamMate1._id,
      status: requestStatusTypes.PENDING_APPROVAL,
    });

    const requestByLeader = await yantraTeamLeaderApprovalsModel.findOne({
      userId: teamMate1._id,
      status: requestStatusTypes.PENDING_APPROVAL,
    });

    //user shouldnt have pending requests
    if (request) {
      return next(
        new AppError(
          `${req.body.teamMate1Email} -> Remove Requests Sent to other Teams to Create a NewTeam`,
          412,
          errorCodes.ONE_OF_THE_TEAM_MATES_HAVE_PENDING_REQUESTS
        )
      );
    }

    //user shouldnt have pending requests sent by other team leader
    if (requestByLeader) {
      return next(
        new AppError(
          `${req.body.teamMate1Email} -> Remove Requests by other Leaders to Create a NewTeam`,
          412,
          errorCodes.ONE_OF_THE_TEAM_MATES_HAVE_PENDING_REQUESTS
        )
      );
    }
  }

  if (req.body.teamMate2Email) {
    teamMate2 = await User.findOne({
      email: req.body.teamMate2Email,
    });

    if (!teamMate2) {
      transporter.sendMail(
        {
          from: process.env.NODEMAILER_EMAIL,
          to: req.body.teamMate2Email,
          subject: "Ignitia: Account Creation Required",
          html:
            "Greetings!" +
            "<br>" +
            "You have been invited to join a team for Ignitia!" +
            "<br>" +
            "Unfortunately, it has come to our attention that you have not yet created an account on the Ignitia website. In order to facilitate your participation, we kindly request you to create an account as soon as possible." +
            "<br>" +
            "To create an Ignitia account, please follow these steps:" +
            "<br>" +
            "     1.Visit the Ignitia website at [insert Ignitia website]." +
            "<br>" +
            '     2.Click on the "Sign Up" or "Register" button.' +
            "<br>" +
            "     3.Provide the required information, such as your name, email address, and a secure password." +
            "<br>" +
            "On successful creation of your account, you will receive an e-mail confirming the same." +
            "<br>" +
            "Once your account is created, please reach out to your team leader and ask them to re-register the team to confirm your participation." +
            "<br>" +
            "Regards," +
            "<br>" +
            "Team Ignitia",
          auth: {
            user: process.env.NODEMAILER_EMAIL,
            refreshToken: process.env.NODEMAILER_REFRESH_TOKEN,
            accessToken: process.env.NODEMAILER_ACCESS_TOKEN,
            expires: 3599,
          },
        },
        (err, success) => {
          if (err) {
            console.log(err);
          }
        }
      );

      return next(
        new AppError(
          `${req.body.teamMate2Email} email is incorrect or the teammate hasn't singed up`,
          412,
          errorCodes.NOT_SIGNED_UP
        )
      );
    }

    if (teamMate2.registeredEvents[eventCodes.YANTRA] === 0) {
      return next(
        new AppError(
          `${req.body.teamMate2Email} not registered for yantra`,
          412,
          errorCodes.ONE_OF_THE_TEAM_MATES_NOT_REGISTERED_FOR_YANTRA
        )
      );
    }

    if (teamMate2.yantraTeamId || teamMate2.yantraTeamRole) {
      return next(
        new AppError(
          `${req.body.teamMate2Email} already Part of a yantraTeam`,
          412,
          errorCodes.ONE_OF_THE_TEAM_MATES_ALREADY_IN_YANTRA_TEAM
        )
      );
    }

    const request = await yantraPendingApprovals.findOne({
      userId: teamMate2._id,
      status: requestStatusTypes.PENDING_APPROVAL,
    });

    const requestByLeader = await yantraTeamLeaderApprovalsModel.findOne({
      userId: teamMate2._id,
      status: requestStatusTypes.PENDING_APPROVAL,
    });

    //user shouldnt have pending requests
    if (request) {
      return next(
        new AppError(
          `${req.body.teamMate2Email} -> Remove Requests Sent to other Teams to Create a NewTeam`,
          412,
          errorCodes.ONE_OF_THE_TEAM_MATES_HAVE_PENDING_REQUESTS
        )
      );
    }

    //user shouldnt have pending requests sent by other team leader
    if (requestByLeader) {
      return next(
        new AppError(
          `${req.body.teamMate2Email} -> Remove Requests by other Leaders to Create a NewTeam`,
          412,
          errorCodes.ONE_OF_THE_TEAM_MATES_HAVE_PENDING_REQUESTS
        )
      );
    }
  }
  if (req.body.teamMate3Email) {
    teamMate3 = await User.findOne({
      email: req.body.teamMate3Email,
    });

    if (!teamMate3) {
      transporter.sendMail(
        {
          from: process.env.NODEMAILER_EMAIL,
          to: req.body.teamMate3Email,
          subject: "Ignitia: Account Creation Required",
          html:
            "Greetings!" +
            "<br>" +
            "You have been invited to join a team for Ignitia!" +
            "<br>" +
            "Unfortunately, it has come to our attention that you have not yet created an account on the Ignitia website. In order to facilitate your participation, we kindly request you to create an account as soon as possible." +
            "<br>" +
            "To create an Ignitia account, please follow these steps:" +
            "<br>" +
            "     1.Visit the Ignitia website at [insert Ignitia website]." +
            "<br>" +
            '     2.Click on the "Sign Up" or "Register" button.' +
            "<br>" +
            "     3.Provide the required information, such as your name, email address, and a secure password." +
            "<br>" +
            "On successful creation of your account, you will receive an e-mail confirming the same." +
            "<br>" +
            "Once your account is created, please reach out to your team leader and ask them to re-register the team to confirm your participation." +
            "<br>" +
            "Regards," +
            "<br>" +
            "Team Ignitia",
          auth: {
            user: process.env.NODEMAILER_EMAIL,
            refreshToken: process.env.NODEMAILER_REFRESH_TOKEN,
            accessToken: process.env.NODEMAILER_ACCESS_TOKEN,
            expires: 3599,
          },
        },
        (err, success) => {
          if (err) {
            console.log(err);
          }
        }
      );

      return next(
        new AppError(
          `${req.body.teamMate3Email} email is incorrect or the teammate hasn't singed up`,
          412,
          errorCodes.NOT_SIGNED_UP
        )
      );
    }

    if (teamMate3.registeredEvents[eventCodes.YANTRA] === 0) {
      return next(
        new AppError(
          `${req.body.teamMate3Email} not registered for yantra`,
          412,
          errorCodes.ONE_OF_THE_TEAM_MATES_NOT_REGISTERED_FOR_YANTRA
        )
      );
    }

    if (teamMate3.yantraTeamId || teamMate3.yantraTeamRole) {
      return next(
        new AppError(
          `${req.body.teamMate3Email} already Part of a yantraTeam`,
          412,
          errorCodes.ONE_OF_THE_TEAM_MATES_ALREADY_IN_YANTRA_TEAM
        )
      );
    }

    const request = await yantraPendingApprovals.findOne({
      userId: teamMate3._id,
      status: requestStatusTypes.PENDING_APPROVAL,
    });

    const requestByLeader = await yantraTeamLeaderApprovalsModel.findOne({
      userId: teamMate3._id,
      status: requestStatusTypes.PENDING_APPROVAL,
    });

    //user shouldnt have pending requests
    if (request) {
      return next(
        new AppError(
          `${req.body.teamMate3Email} -> Remove Requests Sent to other Teams to Create a NewTeam`,
          412,
          errorCodes.ONE_OF_THE_TEAM_MATES_HAVE_PENDING_REQUESTS
        )
      );
    }

    //user shouldnt have pending requests sent by other team leader
    if (requestByLeader) {
      return next(
        new AppError(
          `${req.body.teamMate3Email} -> Remove Requests by other Leaders to Create a NewTeam`,
          412,
          errorCodes.ONE_OF_THE_TEAM_MATES_HAVE_PENDING_REQUESTS
        )
      );
    }
  }

  let newTeamMembers = [];
  newTeamMembers.push(req.user._id);
  if (teamMate1) {
    newTeamMembers.push(teamMate1._id);
  }
  if (teamMate2) {
    newTeamMembers.push(teamMate2._id);
  }
  if (teamMate3) {
    newTeamMembers.push(teamMate3._id);
  }

  const newTeam = await new yantraTeams({
    teamName: req.body.teamName,
    teamLeaderId: req.user._id,
    members: newTeamMembers,
  }).save();

  await User.updateMany(
    { _id: req.user._id },
    { $set: { yantraTeamId: newTeam._id, yantraTeamRole: teamRole.LEADER } }
  );

  if (teamMate1) {
    await User.updateMany(
      { _id: teamMate1._id },
      { $set: { yantraTeamId: newTeam._id, yantraTeamRole: teamRole.MEMBER } }
    );
  }

  if (teamMate2) {
    await User.updateMany(
      { _id: teamMate2._id },
      { $set: { yantraTeamId: newTeam._id, yantraTeamRole: teamRole.MEMBER } }
    );
  }

  if (teamMate3) {
    await User.updateMany(
      { _id: teamMate3._id },
      { $set: { yantraTeamId: newTeam._id, yantraTeamRole: teamRole.MEMBER } }
    );
  }

  transporter.sendMail(
    {
      from: process.env.NODEMAILER_EMAIL,
      to: req.user.email,
      subject: "Ignitia: Team Created Successfully!",
      html:
        "Greetings!" +
        "<br>" +
        "Congratulations, captain! Your team has successfully registered for Ignitia!" +
        "<br>" +
        "By successfully completing the registration process, you have secured a spot in the Ignitia Hackathon, which means that you are now one step closer to showcasing your skills, collaborating with fellow innovators, and creating remarkable solutions to the challenges ahead." +
        "<br>" +
        "Wishing you the very best!" +
        "<br>" +
        "Regards," +
        "<br>" +
        "Team Ignitia",
      auth: {
        user: process.env.NODEMAILER_EMAIL,
        refreshToken: process.env.NODEMAILER_REFRESH_TOKEN,
        accessToken: process.env.NODEMAILER_ACCESS_TOKEN,
        expires: 3599,
      },
    },
    (err, success) => {
      if (err) {
        console.log(err);
      }
    }
  );

  res.status(201).json({
    message: "New Yantra Team Created Successfully",
    teamId: newTeam._id,
  });
});

exports.getTeamDetails = catchAsync(async (req, res, next) => {
  const user = await User.findById({ _id: req.user._id });

  if (req.params.teamId.length !== objectIdLength) {
    return next(
      new AppError("Invalid TeamId", 412, errorCodes.INVALID_TEAM_ID)
    );
  }

  const yantraTeam = await yantraTeams
    .findById({ _id: req.params.teamId })
    .populate("members", {
      email: 1,
      firstName: 1,
      lastName: 1,
      mobileNumber: 1,
      yantraTeamRole: 1,
      registeredEvents: 1,
    });

  //validate yantraTeam id
  if (!yantraTeam) {
    return next(
      new AppError("Invalid TeamId", 412, errorCodes.INVALID_TEAM_ID)
    );
  }

  //check if user is part of given yantraTeam
  // if (user.teamId == null || user.teamId.toString() !== req.params.teamId) {
  //   return next(
  //     new AppError(
  //       "User is not part of given teamID or user isn't part of any yantraTeam",
  //       412,
  //       errorCodes.INVALID_USERID_FOR_TEAMID
  //     )
  //   );
  // }

  res.status(200).json({
    message: "Getting Yantra Team Details Successfull",
    yantraTeam,
  });
});

exports.updateTeam = catchAsync(async (req, res, next) => {
  //body validation
  const { error } = updateTeamBodyValidation(req.body);
  if (error) {
    return next(
      new AppError(
        error.details[0].message,
        400,
        errorCodes.INPUT_PARAMS_INVALID
      )
    );
  }

  if (req.params.teamId.length !== objectIdLength) {
    return next(
      new AppError("Invalid TeamId", 412, errorCodes.INVALID_TEAM_ID)
    );
  }

  const yantraTeam = await yantraTeams.findById({ _id: req.params.teamId });

  if (!yantraTeam) {
    return next(
      new AppError("Invalid TeamId", 412, errorCodes.INVALID_TEAM_ID)
    );
  }

  //validating teamid
  if (yantraTeam.noOfTimesTeamNameChanged === 3) {
    return next(
      new AppError(
        "Time Name Has Been Changed Already 3 Times(Limit Exceeded) ",
        412,
        errorCodes.UPDATE_TEAMNAME_LIMIT_EXCEEDED
      )
    );
  }

  //checking if yantraTeam name is already taken
  const teamWithNewTeamName = await yantraTeams.findOne({
    teamName: req.body.teamName,
  });

  if (
    teamWithNewTeamName &&
    teamWithNewTeamName.teamName === yantraTeam.teamName
  ) {
    return next(
      new AppError(
        "New TeamName Matched with Existing TeamName",
        412,
        errorCodes.SAME_EXISTING_TEAMNAME
      )
    );
  }
  if (teamWithNewTeamName) {
    return next(
      new AppError(
        "New TeamName Already Exists",
        412,
        errorCodes.TEAM_NAME_EXISTS
      )
    );
  }

  //check whether user belongs to the given yantraTeam and role
  if (yantraTeam.teamLeaderId.toString() !== req.user._id) {
    return next(
      new AppError(
        "User doesn't belong to the yantraTeams or User isn't a Leader",
        412,
        errorCodes.INVALID_USERID_FOR_TEAMID_OR_USER_NOT_LEADER
      )
    );
  }

  await yantraTeams.updateOne(
    { _id: req.params.teamId },
    {
      $set: {
        teamName: req.body.teamName,
      },
      $inc: { noOfTimesTeamNameChanged: 1 },
    }
  );

  res.status(201).json({
    message: "TeamName updated successfully",
    teamId: yantraTeam._id,
  });
});

exports.deleteTeam = catchAsync(async (req, res, next) => {
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
  //check whether user belongs to the given yantraTeam and role
  if (yantraTeam.teamLeaderId.toString() !== req.user._id) {
    return next(
      new AppError(
        "User doesn't belong to the yantraTeams or User isn't a Leader",
        412,
        errorCodes.INVALID_USERID_FOR_TEAMID_OR_USER_NOT_LEADER
      )
    );
  }

  //check yantraTeam size
  if (yantraTeam.members.length !== 1) {
    return next(
      new AppError(
        "Teamsize more than 1. Remove TeamMembers and Delete the yantraTeams",
        412,
        errorCodes.TEAMSIZE_MORE_THAN_ONE
      )
    );
  }

  if (yantraTeam.noOfPendingRequests > 0) {
    return next(
      new AppError(
        "The teams has sent pending requests to other members. Please delete those requests first",
        412,
        errorCodes.TEAM_LEADER_REQUESTS_PENDING_DELETE_TEAM
      )
    );
  }

  const userIds = await yantraPendingApprovals.find(
    {
      teamId: req.params.teamId,
      status: requestStatusTypes.PENDING_APPROVAL,
    },
    {
      userId: 1,
      _id: 0,
    }
  );

  // await yantraPendingApprovals.updateMany(
  //   {
  //     teamId: req.params.teamId,
  //     status: requestStatusTypes.PENDING_APPROVAL,
  //   },
  //   {
  //     $set: { status: requestStatusTypes.TEAM_DELETED },
  //   }
  // );

  await yantraPendingApprovals.deleteMany({
    teamId: req.params.teamId,
  });

  let userIdsArr = [];
  for (let i = 0; i < userIds.length; i++) {
    userIdsArr.push(JSON.stringify(userIds[i].userId).slice(1, -1));
  }

  await User.updateMany(
    {
      _id: {
        $in: userIdsArr,
      },
    },
    {
      $inc: { yantraPendingRequests: -1 },
    }
  );

  await yantraTeams.findOneAndDelete({
    _id: req.params.teamId,
  });

  await User.findByIdAndUpdate(
    { _id: req.user._id },
    { yantraTeamId: null, yantraTeamRole: null }
  );

  res.status(200).json({
    message: "E Hack Team Deleted Successfully",
  });
});

exports.getTeamRequests = catchAsync(async (req, res, next) => {
  //validate yantraTeam id
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

  //check whether user belongs to the given yantraTeam and role
  if (yantraTeam.teamLeaderId.toString() !== req.user._id) {
    return next(
      new AppError(
        "User doesn't belong to the yantraTeams or User isn't a Leader",
        412,
        errorCodes.INVALID_USERID_FOR_TEAMID_OR_USER_NOT_LEADER
      )
    );
  }

  const requests = await yantraPendingApprovals
    .find({
      teamId: req.params.teamId,
      status: requestStatusTypes.PENDING_APPROVAL,
    })
    .populate("userId", {
      email: 1,
      firstName: 1,
      lastName: 1,
      mobileNumber: 1,
    });

  res.status(200).json({
    message: "Get yantraTeams Requests Successfull",
    requests,
  });
});

exports.updateRequest = catchAsync(async (req, res, next) => {
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

  //validate yantraTeam id
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

  //check whether user belongs to the given yantraTeam and role
  if (yantraTeam.teamLeaderId.toString() !== req.user._id) {
    return next(
      new AppError(
        "User doesn't belong to the yantraTeams or User isn't a Leader",
        412,
        errorCodes.INVALID_USERID_FOR_TEAMID_OR_USER_NOT_LEADER
      )
    );
  }

  //check whether userid (user whose status is to be updated) is valid
  const requestedUser = await User.findById({ _id: req.body.userId });
  if (!requestedUser) {
    return next(
      new AppError(
        "Invalid UserId of Requested User",
        412,
        errorCodes.INVALID_USERID
      )
    );
  }

  // if user (user whose status is to be updated) is already in a yantraTeam
  if (requestedUser.yantraTeamId) {
    return next(
      new AppError(
        "Requested User already part of a yantraTeams",
        412,
        errorCodes.USER_ALREADY_IN_TEAM
      )
    );
  }

  //searching for pending request
  const request = await yantraPendingApprovals.findOne({
    userId: req.body.userId,
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
    await yantraPendingApprovals.findOneAndDelete(
      {
        userId: req.body.userId,
        teamId: req.params.teamId,
        status: requestStatusTypes.PENDING_APPROVAL,
      }
      // { $set: { status: requestStatusTypes.REJECTED } }
    );

    await User.findOneAndUpdate(
      {
        _id: req.body.userId,
      },
      {
        $inc: { yantraPendingRequests: -1 },
      }
    );
  }

  if (req.body.status === approvalStatusTypes.APPROVED) {
    //checking yantraTeam size
    if (yantraTeam.members.length === 4) {
      return next(
        new AppError("E Hack Team is Full", 412, errorCodes.TEAM_IS_FULL)
      );
    }
    //updating users teamid and role
    await User.findOneAndUpdate(
      {
        _id: req.body.userId,
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
    await yantraPendingApprovals.deleteMany(
      {
        userId: req.body.userId,
        // teamId: req.params.teamId,
        status: requestStatusTypes.PENDING_APPROVAL,
      }
      // { $set: { status: requestStatusTypes.APPROVED } }
    );

    await yantraTeamLeaderApprovalsModel.deleteMany(
      {
        userId: req.body.userId,
        // teamId: req.params.teamId,
        status: requestStatusTypes.PENDING_APPROVAL,
      }
      // { $set: { status: requestStatusTypes.APPROVED } }
    );

    //updating pending approvals model of all other yantraTeam ids to added to other yantraTeam
    // await yantraPendingApprovals.updateMany(
    //   {
    //     userId: req.body.userId,
    //     status: requestStatusTypes.PENDING_APPROVAL,
    //   },
    //   { $set: { status: requestStatusTypes.ADDED_TO_OTHER_TEAM } }
    // );

    //updating yantraTeam
    await yantraTeams.findOneAndUpdate(
      {
        _id: req.params.teamId,
      },
      {
        $push: { members: req.body.userId },
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
          $set: {},
        }
      );
    }

    const user = await User.findById({ _id: req.body.userId });
    transporter.sendMail(
      {
        from: process.env.NODEMAILER_EMAIL,
        to: user.email,
        subject: "Ignitia: Request Approved By Ignitia Team",
        html:
          "Greetings!" +
          "<br>" +
          user.firstName +
          " " +
          user.lastName +
          " " +
          "your request is approved by Ignitia team " +
          yantraTeam.teamName +
          ".<br>" +
          "Click on the link to view the team details https://yantra.ecellvit.com <br>" +
          "<br>" +
          "Regards," +
          "<br>" +
          "Team Ignitia",
        auth: {
          user: process.env.NODEMAILER_EMAIL,
          refreshToken: process.env.NODEMAILER_REFRESH_TOKEN,
          accessToken: process.env.NODEMAILER_ACCESS_TOKEN,
          expires: 3599,
        },
      },
      (err, success) => {
        if (err) {
          console.log(err);
        }
      }
    );
  }

  res.status(201).json({
    message: "Updated Request Successfully",
  });
});

exports.removeMember = catchAsync(async (req, res, next) => {
  //body validation
  const { error } = removeMemberBodyValidation(req.body);
  if (error) {
    return next(
      new AppError(
        error.details[0].message,
        400,
        errorCodes.INPUT_PARAMS_INVALID
      )
    );
  }
  //checking for invalid yantraTeam id
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

  //checking whether user to remove id is valid
  const userToRemove = await User.findById({ _id: req.body.userId });
  if (!userToRemove) {
    return next(
      new AppError("Invalid UserId to Remove", 412, errorCodes.INVALID_USERID)
    );
  }

  //check whether user belongs to the given yantraTeam and role
  if (yantraTeam.teamLeaderId.toString() !== req.user._id) {
    return next(
      new AppError(
        "User doesn't belong to the yantraTeam or user isn't a leader",
        412,
        errorCodes.INVALID_USERID_FOR_TEAMID_OR_USER_NOT_LEADER
      )
    );
  }

  //checking whether user to remove belomgs to the yantraTeam id
  if (
    userToRemove.yantraTeamId == null ||
    userToRemove.yantraTeamId.toString() !== req.params.teamId
  ) {
    return next(
      new AppError(
        "User to remove and TeamId didnt Match",
        412,
        errorCodes.INVALID_USERID_FOR_TEAMID
      )
    );
  }

  //updating user teamid and teamrole
  await User.findOneAndUpdate(
    { _id: req.body.userId },
    { yantraTeamId: null, yantraTeamRole: null }
  );

  //updating yantraTeam
  await yantraTeams.findOneAndUpdate(
    { _id: req.params.teamId },
    { $pull: { members: req.body.userId } }
  );

  //updating yantraPendingApprovals
  // await yantraPendingApprovals.findOneAndUpdate(
  //   {
  //     userId: req.body.userId,
  //     teamId: req.params.teamId,
  //     $or: [
  //       { status: requestStatusTypes.APPROVED },
  //       { status: requestStatusTypes.JOINED_VIA_TOKEN },
  //     ],
  //   },
  //   {
  //     $set: { status: requestStatusTypes.REMOVED_FROM_TEAM },
  //   }
  // );

  transporter.sendMail(
    {
      from: process.env.NODEMAILER_EMAIL,
      to: userToRemove.email,
      subject: "Ignitia: Removed From Ignitia Team",
      html:
        "Greetings!" +
        "<br>" +
        userToRemove.firstName +
        " " +
        userToRemove.lastName +
        " " +
        "You have been removed from the Ignitia Team " +
        yantraTeam.teamName +
        ".<br>" +
        "To Join or Create a new Team Click on the link https://yantra.ecellvit.com " +
        "<br>" +
        "Regards," +
        "<br>" +
        "Team Ignitia",
      auth: {
        user: process.env.NODEMAILER_EMAIL,
        refreshToken: process.env.NODEMAILER_REFRESH_TOKEN,
        accessToken: process.env.NODEMAILER_ACCESS_TOKEN,
        expires: 3599,
      },
    },
    (err, success) => {
      if (err) {
        console.log(err);
      }
    }
  );

  res.status(201).json({
    message: "User Removed Successfully",
  });
});

exports.getAllTeams = catchAsync(async (req, res, next) => {
  // const startTime = Date.now();
  // const teams = await yantraTeams.find().populate("members", {
  //   name: 1,
  //   teamRole: 1,
  //   email: 1,
  //   mobileNumber: 1,
  // });
  // const endTime = Date.now();
  // console.log("Time Taken = ", endTime - startTime);
  // console.log(teams);

  res.status(201).json({
    message: "Get All Teams Successfull",
    paginatedResult: res.paginatedResults,
  });
});

exports.getTeamToken = catchAsync(async (req, res, next) => {
  //validate yantraTeam id
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

  //check whether user belongs to the given yantraTeam and role
  if (yantraTeam.teamLeaderId.toString() !== req.user._id) {
    return next(
      new AppError(
        "User doesn't belong to the yantraTeams or User isn't a Leader",
        412,
        errorCodes.INVALID_USERID_FOR_TEAMID_OR_USER_NOT_LEADER
      )
    );
  }

  const { teamToken } = await generateTeamToken(yantraTeam);

  res.status(201).json({
    message: "yantraTeams Token Generated Succesfully",
    teamToken,
  });
});

exports.getAllMembers = catchAsync(async (req, res, next) => {
  const user = await User.findById({ _id: req.user._id });

  if (user.yantraTeamId === null || user.yantraTeamRole !== teamRole.LEADER) {
    return next(
      new AppError(
        "User not part of any team or user not a leader",
        412,
        errorCodes.INVALID_USERID_FOR_TEAMID_OR_USER_NOT_LEADER
      )
    );
  }

  // const yantraMembers = await User.find({
  //   "registeredEvents.1": 1,
  //   yantraTeamId: null,
  // });

  res.status(201).json({
    message: "Get All Members Successfull",
    // yantraMembers,,
    paginatedResult: res.paginatedResults,
  });
});

exports.getMemberRequests = catchAsync(async (req, res, next) => {
  const user = await User.findById({ _id: req.user._id });

  if (user.yantraTeamId === null || user.yantraTeamRole !== teamRole.LEADER) {
    return next(
      new AppError(
        "User not part of any team or user not a leader",
        412,
        errorCodes.INVALID_USERID_FOR_TEAMID_OR_USER_NOT_LEADER
      )
    );
  }

  const requests = await yantraTeamLeaderApprovalsModel
    .find({
      teamId: user.yantraTeamId,
      status: requestStatusTypes.PENDING_APPROVAL,
    })
    .populate({
      path: "userId",
      select: "email firstName lastName mobileNumber",
    });

  res.status(200).json({
    message: "Get Add Member Requests Successfull",
    requests,
  });
});

exports.addMemberRequest = catchAsync(async (req, res, next) => {
  const user = await User.findById({ _id: req.user._id });

  if (user.yantraTeamId === null || user.yantraTeamRole !== teamRole.LEADER) {
    return next(
      new AppError(
        "User not part of any team or user not a leader",
        412,
        errorCodes.INVALID_USERID_FOR_TEAMID_OR_USER_NOT_LEADER
      )
    );
  }

  const leaderTeam = await yantraTeams.findById({
    _id: user.yantraTeamId,
  });

  const toAddMember = await User.findById({
    _id: req.params.userId,
  });

  if (!toAddMember) {
    return next(
      new AppError("Invalid UserId", 412, errorCodes.INVALID_USER_ID)
    );
  }

  if (toAddMember.yantraTeamId) {
    return next(
      new AppError(
        "User already part of a Team",
        412,
        errorCodes.USER_ALREADY_IN_TEAM
      )
    );
  }

  if (leaderTeam.members.length === 4) {
    return next(
      new AppError(
        "Team is Full. Can't Add Member",
        412,
        errorCodes.TEAM_IS_FULL
      )
    );
  }

  const isReqSentAlready = await yantraPendingApprovals.findOne({
    userId: req.params.userId,
    teamId: leaderTeam._id,
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
  const request = await yantraTeamLeaderApprovalsModel.findOne({
    userId: req.params.userId,
    teamId: leaderTeam._id,
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

  if (leaderTeam.noOfPendingRequests >= 5) {
    return next(
      new AppError(
        "Can't send more than 5 requests",
        412,
        errorCodes.PENDING_REQUESTS_LIMIT_REACHED
      )
    );
  }

  const newRequest = await new yantraTeamLeaderApprovalsModel({
    teamId: leaderTeam._id,
    userId: req.params.userId,
    teamLeaderId: req.user._id,
    status: requestStatusTypes.PENDING_APPROVAL,
  }).save();

  await yantraTeams.findByIdAndUpdate(
    {
      _id: leaderTeam._id,
    },
    {
      $inc: { noOfPendingRequests: 1 },
    }
  );

  transporter.sendMail(
    {
      from: process.env.NODEMAILER_EMAIL,
      to: toAddMember.email,
      subject:
        "Ignitia: Pending Approval From a Team Leader to Join a their team for Ignitia",
      html:
        "Greetings!" +
        "<br>" +
        user.firstName +
        " " +
        user.lastName +
        " " +
        "has sent a request to join his/her Ignitia team " +
        leaderTeam.teamName +
        ".<br>" +
        "To confirm your participation, follow these steps-" +
        "<br>" +
        "     1.Visit the Ignitia website at [insert Ignitia website]." +
        "<br>" +
        "     2.Click on the ‘Confirm my Registration’ button." +
        "<br>" +
        user.firstName +
        " " +
        user.lastName +
        "'s Mobile Number: " +
        user.mobileNumber +
        "<br>" +
        user.firstName +
        " " +
        user.lastName +
        "'s Email: " +
        user.email +
        "<br>" +
        "Regards," +
        "<br>" +
        "Team Ignitia",
      auth: {
        user: process.env.NODEMAILER_EMAIL,
        refreshToken: process.env.NODEMAILER_REFRESH_TOKEN,
        accessToken: process.env.NODEMAILER_ACCESS_TOKEN,
        expires: 3599,
      },
    },
    (err, success) => {
      if (err) {
        console.log(err);
      }
    }
  );

  res.status(201).json({
    message: "Sent request successfully",
    requestId: newRequest._id,
  });
});

exports.removeMemberRequest = catchAsync(async (req, res, next) => {
  const user = await User.findById({ _id: req.user._id });

  if (user.yantraTeamId === null || user.yantraTeamRole !== teamRole.LEADER) {
    return next(
      new AppError(
        "User not part of any team or user not a leader",
        412,
        errorCodes.INVALID_USERID_FOR_TEAMID_OR_USER_NOT_LEADER
      )
    );
  }

  const toAddMember = await User.findById({
    _id: req.params.userId,
  });

  if (!toAddMember) {
    return next(
      new AppError("Invalid UserId", 412, errorCodes.INVALID_USER_ID)
    );
  }

  //checking whether user is already a part of team
  if (toAddMember.yantraTeamId) {
    return next(
      new AppError(
        "User already part of a Team",
        412,
        errorCodes.USER_ALREADY_IN_TEAM
      )
    );
  }

  //checking whether pending request is found
  const request = await yantraTeamLeaderApprovalsModel.findOne({
    userId: req.params.userId,
    teamId: user.yantraTeamId,
    status: requestStatusTypes.PENDING_APPROVAL,
  });

  if (!request) {
    return next(
      new AppError(
        "No Add Member Request Found",
        412,
        errorCodes.NO_PENDING_REQUESTS
      )
    );
  }

  await yantraTeamLeaderApprovalsModel.findOneAndDelete(
    {
      userId: req.params.userId,
      teamId: user.yantraTeamId,
      status: requestStatusTypes.PENDING_APPROVAL,
    }
    // { $set: { status: requestStatusTypes.REQUEST_TAKEN_BACK } }
  );

  await yantraTeams.findByIdAndUpdate(
    {
      _id: user.yantraTeamId,
    },
    {
      $inc: { noOfPendingRequests: -1 },
    }
  );

  res.status(201).json({
    message: "Removed Request Successfully",
  });
});

exports.yantraUploadFile = catchAsync(async (req, res, next) => {
  const { error } = fileUploadBodyValidation(req.body);
  if (error) {
    return next(
      new AppError(
        error.details[0].message,
        400,
        errorCodes.INPUT_PARAMS_INVALID
      )
    );
  }

  // const teamsSubmitted = await yantraTeams.find({
  //   projectName: { $ne: null },
  // });

  // if (teamsSubmitted.length >= 50) {
  //   return next(
  //     new AppError(
  //       "Submissions have been closed Temporarily",
  //       412,
  //       errorCodes.MAXIMUM_NUMBER_OF_TEAMS_REACHED
  //     )
  //   );
  // }

  const user = await User.findById({ _id: req.user._id });

  if (user.yantraTeamId === null) {
    return next(
      new AppError(
        "User not part of any team",
        412,
        errorCodes.INVALID_USERID_FOR_TEAMID_OR_USER_NOT_LEADER
      )
    );
  }

  await yantraTeams.findByIdAndUpdate(
    {
      _id: user.yantraTeamId,
    },
    {
      $set: {
        projectName: req.body.projectName,
        techStack: req.body.techStack,
        youtubeUrl: req.body.youtubeUrl,
        desc: req.body.desc,
        fileUrl: req.body.fileUrl,
        fileId: req.body.fileId,
      },
    }
  );

  res.status(201).json({
    message: "Uploaded file successfully",
  });
});

exports.yantraGetFile = catchAsync(async (req, res, next) => {
  const user = await User.findById({ _id: req.user._id });

  if (user.yantraTeamId === null) {
    return next(
      new AppError(
        "User not part of any team",
        412,
        errorCodes.INVALID_USERID_FOR_TEAMID_OR_USER_NOT_LEADER
      )
    );
  }

  const team = await yantraTeams.findById({
    _id: user.yantraTeamId,
  });

  res.status(201).json({
    message: "File fetched successfully",
    teamName: team.teamName,
    projectName: team.projectName,
    techStack: team.techStack,
    youtubeUrl: team.youtubeUrl,
    desc: team.desc,
    fileUrl: team.fileUrl,
    fileId: team.fileId,
  });
});
