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

    //=======================================================================db collections====================================================================================

    const database = client.db("advokate");

    //! user collection
    const userCollection = database.collection("user");

    //! lawyerProfiles collection
    const lawyerProfilesCollection = database.collection("lawyerProfiles");

    //! hiringRequest collection
    const hiringRequestsCollection = database.collection("hiringRequests");

    //! review collection
    const reviewCollection = database.collection("reviews");

    //=============================================================================user related api's=========================================================================

    //! get legal profiles with search, filter, backend sorting & pagination + Real-time Review Aggregation
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
          .aggregate([
            { $match: query },
            { $sort: sortQuery },
            { $skip: skip },
            { $limit: limitNumber },
            {
              $lookup: {
                from: "reviews",
                let: { idStr: { $toString: "$_id" } },
                pipeline: [
                  {
                    $match: {
                      $expr: { $eq: ["$lawyerId", "$$idStr"] },
                    },
                  },
                ],
                as: "lawyerReviews",
              },
            },
            {
              $addFields: {
                totalReviews: { $size: "$lawyerReviews" },
                averageRating: {
                  $ifNull: [
                    { $round: [{ $avg: "$lawyerReviews.rating" }, 1] },
                    0.0,
                  ],
                },
              },
            },
            {
              $project: { lawyerReviews: 0 },
            },
          ])
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

    //! lawyers profile page for admin
    app.get("/api/admin/lawyerProfiles", async (req, res) => {
      try {
        const result = await lawyerProfilesCollection
          .find({})
          .sort({ createdAt: -1 })
          .toArray();
        res.send(result);
      } catch (error) {
        res
          .status(500)
          .send({ message: "Internal Server Error", error: error.message });
      }
    });

    // ! Update lawyer profile status (approved / pending / rejected)
    app.patch(
      "/api/admin/lawyerProfiles/change-status/:id",
      async (req, res) => {
        try {
          const id = req.params.id;
          const { status } = req.body; // pending, approved, rejected
          const filter = { _id: new ObjectId(id) };
          const updateDoc = { $set: { status: status } };
          const result = await lawyerProfilesCollection.updateOne(
            filter,
            updateDoc,
          );
          res.send(result);
        } catch (error) {
          res
            .status(500)
            .send({ message: "Internal Server Error", error: error.message });
        }
      },
    );

    // ! Delete lawyer profile
    app.delete("/api/admin/lawyerProfiles/delete/:id", async (req, res) => {
      try {
        const id = req.params.id;
        const query = { _id: new ObjectId(id) };
        const result = await lawyerProfilesCollection.deleteOne(query);
        res.send(result);
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

    // ! Get a single legal profile by MongoDB ID
    app.get("/api/lawyerProfiles/:id", async (req, res) => {
      try {
        const id = req.params.id;
        const result = await lawyerProfilesCollection.findOne({
          _id: new ObjectId(id),
        });
        if (!result) {
          return res.status(404).send({ message: "Profile not found" });
        }
        res.send(result);
      } catch (error) {
        res
          .status(500)
          .send({ message: "Internal Server Error", error: error.message });
      }
    });

    // ! Update legal profile by MongoDB ID
    app.put("/api/lawyerProfiles/update/:id", async (req, res) => {
      try {
        const id = req.params.id;
        const updatedData = req.body;
        const filter = { _id: new ObjectId(id) };

        delete updatedData._id;

        const updateDoc = {
          $set: {
            ...updatedData,
            updatedAt: new Date(),
          },
        };

        const result = await lawyerProfilesCollection.updateOne(
          filter,
          updateDoc,
        );
        res.send(result);
      } catch (error) {
        res
          .status(500)
          .send({ message: "Internal Server Error", error: error.message });
      }
    });

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

    // ! Delete lawyer profile by individual creator
    app.delete("/api/lawyerProfiles/delete/:id", async (req, res) => {
      try {
        const id = req.params.id;
        const query = { _id: new ObjectId(id) };
        const result = await lawyerProfilesCollection.deleteOne(query);
        res.send(result);
      } catch (error) {
        res
          .status(500)
          .send({ message: "Internal Server Error", error: error.message });
      }
    });

    // ===================================================================================lawyer hiring related api's======================================================

    //! get the hiring requests of a lawyer by their unique account email
    app.get("/api/lawyer/hiring-requests", async (req, res) => {
      try {
        const { lawyerEmail } = req.query;

        if (!lawyerEmail) {
          return res
            .status(400)
            .send({ message: "Lawyer email parameter is missing." });
        }

        const requests = await hiringRequestsCollection
          .find({ lawyerEmail: lawyerEmail })
          .sort({ createdAt: -1 })
          .toArray();

        res.send(requests);
      } catch (error) {
        res
          .status(500)
          .send({ message: "Internal Server Error", error: error.message });
      }
    });

    //! get the hiring requests of a client by their email
    app.get("/api/client/hiring-requests", async (req, res) => {
      try {
        const { clientEmail } = req.query;

        if (!clientEmail) {
          return res
            .status(400)
            .send({ message: "Client email parameter is missing." });
        }

        const requests = await hiringRequestsCollection
          .find({ clientEmail: clientEmail })
          .sort({ createdAt: -1 })
          .toArray();

        res.send(requests);
      } catch (error) {
        res
          .status(500)
          .send({ message: "Internal Server Error", error: error.message });
      }
    });

    // ! update hiring request api
    app.patch("/api/lawyer/hiring-requests/:id", async (req, res) => {
      try {
        const { id } = req.params;
        const { status } = req.body;

        if (!["accepted", "rejected"].includes(status)) {
          return res
            .status(400)
            .send({ message: "Invalid status parameters shift." });
        }

        const filter = { _id: new ObjectId(id) };
        const updateDoc = {
          $set: {
            status: status,
            updatedAt: new Date(),
          },
        };

        const result = await hiringRequestsCollection.updateOne(
          filter,
          updateDoc,
        );
        res.send(result);
      } catch (error) {
        res
          .status(500)
          .send({ message: "Internal Server Error", error: error.message });
      }
    });

    //! get the hiring requests
    app.get("/api/client/hiring-status", async (req, res) => {
      try {
        const { lawyerId, clientId } = req.query;

        if (!clientId || !lawyerId) {
          return res.send({ hasApplied: false });
        }

        const request = await hiringRequestsCollection.findOne({
          lawyerId: lawyerId,
          clientId: clientId,
        });

        res.send({
          hasApplied: !!request,
          status: request ? request.status : null,
        });
      } catch (error) {
        res
          .status(500)
          .send({ message: "Internal Server Error", error: error.message });
      }
    });

    // ! new hiring request post to the database
    app.post("/api/client/hire-lawyer", async (req, res) => {
      try {
        const hiringRequest = req.body;

        if (!hiringRequest.clientId || !hiringRequest.lawyerId) {
          return res
            .status(400)
            .send({ message: "ClientId and LawyerId are required fields." });
        }

        const existingRequest = await hiringRequestsCollection.findOne({
          lawyerId: hiringRequest.lawyerId,
          clientId: hiringRequest.clientId,
        });

        if (existingRequest) {
          return res.status(400).send({
            message: "You have already submitted a request to this lawyer.",
          });
        }

        const newHiringRequest = {
          ...hiringRequest,
          status: "pending",
          paymentStatus: "pending",
          caseStatus: "active",
          createdAt: new Date(),
        };

        const result =
          await hiringRequestsCollection.insertOne(newHiringRequest);
        res.status(201).send(result);
      } catch (error) {
        res
          .status(500)
          .send({ message: "Internal Server Error", error: error.message });
      }
    });

    //! update the case status
    app.patch("/api/lawyer/hiring-requests/mark-won/:id", async (req, res) => {
      try {
        const { id } = req.params;

        const filter = { _id: new ObjectId(id) };
        const updateDoc = {
          $set: {
            caseStatus: "won",
            updatedAt: new Date(),
          },
        };

        const result = await database
          .collection("hiringRequests")
          .updateOne(filter, updateDoc);
        res.send(result);
      } catch (error) {
        res
          .status(500)
          .send({ message: "Internal Server Error", error: error.message });
      }
    });

    // =================================================================================== Review Related APIs ======================================================

    // ! post new review data
    app.post("/api/reviews", async (req, res) => {
      try {
        const reviewData = req.body;

        if (
          !reviewData.lawyerId ||
          !reviewData.clientId ||
          !reviewData.rating
        ) {
          return res.status(400).send({
            message:
              "Required fields (lawyerId, clientId, rating) are missing.",
          });
        }

        const newReview = {
          ...reviewData,
          rating: parseFloat(reviewData.rating),
          createdAt: new Date(),
        };

        const result = await reviewCollection.insertOne(newReview);
        res.status(201).send(result);
      } catch (error) {
        res
          .status(500)
          .send({ message: "Internal Server Error", error: error.message });
      }
    });

    // ! get all the review using the lawyer id
    app.get("/api/reviews/:lawyerId", async (req, res) => {
      try {
        const { lawyerId } = req.params;

        const reviews = await reviewCollection
          .find({ lawyerId: lawyerId })
          .sort({ createdAt: -1 })
          .toArray();

        res.send(reviews);
      } catch (error) {
        res
          .status(500)
          .send({ message: "Internal Server Error", error: error.message });
      }
    });

    //!===========================================================================total hires and case won api================================================
    app.get("/api/lawyers/:email/stats", async (req, res) => {
      try {
        const { email } = req.params;

        if (!email) {
          return res
            .status(400)
            .send({ message: "Lawyer email parameter is required." });
        }

        const totalHires = await hiringRequestsCollection.countDocuments({
          lawyerEmail: email,
          status: "accepted",
        });

        const casesWon = await hiringRequestsCollection.countDocuments({
          lawyerEmail: email,
          caseStatus: "won",
        });

        res.send({ totalHires, casesWon });
      } catch (error) {
        res
          .status(500)
          .send({ message: "Internal Server Error", error: error.message });
      }
    });

    //===================================================================================client review page related apis===================================================
    // ! get the client's all reviews
    app.get("/api/client/my-reviews", async (req, res) => {
      try {
        const { email } = req.query;
        if (!email) {
          return res.status(400).send({ message: "Client email is required." });
        }

        const myReviews = await reviewCollection
          .find({ clientEmail: email })
          .sort({ createdAt: -1 })
          .toArray();

        res.send(myReviews);
      } catch (error) {
        res
          .status(500)
          .send({ message: "Internal Server Error", error: error.message });
      }
    });

    // ! review update apis
    app.put("/api/reviews/:id", async (req, res) => {
      try {
        const { id } = req.params;
        const { rating, comment } = req.body;

        const filter = { _id: new ObjectId(id) };
        const updateDoc = {
          $set: {
            rating: parseFloat(rating),
            comment: comment,
            updatedAt: new Date(),
          },
        };

        const result = await reviewCollection.updateOne(filter, updateDoc);
        res.send(result);
      } catch (error) {
        res
          .status(500)
          .send({ message: "Internal Server Error", error: error.message });
      }
    });

    // ! review delete apis
    app.delete("/api/reviews/:id", async (req, res) => {
      try {
        const { id } = req.params;
        const query = { _id: new ObjectId(id) };
        const result = await reviewCollection.deleteOne(query);
        res.send(result);
      } catch (error) {
        res
          .status(500)
          .send({ message: "Internal Server Error", error: error.message });
      }
    });

    // ======================================================================================================================================

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
