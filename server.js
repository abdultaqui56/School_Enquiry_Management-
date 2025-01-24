const express = require('express');
const mysql = require('mysql2');
const bodyParser = require('body-parser');
const session = require('express-session');
const app = express();

// Set up MySQL connection
const db = mysql.createConnection({
  host: 'localhost',
  user: 'root',
  password: 'root@123',
  database: 'entrydb',
});

// Middleware
app.use(bodyParser.urlencoded({ extended: true }));
app.set('view engine', 'ejs');  // Set EJS as the view engine
app.set('views', 'views');      // Define 'views' folder for EJS templates

// Use sessions
app.use(session({
  secret: 'your-secret-key',
  resave: false,
  saveUninitialized: true,
}));

// Route to render the form,  Renders the main submission form , Allows new entries to be submitted
app.get('/', (req, res) => {
  res.render('index'); // Ensure 'index.ejs' exists in 'views' folder
});

// Admin login route
app.get('/admin/login', (req, res) => {
  const error = req.query.error; // Capture the error message from the URL query parameters
  res.render('admin-login', { error }); // Pass the error to the EJS template
});

// Login POST route
app.post('/admin/login', (req, res) => {
  const { username, password } = req.body;
  if (username === 'admin' && password === 'admin123') {
    req.session.loggedIn = true;
    res.redirect('/admin/dashboard');
  } else {
    res.redirect('/admin/login?error=Invalid credentials');
  }
});

// Dashboard route (protected)
app.get('/admin/dashboard', (req, res) => {
  if (!req.session.loggedIn) {
    return res.redirect('/admin/login');
  }

  db.query('SELECT * FROM entries', (err, results) => {
    if (err) {
      console.error('Error fetching entries:', err);
      return res.status(500).send('Internal Server Error');
    }

    // Format the 'dated' field to a readable format
    results.forEach(entry => {
      entry.dated = new Date(entry.dated).toLocaleDateString(); // Format it to 'YYYY-MM-DD'
      entry.syllabus = (entry.syllabus || 'N/A').toUpperCase(); // Normalize syllabus names
    });

    // Extract unique syllabi and classes
    const uniqueSyllabi = [...new Set(results.map(entry => entry.syllabus))];
    const uniqueClasses = [...new Set(
      results.map(entry => entry.class ? entry.class.trim() : 'N/A')
    )].sort((a, b) => {
      const numA = parseInt(a, 10);
      const numB = parseInt(b, 10);
      if (!isNaN(numA) && !isNaN(numB)) return numA - numB; // Numeric comparison
      return a.localeCompare(b); // Alphabetic fallback
    });
    

    res.render('dashboard', {
      entries: results,
      uniqueSyllabi,
      uniqueClasses
    });
  });
});


// Logout route
app.get('/admin/logout', (req, res) => {
    req.session.destroy((err) => {
      if (err) {
        console.error('Error during session destruction:', err);
        return res.status(500).send('Error during session destruction');
      }
      // Redirect to the login page after session is destroyed
      res.clearCookie('connect.sid'); // Clear session cookie
      res.redirect('/admin/login');
    });
  });
  

// Handle entry submission
app.post('/submit', (req, res) => {
  const {
    name, email, contact_number, class: className,
    father_name, mother_name, sex, father_occupation,
    mother_occupation, syllabus, message
  } = req.body;

  const query = `
    INSERT INTO entries (
      name, email, contact, class, father_name, mother_name,
      sex, father_occupation, mother_occupation, syllabus, message, status, dated
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', CURRENT_TIMESTAMP)
  `;

  db.query(query, [
    name, email, contact_number, className, father_name, mother_name,
    sex, father_occupation, mother_occupation, syllabus, message
  ], (err) => {
    if (err) {
      console.error('Error submitting entry:', err);
      return res.status(500).send('Error submitting entry');
    }
    res.redirect('/');
  });
});

// Start the server
app.listen(3000, () => {
  console.log('Server running on port 3000');
});
