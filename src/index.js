/*
import mongoose from "mongoose";
import { DB_NAME } from "./constants";

import express from "express"
const app = express()
;( async () => {
    try {
        await mongoose.connect(`${process.env.MONGODB_URI}/${DB_NAME}`)
        app.on("error" , (error) => {
            console.log("ERR: ", error);
            throw error
        })

        app.listen(process.env.PORT, () => {
            console.log(`App is listening on port ${process.env.PORT}`);
        })
    } catch (error) {
        console.error("ERROR: ", error)
        throw error
    }
})()
*/

import app from "./app.js";
import connectDB from "./db/connect.js";
import dotenv from 'dotenv'

dotenv.config({
    path: '.env'
})

connectDB()
.then(() => {
    app.listen(process.env.PORT || 8000)
    app.on("error" , (error) => {
        console.log("ERR: ", error);
        throw error
    })
})
.catch((error) => {
    console.log("MongoDB Connection Failed || ", error);
})