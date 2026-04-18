const mongoose = require("mongoose");

const vehicleSchema = new mongoose.Schema({
  UserID: { type: String, required: true },
  year: { type: String, required: true }, // <-- change Number to String
  brand: { type: String, required: true }, // <-- change Number to String
  model: { type: String, required: true }, // <-- change Number to String
  Color: { type: String, required: true },
  Plate: { type: String, required: true }, // removed unique if duplicates allowed
  Date: { type: Date, default: Date.now }
});

module.exports = mongoose.model("Vehicle", vehicleSchema);
