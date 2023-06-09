import 'dotenv/config'
import express, {Application, Response, Request} from "express";
import cors from 'cors';
import mysql from 'mysql2';
import { MysqlError } from 'mysql';
import bcrypt from 'bcrypt';
import jwt from "jsonwebtoken";
import { v4 as uuidv4 } from 'uuid';
import nodemailer from 'nodemailer';

// npm start to compile and run
const app : Application = express();
const port = 3002;
app.use(cors({
    origin: 'http://localhost:3000',
    credentials: true
}));
app.use(express.urlencoded({extended: true}));
app.use(express.json());

app.listen(port, ()=>{
    console.log(`App running on port ${port}`);
    tokenExpirationCheckAllUsers();
});

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
    } else {
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

const tokenExpirationCheckAllUsers = () => {
    db.query(`SELECT * FROM users`, (err: MysqlError, results: any) => {
        if (err) {
            console.log(err);
        } else {
            results.forEach((result: any) => {
                const idUser = result.idusers;
                const tokenExpirationDate = result.token_expiration_date;
                const isEmailVerified = result.is_email_verified;

                // if email is NOT verified and token is expired, delete user
                if (isEmailVerified === 0 && tokenExpirationDate < new Date()) {
                    console.log('Token expired, deleting user ' + idUser);
                    db.query(`DELETE FROM users WHERE idusers = '${idUser}'`, (err: MysqlError, result: any) => {
                        if (err) {
                            console.log(err);
                        } else {
                            console.log('User deleted');
                        }
                    });
                }
            });
        }
    });
};

const sendVerificationEmail = (email: string, verificationToken: string) => {
    const mailOptions = {
        from: process.env.AUTH_EMAIL,
        to: email,
        subject: 'Verify your email',
        text: `Click this link to verify your email: http://localhost:3000/verify/${verificationToken}\n This link will expire in 24 hours.`
    };

    transporter.sendMail(mailOptions, (err : Error | null, info : any) => {
        if (err) {
            console.log(err);
        } else {
            console.log('Verification email sent: ' + info.response);
        }
    });
};

const createTomorrowsDate = () => {
    const today = new Date();
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    return tomorrow;
}

app.post('/signup', (req: Request, res: Response) => {
    tokenExpirationCheckAllUsers();
    const username : string = req.body.username;
    const password : string = req.body.password;
    const email : string = req.body.email;
    const verificationToken : string = uuidv4();

    db.query(`SELECT * FROM users WHERE email = '${email}'`, (err: MysqlError, result: string) => {
        if (err) {
            console.log(err);
        } else {
            if (result.length > 0) {
                res.send({ message: 'Email is already registered' });
                console.log('Email is already registered');
            } else {
                bcrypt.hash(password, SaltRounds, (err : Error | undefined, hash : string) => {
                    if (err) {
                        res.status(500);
                        console.log(err);
                    } else {
                        db.query(`INSERT INTO users (username, email, password, balance, token, is_email_verified, token_expiration_date) VALUES ('${username}', '${email}', '${hash}', 0, '${verificationToken}', 0, '${createTomorrowsDate()}')`, (err: MysqlError, result: string) => {
                            if (err) {
                                res.status(500);
                                console.log(err);
                            } else {
                                res.send({ message: 'User created' });
                                console.log('Token inserted');
                                sendVerificationEmail(email, verificationToken);
                            }
                        });
                    }
                })
            }
        }
    });
});

const verifyEmail = (token: string, callback: (resultCode: number)=>void) => {
    let resultCode : number
    db.query(`SELECT * FROM users WHERE token = '${token}'`, (err: MysqlError, result: any) => {
        if (err) {
            console.log(err);
            resultCode = 0;
        } else {
            if (result.length > 0) {
                const is_email_verified = result[0].is_email_verified;
                if (is_email_verified === 1) {
                    console.log('Email already verified');
                    resultCode = 3;
                };
                const userId = result[0].idusers;
                db.query('UPDATE users SET is_email_verified = 1 WHERE idusers = ?', [userId]);
                console.log('Email verified');
                resultCode = 1;
            } else {
                console.log('Invalid token');
                resultCode = 2;
            }
        }
        callback(resultCode);
    });
};

app.get('/verify/:token', async (req: Request, res: Response) => {
    tokenExpirationCheckAllUsers();
    const token : string = req.params.token;
    console.log('Verification request with token: \n' + token);

    verifyEmail(token, (resultCode: number) => {
        if (resultCode === 0) {
            res
                .status(500)
                .send({ message: '500: Server error!' })
        } else if (resultCode === 1) {
            res.send({ message: 'Email verified... Successfully!' });
        } else if (resultCode === 2) {
            res.send({ message: 'Invalid token! Try again or ask for support' });
        } else if (resultCode === 3) {
            res.send({ message: 'Email is already verified' });
        };
    })
});

app.post('/login', (req: Request, res: Response) => {
    tokenExpirationCheckAllUsers();
    const email : string = req.body.email;
    const password : string = req.body.password;

    db.query(`SELECT * FROM users WHERE email = '${email}'`, (err: MysqlError, result: any) => {
        if (err) {
            console.log(err);
            res.status(500);
        } else {
            if (result.length > 0 && result[0].is_email_verified === 1) {
                bcrypt.compare(password, result[0].password, (err : Error | undefined, response : boolean) => {
                    if (err) {
                        res.status(500);
                        console.log(err);
                    } else {
                        if (response) {
                            const username = result[0].username;
                            const id = result[0].idusers;
                            const token = jwt.sign({id: id, email: email, username: username}, process.env.ACCESS_TOKEN_SECRET_KEY!);
                            res.status(200).send({message: 'Login successful', token: token, id: id, username: username, email: email});
                            console.log('Login successful');
                        } else {
                            res.send({message: 'Incorrect password'});
                            console.log('Incorrect password');
                        }
                    }
                })
            } else {
                res.send({message: 'Email is not registered or email is not verified'});
                console.log('Email is not registered or email is not verified');
            }
        }
    })
});

// Decomment this to use authentication middleware
// const authenticateToken = (req: any, res: Response, next: any) => {
//     const authHeader = req.headers['authorization'];
//     const token = authHeader && authHeader.split(' ')[1];
//     if (token == null) return res.sendStatus(401);

//     jwt.verify(token, process.env.ACCESS_TOKEN_SECRET_KEY!, (err: any, user: any) => {
//         if (err) return res.sendStatus(403);
//         req.user = user;
//         next();
//     })
// };

app.post('/purchases', (req: Request, res: Response) => {
    tokenExpirationCheckAllUsers();
    const user_id : number = req.body.user_id;
    const item_name : any[] = req.body.cartItems;
    const price : number = req.body.price;

    db.query(`INSERT INTO purchases (user_id, item_name, price) VALUES ('${user_id}', '${item_name}', '${price}')`, (err: MysqlError, result: string) => {
        if (err) {
            res.status(500);
            console.log(err);
        } else {
            db.query(`UPDATE users SET balance = balance - ${price} WHERE idusers = ${user_id}`, (err: MysqlError, result: string) => {
                if (err) {
                    res.status(500);
                    console.log(err);
                }});
            res.status(201).send({message: 'Purchase created'});
            console.log('Purchase successful');
        }
    })
});

app.post('/addMoney', (req: Request, res: Response) => {
    tokenExpirationCheckAllUsers();
    const user_id : number = req.body.user_id;
    const amount : number = req.body.amount;

    db.query(`UPDATE users SET balance = balance + ${amount} WHERE idusers = ${user_id}`, (err: MysqlError, result: string) => {
        if (err) {
            res.status(500);
            console.log(err);
        } else {
            res.status(201).send({message: 'Money added'});
            console.log('Money added');
        }
    })
});

app.post('/removeMoney', (req: Request, res: Response) => {
    tokenExpirationCheckAllUsers();
    const user_id : number = req.body.user_id;
    const amount : number = req.body.amount;

    db.query(`UPDATE users SET balance = balance - ${amount} WHERE idusers = ${user_id}`, (err: MysqlError, result: string) => {
        if (err) {
            res.status(500);
            console.log(err);
        } else {
            res.status(201).send({message: 'Money removed'});
            console.log('Money removed');
        }
    })
});

app.get('/getBalance', (req: Request, res: Response) => {
    tokenExpirationCheckAllUsers();
    const user_id = req.query.user_id;

    db.query(`SELECT balance FROM users WHERE idusers = ${user_id}`, (err: MysqlError, result: any) => {
        if (err) {
            res.status(500);
            console.log(err);
        } else {
            res.status(201).send({message: 'Balance returned', balance: result[0].balance});
        }
    })
});