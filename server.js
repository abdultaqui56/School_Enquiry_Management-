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

db.connect(err => {
  if (err) {
    console.error('Error connecting to the database:', err);
  } else {
    console.log('Connected to the database');
  }
});

// Middleware
app.use(express.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.set('view engine', 'ejs');  // Set EJS as the view engine
app.set('views', 'views');      // Define 'views' folder for EJS templates

// Use sessions
app.use(session({
  secret: '#2$%^&*(JGFE',  // Add your secret string here
  resave: false,
  saveUninitialized: true,
  cookie: { secure: false }   // Set 'secure: true' only if you're using HTTPS
}))


// Route to render the form,  Renders the main submission form , Allows new entries to be submitted
app.get('/', (req, res) => {
  res.render('home'); // Ensure 'home.ejs' exists in 'views' folder
});

app.get('/index', (req, res) => {
  res.render('index'); // Enquiry Page
});

app.get('/student-login', (req, res) => {
  res.render('student-login'); // Student Login Page 
});

app.get('/fee-structure', (req, res) => {
  res.render('fee-structure'); // Render the fee page
});

// Routes
app.get('/office-login', (req, res) => {
  res.render('office-login');
});

db.query(`
  CREATE TABLE IF NOT EXISTS fee_structures (
    id INT AUTO_INCREMENT PRIMARY KEY,
    batch INT NOT NULL,
    syllabus VARCHAR(10) NOT NULL,
    class INT NOT NULL,
    academicFee DECIMAL(10,2) NOT NULL,
    transportationFee DECIMAL(10,2) NOT NULL,
    booksFee DECIMAL(10,2) NOT NULL,
    uniformFee DECIMAL(10,2) NOT NULL,
    sportsFee DECIMAL(10,2) NOT NULL,
    annualFunctionFee DECIMAL(10,2) NOT NULL,
    totalFee DECIMAL(10,2) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  )`, (err) => {
    if (err) {
      console.error('Error creating fee_structures table:', err);
    } else {
      console.log('fee_structures table ready');
    }
});

// Authentication Middleware
const isAuthenticated = (req, res, next) => {
  if (req.session.isLoggedIn) {
    return next();
  }
  res.redirect('/office-login');
};

app.post('/office-login', (req, res) => {
  const { office_id, password } = req.body;
  
  if (office_id === 'admin' && password === 'admin123') {
    req.session.isLoggedIn = true;
    res.redirect('/fee-structure');
  } else {
    res.render('office-login', { error: 'Invalid credentials' });
  }
});

app.get('/fee-records', async (req, res) => {
  try {
      const { syllabus, batch, page = 1 } = req.query;
      const limit = 10; // 10 rows per page
      const offset = (page - 1) * limit;

      let query = 'SELECT * FROM fee_structures';
      let countQuery = 'SELECT COUNT(*) as total FROM fee_structures';
      const queryParams = [];
      const conditions = [];

      if (syllabus && syllabus !== '') {
          conditions.push('syllabus = ?');
          queryParams.push(syllabus);
      }

      if (batch && batch !== '') {
          conditions.push('batch = ?');
          queryParams.push(batch);
      }

      if (conditions.length > 0) {
          const whereClause = ' WHERE ' + conditions.join(' AND ');
          query += whereClause;
          countQuery += whereClause;
      }

      query += ' ORDER BY batch DESC, syllabus ASC, class ASC LIMIT ? OFFSET ?';
      queryParams.push(limit, offset);

      // Get total count for pagination
      const [countResult] = await db.promise().query(countQuery);
      const totalRecords = countResult[0].total;
      const totalPages = Math.ceil(totalRecords / limit);

      // Get records for current page
      const [records] = await db.promise().query(query, queryParams);
      
      res.json({
          success: true,
          records,
          pagination: {
              currentPage: parseInt(page),
              totalPages,
              totalRecords
          }
      });
  } catch (error) {
      console.error('Database error:', error);
      res.status(500).json({
          success: false,
          message: 'Failed to fetch fee records'
      });
  }
});

// API route to get a single fee structure
app.get('/api/fee-structure/:id', async (req, res) => {
  try {
    const [records] = await db.promise().query(
      'SELECT * FROM fee_structures WHERE id = ?',
      [req.params.id]
    );
    
    if (records.length === 0) {
      return res.status(404).json({ success: false, message: 'Record not found' });
    }
    
    res.json({ success: true, record: records[0] });
  } catch (error) {
    console.error('Error fetching fee structure:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});


// API route to delete fee structure
app.delete('/api/fee-structure/:id', async (req, res) => {
  try {
    const [result] = await db.promise().query(
      'DELETE FROM fee_structures WHERE id = ?', 
      [req.params.id]
    );
    
    if (result.affectedRows === 0) {
      return res.status(404).json({ success: false, message: 'Record not found' });
    }
    
    res.json({ success: true, message: 'Record deleted successfully' });
  } catch (error) {
    console.error('Error deleting fee structure:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Backend route - Update your existing submit-fee route
app.post('/submit-fee', async (req, res) => {
  try {
      console.log('Received Data:', req.body); // Debug log

      const {
          batch,
          syllabus,
          class: className,
          academicFee,
          transportationFee,
          booksFee,
          uniformFee,
          sportsFee,
          annualFunctionFee,
          totalFee
      } = req.body;

      // More detailed validation
      const missingFields = [];
      if (!batch) missingFields.push('batch');
      if (!syllabus) missingFields.push('syllabus');
      if (!className) missingFields.push('class');

      if (missingFields.length > 0) {
          return res.status(400).json({
              success: false,
              message: `Missing required fields: ${missingFields.join(', ')}`
          });
      }

      // Check if record exists
      const [existing] = await db.promise().query(
          'SELECT id FROM fee_structures WHERE batch = ? AND syllabus = ? AND class = ?',
          [batch, syllabus, className]
      );

      if (existing.length > 0) {
          // Update existing record
          await db.promise().query(
              `UPDATE fee_structures 
              SET academicFee = ?, transportationFee = ?, booksFee = ?,
                  uniformFee = ?, sportsFee = ?, annualFunctionFee = ?, totalFee = ?
              WHERE batch = ? AND syllabus = ? AND class = ?`,
              [
                  academicFee,
                  transportationFee,
                  booksFee,
                  uniformFee,
                  sportsFee,
                  annualFunctionFee,
                  totalFee,
                  batch,
                  syllabus,
                  className
              ]
          );
      } else {
          // Insert new record
          await db.promise().query(
              `INSERT INTO fee_structures (
                  batch, syllabus, class, academicFee, transportationFee,
                  booksFee, uniformFee, sportsFee, annualFunctionFee, totalFee
              ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
              [
                  batch,
                  syllabus,
                  className,
                  academicFee,
                  transportationFee,
                  booksFee,
                  uniformFee,
                  sportsFee,
                  annualFunctionFee,
                  totalFee
              ]
          );
      }

      res.json({
          success: true,
          message: 'Fee structure saved successfully'
      });
  } catch (error) {
      console.error('Database error:', error);
      res.status(500).json({
          success: false,
          message: 'Error saving fee structure'
      });
  }
});

app.get("/get-stats", async (req, res) => {
  const selectedSyllabus = req.query.syllabus ? req.query.syllabus.toUpperCase() : "ALL";

  try {
    let query = `
      SELECT 
        CASE 
          WHEN class = '1' THEN 'I'
          WHEN class = '2' THEN 'II'
          WHEN class = '3' THEN 'III'
          WHEN class = '4' THEN 'IV'
          WHEN class = '5' THEN 'V'
          WHEN class = '6' THEN 'VI'
          WHEN class = '7' THEN 'VII'
          WHEN class = '8' THEN 'VIII'
          WHEN class = '9' THEN 'IX'
          WHEN class = '10' THEN 'X'
          ELSE class 
        END AS formatted_class,
        UPPER(syllabus) AS syllabus,
        COUNT(*) AS count
      FROM approved_list
      ${selectedSyllabus !== "ALL" ? "WHERE UPPER(syllabus) = ?" : ""}
      GROUP BY formatted_class, syllabus
      ORDER BY 
        FIELD(formatted_class, 'I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X');
    `;

    const queryParams = selectedSyllabus !== "ALL" ? [selectedSyllabus] : [];
    const [results] = await db.promise().query(query, queryParams);

    // Initialize data with zeros
    const stats = { STATE: {}, ICSE: {}, CBSE: {} };
    ["I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X"].forEach((romanClass) => {
      stats.STATE[romanClass] = 0;
      stats.ICSE[romanClass] = 0;
      stats.CBSE[romanClass] = 0;
    });

    // Fill stats with actual counts from the database
    results.forEach((row) => {
      if (stats[row.syllabus]) {
        stats[row.syllabus][row.formatted_class] = row.count;
      }
    });

    console.log("✅ Generated Stats:", JSON.stringify(stats, null, 2));
    res.json(stats);
  } catch (error) {
    console.error("❌ Error fetching statistics:", error);
    res.status(500).json({ error: "Failed to fetch statistics" });
  }
});


// Logout Route
app.get('/logout', (req, res) => {
  req.session.destroy();
  res.redirect('/office-login');
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

  db.query('SELECT * FROM entries order by dated desc', (err, results) => {
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
    res.redirect('/index');
  });
});

// Add these routes to your server.js file
// GET route for approved list page
app.get('/approved-list', async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = 4;
    const offset = (page - 1) * limit;
    
    const syllabus = req.query.syllabus;
    const classValue = req.query.class;
    
    // Build WHERE clause without status check
    let whereClause = 'WHERE 1=1'; // Always true condition to make it easier to add conditions
    const queryParams = [];

    if (syllabus && syllabus !== 'All') {
      whereClause += ' AND UPPER(syllabus) = ?';
      queryParams.push(syllabus.toUpperCase());
    }
    
    if (classValue && classValue !== 'All') {
      whereClause += ' AND class = ?';
      queryParams.push(classValue);
    }

    // Get total count for pagination
    const countQuery = `SELECT COUNT(*) as total FROM approved_list ${whereClause}`;
    
    // Get entries with pagination
    const dataQuery = `
      SELECT 
        id, usn, name, email, contact, class, father_name, mother_name, sex, 
        UPPER(syllabus) as syllabus, message, 
        DATE_FORMAT(dated, '%Y-%m-%d') as formatted_date
      FROM approved_list 
      ${whereClause}
      ORDER BY dated DESC 
      LIMIT ? OFFSET ?`;

    // Add pagination parameters
    queryParams.push(limit, offset);

    // Execute count query
    const [countResult] = await db.promise().query(countQuery, queryParams.slice(0, -2));
    const totalEntries = countResult[0].total;
    const totalPages = Math.ceil(totalEntries / limit);

    // Execute data query
    const [entries] = await db.promise().query(dataQuery, queryParams);

    // Get unique syllabi
    const [syllabiResult] = await db.promise().query(
      'SELECT DISTINCT UPPER(syllabus) as syllabus FROM approved_list ORDER BY syllabus'
    );
    
    // Get unique classes
    const [classesResult] = await db.promise().query(
      'SELECT DISTINCT class FROM approved_list ORDER BY class'
    );

    const uniqueSyllabi = syllabiResult.map(row => row.syllabus);
    const uniqueClasses = classesResult.map(row => row.class);

    res.render('approved_list', {
      entries,
      currentPage: page,
      totalPages,
      uniqueSyllabi,
      uniqueClasses
    });

  } catch (error) {
    console.error('Error in approved-list route:', error);
    res.status(500).send('Server error: ' + error.message);
  }
});

// POST route for updating USN
const USNGenerator = require('./utils/usnGenerator');

// Update the existing route
app.post('/update-usn', async (req, res) => {
  try {
    const { id, syllabus } = req.body;
    
    // Get student class from database
    const [student] = await db.promise().query(
      'SELECT class FROM approved_list WHERE id = ?',
      [id]
    );

    if (!student.length) {
      return res.status(404).json({ error: "Student not found" });
    }

    const usn = await USNGenerator.generateUSN(db, syllabus, student[0].class);
    
    await db.promise().query(
      'UPDATE approved_list SET usn = ? WHERE id = ?',
      [usn, id]
    );

    res.json({ success: true, usn });
  } catch (error) {
    console.error("Error generating USN:", error);
    res.status(500).json({ error: error.message });
  }
});

app.post('/batch-update-usns', async (req, res) => {
  try {
    const result = await USNGenerator.batchUpdateUSNs(db);
    res.json(result);
  } catch (error) {
    res.status(500).json({ 
      success: false, 
      error: "Failed to update USNs" 
    });
  }
});

app.use((req, res, next) => {
  res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
  res.setHeader("Pragma", "no-cache");
  res.setHeader("Expires", "0");
  next();
});

// POST route to update status and move entry to the approved_list table
// Update status route - Modified to properly handle the approved entries
app.post('/update-status/:id', (req, res) => {
  const entryId = req.params.id;
  const { status } = req.body;

  if (!status) {
    return res.status(400).json({ success: false, message: 'Status is required' });
  }

  if (status === 'accepted') {
    // First get the entry data
    db.query('SELECT * FROM entries WHERE id = ?', [entryId], (err, results) => {
      if (err) {
        console.error('Error fetching entry:', err);
        return res.status(500).json({ success: false, message: 'Database error' });
      }

      if (results.length === 0) {
        return res.status(404).json({ success: false, message: 'Entry not found' });
      }

      const entry = results[0];

      // Insert into approved_list with the same ID
      const insertQuery = `
        INSERT INTO approved_list (
          id, name, email, contact, class, father_name, mother_name,
          sex, father_occupation, mother_occupation, syllabus, message, dated
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
      `;

      db.query(insertQuery, [
        entry.id, // Keep the same ID
        entry.name,
        entry.email,
        entry.contact,
        entry.class,
        entry.father_name,
        entry.mother_name,
        entry.sex,
        entry.father_occupation,
        entry.mother_occupation,
        entry.syllabus,
        entry.message
      ], (err) => {
        if (err) {
          console.error('Error inserting into approved_list:', err);
          return res.status(500).json({ success: false, message: 'Error moving entry to approved list' });
        }

        // Delete from entries table
        db.query('DELETE FROM entries WHERE id = ?', [entryId], (err) => {
          if (err) {
            console.error('Error deleting from entries:', err);
            return res.status(500).json({ success: false, message: 'Error updating entry status' });
          }

          res.json({ success: true, message: 'Entry approved and moved successfully' });
        });
      });
    });
  } else {
    // Handle denied status
    db.query('UPDATE entries SET status = ? WHERE id = ?', [status, entryId], (err) => {
      if (err) {
        console.error('Error updating entry status:', err);
        return res.status(500).json({ success: false, message: 'Error updating entry status' });
      }

      res.json({ success: true, message: 'Status updated successfully' });
    });
  }
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

// app.get('/approved-list', (req, res) => {

//   if (!req.session.loggedIn) {
//     return res.redirect('/admin/login');
//   }

//   const page = parseInt(req.query.page) || 1;
//   const limit = 10;
//   const offset = (page - 1) * limit;

//   // Get filters from query parameters
//   const syllabusFilter = req.query.syllabus && req.query.syllabus !== 'All' ? ` AND syllabus = '${req.query.syllabus}'` : '';
//   const classFilter = req.query.class && req.query.class !== 'All' ? ` AND class = '${req.query.class}'` : '';

//   // Count total entries with filters
//   const countQuery = `
//     SELECT COUNT(*) as total 
//     FROM approved_list 
//     WHERE 1=1 ${syllabusFilter} ${classFilter}
//   `;

//   db.query(countQuery, (err, countResult) => {
//     if (err) {
//       console.error('Error counting approved entries:', err);
//       return res.status(500).render('error', { message: 'Database error' });
//     }

//     const totalEntries = countResult[0].total;
//     const totalPages = Math.ceil(totalEntries / limit);

//     // Get filtered and paginated entries
//     const query = `
//       SELECT * FROM approved_list 
//       WHERE 1=1 ${syllabusFilter} ${classFilter}
//       ORDER BY dated DESC 
//       LIMIT ? OFFSET ?
//     `;

//     db.query(query, [limit, offset], (err, entries) => {
//       if (err) {
//         console.error('Error fetching approved entries:', err);
//         return res.status(500).render('error', { message: 'Database error' });
//       }

//       // Format dates
//       entries.forEach(entry => {
//         entry.dated = new Date(entry.dated).toLocaleDateString();
//       });

//       // Static syllabus options
//       const uniqueSyllabi = ['All', 'STATE', 'ICSE', 'CBSE'];
//       const uniqueClasses = ['All', ...Array.from({ length: 12 }, (_, i) => `Class ${i + 1}`)];

//       res.render('approved-list', {
//         entries,
//         currentPage: page,
//         totalPages,
//         uniqueSyllabi,
//         uniqueClasses
//       });
//     });
//   });
// });

// Create the approved_list table 

const createApprovedListTable = `
CREATE TABLE IF NOT EXISTS approved_list (
  id INT PRIMARY KEY,
  usn VARCHAR(20),
  name VARCHAR(255) NOT NULL,
  email VARCHAR(255),
  contact VARCHAR(20),
  class VARCHAR(50),
  father_name VARCHAR(255),
  mother_name VARCHAR(255),
  sex VARCHAR(20),
  father_occupation VARCHAR(255),
  mother_occupation VARCHAR(255),
  syllabus VARCHAR(50),
  message TEXT,
  dated TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_syllabus (syllabus),
  INDEX idx_class (class)
);`


db.query(createApprovedListTable, (err) => {
  if (err) {
    console.error('Error creating approved_list table:', err);
  } else {
    console.log('approved_list table ready');
  }
});

// Start the server
app.listen(3000, () => {
  console.log('Server running on port 3000');
});