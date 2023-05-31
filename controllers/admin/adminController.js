const AppError = require("../../utils/appError");
const catchAsync = require("../../utils/catchAsync");
const User = require("../../models/userModel");
const yantraTeamModel = require("../../models/yantraTeamModel");
const { registerTypes } = require("../../utils/constants");
const yantraPendingApprovals = require("../../models/yantraPendingApprovalsModel");
const yantraTeamLeaderApprovalsModel = require("../../models/yantraTeamLeaderPendingApprovalsModel");

exports.getAllCounts = catchAsync(async (req, res, next) => {
  const users = await User.find();

  const t10RegisteredUsers = [];
  for (let i = 0; i < users.length; i++) {
    if (users[i].registeredEvents && users[i].registeredEvents[0] === 1) {
      t10RegisteredUsers.push(users[i]);
    }
  }

  const nexusRegisteredUsers = [];
  for (let i = 0; i < users.length; i++) {
    if (users[i].registeredEvents && users[i].registeredEvents[2] === 1) {
      nexusRegisteredUsers.push(users[i]);
    }
  }

  const devopsRegisteredTeams = [];
  for (let i = 0; i < users.length; i++) {
    if (users[i].registeredEvents && users[i].registeredEvents[3] === 1) {
      devopsRegisteredTeams.push(users[i]);
    }
  }

  const yantraTeams = await yantraTeamModel
    .find(
      {},
      {
        _id: 0,
        noOfTimesTeamNameChanged: 0,
        noOfPendingRequests: 0,
        __v: 0,
        teamLeaderId: 0,
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

  const yantraTeamsWithTwoMembers = [];
  const yantraTeamsWithThreeMembers = [];
  const yantraTeamsWithFourMembers = [];

  for (let i = 0; i < yantraTeams.length; i++) {
    if (yantraTeams[i].members.length === 2) {
      yantraTeamsWithTwoMembers.push(yantraTeams[i]);
    } else if (yantraTeams[i].members.length === 3) {
      yantraTeamsWithThreeMembers.push(yantraTeams[i]);
    } else if (yantraTeams[i].members.length === 4) {
      yantraTeamsWithFourMembers.push(yantraTeams[i]);
    }
  }

  res.status(200).json({
    message: "Data Fetched Successfully",
    Number_Of_Users_LoggedIn: users.length,
    Number_Of_Users_Registered_for_Devops_Workshop:
      devopsRegisteredTeams.length,
    Number_of_Users_Registered_for_T10_Workshop: t10RegisteredUsers.length,
    Number_of_Users_Registered_for_Nexus_Workshop: nexusRegisteredUsers.length,
    No_of_Ignitia_Hack_Teams: yantraTeams.length,
    No_of_Ignitia_Hack_Teams_With_2_Members: yantraTeamsWithTwoMembers.length,
    No_of_Ignitia_Hack_Teams_With_3_Members: yantraTeamsWithThreeMembers.length,
    No_of_Ignitia_Hack_Teams_With_4_Members: yantraTeamsWithFourMembers.length,
  });
});