// CodeCraftHub - Simple REST API for managing courses
// Node.js + Express + JSON file storage (courses.json)

const express = require('express');
const fs = require('fs').promises;
const path = require('path');

// Create an Express app
const app = express();

// Middleware to parse JSON request bodies
app.use(express.json());

// Path to the data file (JSON)
const DATA_FILE = path.join(__dirname, 'courses.json');

// Allowed status values
const ALLOWED_STATUSES = ['Not Started', 'In Progress', 'Completed'];

// Utility: ensure the data file exists; create it if it doesn't
async function ensureDataFile() {
  try {
    await fs.access(DATA_FILE);
  } catch {
    // If the file (or directory) doesn't exist, create them
    await fs.mkdir(path.dirname(DATA_FILE), { recursive: true });
    await fs.writeFile(DATA_FILE, '[]', 'utf8'); // start with an empty array
  }
}

// Utility: load courses from the JSON file
async function loadCourses() {
  await ensureDataFile();
  const content = await fs.readFile(DATA_FILE, 'utf8');
  try {
    const data = JSON.parse(content);
    // Basic sanity: ensure it's an array
    return Array.isArray(data) ? data : [];
  } catch {
    // If JSON is corrupted, reset to empty array
    await fs.writeFile(DATA_FILE, '[]', 'utf8');
    return [];
  }
}

// Utility: save courses to the JSON file
async function saveCourses(courses) {
  await fs.writeFile(DATA_FILE, JSON.stringify(courses, null, 2), 'utf8');
}

// Utility: validate date in YYYY-MM-DD format and check it's a real date
function isValidDateYYYYMMDD(dateStr) {
  if (typeof dateStr !== 'string') return false;
  const ymdRegex = /^\d{4}-\d{2}-\d{2}$/;
  if (!ymdRegex.test(dateStr)) return false;
  const date = new Date(dateStr);
  // Date must be valid and match the input (to catch 2020-02-30, etc.)
  if (Number.isNaN(date.getTime())) return false;
  // Ensure the string matches the date produced by the Date object (to catch anomalies)
  const [y, m, d] = dateStr.split('-').map(Number);
  return date.getUTCFullYear() === y && (date.getUTCMonth() + 1) === m && date.getUTCDate() === d;
}

// Utility: generate next ID (start at 1)
function getNextId(courses) {
  const maxId = courses.reduce((max, c) => (typeof c.id === 'number' && c.id > max ? c.id : max), 0);
  return maxId + 1;
}

// Route: GET /api/courses
// Description: Get all courses
app.get('/api/courses', async (req, res) => {
  try {
    const courses = await loadCourses();
    res.json(courses);
  } catch (err) {
    console.error('Error reading courses:', err);
    res.status(500).json({ error: 'Internal server error while reading courses' });
  }
});

// Route: GET /api/courses/:id
// Description: Get a specific course by id
app.get('/api/courses/:id', async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (Number.isNaN(id)) {
      return res.status(400).json({ error: 'Invalid course id' });
    }

    const courses = await loadCourses();
    const course = courses.find(c => c.id === id);
    if (!course) {
      return res.status(404).json({ error: 'Course not found' });
    }

    res.json(course);
  } catch (err) {
    console.error('Error fetching course by id:', err);
    res.status(500).json({ error: 'Internal server error while fetching course' });
  }
});

// Route: POST /api/courses
// Description: Add a new course
app.post('/api/courses', async (req, res) => {
  try {
    const { name, description, target_date, status } = req.body;

    // Validate required fields
    if (!name || !description || !target_date || !status) {
      return res.status(400).json({ error: 'Missing required fields: name, description, target_date, status' });
    }

    // Validate target_date format
    if (!isValidDateYYYYMMDD(target_date)) {
      return res.status(400).json({ error: 'target_date must be in format YYYY-MM-DD and be a valid date' });
    }

    // Validate status value
    if (!ALLOWED_STATUSES.includes(status)) {
      return res.status(400).json({ error: `Invalid status. Allowed values: ${ALLOWED_STATUSES.join(', ')}` });
    }

    // Load existing data and generate new course
    const courses = await loadCourses();
    const newCourse = {
      id: getNextId(courses),
      name,
      description,
      target_date,
      status,
      created_at: new Date().toISOString()
    };

    courses.push(newCourse);
    await saveCourses(courses);

    res.status(201).json(newCourse);
  } catch (err) {
    console.error('Error creating course:', err);
    res.status(500).json({ error: 'Internal server error while creating course' });
  }
});

// Route: PUT /api/courses/:id
// Description: Update an existing course (full replacement of fields except created_at)
app.put('/api/courses/:id', async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (Number.isNaN(id)) {
      return res.status(400).json({ error: 'Invalid course id' });
    }

    const { name, description, target_date, status } = req.body;

    // Validate required fields for an update
    if (!name || !description || !target_date || !status) {
      return res.status(400).json({ error: 'Missing required fields: name, description, target_date, status' });
    }

    if (!isValidDateYYYYMMDD(target_date)) {
      return res.status(400).json({ error: 'target_date must be in format YYYY-MM-DD and be a valid date' });
    }

    if (!ALLOWED_STATUSES.includes(status)) {
      return res.status(400).json({ error: `Invalid status. Allowed values: ${ALLOWED_STATUSES.join(', ')}` });
    }

    const courses = await loadCourses();
    const idx = courses.findIndex(c => c.id === id);
    if (idx === -1) {
      return res.status(404).json({ error: 'Course not found' });
    }

    // Preserve created_at; update other fields
    const existing = courses[idx];
    const updatedCourse = {
      id,
      name,
      description,
      target_date,
      status,
      created_at: existing.created_at
    };

    courses[idx] = updatedCourse;
    await saveCourses(courses);

    res.json(updatedCourse);
  } catch (err) {
    console.error('Error updating course:', err);
    res.status(500).json({ error: 'Internal server error while updating course' });
  }
});

// Route: DELETE /api/courses/:id
// Description: Delete a course
app.delete('/api/courses/:id', async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (Number.isNaN(id)) {
      return res.status(400).json({ error: 'Invalid course id' });
    }

    const courses = await loadCourses();
    const idx = courses.findIndex(c => c.id === id);
    if (idx === -1) {
      return res.status(404).json({ error: 'Course not found' });
    }

    const [deleted] = courses.splice(idx, 1);
    await saveCourses(courses);

    res.json(deleted);
  } catch (err) {
    console.error('Error deleting course:', err);
    res.status(500).json({ error: 'Internal server error while deleting course' });
  }
});

// Root route - optional friendly message
app.get('/', (req, res) => {
  res.send('CodeCraftHub API is running. Use /api/courses endpoints to manage courses.');
});

// Start the server on port 5000
const PORT = 5000;

// Ensure data file exists, then start listening
(async () => {
  try {
    await ensureDataFile();
    app.listen(PORT, () => {
      console.log(`CodeCraftHub API is listening on http://localhost:${PORT}`);
    });
  } catch (err) {
    console.error('Failed to start server:', err);
  }
})();