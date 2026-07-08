import express, { type Express, type Request, type Response } from 'express';

const app: Express = express();
const port = 3000;

app.use(express.static("src/public"));

app.get('/', (req: Request, res: Response)=>{
    res.send('Hello World');
});

app.listen(port, ()=>{
    console.log(`Running on port ${port}`);
});