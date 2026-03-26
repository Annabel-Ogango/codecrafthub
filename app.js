// CodeCraftHub - Simple REST API for managing courses
// Node.js + Express + JSON file storage (courses.json)

const express = require('express'); // Added this to the top
const cors = require('cors');       // Added this to the top
const fs = require('fs').promises;
const path = require('path');

// Create an Express app
const app = express();

// Middleware - MUST be here to work with Bolt
app.use(cors()); 
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
    await fs.mkdir(path.dirname(DATA_FILE), { recursive: true });
    await fs.writeFile(DATA_FILE, '[]', 'utf8');
  }
}

// Utility: load courses from the JSON file
async function loadCourses() {
  await ensureDataFile();
  const content = await fs.readFile(DATA_FILE, 'utf8');
  try {
    const data = JSON.parse(content);
    return Array.isArray(data) ? data : [];
  } catch {
    await fs.writeFile(DATA_FILE, '[]', 'utf8');
    return [];
  }
}

// Utility: save courses to the JSON file
async function saveCourses(courses) {
  await fs.writeFile(DATA_FILE, JSON.stringify(courses, null, 2), 'utf8');
}

// Utility: validate date in YYYY-MM-DD format
function isValidDateYYYYMMDD(dateStr) {
  if (typeof dateStr !== 'string') return false;
  const ymdRegex = /^\d{4}-\d{2}-\d{2}$/;
  if (!ymdRegex.test(dateStr)) return false;
  const date = new Date(dateStr);
  if (Number.isNaN(date.getTime())) return false;
  const [y, m, d] = dateStr.split('-').map(Number);
  return date.getUTCFullYear() === y && (date.getUTCMonth() + 1) === m && date.getUTCDate() === d;
}

// Utility: generate next ID
function getNextId(courses) {
  const maxId = courses.reduce((max, c) => (typeof c.id === 'number' && c.id > max ? c.id : max), 0);
  return maxId + 1;
}

// --- ROUTES ---

app.get('/api/courses', async (req, res) => {
  try {
    const courses = await loadCourses();
    res.json(courses);
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.get('/api/courses/:id', async (req, res) => {
  try {
    const id = Number(req.params.id);
    const courses = await loadCourses();
    const course = courses.find(c => c.id === id);
    if (!course) return res.status(404).json({ error: 'Not found' });
    res.json(course);
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.post('/api/courses', async (req, res) => {
  try {
    const { name, description, target_date, status } = req.body;
    if (!name || !description || !target_date || !status) {
      return res.status(400).json({ error: 'Missing fields' });
    }
    const courses = await loadCourses();
    const newCourse = { id: getNextId(courses), name, description, target_date, status, created_at: new Date().toISOString() };
    courses.push(newCourse);
    await saveCourses(courses);
    res.status(201).json(newCourse);
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.put('/api/courses/:id', async (req, res) => {
  try {
    const id = Number(req.params.id);
    const { name, description, target_date, status } = req.body;
    const courses = await loadCourses();
    const idx = courses.findIndex(c => c.id === id);
    if (idx === -1) return res.status(404).json({ error: 'Not found' });
    courses[idx] = { ...courses[idx], name, description, target_date, status };
    await saveCourses(courses);
    res.json(courses[idx]);
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.delete('/api/courses/:id', async (req, res) => {
  try {
    const id = Number(req.params.id);
    const courses = await loadCourses();
    const idx = courses.findIndex(c => c.id === id);
    if (idx === -1) return res.status(404).json({ error: 'Not found' });
    const [deleted] = courses.splice(idx, 1);
    await saveCourses(courses);
    res.json(deleted);
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.get('/', (req, res) => {
  res.send('CodeCraftHub API is running.');
});

const PORT = 5000;
(async () => {
  await ensureDataFile();
  app.listen(PORT, () => {
    console.log(`CodeCraftHub API is listening on http://localhost:${PORT}`);
  });
})();