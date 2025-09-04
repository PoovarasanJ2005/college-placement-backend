const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
const bodyParser = require('body-parser');
const bcrypt = require('bcryptjs');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const session = require('express-session');


const User = require('./models/User');
const Student = require('./models/Student');
const Internship = require('./models/Internship');
const Company = require('./models/company');


const app = express();
const port = 3000;

// MongoDB connection
mongoose.connect('mongodb://localhost:27017/placementhub', {
  useNewUrlParser: true,
  useUnifiedTopology: true,
})
  .then(() => console.log("✅ MongoDB connected to placementhub"))
  .catch(err => console.error("❌ MongoDB connection error:", err));

function requireLogin(req, res, next) {
  if (!req.session.user) {
    return res.status(401).json({ success: false, message: 'Login required' });
  }
  next();
}


// Middleware
app.use(cors());
app.use(express.json());

app.use(cors({
  origin: '*',
  credentials: true
}));
app.use(session({
  secret: 'placement-secret',
  resave: false,
  saveUninitialized: true,
}));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static('public'));


// Serve uploaded files
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// ===== File Upload Configuration =====
const studentUpload = multer({ dest: 'uploads/students/' });

const internshipUploadPath = path.join(__dirname, 'uploads/internships');
if (!fs.existsSync(internshipUploadPath)) fs.mkdirSync(internshipUploadPath, { recursive: true });

const internshipStorage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, internshipUploadPath);
  },
  filename: function (req, file, cb) {
    cb(null, Date.now() + '-' + file.originalname);
  }
});

const internshipUpload = multer({ storage: internshipStorage });

// ====== Auth Routes ======
app.post('/signup', async (req, res) => {
  try {
    const { name, email, password, role } = req.body;
    const existing = await User.findOne({ email });
    if (existing) return res.status(409).json({ success: false, message: "User already exists" });

    const hashedPassword = await bcrypt.hash(password, 10);
    const newUser = new User({ name, email, password: hashedPassword, role });
    await newUser.save();
    console.log(`New user signed up: ${email} (${role})`);
    res.json({ success: true, message: "✅ Signup successful" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: "Server error on signup" });
  }
});

app.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = await User.findOne({ email });
    if (!user) return res.status(401).json({ success: false, message: "Invalid credentials" });

    const isMatch = await bcrypt.compare(password, user.password);
    if (isMatch) {
      req.session.user = {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role
      };
      console.log(`User logged in: ${email}`);
      res.json({ success: true, message: "✅ Login successful", user: req.session.user });
    } else {
      res.status(401).json({ success: false, message: "Invalid credentials" });
    }
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: "Server error on login" });
  }
});

app.get('/profile', (req, res) => {
  if (req.session.user) {
    return res.json({ success: true, user: req.session.user });
  } else {
    return res.status(401).json({ success: false, message: "Not logged in" });
  }
});

app.get('/logout', (req, res) => {
  req.session.destroy();
  res.json({ success: true, message: "Logged out successfully" });
});


// Check login status route
app.get('/check-login', (req, res) => {
  res.json({ loggedIn: !!req.session.user });
});



// ====== Student Routes ======
app.post('/add-student', studentUpload.fields([
  { name: 'resume' },
  { name: 'certificates' }
]), async (req, res) => {
  try {
    const studentData = {
      ...req.body,
      resume: req.files?.resume?.[0]?.filename || '',
      certificates: req.files?.certificates?.[0]?.filename || ''
    };
    const newStudent = new Student(studentData);
    await newStudent.save();
    console.log(`New student added: ${newStudent.name} (${newStudent.email})`);
    res.json({ success: true, message: ' ✅ New Student added with files' });
  } catch (err) {
    console.error("❌ Student Add Error:", err.message);
    res.status(500).json({ success: false, message: "Error adding student" });
  }
});

app.get('/student', async (req, res) => {
  try {
    const students = await Student.find({}).lean();
    res.json({ success: true, students });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: "Error fetching students" });
  }
});

