const mongoose = require("mongoose")

const licenseSchema = new mongoose.Schema({
  UserID: { type: String, required: true },
  OfficerID: { type: String, required: true},
  License: { type: String, required: true },
})

module.exports = mongoose.model("license", licenseSchema)
