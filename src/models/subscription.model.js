import mongoose, { Schema } from "mongoose";

const subscriptionSchema = new Schema({
    Subscriber: {
        type: Schema.Types.ObjectId,
        ref: "User" //the user suscribing
    },
    channel: {
        type: Schema.Types.ObjectId,
        ref: "User" //the user Subscriber is suscribing to
    },
},{timestamps: true})

export const subscription = mongoose.model("Subscription", subscriptionSchema)