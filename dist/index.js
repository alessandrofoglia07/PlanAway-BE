import express from "express";
import cors from 'cors';
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
