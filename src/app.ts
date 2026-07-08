import express, { type Express, type Request, type Response } from 'express';

const app: Express = express();

app.get('/', (req: Request, res: Response)=>{
    res.send('Hello Worlsdd');
});

app.listen(3000);

console.log("Running on port 3000");