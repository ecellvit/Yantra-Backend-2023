const mongoose = require("mongoose");

const teamSchema = mongoose.Schema(
  {
    teamName: {
      type: String,
    },
    teamLeaderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Users",
    },
    noOfTimesTeamNameChanged: {
      type: Number,
      default: 0,
    },
    members: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Users",
      },
    ],
    noOfPendingRequests: {
      type: Number,
      default: 0,
    },
    projectName: {
      type: String,
    },
    videoLink: {
      type: String,
    },
    githubLink: {
      type: String,
    },
    fileLink: {
      type: String,
    },
  },
  { collection: "yantraTeams" }
);

module.exports = mongoose.model("yantraTeams", teamSchema);
