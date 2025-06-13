//database schema
import { model, Schema, Types } from "mongoose";

const UserSchema = new Schema({
    username:{type:String, unique:true, required:true},
    password:{type:String, required:true},
    isBrainShared:{type:Boolean, default:false},
    publicEditAllowed:{type:Boolean, default:false}
})
const contentTypes = ["Documents", "Youtube", "X", "Links", "Videos", "Images"]//this is an ever increasing array
const ContentSchema = new Schema({
    link: {type:String, required:true},
    type: {type: String, enum:contentTypes, required:true},
    title: {type:String, required:true},
    tags: {type: Types.ObjectId, ref:"tags"},
    userId: {type: Types.ObjectId, ref:"users", required:true},
    contentAddedBy: {
        type: Schema.Types.Mixed,
        required: true,
        validate: {
            validator: function(v: any) {
                return typeof v === 'string' || v instanceof Types.ObjectId;
            },
            message: 'contentAddedBy must be either a string or ObjectId'
        }
    },
    contentUpdatedBy: {
        type: Schema.Types.Mixed,
        default:"no updation happend",
        validate: {
            validator: function(v: any) {
                return typeof v === 'string' || v instanceof Types.ObjectId;
            },
            message: 'contentUpdatedBy must be either a string or ObjectId'
        }
    }
})

const TagsSchema = new Schema({
    title:{type:String, required:true, unique:true}
})

const LinkSchema = new Schema({
    hash:{type:String, required:true, unique:true},
    userId: {type: Types.ObjectId, ref:"users", required:true, unique:true}
})

export const UserModel = model("users", UserSchema)
export const ContentModel = model("content", ContentSchema)
export const TagsModel = model("tags", TagsSchema)
export const LinkModel = model("links", LinkSchema)
