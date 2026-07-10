import express, { type Express, type Request, type Response } from 'express';

const app: Express = express();
const port = 3000;

const path = require('path');
app.use("/static",express.static(path.join(__dirname, 'public')));

app.get('/', (req: Request, res: Response)=>{
    res.send('Hello World');
});

console.log(__dirname);

app.listen(port, ()=>{
    console.log(`Running on port ${port}`);
});