import express, {Application, Response, Request} from "express";
import cors from 'cors';
import mysql, { MysqlError } from 'mysql';
import bcrypt, { hash } from 'bcrypt';

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
})

db.connect((err) => {
    if (err) {
        console.log('Error connecting' + err.stack);
    } else {
        console.log('Connected to MySQL db');
    }
})


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
                        res.status(500)
                        console.log(err);
                    } else {
                        db.query(`INSERT INTO users (username, password, email) VALUES ('${username}', '${hash}', '${email}')`, (err : MysqlError, result : string) => {
                            if (err) {
                                res.status(500)
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
})

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
                        res.status(500)
                        console.log(err);
                    } else {
                        if (response) {
                            res.status(200).send({message: 'Login successful'});
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
})