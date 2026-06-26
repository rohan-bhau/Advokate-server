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

// const logger = (req, res, next) => {
//   console.log("logger logged", req.params)
//   next()
// }



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

    //! lawyerPaymentCollection
    const lawyerPaymentCollection = database.collection("lawyerPayments");

    //! clientPaymentCollection
    const clientPaymentCollection = database.collection("clientPayments");
    const sessionCollection = database.collection("session");

    //! verification related
    const verifyToken = async (req, res, next) => {
      console.log("headers", req.headers);
      const authHeader = req.headers?.authorization;
      if (!authHeader) {
        return res.status(401).send({ message: "unauthorized access" });
      }

      const token = authHeader.split(" ")[1];

      if (!token) {
        return res.status(401).send({ message: "unauthorized access" });
      }

      const query = { token: token };

      const session = await sessionCollection.findOne(query);
      // console.log(session)

            if (!session) {
              return res.status(401).send({ message: "unauthorized access" });
            }

      const userId = session.userId;
      // console.log('user id of the session', userId)

      const userQuery = {
        _id: userId,
      };

      const user = await userCollection.findOne(userQuery);

            if (!user) {
              return res.status(401).send({ message: "unauthorized access" });
            }

      req.user = user;
      // console.log("user info", user)

      next();
    };

    //!verify client, and must be used after verify token
    const verifyClient = async (req, res, next) => {
      if (req.user?.role !== "client") {
        return res.status(403).send({ message: "forbidden access" });
      }

      next();
    };

    //!verify lawyer, and must be used after verify token
    const verifyLawyer = async (req, res, next) => {
    if (req.user?.role !== "lawyer") {
      return res.status(403).send({ message: "forbidden access" });
    }
      next()
    }

    //!verify admin, and must be used after verify token
    const verifyAdmin = async (req, res, next) => {
      if (req.user?.role !== "admin") {
        return res.status(403).send({ message: "forbidden access" });
      }
      next();
    };

    //========================================================================================================================================================================

    // ! Update user profile (Name, Email & Image)
    app.patch(
      "/api/user/update-profile/:id",
      verifyToken,
      verifyClient,
      async (req, res) => {
        try {
          const id = req.params.id;
          const { name, email, image } = req.body;

          if (!name || !email) {
            return res
              .status(400)
              .send({ message: "Name and Email are required fields." });
          }

          console.log(req.user, id);
          if (req.user._id.toString() !== id) {
            return res.status(403).send({ message: "forbidden access" });
          }

          const filter = { _id: new ObjectId(id) };
          const updateDoc = {
            $set: {
              name: name,
              email: email,
              image: image, // Stores ImgBB string URL safely
              updatedAt: new Date(),
            },
          };

          const result = await userCollection.updateOne(filter, updateDoc);
          res.send(result);
        } catch (error) {
          res
            .status(500)
            .send({ message: "Internal Server Error", error: error.message });
        }
      },
    );

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
    app.get("/api/admin/lawyerProfiles", verifyToken,verifyAdmin, async (req, res) => {
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
      verifyToken,
      verifyAdmin,
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
    app.delete("/api/admin/lawyerProfiles/delete/:id",verifyToken, verifyAdmin, async (req, res) => {
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
    app.get("/api/user",verifyToken,verifyAdmin, async (req, res) => {
      const cursor = userCollection.find();
      const result = await cursor.toArray();
      res.send(result);
    });

    // ? update user role
    app.patch(
      "/api/user/change-role/:id",
      verifyToken,
      verifyAdmin,
      async (req, res) => {
        const id = req.params.id;
        const { role } = req.body;

        const filter = { _id: new ObjectId(id) };
        const updateDoc = { $set: { role: role } };
        const result = await userCollection.updateOne(filter, updateDoc);
        res.send(result);
      },
    );

    // ? delete user
    app.delete("/api/user/delete/:id",verifyToken, verifyAdmin, async (req, res) => {
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
    app.put("/api/lawyerProfiles/update/:id",verifyToken, verifyLawyer, async (req, res) => {
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
    app.post("/api/lawyerProfiles",verifyToken, verifyLawyer, async (req, res) => {
      const legalProfile = req.body;
      const newLegalProfile = {
        ...legalProfile,
        createdAt: new Date(),
      };
      const result = await lawyerProfilesCollection.insertOne(newLegalProfile);
      res.send(result);
    });

    // ! Delete lawyer profile by individual creator
    app.delete("/api/lawyerProfiles/delete/:id",verifyToken, verifyLawyer, async (req, res) => {
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
    app.get("/api/lawyer/hiring-requests",verifyToken,verifyLawyer, async (req, res) => {
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
    app.get(
      "/api/client/hiring-requests",
      verifyToken,
      verifyClient,
      async (req, res) => {
        try {
          const { clientEmail } = req.query;

          if (!clientEmail) {
            return res
              .status(400)
              .send({ message: "Client email parameter is missing." });
          }

          // console.log(req.user, req.query.clientEmail)
          if (req.user.email !== req.query.clientEmail) {
            return res.status(403).send({ message: "forbidden access" });
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
      },
    );

    // ! update hiring request api
    app.patch("/api/lawyer/hiring-requests/:id",verifyToken, verifyLawyer, async (req, res) => {
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
    app.post("/api/client/hire-lawyer",verifyToken,verifyClient, async (req, res) => {
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
    app.patch("/api/lawyer/hiring-requests/mark-won/:id",verifyToken, verifyLawyer, async (req, res) => {
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
    app.post("/api/reviews",verifyToken, verifyClient, async (req, res) => {
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
    app.put("/api/reviews/:id",verifyToken, verifyClient, async (req, res) => {
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
    app.delete("/api/reviews/:id",verifyToken,verifyClient, async (req, res) => {
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

    // =================================================================================== Stripe Payment Audit Ledger APIs ======================================================

    app.patch("/api/lawyer/update-plan/:id",verifyToken, verifyLawyer, async (req, res) => {
      try {
        const { id } = req.params;
        const { planStatus, sessionId, amount, userEmail } = req.body;

        if (!planStatus) {
          return res
            .status(400)
            .send({ message: "Plan status parameter is required." });
        }

        const userFilter = { _id: new ObjectId(id) };
        const userUpdateDoc = {
          $set: {
            plan: planStatus,
            updatedAt: new Date(),
          },
        };
        await userCollection.updateOne(userFilter, userUpdateDoc);

        const paymentReceipt = {
          lawyerId: id,
          lawyerEmail: userEmail || "",
          stripeSessionId: sessionId || "",
          amountPaid: amount ? parseFloat(amount) : 149.0,
          currency: "USD",
          paymentType: "lifetime_profile_activation",
          paymentStatus: "completed",
          createdAt: new Date(),
        };
        const paymentResult =
          await lawyerPaymentCollection.insertOne(paymentReceipt);

        res.send({
          success: true,
          message:
            "Lawyer profile activated and payment ledger audited successfully.",
          paymentId: paymentResult.insertedId,
        });
      } catch (error) {
        res
          .status(500)
          .send({ message: "Internal Server Error", error: error.message });
      }
    });

    app.patch("/api/client/update-hiring-payment",verifyToken, verifyClient, async (req, res) => {
      try {
        const {
          lawyerId,
          clientId,
          sessionId,
          amount,
          clientEmail,
          lawyerEmail,
        } = req.body;

        if (!lawyerId || !clientId) {
          return res.status(400).send({
            message: "Required parameters (lawyerId, clientId) are missing.",
          });
        }

        const hiringFilter = {
          clientId: clientId,
          paymentStatus: "pending",
          $or: [{ lawyerId: lawyerId }, { _id: new ObjectId(lawyerId) }],
        };

        const hiringUpdateDoc = {
          $set: {
            paymentStatus: "paid",
            updatedAt: new Date(),
          },
        };

        const hiringResult = await hiringRequestsCollection.updateOne(
          hiringFilter,
          hiringUpdateDoc,
        );

        const clientReceipt = {
          clientId: clientId,
          clientEmail: clientEmail || "",
          lawyerId: lawyerId,
          lawyerEmail: lawyerEmail || "",
          stripeSessionId: sessionId || "",
          amountPaid: amount ? parseFloat(amount) : 0.0,
          currency: "USD",
          paymentType: "lawyer_retainer_hire",
          paymentStatus: "completed",
          createdAt: new Date(),
        };
        const paymentResult =
          await clientPaymentCollection.insertOne(clientReceipt);

        res.send({
          success: true,
          message: "Hiring request payment updated dynamically.",
          hiringMatchedCount: hiringResult.matchedCount,
          hiringModifiedCount: hiringResult.modifiedCount,
          paymentId: paymentResult.insertedId,
        });
      } catch (error) {
        res
          .status(500)
          .send({ message: "Internal Server Error", error: error.message });
      }
    });

    //! ===================================================================================transitions============================================================
    // transactions for admin
    app.get("/api/admin/lawyer-transactions",verifyToken, verifyAdmin, async (req, res) => {
      try {
        const { search, page = 1, limit = 10 } = req.query;
        const pageNumber = parseInt(page);
        const limitNumber = parseInt(limit);
        const skip = (pageNumber - 1) * limitNumber;

        let matchQuery = {};
        if (search) {
          matchQuery.$or = [
            { lawyerEmail: { $regex: search, $options: "i" } },
            { stripeSessionId: { $regex: search, $options: "i" } },
          ];
        }

        const totalTransactions =
          await lawyerPaymentCollection.countDocuments(matchQuery);

        const transactions = await lawyerPaymentCollection
          .find(matchQuery)
          .sort({ createdAt: -1 })
          .skip(skip)
          .limit(limitNumber)
          .toArray();

        res.send({
          transactions,
          total: totalTransactions,
          page: pageNumber,
          limit: limitNumber,
          totalPages: Math.ceil(totalTransactions / limitNumber),
        });
      } catch (error) {
        res
          .status(500)
          .send({ message: "Internal Server Error", error: error.message });
      }
    });

    //! =============================================================================================================admin analytical related api=========================================
    app.get("/api/admin/analytics-data",verifyToken, verifyAdmin, async (req, res) => {
      try {
        const totalUsers = await userCollection.countDocuments();
        const totalLawyers = await lawyerProfilesCollection.countDocuments();
        const totalHires = await hiringRequestsCollection.countDocuments({
          status: "accepted",
        });

        const revenueData = await lawyerPaymentCollection
          .aggregate([
            { $group: { _id: null, total: { $sum: "$amountPaid" } } },
          ])
          .toArray();
        const totalRevenue = revenueData.length > 0 ? revenueData[0].total : 0;

        const recentPayments = await lawyerPaymentCollection
          .find()
          .sort({ createdAt: -1 })
          .limit(3)
          .toArray();
        const recentHires = await hiringRequestsCollection
          .find()
          .sort({ createdAt: -1 })
          .limit(2)
          .toArray();

        const recentActivities = [
          ...recentPayments.map((p) => ({
            activity: "Payment Received",
            details: `$${p.amountPaid} from ${p.lawyerEmail}`,
            date: p.createdAt,
          })),
          ...recentHires.map((h) => ({
            activity: `Hire Request ${h.status}`,
            details: `${h.clientName} hired ${h.lawyerName}`,
            date: h.createdAt,
          })),
        ]
          .sort((a, b) => new Date(b.date) - new Date(a.date))
          .slice(0, 5);

        const revenueOverview = await lawyerPaymentCollection
          .aggregate([
            {
              $group: {
                _id: { $dateToString: { format: "%b %d", date: "$createdAt" } },
                revenue: { $sum: "$amountPaid" },
              },
            },
            { $sort: { _id: 1 } },
            { $project: { _id: 0, name: "$_id", revenue: 1 } },
          ])
          .toArray();

        const hiresOverTime = await hiringRequestsCollection
          .aggregate([
            {
              $group: {
                _id: { $dateToString: { format: "%b %d", date: "$createdAt" } },
                hires: { $sum: 1 },
              },
            },
            { $sort: { _id: 1 } },
            { $project: { _id: 0, name: "$_id", hires: 1 } },
          ])
          .toArray();

        const roleCounts = await userCollection
          .aggregate([{ $group: { _id: "$role", value: { $sum: 1 } } }])
          .toArray();

        const colorMap = {
          client: "#1D44B7",
          lawyer: "#10B981",
          admin: "#F59E0B",
        };
        const usersByRole = roleCounts.map((item) => ({
          name:
            item._id === "client"
              ? "User"
              : item._id === "lawyer"
                ? "Lawyer"
                : "Admin",
          value: item.value,
          color: colorMap[item._id] || "#6B7280",
        }));

        res.send({
          cards: { totalUsers, totalLawyers, totalHires, totalRevenue },
          recentActivities,
          revenueOverview:
            revenueOverview.length > 0
              ? revenueOverview
              : [{ name: "No Data", revenue: 0 }],
          hiresOverTime:
            hiresOverTime.length > 0
              ? hiresOverTime
              : [{ name: "No Data", hires: 0 }],
          usersByRole:
            usersByRole.length > 0
              ? usersByRole
              : [{ name: "No Users", value: 1, color: "#E5E7EB" }],
        });
      } catch (error) {
        res
          .status(500)
          .send({ message: "Internal Server Error", error: error.message });
      }
    });

    //! ================================================================================================lawyer analytics api=================================================
    app.get("/api/lawyer/dashboard-metrics", async (req, res) => {
      try {
        const { email } = req.query;
        if (!email) {
          return res
            .status(400)
            .send({ message: "Lawyer email parameter is required." });
        }

        const totalHires = await hiringRequestsCollection.countDocuments({
          lawyerEmail: email,
        });
        const completedCases = await hiringRequestsCollection.countDocuments({
          lawyerEmail: email,
          caseStatus: "won",
        });
        const pendingRequests = await hiringRequestsCollection.countDocuments({
          lawyerEmail: email,
          status: "pending",
        });

        const earningsData = await clientPaymentCollection
          .aggregate([
            { $match: { lawyerEmail: email, paymentStatus: "completed" } },
            { $group: { _id: null, total: { $sum: "$amountPaid" } } },
          ])
          .toArray();
        const totalEarnings =
          earningsData.length > 0 ? earningsData[0].total : 0;

        const recentHires = await hiringRequestsCollection
          .find({ lawyerEmail: email })
          .sort({ createdAt: -1 })
          .limit(4)
          .toArray();

        res.send({
          metrics: {
            totalHires,
            completedCases,
            pendingRequests,
            totalEarnings,
          },
          recentHires,
        });
      } catch (error) {
        res
          .status(500)
          .send({ message: "Internal Server Error", error: error.message });
      }
    });

    app.get("/api/lawyer/transactions", async (req, res) => {
      try {
        const { email, search, page = 1, limit = 10 } = req.query;
        if (!email) {
          return res
            .status(400)
            .send({ message: "Lawyer email parameter is required." });
        }

        const pageNumber = parseInt(page);
        const limitNumber = parseInt(limit);
        const skip = (pageNumber - 1) * limitNumber;

        let matchQuery = { lawyerEmail: email };
        if (search) {
          matchQuery.$or = [
            { clientEmail: { $regex: search, $options: "i" } },
            { stripeSessionId: { $regex: search, $options: "i" } },
          ];
        }

        const totalTransactions =
          await clientPaymentCollection.countDocuments(matchQuery);
        const transactions = await clientPaymentCollection
          .find(matchQuery)
          .sort({ createdAt: -1 })
          .skip(skip)
          .limit(limitNumber)
          .toArray();

        res.send({
          transactions,
          total: totalTransactions,
          page: pageNumber,
          limit: limitNumber,
          totalPages: Math.ceil(totalTransactions / limitNumber),
        });
      } catch (error) {
        res
          .status(500)
          .send({ message: "Internal Server Error", error: error.message });
      }
    });

    //! =========================================================================================client analytics and transactions apt==============================================
    app.get("/api/client/dashboard-metrics", async (req, res) => {
      try {
        const { email } = req.query;
        if (!email) {
          return res
            .status(400)
            .send({ message: "Client email parameter is required." });
        }

        const totalHires = await hiringRequestsCollection.countDocuments({
          clientEmail: email,
        });
        const acceptedCases = await hiringRequestsCollection.countDocuments({
          clientEmail: email,
          status: "accepted",
        });
        const completedCases = await hiringRequestsCollection.countDocuments({
          clientEmail: email,
          caseStatus: "won",
        });
        const pendingRequests = await hiringRequestsCollection.countDocuments({
          clientEmail: email,
          status: "pending",
        });

        const recentHires = await hiringRequestsCollection
          .find({ clientEmail: email })
          .sort({ createdAt: -1 })
          .limit(5)
          .toArray();

        res.send({
          metrics: {
            totalHires,
            acceptedCases,
            completedCases,
            pendingRequests,
          },
          recentHires,
        });
      } catch (error) {
        res
          .status(500)
          .send({ message: "Internal Server Error", error: error.message });
      }
    });

    app.get("/api/client/transactions", verifyToken, async (req, res) => {
      try {
        const { email, search, page = 1, limit = 10 } = req.query;
        if (!email) {
          return res
            .status(400)
            .send({ message: "Client email parameter is required." });
        }

        const pageNumber = parseInt(page);
        const limitNumber = parseInt(limit);
        const skip = (pageNumber - 1) * limitNumber;

        let matchQuery = { clientEmail: email };
        if (search) {
          matchQuery.$or = [
            { lawyerEmail: { $regex: search, $options: "i" } },
            { stripeSessionId: { $regex: search, $options: "i" } },
          ];
        }

        const totalTransactions =
          await clientPaymentCollection.countDocuments(matchQuery);
        const transactions = await clientPaymentCollection
          .find(matchQuery)
          .sort({ createdAt: -1 })
          .skip(skip)
          .limit(limitNumber)
          .toArray();

        res.send({
          transactions,
          total: totalTransactions,
          page: pageNumber,
          limit: limitNumber,
          totalPages: Math.ceil(totalTransactions / limitNumber),
        });
      } catch (error) {
        res
          .status(500)
          .send({ message: "Internal Server Error", error: error.message });
      }
    });

    // ======================================================================================================================================

    // await client.db("admin").command({ ping: 1 });
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
