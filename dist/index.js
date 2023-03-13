import express from "express";
// npm start to compile and run
const app = express();
const port = 3002;
app.listen(port, () => console.log(`App running on port ${port}`));
