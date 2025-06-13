import * as dotenv from "dotenv";
dotenv.config();
import express, { type Request, type Response } from "express";
import bcrypt, { hash } from "bcrypt";
import { z } from "zod";
import jwt from "jsonwebtoken";
import { ContentModel, LinkModel, UserModel } from "./db";
import mongoose from "mongoose";
import { userMiddleWareForAuthAndPublic } from "./middleware";
import { hashGenerator } from "./hashGenerator";
import cors from "cors";
import multer from "multer";
import { deleteFromCloudinary, uploadOnCloudinary } from "./cloudinary";
const app = express();
app.use(express.json());
app.use(cors());
const port = process.env.SERVER_PORT;

//multer disc storage
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, "./src/uploads");
  },
  filename: function (req, file, cb) {
    cb(null, `${Date.now()}-${file.originalname}`);
  },
});

const upload = multer({ storage: storage });

//health checking end point of server
app.get("/api/v1/healthCheck", (req, res) => {
  res.status(200).json({ message: "Server is healthy" });
});

//user sign up end point
app.post("/api/v1/signup", async (req: Request, res: Response) => {
  try {
    const requiredBody = z.object({
      username: z
        .string()
        .min(3, "Please enter a valid username")
        .max(20, "Username is too long"),
      password: z
        .string()
        .min(8, "password is too short")
        .regex(
          /[A-Z]/,
          "password should contain atleast one uppercase character"
        )
        .regex(
          /[a-z]/,
          "password should contain atleast one lower case character"
        )
        .regex(/[0-9]/, "password should contain atleast one numeric character")
        .regex(
          /[\W_]/,
          "password should contain atleast one special character"
        ),
    });

    const parsedBody = requiredBody.safeParse(req.body);
    if (parsedBody.error) {
      throw new Error("Error occured while parsing the json body");
    }

    try {
      const { username, password } = req.body;

      const hashedPassword = await bcrypt.hash(password, 5);

      await UserModel.create({
        username: username,
        password: hashedPassword,
      });
      res.status(200).send("user signed up successfully on the app");
    } catch (err) {
      res.status(400).send("please enter a unique username");
    }
  } catch (err) {
    res.status(400).send(`Error occured while signing up ${err}`);
  }
});

//user sign in end point
app.post("/api/v1/login", async (req: Request, res: Response) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) {
      throw new Error(
        "Please enter username and password to singup or enter a unique username"
      );
    }
    const userData = await UserModel.findOne({
      username: username,
    });
    if (!userData) {
      throw new Error("user does not exists in the database");
    }
    const comparedPassword = await bcrypt.compare(password, userData.password);
    if (!comparedPassword) {
      throw new Error("Wrong password");
    }
    if (typeof process.env.JWT_USER_SECRET === "string") {
      const token = jwt.sign(
        {
          id: userData._id,
        },
        process.env.JWT_USER_SECRET
      );
      res.status(200).send(token);
    } else {
      throw new Error("Error occured while generatin a token");
    }
  } catch (err) {
    res.status(400).send(`Error occured while signing up on the app ${err}`);
  }
});

//user content creation end point
app.post(
  "/api/v1/content/:sharedBrainLink?",
  userMiddleWareForAuthAndPublic,
  async (req: Request, res: Response) => {
    try {
      const userId = req.userId;
      const createdBy = req.authenticatedUserId || "anonymous";
      const { type, link, title, tags } = req.body;
      if (!type || !link || !title) {
        throw new Error("enter all the field to create a content");
      }

      await ContentModel.create({
        type: type,
        link: link,
        title: title,
        tags: tags,
        userId: userId,
        contentAddedBy: createdBy,
      });
      res.status(200).send("Content added to the database successfully");
    } catch (err) {
      res.status(400).send(`Error occured while creating the content ${err}`);
    }
  }
);

//user fatching the data from content table for user using token
app.get(
  "/api/v1/content/:sharedBrainLink?",
  userMiddleWareForAuthAndPublic,
  async (req: Request, res: Response) => {
    try {
      const userId = req.userId;
      const userContentData = await ContentModel.find({
        userId: userId,
      }).populate("userId", "username"); //we populated the relationship by which we can get the content with the users details. we are saying that from userId give the user's username.

      res.status(200).json({
        userContentData: userContentData,
      });
    } catch (err) {
      res
        .status(400)
        .send(
          `Error occured while fetching the data from the database for the user ${err}`
        );
    }
  }
);

//put request to edit the content
app.patch(
  "/api/v1/content/:contentId/:sharedBrainLink?",
  userMiddleWareForAuthAndPublic,
  async (req: Request, res: Response) => {
    try {
      const userId = req.userId;
      const updatedBy = req.authenticatedUserId || "anonymous";
      const { type, link, title, tags } = req.body;
      const contentId = req.params.contentId;
      if (!contentId) {
        throw new Error("Please provide the content id to update the data");
      }
      const contentUpdation = await ContentModel.updateOne(
        {
          _id: contentId,
          userId: userId,
        },
        { $set: { type, link, title, tags, contentUpdatedBy: updatedBy } }
      );
      res.status(200).send(`Updated the data successfully`);
    } catch (err) {
      res.status(500).send(`Error occured while updating the data ${err}`);
    }
  }
);

