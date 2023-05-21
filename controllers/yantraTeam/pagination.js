const AppError = require("../../utils/appError");
const { errorCodes } = require("../../utils/constants");
const yantraTeams = require("../../models/yantraTeamModel");
const userModel = require("../../models/userModel");

module.exports = {
  pagination: function () {
    return async (req, res, next) => {
      const page = parseInt(req.query.page);
      const limit = parseInt(req.query.limit);

      if (!page && !limit) {
        try {
          const results = {};
          results.results = await yantraTeams
            .find({
              $expr: {
                $lt: [{ $size: { $ifNull: ["$members", []] } }, 4],
              },
            })
            .populate("members", {
              email: 1,
              firstName: 1,
              lastName: 1,
              mobileNumber: 1,
              regNo: 1,
              registeredEvents: 1,
              yantraTeamId: 1,
              yantraTeamRole: 1,
            });

          res.paginatedResults = results;
          next();
        } catch (e) {
          return next(
            new AppError("Internal Server Error", 500, errorCodes.UNKNOWN_ERROR)
          );
        }
      }

      const startIndex = (page - 1) * limit;
      const endIndex = page * limit;

      const results = {};
      if (
        endIndex <
        (await yantraTeams.countDocuments({
          $expr: {
            $lt: [{ $size: { $ifNull: ["$members", []] } }, 4],
          },
        }))
      ) {
        results.next = {
          page: page + 1,
          limit: limit,
        };
      }
      if (startIndex > 0) {
        results.previous = {
          page: page - 1,
          limit: limit,
        };
      }

      try {
        results.results = await yantraTeams
          .find({
            $expr: {
              $lt: [{ $size: { $ifNull: ["$members", []] } }, 4],
            },
          })
          .populate("members", {
            email: 1,
            firstName: 1,
            lastName: 1,
            mobileNumber: 1,
            regNo: 1,
            registeredEvents: 1,
            yantraTeamId: 1,
            yantraTeamRole: 1,
          })
          .limit(limit)
          .skip(startIndex)
          .exec();
        res.paginatedResults = results;
        // console.log(res.paginatedResults);
        return next();
      } catch (e) {
        return next(
          new AppError("Internal Server Error", 500, errorCodes.UNKNOWN_ERROR)
        );
      }
    };
  },

  paginateAddMembers: function () {
    return async (req, res, next) => {
      const page = parseInt(req.query.page);
      const limit = parseInt(req.query.limit);

      if (!page && !limit) {
        try {
          const results = {};
          results.results = await userModel.find(
            {
              "registeredEvents.1": 1,
              yantraTeamId: null,
            },
            {
              email: 1,
              firstName: 1,
              lastName: 1,
              // mobileNumber: 1,
            }
          );

          res.paginatedResults = results;
          next();
        } catch (e) {
          return next(
            new AppError("Internal Server Error", 500, errorCodes.UNKNOWN_ERROR)
          );
        }
      }
      const startIndex = (page - 1) * limit;
      const endIndex = page * limit;

      const results = {};
      if (
        endIndex <
        (await userModel.countDocuments({
          $expr: {
            $and: [
              { $eq: ["$yantraTeamId", null] },
              { $eq: [{ $arrayElemAt: ["$registeredEvents", 1] }, 1] },
            ],
          },
        }))
      ) {
        results.next = {
          page: page + 1,
          limit: limit,
        };
      }
      if (startIndex > 0) {
        results.previous = {
          page: page - 1,
          limit: limit,
        };
      }

      try {
        results.results = await userModel
          .find(
            {
              "registeredEvents.1": 1,
              yantraTeamId: null,
            },
            {
              email: 1,
              firstName: 1,
              lastName: 1,
              // mobileNumber: 1,
            }
          )
          .limit(limit)
          .skip(startIndex)
          .exec();
        res.paginatedResults = results;
        // console.log(res.paginatedResults);
        return next();
      } catch (e) {
        return next(
          new AppError("Internal Server Error", 500, errorCodes.UNKNOWN_ERROR)
        );
      }
    };
  },
};
