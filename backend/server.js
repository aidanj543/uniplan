require("dotenv").config();

const express = require("express");
const mysql = require("mysql2/promise");
const bcrypt = require("bcrypt");
const cors = require("cors");

const app = express();

app.use(cors());
app.use(express.json());

const dbConfig = {
  host: process.env.DB_HOST || "localhost",
  user: process.env.DB_USER || "root",
  password: process.env.DB_PASSWORD || "password",
  port: Number(process.env.DB_PORT) || 3306,
  waitForConnections: true,
  connectionLimit: 10,
};

const databaseName = process.env.DB_NAME || "uniplan";
let pool;

async function initializeDatabase() {
  const setupPool = mysql.createPool(dbConfig);

  await setupPool.query(`CREATE DATABASE IF NOT EXISTS \`${databaseName}\``);
  await setupPool.end();

  pool = mysql.createPool({
    ...dbConfig,
    database: databaseName,
  });
}

async function ensureTables() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id INT AUTO_INCREMENT PRIMARY KEY,
      first_name VARCHAR(100) NOT NULL,
      last_name VARCHAR(100) NOT NULL,
      email VARCHAR(255) UNIQUE NOT NULL,
      password_hash VARCHAR(255) NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS courses (
      id INT AUTO_INCREMENT PRIMARY KEY,
      user_id INT NOT NULL,
      name VARCHAR(255) NOT NULL,
      instructor VARCHAR(255),
      progress INT DEFAULT 0,
      assignments INT DEFAULT 0,
      exams INT DEFAULT 0,
      credits INT DEFAULT 0,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT courses_user_id_fk
        FOREIGN KEY (user_id) REFERENCES users(id)
        ON DELETE CASCADE,
      CONSTRAINT courses_progress_check CHECK (progress >= 0 AND progress <= 100)
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS tasks (
      id INT AUTO_INCREMENT PRIMARY KEY,
      user_id INT NOT NULL,
      title VARCHAR(255) NOT NULL,
      course VARCHAR(255),
      due_date DATE,
      priority VARCHAR(50) DEFAULT 'Medium',
      completed BOOLEAN DEFAULT FALSE,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT tasks_user_id_fk
        FOREIGN KEY (user_id) REFERENCES users(id)
        ON DELETE CASCADE
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS assignments (
      id INT AUTO_INCREMENT PRIMARY KEY,
      user_id INT NOT NULL,
      title VARCHAR(255) NOT NULL,
      course VARCHAR(255),
      due_date DATE,
      priority VARCHAR(50) DEFAULT 'Medium',
      status VARCHAR(80) DEFAULT 'To Start',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT assignments_user_id_fk
        FOREIGN KEY (user_id) REFERENCES users(id)
        ON DELETE CASCADE
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS events (
      id INT AUTO_INCREMENT PRIMARY KEY,
      user_id INT NOT NULL,
      title VARCHAR(255) NOT NULL,
      event_day VARCHAR(20),
      event_time TIME,
      event_type VARCHAR(80) DEFAULT 'Class',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT events_user_id_fk
        FOREIGN KEY (user_id) REFERENCES users(id)
        ON DELETE CASCADE
    )
  `);
}

function getUserId(req) {
  return Number(req.params.userId || req.body.user_id);
}

function isValidUserId(userId) {
  return Number.isInteger(userId) && userId > 0;
}

async function findById(table, id) {
  const [rows] = await pool.query(`SELECT * FROM ${table} WHERE id = ?`, [id]);
  return rows[0];
}

app.get("/health", async (_req, res) => {
  try {
    await pool.query("SELECT 1");
    res.json({ status: "ok" });
  } catch (err) {
    res.status(500).json({ status: "error", message: err.message });
  }
});

app.post("/register", async (req, res) => {
  try {
    const { first_name, last_name, email, password } = req.body;

    if (!first_name || !last_name || !email || !password) {
      return res.status(400).json({ message: "All fields are required" });
    }

    const password_hash = await bcrypt.hash(password, 10);

    const [result] = await pool.query(
      `INSERT INTO users (first_name, last_name, email, password_hash)
       VALUES (?, ?, ?, ?)`,
      [first_name, last_name, email, password_hash]
    );

    const user = await findById("users", result.insertId);

    return res.status(201).json({
      id: user.id,
      first_name: user.first_name,
      last_name: user.last_name,
      email: user.email,
      created_at: user.created_at,
    });
  } catch (err) {
    if (err.code === "ER_DUP_ENTRY") {
      return res.status(409).json({ message: "Email already registered" });
    }

    console.error("REGISTER ERROR:", err);
    return res.status(500).json({ message: "Registration failed" });
  }
});

app.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ message: "Email and password are required" });
    }

    const [rows] = await pool.query(
      `SELECT id, first_name, last_name, email, password_hash
       FROM users
       WHERE email = ?`,
      [email]
    );

    if (rows.length === 0) {
      return res.status(401).json({ message: "Invalid credentials" });
    }

    const user = rows[0];
    const isMatch = await bcrypt.compare(password, user.password_hash);

    if (!isMatch) {
      return res.status(401).json({ message: "Invalid credentials" });
    }

    return res.json({
      message: "Login successful",
      user: {
        id: user.id,
        first_name: user.first_name,
        last_name: user.last_name,
        email: user.email,
      },
    });
  } catch (err) {
    console.error("LOGIN ERROR:", err);
    return res.status(500).json({ message: "Login failed" });
  }
});

app.get("/users/:userId/courses", async (req, res) => {
  try {
    const userId = getUserId(req);

    if (!isValidUserId(userId)) {
      return res.status(400).json({ message: "Valid user id is required" });
    }

    const [rows] = await pool.query(
      `SELECT id, name, instructor, progress, assignments, exams, credits
       FROM courses
       WHERE user_id = ?
       ORDER BY created_at DESC`,
      [userId]
    );

    return res.json(rows);
  } catch (err) {
    console.error("GET COURSES ERROR:", err);
    return res.status(500).json({ message: "Could not load courses" });
  }
});

app.post("/courses", async (req, res) => {
  try {
    const { user_id, name, instructor, progress, assignments, exams, credits } = req.body;

    if (!isValidUserId(Number(user_id)) || !name) {
      return res.status(400).json({ message: "User id and course name are required" });
    }

    const [result] = await pool.query(
      `INSERT INTO courses (user_id, name, instructor, progress, assignments, exams, credits)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        user_id,
        name,
        instructor || "",
        Number(progress) || 0,
        Number(assignments) || 0,
        Number(exams) || 0,
        Number(credits) || 0,
      ]
    );

    const course = await findById("courses", result.insertId);

    return res.status(201).json(course);
  } catch (err) {
    console.error("CREATE COURSE ERROR:", err);
    return res.status(500).json({ message: "Could not create course" });
  }
});

