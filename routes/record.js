const express = require("express");
const mysql = require("mysql");
const router = express.Router();
const Multer = require("multer");
const imgUpload = require("../modules/imgUpload");

const multer = Multer({
  storage: Multer.MemoryStorage,
  fileSize: 5 * 1024 * 1024,
});

// TODO: Sesuaikan konfigurasi database
const connection = mysql.createConnection({
  host: "public_ip_sql_instance_Anda",
  user: "root",
  database: "nama_database_Anda",
  password: "password_sql_Anda",
});

// Contoh implementasi registrasi pengguna
router.post("/register", async (req, res) => {
  const { username, email, password } = req.body;
  // Hash password sebelum menyimpan ke database
  const hashedPassword = await hashPassword(password);

  const query = "INSERT INTO user (username, email, password) VALUES (?, ?, ?)";
  connection.query(query, [username, email, hashedPassword], (err, result) => {
    if (err) {
      res.status(500).send({ message: err.sqlMessage });
    } else {
      res.send({ message: "Registration Successful" });
    }
  });
});

// Contoh implementasi login
router.post("/login", async (req, res) => {
  const { email, password } = req.body;

  const query = "SELECT * FROM user WHERE email = ?";
  connection.query(query, [email], async (err, results) => {
    if (err) {
      res.status(500).send({ message: err.sqlMessage });
    } else {
      if (results.length > 0) {
        const user = results[0];
        const passwordMatch = await comparePassword(password, user.password);
        if (passwordMatch) {
          // Generate access token and store it in the akses_token table
          const accessToken = generateAccessToken(user.id);
          const insertTokenQuery =
            "INSERT INTO akses_token (id_user, acces_token) VALUES (?, ?)";
          connection.query(
            insertTokenQuery,
            [user.id, accessToken],
            (tokenErr) => {
              if (tokenErr) {
                res.status(500).send({ message: tokenErr.sqlMessage });
              } else {
                res.json({ accessToken });
              }
            }
          );
        } else {
          res.status(401).send({ message: "Incorrect password" });
        }
      } else {
        res.status(404).send({ message: "User not found" });
      }
    }
  });
});

// Contoh middleware otorisasi
const verifyToken = (req, res, next) => {
  const accessToken = req.headers.authorization;

  if (!accessToken) {
    return res.status(401).send({ message: "Access token is missing" });
  }

  // Verifikasi token, jika valid, set data pengguna ke req.user
  verifyAccessToken(accessToken, (err, user) => {
    if (err) {
      return res.status(403).send({ message: "Invalid access token" });
    }
    req.user = user;
    next();
  });
};

// Contoh penggunaan middleware pada suatu route
router.get("/protected", verifyToken, (req, res) => {
  res.send({ message: "This is a protected route" });
});

// Contoh implementasi fungsi pembuatan dan verifikasi token
const jwt = require("jsonwebtoken");

const generateAccessToken = (userId) => {
  return jwt.sign({ userId }, "secretKey", { expiresIn: "1h" });
};

const verifyAccessToken = (token, callback) => {
  jwt.verify(token, "secretKey", callback);
};

router.get("/dashboard", (req, res) => {
  const query =
    "select (select count(*) from records where month(records.date) = month(now()) AND year(records.date) = year(now())) as month_records, (select sum(amount) from records) as total_amount;";
  connection.query(query, (err, rows, field) => {
    if (err) {
      res.status(500).send({ message: err.sqlMessage });
    } else {
      res.json(rows);
    }
  });
});

router.get("/getrecords", (req, res) => {
  const query = "SELECT * FROM records";
  connection.query(query, (err, rows, field) => {
    if (err) {
      res.status(500).send({ message: err.sqlMessage });
    } else {
      res.json(rows);
    }
  });
});

router.get("/getlast10records", (req, res) => {
  const query = "SELECT * FROM records ORDER BY date DESC LIMIT 10";
  connection.query(query, (err, rows, field) => {
    if (err) {
      res.status(500).send({ message: err.sqlMessage });
    } else {
      res.json(rows);
    }
  });
});

router.get("/gettopexpense", (req, res) => {
  const query =
    "SELECT * FROM records WHERE amount < 0 ORDER BY amount ASC LIMIT 10";
  connection.query(query, (err, rows, field) => {
    if (err) {
      res.status(500).send({ message: err.sqlMessage });
    } else {
      res.json(rows);
    }
  });
});

router.get("/getrecord/:id", (req, res) => {
  const id = req.params.id;

  const query = "SELECT * FROM records WHERE id = ?";
  connection.query(query, [id], (err, rows, field) => {
    if (err) {
      res.status(500).send({ message: err.sqlMessage });
    } else {
      res.json(rows);
    }
  });
});

router.get("/searchrecords", (req, res) => {
  const s = req.query.s;

  console.log(s);
  const query =
    "SELECT * FROM records WHERE name LIKE '%" +
    s +
    "%' or notes LIKE '%" +
    s +
    "%'";
  connection.query(query, (err, rows, field) => {
    if (err) {
      res.status(500).send({ message: err.sqlMessage });
    } else {
      res.json(rows);
    }
  });
});

router.post(
  "/insertrecord",
  multer.single("attachment"),
  imgUpload.uploadToGcs,
  (req, res) => {
    const name = req.body.name;
    const amount = req.body.amount;
    const date = req.body.date;
    const notes = req.body.notes;
    var imageUrl = "";

    if (req.file && req.file.cloudStoragePublicUrl) {
      imageUrl = req.file.cloudStoragePublicUrl;
    }

    const query =
      "INSERT INTO records (name, amount, date, notes, attachment) values (?, ?, ?, ?, ?)";

    connection.query(
      query,
      [name, amount, date, notes, imageUrl],
      (err, rows, fields) => {
        if (err) {
          res.status(500).send({ message: err.sqlMessage });
        } else {
          res.send({ message: "Insert Successful" });
        }
      }
    );
  }
);

router.put(
  "/editrecord/:id",
  multer.single("attachment"),
  imgUpload.uploadToGcs,
  (req, res) => {
    const id = req.params.id;
    const name = req.body.name;
    const amount = req.body.amount;
    const date = req.body.date;
    const notes = req.body.notes;
    var imageUrl = "";

    if (req.file && req.file.cloudStoragePublicUrl) {
      imageUrl = req.file.cloudStoragePublicUrl;
    }

    const query =
      "UPDATE records SET name = ?, amount = ?, date = ?, notes = ?, attachment = ? WHERE id = ?";

    connection.query(
      query,
      [name, amount, date, notes, imageUrl, id],
      (err, rows, fields) => {
        if (err) {
          res.status(500).send({ message: err.sqlMessage });
        } else {
          res.send({ message: "Update Successful" });
        }
      }
    );
  }
);

router.delete("/deleterecord/:id", (req, res) => {
  const id = req.params.id;

  const query = "DELETE FROM records WHERE id = ?";
  connection.query(query, [id], (err, rows, fields) => {
    if (err) {
      res.status(500).send({ message: err.sqlMessage });
    } else {
      res.send({ message: "Delete successful" });
    }
  });
});

router.post(
  "/uploadImage",
  multer.single("image"),
  imgUpload.uploadToGcs,
  (req, res, next) => {
    const data = req.body;
    if (req.file && req.file.cloudStoragePublicUrl) {
      data.imageUrl = req.file.cloudStoragePublicUrl;
    }

    res.send(data);
  }
);

module.exports = router;