app.get("/student/:id", async (req, res) => {
  try {
    const student = await Student.findById(req.params.id);
    if (!student) return res.json({ success: false });
    res.json({ success: true, student });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ====== Internship Routes ======
app.post('/add-internship', internshipUpload.single('file'), async (req, res) => {
  try {
    const { name, company, position, duration, stipend } = req.body;
    const document = req.file ? req.file.filename : '';

    const newInternship = new Internship({
      name,
      company,
      position,
      duration,
      stipend,
      document
    });

    await newInternship.save();
    console.log(`✅ Internship added: ${newInternship.company} - ${newInternship.position}`);
    res.json({ success: true, message: "Internship added successfully" });
  } catch (err) {
    console.error('❌ Internship Error:', err.message);
    res.status(500).json({ success: false, message: "Error adding internship" });
  }
});

app.get('/internships', async (req, res) => {
  try {
    const internships = await Internship.find({});
    res.json({ success: true, internships });
  } catch (err) {
    console.error('❌ Internship Fetch Error:', err.message);
    res.status(500).json({ success: false, message: "Error fetching internships" });
  }
});

// ====== DELETE Internship ======
app.delete('/internships/:id', async (req, res) => {
  try {
    const deletedInternship = await Internship.findByIdAndDelete(req.params.id);
    if (!deletedInternship) {
      return res.status(404).json({ success: false, message: 'Internship not found' });
    }

    // Also delete the uploaded file if it exists
    if (deletedInternship.document) {
      const filePath = path.join(__dirname, 'uploads/internships', deletedInternship.document);
      fs.unlink(filePath, (err) => {
        if (err) console.warn('⚠️ File delete failed:', err.message);
        else console.log(`🗑️ File deleted: ${deletedInternship.document}`);
      });
    }

    res.json({ success: true, message: 'Internship deleted successfully' });
  } catch (err) {
    console.error('❌ Internship Delete Error:', err.message);
    res.status(500).json({ success: false, message: 'Error deleting internship' });
  }
});

// ====== UPDATE Internship ======
// Express PUT route to update internship data
app.put('/internships/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { name, company, position, duration, stipend } = req.body;

    const updatedInternship = await Internship.findByIdAndUpdate(
      id,
      { name, company, position, duration, stipend },
      { new: true }
    );

    if (!updatedInternship) {
      return res.status(404).json({ success: false, message: 'Internship not found' });
    }

    res.json({ success: true, internship: updatedInternship });
  } catch (err) {
    console.error("❌ Internship Update Error:", err);
    res.status(500).json({ success: false, message: "Failed to update internship" });
  }
});


app.get('/profile', (req, res) => {
  if (req.isAuthenticated()) {
    res.json({ success: true, user: req.user });
  } else {
    res.json({ success: false });
  }
});

// GET all companies
app.get('/companies', async (req, res) => {
  try {
    const companies = await Company.find({}).sort({ visitDate: -1 });  // sort by visitDate desc
    res.json({ success: true, companies });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Error fetching companies' });
  }
});

// POST create new company
app.post('/companies', async (req, res) => {
  try {
    const { companyName, visitDate, studentsPlaced, package: pkg } = req.body;

    if (!companyName || !visitDate || studentsPlaced == null || !pkg) {
      return res.status(400).json({ success: false, message: 'All fields required' });
    }

    const newCompany = new Company({
      companyName,
      visitDate: new Date(visitDate),
      studentsPlaced,
      package: pkg,
    });

    await newCompany.save();

    res.json({ success: true, message: 'Company added', company: newCompany });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Error adding company' });
  }
});

// PUT update company by id
app.put('/companies/:id', async (req, res) => {
  try {
    const { companyName, visitDate, studentsPlaced, package: pkg } = req.body;

    const updatedCompany = await Company.findByIdAndUpdate(
      req.params.id,
      {
        companyName,
        visitDate: visitDate ? new Date(visitDate) : undefined,
        studentsPlaced,
        package: pkg,
      },
      { new: true }
    );

    if (!updatedCompany) {
      return res.status(404).json({ success: false, message: 'Company not found' });
    }

    res.json({ success: true, message: 'Company updated', company: updatedCompany });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Error updating company' });
  }
});

// DELETE company by id
app.delete('/companies/:id', async (req, res) => {
  try {
    const deleted = await Company.findByIdAndDelete(req.params.id);
    if (!deleted) return res.status(404).json({ success: false, message: 'Company not found' });

    res.json({ success: true, message: 'Company deleted' });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Error deleting company' });
  }
});


// 📊 Real-time dashboard stats

app.get('/api/dashboard-stats', async (req, res) => {
  try {
    const students = await Student.find({});

    const total = students.length;
    const avgCgpa = (students.reduce((acc, s) => acc + (s.cgpa || 0), 0) / total).toFixed(2);
    const eligible = students.filter(s => s.cgpa >= 7.5).length;
    const notEligible = total - eligible;
    const placed = students.filter(s => s.placementStatus === 'Placed').length;

    res.json({ total, avgCgpa, eligible, notEligible, placed });
  } catch (error) {
    console.error('Error fetching stats:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

app.get('/api/cgpa-by-department', async (req, res) => {
  try {
    const students = await Student.find({});
    const deptMap = {};

    students.forEach(s => {
      if (!s.department || isNaN(s.cgpa)) return;
      if (!deptMap[s.department]) {
        deptMap[s.department] = { totalCgpa: 0, count: 0 };
      }
      deptMap[s.department].totalCgpa += parseFloat(s.cgpa);
      deptMap[s.department].count += 1;
    });

    const result = Object.entries(deptMap).map(([dept, stats]) => ({
      department: dept,
      avgCgpa: (stats.totalCgpa / stats.count).toFixed(2)
    }));

    res.json({ success: true, data: result });
  } catch (err) {
    console.error('Error fetching avg CGPA by department:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});
// ====== Start Server ======
app.listen(port, () => {
  console.log(`🚀 Server running at http://localhost:${port}`);
});