app.get("/users/:userId/tasks", async (req, res) => {
  try {
    const userId = getUserId(req);

    if (!isValidUserId(userId)) {
      return res.status(400).json({ message: "Valid user id is required" });
    }

    const [rows] = await pool.query(
      `SELECT id, title, course, due_date, priority, completed
       FROM tasks
       WHERE user_id = ?
       ORDER BY completed ASC, due_date ASC, created_at DESC`,
      [userId]
    );

    return res.json(rows);
  } catch (err) {
    console.error("GET TASKS ERROR:", err);
    return res.status(500).json({ message: "Could not load tasks" });
  }
});

app.post("/tasks", async (req, res) => {
  try {
    const { user_id, title, course, due_date, priority } = req.body;

    if (!isValidUserId(Number(user_id)) || !title) {
      return res.status(400).json({ message: "User id and task title are required" });
    }

    const [result] = await pool.query(
      `INSERT INTO tasks (user_id, title, course, due_date, priority)
       VALUES (?, ?, ?, ?, ?)`,
      [user_id, title, course || "", due_date || null, priority || "Medium"]
    );

    const task = await findById("tasks", result.insertId);

    return res.status(201).json(task);
  } catch (err) {
    console.error("CREATE TASK ERROR:", err);
    return res.status(500).json({ message: "Could not create task" });
  }
});

app.get("/users/:userId/assignments", async (req, res) => {
  try {
    const userId = getUserId(req);

    if (!isValidUserId(userId)) {
      return res.status(400).json({ message: "Valid user id is required" });
    }

    const [rows] = await pool.query(
      `SELECT id, title, course, due_date, priority, status
       FROM assignments
       WHERE user_id = ?
       ORDER BY due_date ASC, created_at DESC`,
      [userId]
    );

    return res.json(rows);
  } catch (err) {
    console.error("GET ASSIGNMENTS ERROR:", err);
    return res.status(500).json({ message: "Could not load assignments" });
  }
});

app.post("/assignments", async (req, res) => {
  try {
    const { user_id, title, course, due_date, priority, status } = req.body;

    if (!isValidUserId(Number(user_id)) || !title) {
      return res.status(400).json({ message: "User id and assignment title are required" });
    }

    const [result] = await pool.query(
      `INSERT INTO assignments (user_id, title, course, due_date, priority, status)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [user_id, title, course || "", due_date || null, priority || "Medium", status || "To Start"]
    );

    const assignment = await findById("assignments", result.insertId);

    return res.status(201).json(assignment);
  } catch (err) {
    console.error("CREATE ASSIGNMENT ERROR:", err);
    return res.status(500).json({ message: "Could not create assignment" });
  }
});

app.get("/users/:userId/events", async (req, res) => {
  try {
    const userId = getUserId(req);

    if (!isValidUserId(userId)) {
      return res.status(400).json({ message: "Valid user id is required" });
    }

    const [rows] = await pool.query(
      `SELECT id, title, event_day, event_time, event_type
       FROM events
       WHERE user_id = ?
       ORDER BY created_at DESC`,
      [userId]
    );

    return res.json(rows);
  } catch (err) {
    console.error("GET EVENTS ERROR:", err);
    return res.status(500).json({ message: "Could not load events" });
  }
});

app.post("/events", async (req, res) => {
  try {
    const { user_id, title, event_day, event_time, event_type } = req.body;

    if (!isValidUserId(Number(user_id)) || !title) {
      return res.status(400).json({ message: "User id and event title are required" });
    }

    const [result] = await pool.query(
      `INSERT INTO events (user_id, title, event_day, event_time, event_type)
       VALUES (?, ?, ?, ?, ?)`,
      [user_id, title, event_day || "", event_time || null, event_type || "Class"]
    );

    const event = await findById("events", result.insertId);

    return res.status(201).json(event);
  } catch (err) {
    console.error("CREATE EVENT ERROR:", err);
    return res.status(500).json({ message: "Could not create event" });
  }
});

const PORT = Number(process.env.PORT) || 5001;
initializeDatabase()
  .then(ensureTables)
  .then(() => {
    app.listen(PORT, () => {
      console.log(`Server running on http://localhost:${PORT}`);
    });
  })
  .catch((err) => {
    console.error("DATABASE SETUP ERROR:", err);
    process.exit(1);
  });
