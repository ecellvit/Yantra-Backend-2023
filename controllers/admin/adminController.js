const AppError = require("../../utils/appError");
const catchAsync = require("../../utils/catchAsync");
const User = require("../../models/userModel");
const yantraTeamModel = require("../../models/yantraTeamModel");
const { registerTypes, eventCodes } = require("../../utils/constants");

exports.getAllCounts = catchAsync(async (req, res, next) => {
  const users = await User.find();

  let t10RegisteredUsersCount = 0;
  let nexusRegisteredUsersCount = 0;
  let devopsRegisteredUsersCount = 0;
  for (let i = 0; i < users.length; i++) {
    if (
      users[i].registeredEvents &&
      users[i].registeredEvents[eventCodes.T_10] === 1
    ) {
      t10RegisteredUsersCount++;
    }

    if (
      users[i].registeredEvents &&
      users[i].registeredEvents[eventCodes.NEXUS] === 1
    ) {
      nexusRegisteredUsersCount++;
    }

    if (
      users[i].registeredEvents &&
      users[i].registeredEvents[eventCodes.DEVOPS] === 1
    ) {
      devopsRegisteredUsersCount++;
    }
  }

  const yantraTeams = await yantraTeamModel.find();

  let yantraTeamsWithOneMemberCount = 0;
  let yantraTeamsWithTwoMembersCount = 0;
  let yantraTeamsWithThreeMembersCount = 0;
  let yantraTeamsWithFourMembersCount = 0;
  let yantraIdeaSubmissionCount = 0;

  for (let i = 0; i < yantraTeams.length; i++) {
    if (yantraTeams[i].projectName) {
      yantraIdeaSubmissionCount++;
    }
    if (yantraTeams[i].members.length === 1) {
      yantraTeamsWithOneMemberCount++;
    } else if (yantraTeams[i].members.length === 2) {
      yantraTeamsWithTwoMembersCount++;
    } else if (yantraTeams[i].members.length === 3) {
      yantraTeamsWithThreeMembersCount++;
    } else if (yantraTeams[i].members.length === 4) {
      yantraTeamsWithFourMembersCount++;
    }
  }

  res.status(200).json({
    message: "Data Fetched Successfully",
    Number_Of_Users_LoggedIn: users.length,
    Number_Of_Users_Registered_for_Devops_Workshop: devopsRegisteredUsersCount,
    Number_of_Users_Registered_for_T10_Workshop: t10RegisteredUsersCount,
    Number_of_Users_Registered_for_Nexus_Workshop: nexusRegisteredUsersCount,
    No_of_Ignitia_Hack_Teams: yantraTeams.length,
    No_of_Ignitia_Hack_Teams_Submitted: yantraIdeaSubmissionCount,
    No_of_Ignitia_Hack_Teams_With_1_Member: yantraTeamsWithOneMemberCount,
    No_of_Ignitia_Hack_Teams_With_2_Members: yantraTeamsWithTwoMembersCount,
    No_of_Ignitia_Hack_Teams_With_3_Members: yantraTeamsWithThreeMembersCount,
    No_of_Ignitia_Hack_Teams_With_4_Members: yantraTeamsWithFourMembersCount,
  });
});

exports.getDevopsRegisteredUsers = catchAsync(async (req, res, next) => {
  const devopsRegisteredUsers = await User.find(
    {
      "registeredEvents.3": registerTypes.REGISTERED,
    },
    {
      _id: 0,
      loginType: 0,
      hasFilledDetails: 0,
      yantraPendingRequests: 0,
      yantraTeamId: 0,
      yantraTeamRole: 0,
      registeredEvents: 0,
      date: 0,
      __v: 0,
    }
  );

  res.status(200).json({
    message: "Data Fetched Successfully",
    No_Of_Users_Registered_For_Devops_Workshop: devopsRegisteredUsers.length,
    devopsRegisteredUsers,
  });
});

exports.getT10RegisteredUsers = catchAsync(async (req, res, next) => {
  const t10RegisteredUsers = await User.find(
    {
      "registeredEvents.1": registerTypes.REGISTERED,
    },
    {
      _id: 0,
      loginType: 0,
      hasFilledDetails: 0,
      yantraPendingRequests: 0,
      yantraTeamId: 0,
      yantraTeamRole: 0,
      registeredEvents: 0,
      date: 0,
      __v: 0,
    }
  );

  res.status(200).json({
    message: "Data Fetched Successfully",
    No_Of_Users_Registered_For_T10_Workshop: t10RegisteredUsers.length,
    t10RegisteredUsers,
  });
});

exports.getNexusRegisteredUsers = catchAsync(async (req, res, next) => {
  const nexusRegisteredUsers = await User.find(
    {
      "registeredEvents.2": registerTypes.REGISTERED,
    },
    {
      _id: 0,
      loginType: 0,
      hasFilledDetails: 0,
      yantraPendingRequests: 0,
      yantraTeamId: 0,
      yantraTeamRole: 0,
      registeredEvents: 0,
      date: 0,
      __v: 0,
    }
  );

  res.status(200).json({
    message: "Data Fetched Successfully",
    No_Of_Users_Registered_For_Nexus_Workshop: nexusRegisteredUsers.length,
    nexusRegisteredUsers,
  });
});

exports.getIgnitiaTeams = catchAsync(async (req, res, next) => {
  const yantraTeams = await yantraTeamModel
    .find(
      {},
      {
        _id: 0,
        noOfTimesTeamNameChanged: 0,
        noOfPendingRequests: 0,
        __v: 0,
        teamLeaderId: 0,
        videoLink: 0,
      }
    )
    .populate("members", {
      email: 1,
      firstName: 1,
      lastName: 1,
      mobileNumber: 1,
      regNo: 1,
      _id: 0,
    });

  res.status(200).json({
    message: "Data Fetched Successfully",
    No_Of_Ignitia_Hack_Teams: yantraTeams.length,
    yantraTeams,
  });
});
