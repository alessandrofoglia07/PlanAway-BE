import express, {Application, Response, Request} from "express";
import cors from 'cors';

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
