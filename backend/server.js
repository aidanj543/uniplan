require("dotenv").config();

const express = require("express");
const { Pool } = require("pg");
const bcrypt = require("bcrypt");
const cors = require("cors");

const app = express();

app.use(cors());
app.use(express.json());

const pool = new Pool({
  user: process.env.DB_USER || "postgres",
  host: process.env.DB_HOST || "localhost",
  database: process.env.DB_NAME || "uniplan",
  password: process.env.DB_PASSWORD || "password",
  port: Number(process.env.DB_PORT) || 5432,
});

const getUserTableColumns = async () => {
  const { rows } = await pool.query(
    `SELECT column_name
     FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = 'users'`
  );

  return new Set(rows.map((row) => row.column_name));
};

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

    const userColumns = await getUserTableColumns();
    const password_hash = await bcrypt.hash(password, 10);
    const storesHashedPassword = userColumns.has("password_hash");
    const passwordColumn = storesHashedPassword ? "password_hash" : "password";
    const returnCreatedAt = userColumns.has("created_at")
      ? ", created_at"
      : "";

    const result = await pool.query(
      `INSERT INTO users (first_name, last_name, email, ${passwordColumn})
       VALUES ($1, $2, $3, $4)
       RETURNING id, first_name, last_name, email${returnCreatedAt}`,
      [first_name, last_name, email, password_hash]
    );

    return res.status(201).json(result.rows[0]);
  } catch (err) {
    if (err.code === "23505") {
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

    const userColumns = await getUserTableColumns();
    const hasPasswordHash = userColumns.has("password_hash");
    const hasPassword = userColumns.has("password");

    if (!hasPasswordHash && !hasPassword) {
      return res.status(500).json({ message: "Users table has no password column" });
    }

    const selectedPasswordColumn = hasPasswordHash ? "password_hash" : "password";
    const result = await pool.query(
      `SELECT id, first_name, last_name, email, ${selectedPasswordColumn}
       FROM users
       WHERE email = $1`,
      [email]
    );

    if (result.rowCount === 0) {
      return res.status(401).json({ message: "Invalid credentials" });
    }

    const user = result.rows[0];
    const storedPassword = user[selectedPasswordColumn];
    const looksLikeBcryptHash =
      typeof storedPassword === "string" && storedPassword.startsWith("$2");
    const isMatch = looksLikeBcryptHash
      ? await bcrypt.compare(password, storedPassword)
      : password === storedPassword;

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

const PORT = Number(process.env.PORT) || 5000;
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
