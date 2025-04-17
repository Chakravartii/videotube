
import mongoose from "mongoose";
import {DB_NAME} from "../constants.js"

const connectDb = async()=>{
    try{
        const url=`${process.env.MONGODB_URI}/${DB_NAME}`
        const connectionInstance=await mongoose.connect(url)
        console.log("MongoDB connected && DB Host ",connectionInstance.connection.host);
        
    }
    catch(error){
        console.log("DB Connection failed & error is :",error);
        process.exit(1);
    }
}
export default connectDb;