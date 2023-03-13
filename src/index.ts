import express, {Application, Response, Request} from "express";

// npm start to compile and run
const app : Application = express();
const port = 3002;

app.listen(port, ()=>console.log(`App running on port ${port}`));
