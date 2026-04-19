const mongoose = require("mongoose")

const warrantSchema = new mongoose.Schema({
  UserID: { type: String, required: true },
  OfficerID: { type: String, required: true },
  Offense: { type: String, required: true },
  Time: { type: String, required: true },
  Reason: { type: String, required: true },
  Date: { type: Date, default: Date.now }
})

module.exports = mongoose.model("Warrant", warrantSchema)
