// require('dotenv').config({path : './env'})

import dotenv from "dotenv";
import connectDb from "./db/index.js";
import { app } from "./app.js";

dotenv.config({
    path:'./.env'
})

connectDb().then(()=>{
    const port=process.env.PORT||8000;
    app.on("error",(err)=>{
        console.log("err: ",err)
        throw err;
    })
    app.listen(port,()=>{
        console.log(`app is listening on port: http://localhost:${port}`);
    })
}).catch(
(err)=>{
    console.log("DB connection failed, error: ",err);
}
)