const mongoose = require("mongoose")

const ticketSchema = new mongoose.Schema({
  UserID: { type: String, required: true },
  OfficerID: { type: String, required: true },
  Offense: { type: String, required: true },
  Price: { type: Number, required: true },
  Date: { type: Date, default: Date.now }
})

module.exports = mongoose.model("Ticket", ticketSchema)