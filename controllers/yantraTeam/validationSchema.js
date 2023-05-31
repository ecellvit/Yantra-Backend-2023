const Joi = require("joi");
const { objectIdLength } = require("../../utils/constants");

module.exports = {
  createTeamBodyValidation: (body) => {
    const schema = Joi.object({
      teamName: Joi.string().required(),
      teamMate1Email: Joi.string().email(),
      teamMate2Email: Joi.string().email().allow(null, ""),
      teamMate3Email: Joi.string().email().allow(null, ""),
    });
    return schema.validate(body);
  },

  updateTeamBodyValidation: (body) => {
    const Schema = Joi.object({
      teamName: Joi.string().required(),
    });
    return Schema.validate(body);
  },

  updateRequestBodyValidation: (body) => {
    const Schema = Joi.object({
      userId: Joi.string().required().length(objectIdLength).required(),
      status: Joi.number().min(0).max(1).required(),
    });
    return Schema.validate(body);
  },

  removeMemberBodyValidation: (body) => {
    const Schema = Joi.object({
      userId: Joi.string().required().length(objectIdLength).required(),
    });
    return Schema.validate(body);
  },

  fileUploadBodyValidation: (body) => {
    const Schema = Joi.object({
      projectName: Joi.string().required().allow(null, ""),
      videoLink: Joi.string().required().allow(null, ""),
      githubLink: Joi.string().required().allow(null, ""),
      fileLink: Joi.string().required().allow(null, ""),
    });
    return Schema.validate(body);
  },
};