//content deletion end point
app.delete(
  "/api/v1/content/:contentId/:sharedBrainLink?",
  userMiddleWareForAuthAndPublic,
  async (req: Request, res: Response) => {
    try {
      const userId = req.userId;
      const contentId = req.params.contentId;
      if (!contentId) {
        throw new Error("Please provide the contentId to delete the content");
      }
      const result = await ContentModel.deleteOne({
        _id: contentId,
        userId: userId,
      });
      if (result.deletedCount === 0) {
        res.status(400).send("You are not authorized to delete the data");
        return;
      }
      res.status(200).send("Content delete for the given id successfully");
    } catch (err) {
      res.status(400).send(`Error occured while deleting the content ${err}`);
    }
  }
);

//brain sharing end point
app.post(
  "/api/v1/brain/share",
  userMiddleWareForAuthAndPublic,
  async (req: Request, res: Response) => {
    try {
      const userDetails = await UserModel.findOne({
        _id: req.userId,
      });
      if (!userDetails) {
        res.status(400).send("User does not exists, Invalid token");
        return;
      }
      const { share } = req.body;
      if (share === true) {
        const existingHash = await LinkModel.findOne({
          userId: req.userId,
        });

        if (existingHash) {
          res.status(200).json({
            hash: existingHash.hash,
          });
          return;
        }

        const hash = hashGenerator(20);
        const result = await LinkModel.create({
          hash: hash,
          userId: req.userId,
        });

        userDetails.isBrainShared = true;

        await userDetails?.save({ validateBeforeSave: false });
        res.status(200).json({
          message: "Hash generated successfully",
          link: result.hash,
        });
        return;
      } else if (share === false) {
        await LinkModel.deleteOne({
          userId: req.userId,
        });
        res.status(200).send("hash Deleted successfully");
      }
    } catch (err) {
      res.status(400).send(`Error occured while generating the hash ${err}`);
    }
  }
);

//fetching shared brain data
app.get("/api/v1/brain/:shareLink", async (req: Request, res: Response) => {
  try {
    const hash = req.params.shareLink;
    const link = await LinkModel.findOne({
      hash: hash,
    });
    if (!link) {
      res.status(404).send("This Link does not exists");
      return;
    }
    const content = await ContentModel.find({
      userId: link.userId,
    }).populate("userId", "username");
    res.status(200).json({
      content,
    });
  } catch (err) {
    res.status(400).send(`Error occured while loading the page ${err}`);
  }
});

//upload content to the database
app.post(
  "/api/v1/upload/:sharedBrainLink?",
  userMiddleWareForAuthAndPublic,
  upload.single("uploadImage"),
  async (req, res) => {
    try {
      const { title, type } = req.body;
      const userId = req.userId;
      const createdBy = req.authenticatedUserId || "anonymous";
      if (!req.file) {
        throw new Error("No file uploaded");
      }
      const localFilePath = req.file.path;
      const cloudinaryResponse = await uploadOnCloudinary(localFilePath);
      if (!cloudinaryResponse) {
        res.status(500).send("Unable to upload your file");
      }
      const fileData = {
        title: title,
        type: type,
        link: cloudinaryResponse,
        userId: userId,
        contentAddedBy: createdBy,
      };
      const response = await ContentModel.create(fileData);
      if (!response) {
        throw new Error("Unable to upload the file");
      }
      res.status(200).send(response);
    } catch (error) {
      res.status(500).send(`Error occured while uploading: ${error}`);
    }
  }
);

//get your uploaded files
app.get(
  "/api/v1/uploads/:id/:sharedBrainLink?",
  userMiddleWareForAuthAndPublic,
  async (req, res) => {
    try {
      const id = req.params.id;
      const userId = req.userId;
      const files = await ContentModel.findOne({
        _id: id,
        userId: userId,
      });
      if (!files) {
        throw new Error("File not found");
      }
      res.status(200).send(`You can view your file here ${files.link!}`);
    } catch (error: any) {
      res.status(500).send(`Error: ${error}`);
    }
  }
);

