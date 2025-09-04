const mongoose = require('mongoose');

const internshipSchema = new mongoose.Schema({
  name: String,
  company: String,
  position: String,
  duration: String,
  stipend: String,
  document: String
}, { timestamps: true });

module.exports = mongoose.model('Internship', internshipSchema);
