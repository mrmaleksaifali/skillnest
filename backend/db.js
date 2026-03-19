const { Pool } = require("pg");

const pool = new Pool({
  user: "postgres",
  host: "db", // ⚠️ important change
  database: "skillnest",
  password: "postgres",
  port: 5432,
});

module.exports = pool;