//update the uploaded file
app.patch(
  "/api/v1/uploads/:id/:sharedBrainLink?",
  userMiddleWareForAuthAndPublic,
  upload.single("uploadImage"),
  async (req, res) => {
    try {
      const id = req.params.id;
      const contentUpdatedById = req.authenticatedUserId || "anonymous";
      const userId = req.userId;
      const { title } = req.body;
      const contentInfo = await ContentModel.findOne({
        _id: id,
        userId: userId,
      });
      if (!contentInfo) {
        res
          .status(400)
          .send("The content you are trying to access is not available");
      }
      const fileToBeDeletedLink = contentInfo?.link?.split("/");
      const fileCloudinaryId = fileToBeDeletedLink![8].split(".");
      const fileInfoToBeDeleted = {
        fileToBeDeleted: `${fileToBeDeletedLink![7]}/${fileCloudinaryId[0]}`,
        resourceType: `${fileToBeDeletedLink![4]}`,
        type: `${fileToBeDeletedLink![5]}`,
      };
      const deleteContentFromCloudinary = await deleteFromCloudinary(
        fileInfoToBeDeleted
      );
      if (deleteContentFromCloudinary === false) {
        res
          .status(500)
          .send("Error occured while removing the previous profile picture");
        return;
      }

      if (!req.file) {
        res.status(400).send("No new file uploaded");
        return;
      }
      const localFilePath = req.file.path;
      const cloudinaryResponse = await uploadOnCloudinary(localFilePath);
      if (!cloudinaryResponse) {
        res
          .status(500)
          .send("Unable to upload new file, Please try again later");
      }

      contentInfo!.title = title;
      contentInfo!.link = cloudinaryResponse;
      contentInfo!.contentUpdatedBy = contentUpdatedById;

      contentInfo?.save({ validateBeforeSave: false });

      res
        .status(200)
        .json({ message: "File updated successfully", contentInfo });
    } catch (error) {
      res.status(400).send(`Error occured ${error}`);
    }
  }
);

//delete uploaded files
app.delete(
  "/api/v1/deleteUploads/:id/:sharedBrainLink?",
  userMiddleWareForAuthAndPublic,
  async (req, res) => {
    try {
      const userId = req.userId;
      const contentToBeDeletedId = req.params.id;
      if (!contentToBeDeletedId) {
        throw new Error("Please select a content to delete");
      }
      const content = await ContentModel.findById({
        _id: contentToBeDeletedId,
        userId: userId,
      });
      if (!content) {
        throw new Error(
          "Content which you are trying to delete does not exists or you are not authorized to access the content"
        );
      }
      const contentToBeDeletedLink = content.link.split("/");
      const contentId = contentToBeDeletedLink[8].split(".");
      const fileInfoToBeDeleted = {
        fileToBeDeleted: `${contentToBeDeletedLink[7]}/${contentId[0]}`,
        resourceType: `${contentToBeDeletedLink[4]}`,
        type: `${contentToBeDeletedLink[5]}`,
      };
      const deleteContentFromCloudinary = await deleteFromCloudinary(
        fileInfoToBeDeleted
      );
      if (deleteContentFromCloudinary === false) {
        throw new Error("Error occured while deleting the file");
      }
      const result = await ContentModel.deleteOne({
        _id: contentToBeDeletedId,
        userId: userId,
      });
      if (result.deletedCount === 0) {
        throw new Error("Failed to delete content from the database");
      }
      res.status(200).send(`Content deleted successfully`);
    } catch (error) {
      res.status(400).send(`Error occured while deleting the content ${error}`);
    }
  }
);

// get the toggle button value
app.get("/api/v1/toggleValue", userMiddleWareForAuthAndPublic, async(req, res) => {
  try {
    const toggleValue = await UserModel.findOne(
      {
        _id: req.authenticatedUserId,
        isBrainShared: true
      }
    )
    toggleValue?.isBrainShared
    if(!toggleValue){
      throw new Error("Brain is not shared")
    }

    res.status(200).send(toggleValue.isBrainShared);
  } catch (error) {
    res.status(400).send(`Error occured while fetching the toggle button data ${error}`)
  }
})

// toggle the isEditable button
app.patch("/api/v1/toggleEditButton", userMiddleWareForAuthAndPublic, async(req, res) => {
  try {
    const { toggleValue }:{toggleValue:boolean} = req.body
    console.log(toggleValue);
    const isBrainShared = await UserModel.findOne(
      {
        _id: req.authenticatedUserId,
        isBrainShared: true
      }
    )
    console.log(isBrainShared)

    if(!isBrainShared){
      throw new Error("Either the brain is not shared or the user is not authorized")
    }

    const newUpdatedData = isBrainShared.publicEditAllowed = toggleValue
    console.log("new updated data", newUpdatedData);

    await isBrainShared.save({validateBeforeSave:false})

    res.status(200).send(`${toggleValue ? "Brain is editable now": "Brain is viewable only now"}`)

  } catch (error) {
    res.status(400).send(`Error occured while toggling the editabled button the content ${error}`);
  }
})

const main = async () => {
  if (typeof process.env.MONGO_URL === "string") {
    await mongoose.connect(process.env.MONGO_URL);
    console.log("connected to database successfully");
  } else {
    console.log("Error occured while connecting to the database");
  }

  app.listen(port, () => {
    console.log(`app is listening on port ${port}`);
  });
};

main();
