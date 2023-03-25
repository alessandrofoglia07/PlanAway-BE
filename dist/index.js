import express from "express";
import cors from 'cors';
import mysql from 'mysql';
import bcrypt from 'bcrypt';
import jwt from "jsonwebtoken";
const secretKey = 'i&cfUx@uBajZ#HxV3f0u8v$GgK4$buX7';
// npm start to compile and run
const app = express();
const port = 3002;
app.use(cors({
    origin: 'http://localhost:3000',
    credentials: true
}));
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.listen(port, () => console.log(`App running on port ${port}`));
// bcrypt 
const SaltRounds = 10;
// db connection
const db = mysql.createConnection({
    user: 'root',
    host: 'localhost',
    password: 'root123',
    database: 'planaway'
});
db.connect((err) => {
    if (err) {
        console.log('Error connecting' + err.stack);
    }
    else {
        console.log('Connected to MySQL db');
    }
});
app.post('/signup', (req, res) => {
    const username = req.body.username;
    const password = req.body.password;
    const email = req.body.email;
    db.query(`SELECT * FROM users WHERE email = '${email}'`, (err, result) => {
        if (err) {
            console.log(err);
            res.status(500);
        }
        else {
            if (result.length > 0) {
                res.send({ message: 'Email is already registered' });
                console.log('Email is already registered');
            }
            else {
                bcrypt.hash(password, SaltRounds, (err, hash) => {
                    if (err) {
                        res.status(500);
                        console.log(err);
                    }
                    else {
                        db.query(`INSERT INTO users (username, password, email) VALUES ('${username}', '${hash}', '${email}')`, (err, result) => {
                            if (err) {
                                res.status(500);
                                console.log(err);
                            }
                            else {
                                res.status(201).send({ message: 'User created' });
                                console.log('Sign up successful');
                            }
                        });
                    }
                });
            }
        }
    });
});
app.post('/login', (req, res) => {
    const email = req.body.email;
    const password = req.body.password;
    db.query(`SELECT * FROM users WHERE email = '${email}'`, (err, result) => {
        if (err) {
            console.log(err);
            res.status(500);
        }
        else {
            if (result.length > 0) {
                bcrypt.compare(password, result[0].password, (err, response) => {
                    if (err) {
                        res.status(500);
                        console.log(err);
                    }
                    else {
                        if (response) {
                            const token = jwt.sign({ email: email }, secretKey, { expiresIn: '1h' });
                            res.status(200).send({ message: 'Login successful', token: token });
                            console.log('Login successful');
                        }
                        else {
                            res.send({ message: 'Incorrect password' });
                            console.log('Incorrect password');
                        }
                    }
                });
            }
            else {
                res.send({ message: 'Email is not registered' });
                console.log('Email is not registered');
            }
        }
    });
});
