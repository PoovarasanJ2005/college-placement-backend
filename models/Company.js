const mongoose = require('mongoose');

const companySchema = new mongoose.Schema({
  companyName: String,
  visitDate: Date,
  studentsPlaced: Number,
  package: String
}, { timestamps: true });

module.exports = mongoose.model('Company', companySchema);
