const express = require("express");
const app = express();
const cors = require("cors");
require("dotenv").config();

const port = process.env.PORT || 5000;
app.use(cors());
app.use(express.json());
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");

app.get("/", (req, res) => {
  res.send("Hello World!");
});

// ? mongodb uri
const uri = process.env.MONGO_URI;

//? mongo db connection
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});
async function run() {
  try {
    // Connect the client to the server	(optional starting in v4.7)
    await client.connect();
    // Send a ping to confirm a successful connection

    const database = client.db("advokate");

    //! user collection
    const userCollection = database.collection("user");

    //! lawyerProfiles collection
    const lawyerProfilesCollection = database.collection("lawyerProfiles");

    //=============================================================================user related api's=========================================================================

    //!get legal profiles
    //! get legal profiles with search, filter, backend sorting & pagination
    app.get("/api/lawyerProfiles", async (req, res) => {
      try {
        const {
          search,
          category,
          availability,
          sort,
          page = 1,
          limit = 8,
        } = req.query;

        // ?
        let query = { status: "approved" };

        if (search) {
          query.$or = [
            { professionalName: { $regex: search, $options: "i" } },
            { bio: { $regex: search, $options: "i" } },
          ];
        }

        if (category && category !== "all") {
          query.specialization = category;
        }

        if (availability && availability !== "all") {
          query.availabilityStatus = availability;
        }

        let sortQuery = { createdAt: 1 };
        if (sort === "fee-asc") {
          sortQuery = { hourlyFee: -1 };
        } else if (sort === "fee-desc") {
          sortQuery = { hourlyFee: 1 };
        }

        const pageNumber = parseInt(page);
        const limitNumber = parseInt(limit);
        const skip = (pageNumber - 1) * limitNumber;

        const totalLawyers =
          await lawyerProfilesCollection.countDocuments(query);

        const result = await lawyerProfilesCollection
          .find(query)
          .sort(sortQuery)
          .skip(skip)
          .limit(limitNumber)
          .toArray();

        res.send({
          lawyers: result,
          total: totalLawyers,
          page: pageNumber,
          limit: limitNumber,
          totalPages: Math.ceil(totalLawyers / limitNumber),
        });
      } catch (error) {
        res
          .status(500)
          .send({ message: "Internal Server Error", error: error.message });
      }
    });

    //! get individual legal profile
    app.get("/api/my/lawyerProfiles", async (req, res) => {
      const query = {};
      if (req.query.lawyerId) {
        query.lawyerId = req.query.lawyerId;
      }
      const result = await lawyerProfilesCollection.find(query).toArray();
      res.send(result);
    });

    //=============================================================================user related api's =======================================================

    //? get all the users
    app.get("/api/user", async (req, res) => {
      const cursor = userCollection.find();
      const result = await cursor.toArray();
      res.send(result);
    });

    // ? update user role
    app.patch("/api/user/change-role/:id", async (req, res) => {
      const id = req.params.id;
      const { role } = req.body;
      const filter = { _id: new ObjectId(id) };
      const updateDoc = { $set: { role: role } };
      const result = await userCollection.updateOne(filter, updateDoc);
      res.send(result);
    });

    // ? delete user
    app.delete("/api/user/delete/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await userCollection.deleteOne(query);
      res.send(result);
    });

    //=============================================================================lawyer profile related api's==============================================================

    //! post legal profile
    app.post("/api/lawyerProfiles", async (req, res) => {
      const legalProfile = req.body;
      const newLegalProfile = {
        ...legalProfile,
        createdAt: new Date(),
      };
      const result = await lawyerProfilesCollection.insertOne(newLegalProfile);
      res.send(result);
    });

    await client.db("admin").command({ ping: 1 });
    console.log(
      "Pinged your deployment. You successfully connected to MongoDB!",
    );
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);

app.listen(port, () => {
  console.log(`Example app listening on port ${port}`);
});
