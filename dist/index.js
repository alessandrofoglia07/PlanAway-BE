import 'dotenv/config';
import express from "express";
import cors from 'cors';
import mysql from 'mysql';
import bcrypt from 'bcrypt';
import jwt from "jsonwebtoken";
import { v4 as uuidv4 } from 'uuid';
import nodemailer from 'nodemailer';
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
let transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: process.env.AUTH_EMAIL,
        pass: process.env.AUTH_PASSWORD
    }
});
const sendVerificationEmail = (email, verificationToken) => {
    const mailOptions = {
        from: process.env.AUTH_EMAIL,
        to: email,
        subject: 'Verify your email',
        text: `Click this link to verify your email: http://localhost:3000/verify/${verificationToken}\n This link will expire in 24 hours.`
    };
    transporter.sendMail(mailOptions, (err, info) => {
        if (err) {
            console.log(err);
        }
        else {
            console.log('Verification email sent: ' + info.response);
        }
    });
};
app.post('/signup', (req, res) => {
    const username = req.body.username;
    const password = req.body.password;
    const email = req.body.email;
    const verificationToken = uuidv4();
    db.query(`SELECT * FROM users WHERE email = '${email}'`, (err, result) => {
        if (err) {
            console.log(err);
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
                        db.query(`INSERT INTO users (username, email, password, balance, token, is_email_verified, token_expiration_date) VALUES ('${username}', '${email}', '${hash}', 0, '${verificationToken}', 0, DATE_ADD(NOW(), INTERVAL 1 DAY))`, (err, result) => {
                            if (err) {
                                res.status(500);
                                console.log(err);
                            }
                            else {
                                res.send({ message: 'User created' });
                                console.log('Token inserted');
                                sendVerificationEmail(email, verificationToken);
                            }
                        });
                    }
                });
            }
        }
    });
});
//TO FIX!
const verifyEmail = async (token) => {
    try {
        const [rows] = await db.query('SELECT * FROM users WHERE token = ?', [token]);
        if (!rows || rows.length === 0) {
            return { message: 'Invalid token' };
        }
        if (rows) {
            const userId = rows[0].idusers;
            await db.query('UPDATE users SET is_email_verified = 1 WHERE idusers = ?', [userId]);
            return { message: 'Email verified' };
        }
        else {
            return { message: 'Invalid token' };
        }
    }
    catch (err) {
        throw new Error(err.message);
    }
};
app.get('/verify/:token', async (req, res) => {
    const token = req.params.token;
    verifyEmail(token);
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
            if (result.length > 0 && result[0].is_email_verified === 1) {
                bcrypt.compare(password, result[0].password, (err, response) => {
                    if (err) {
                        res.status(500);
                        console.log(err);
                    }
                    else {
                        if (response) {
                            const username = result[0].username;
                            const id = result[0].idusers;
                            const token = jwt.sign({ id: id, email: email, username: username }, process.env.ACCESS_TOKEN_SECRET_KEY);
                            res.status(200).send({ message: 'Login successful', token: token, id: id, username: username, email: email });
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
                res.send({ message: 'Email is not registered or email is not verified' });
                console.log('Email is not registered or email is not verified');
            }
        }
    });
});
const authenticateToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    if (token == null)
        return res.sendStatus(401);
    jwt.verify(token, process.env.ACCESS_TOKEN_SECRET_KEY, (err, user) => {
        if (err)
            return res.sendStatus(403);
        req.user = user;
        next();
    });
};
app.post('/purchases', (req, res) => {
    const user_id = req.body.user_id;
    const item_name = req.body.cartItems;
    const price = req.body.price;
    db.query(`INSERT INTO purchases (user_id, item_name, price) VALUES ('${user_id}', '${item_name}', '${price}')`, (err, result) => {
        if (err) {
            res.status(500);
            console.log(err);
        }
        else {
            db.query(`UPDATE users SET balance = balance - ${price} WHERE idusers = ${user_id}`, (err, result) => {
                if (err) {
                    res.status(500);
                    console.log(err);
                }
            });
            res.status(201).send({ message: 'Purchase created' });
            console.log('Purchase successful');
        }
    });
});
app.post('/addMoney', (req, res) => {
    const user_id = req.body.user_id;
    const amount = req.body.amount;
    db.query(`UPDATE users SET balance = balance + ${amount} WHERE idusers = ${user_id}`, (err, result) => {
        if (err) {
            res.status(500);
            console.log(err);
        }
        else {
            res.status(201).send({ message: 'Money added' });
            console.log('Money added');
        }
    });
});
app.post('/removeMoney', (req, res) => {
    const user_id = req.body.user_id;
    const amount = req.body.amount;
    db.query(`UPDATE users SET balance = balance - ${amount} WHERE idusers = ${user_id}`, (err, result) => {
        if (err) {
            res.status(500);
            console.log(err);
        }
        else {
            res.status(201).send({ message: 'Money removed' });
            console.log('Money removed');
        }
    });
});
app.get('/getBalance', (req, res) => {
    const user_id = req.query.user_id;
    db.query(`SELECT balance FROM users WHERE idusers = ${user_id}`, (err, result) => {
        if (err) {
            res.status(500);
            console.log(err);
        }
        else {
            res.status(201).send({ message: 'Balance returned', balance: result[0].balance });
        }
    });
});
