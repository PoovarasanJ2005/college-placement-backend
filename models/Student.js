const mongoose = require('mongoose');

const studentSchema = new mongoose.Schema({
  name: String,
  email: String,
  department: String,
  cgpa: Number,
  resume: String,
  certificates: String,
  placementStatus: { type: String, enum: ['Placed', 'Not Placed'], default: 'Not Placed' }
}, { timestamps: true });

module.exports = mongoose.model('Student', studentSchema);
