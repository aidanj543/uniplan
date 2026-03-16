require("dotenv").config();

const express = require("express");
const { Pool } = require("pg");
const bcrypt = require("bcrypt");
const cors = require("cors");

const app = express();

app.use(cors());
app.use(express.json());

const pool = new Pool({
    user: "postgres",
    host: "localhost",
    database: "uniplan",
    password: "password",
    port: 5432,
});

app.post("/register", async (req, res) => {
  console.log("REGISTER BODY:", req.body);

  try {

    const { first_name, last_name, email, password } = req.body;

    const result = await pool.query(
      "INSERT INTO users (first_name, last_name, email, password) VALUES ($1,$2,$3,$4) RETURNING *",
      [first_name, last_name, email, password]
    );

    res.json(result.rows[0]);

  } catch (err) {

    console.error("REGISTER ERROR:", err);
    res.status(500).json({ message: err.message });

  }
});