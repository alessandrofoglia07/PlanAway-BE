import 'dotenv/config'
import express, {Application, Response, Request} from "express";
import cors from 'cors';
import mysql, { MysqlError } from 'mysql';
import bcrypt from 'bcrypt';
import jwt from "jsonwebtoken";

// npm start to compile and run
const app : Application = express();
const port = 3002;
app.use(cors({
    origin: 'http://localhost:3000',
    credentials: true
}));
app.use(express.urlencoded({extended: true}));
app.use(express.json());

app.listen(port, ()=>console.log(`App running on port ${port}`));

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


app.post('/signup', (req: Request, res: Response) => {
    const username : string = req.body.username;
    const password : string = req.body.password;
    const email : string = req.body.email;

    db.query(`SELECT * FROM users WHERE email = '${email}'`, (err: MysqlError, result: string) => {
        if (err) {
            console.log(err);
            res.status(500);
        } else {
            if (result.length > 0) {
                res.send({message: 'Email is already registered'});
                console.log('Email is already registered');
            } else {
                bcrypt.hash(password, SaltRounds, (err : Error | undefined, hash : string) => {
                    if (err) {
                        res.status(500);
                        console.log(err);
                    } else {
                        db.query(`INSERT INTO users (username, password, email) VALUES ('${username}', '${hash}', '${email}')`, (err : MysqlError, result : string) => {
                            if (err) {
                                res.status(500);
                                console.log(err);
                            } else {
                                res.status(201).send({message: 'User created'});
                                console.log('Sign up successful');
                            }
                        })
                    }
                })
            }
        }
    })
});

app.post('/login', (req: Request, res: Response) => {
    const email : string = req.body.email;
    const password : string = req.body.password;

    db.query(`SELECT * FROM users WHERE email = '${email}'`, (err: MysqlError, result: any) => {
        if (err) {
            console.log(err);
            res.status(500);
        } else {
            if (result.length > 0) {
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
                res.send({message: 'Email is not registered'});
                console.log('Email is not registered');
            }
        }
    })
});

const authenticateToken = (req: any, res: Response, next: any) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    if (token == null) return res.sendStatus(401);

    jwt.verify(token, process.env.ACCESS_TOKEN_SECRET_KEY!, (err: any, user: any) => {
        if (err) return res.sendStatus(403);
        req.user = user;
        next();
    })
};

app.post('/purchases', (req: any, res: Response) => {
    const user_id : number = req.body.user_id;
    const item_name : any[] = req.body.cartItems;
    const price : number = req.body.price;

    const result = db.query(`INSERT INTO purchases (user_id, item_name, price) VALUES ('${user_id}', '${item_name}', '${price}')`, (err: MysqlError, result: string) => {
        if (err) {
            res.status(500);
            console.log(err);
        } else {
            res.status(201).send({message: 'Purchase created'});
            console.log('Purchase successful');
        }
    })
});