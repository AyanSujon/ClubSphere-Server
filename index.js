




const express = require('express')
const cors = require('cors');

const app = express()
require('dotenv').config()
const { MongoClient, ServerApiVersion } = require('mongodb');
const stripe = require('stripe')(process.env.STRIPE_SECRET);

const port = process.env.PORT || 3000


// Middleware
app.use(cors());
app.use(express.json())




const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.tachgq7.mongodb.net/assignment-B12A11?appName=Cluster0`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  }
});


async function run() {
  try {
    // Connect the client to the server	(optional starting in v4.7)
    await client.connect();
    const db = client.db('assignment-B12A11');
    const usersCollection = db.collection('users');
    const clubsCollection = db.collection('clubs');
    const eventsCollection = db.collection('events');
    const eventRegistrationsCollection = db.collection('eventRegistrations');
    const clubMembershipCollection = db.collection('clubMembership');
    const paymentCollection = db.collection('payments');






    // app.post('/register', async(req, res)=>{
    //   console.log(req.dody , "request");
    // })



    app.post('/users', async (req, res) => {
      const user = req.body;
      // user.role = 'user';
      // user.createdAt = new Date();
      user.role = 'member',
        user.createdAt = new Date().toISOString() // <-- dynamic timestamp
      const email = user.email;
      const userExists = await usersCollection.findOne({ email })
      console.log("user data: ", user)
      console.log("existing user", userExists)
      if (userExists) {
        return res.send({ message: 'user exists' })
      }

      const result = await usersCollection.insertOne(user);
      res.send(result);
    })





    // Recently Added Clubs API
    app.get('/clubs', async (req, res) => {
      try {
        const query = {};
        const { category, location, managerEmail } = req.query;

        // Optional filters
        if (category) {
          query.category = category;
        }

        if (location) {
          query.location = location;
        }

        if (managerEmail) {
          query.managerEmail = managerEmail;
        }

        // Sort by newest first
        const options = { sort: { createdAt: -1 } };

        const cursor = clubsCollection.find(query, options);
        const result = await cursor.toArray();

        res.status(200).send(result);
      } catch (error) {
        console.error("Failed to fetch clubs:", error);
        res.status(500).send({ message: "Failed to fetch clubs" });
      }
    });




    // // Upcoming Events API
    // app.get('/events/upcoming', async (req, res) => {
    //     try {
    //         const query = {};
    //         const { clubId, isPaid, location } = req.query;

    //         // Filter by clubId
    //         if (clubId) {
    //             query.clubId = clubId;
    //         }

    //         // Filter by paid/free events
    //         if (isPaid) {
    //             query.isPaid = isPaid === "true"; // convert string → boolean
    //         }

    //         // Filter by location
    //         if (location) {
    //             query.location = location;
    //         }

    //         // Only future events
    //         query.eventDate = { $gte: new Date() };

    //         // Sort by nearest upcoming
    //         const options = { sort: { eventDate: 1 } };

    //         const cursor = eventsCollection.find(query, options);
    //         const result = await cursor.toArray();

    //         res.status(200).send(result);
    //     } catch (error) {
    //         console.error("Failed to fetch upcoming events:", error);
    //         res.status(500).send({ message: "Failed to fetch upcoming events" });
    //     }
    // });




    // Upcoming Events API
    app.get('/events/upcoming', async (req, res) => {
      try {
        const query = {};
        const { clubId, isPaid, location } = req.query;

        if (clubId) query.clubId = clubId;
        if (isPaid) query.isPaid = isPaid === "true";
        if (location) query.location = location;

        // Handle both string and Date types
        const nowISO = new Date().toISOString();

        query.eventDate = { $gte: nowISO };

        const options = { sort: { eventDate: 1 } };

        const events = await eventsCollection.find(query, options).toArray();
        res.send(events);

      } catch (err) {
        console.error(err);
        res.status(500).send({ message: "Failed to fetch upcoming events" });
      }
    });







    // POST: Register for an event
    app.post("/event-registrations", async (req, res) => {
      try {
        const registration = req.body;
        const { eventId, userEmail } = registration;

        // Validate required fields
        if (!eventId || !userEmail) {
          return res.status(400).send({ message: "Missing required fields." });
        }

        // Prevent duplicate registration
        const existing = await eventRegistrationsCollection.findOne({
          eventId,
          userEmail,
        });

        if (existing) {
          return res.status(409).send({ message: "Already registered." });
        }

        // Add server timestamp if not provided
        registration.registeredAt = registration.registeredAt || new Date();

        // Insert into DB
        const result = await eventRegistrationsCollection.insertOne(registration);

        res.send({
          success: true,
          message: "Event registered successfully!",
          data: result,
        });

      } catch (error) {
        console.error("Event Registration Error →", error);
        res.status(500).send({ message: "Internal server error", error });
      }
    });
















    // Payment Related Apis 
    app.post('/payment-checkout-session', async (req, res) => {
      const paymentInfo = req.body;

      console.log(paymentInfo);
      const amount = parseInt(paymentInfo.amount) * 100;
      const session = await stripe.checkout.sessions.create({
        line_items: [
          {

            price_data: {
              currency: 'USD',
              unit_amount: amount,
              product_data: {
                name: paymentInfo.eventTitle
              }
            },

            quantity: 1,
          },
        ],
        customer_email: paymentInfo.userEmail,
        mode: 'payment',
        metadata: {
          userEmail: paymentInfo.userEmail,
          amount: paymentInfo.amount,
          paymentType: paymentInfo.paymentType,
          clubId: paymentInfo.clubId,
          eventId: paymentInfo.eventId,
          transactionId: null,
          status: "pending",
          createdAt: new Date().toISOString(),
          eventTitle: paymentInfo.eventTitle,

        },
        success_url: `${process.env.SITE_DOMAIN}/payment-success?session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${process.env.SITE_DOMAIN}/payment-cancelled`,
      })

      console.log(session);
      res.send({ url: session.url });
    })






    // // Payment success api from jhonkar vaiya
    // app.patch('/payment-success', async (req, res) => {
    //   const sessionId = req.query.session_id;
    //   // console.log(`session Id: `, sessionId);

    //   const session = await stripe.checkout.sessions.retrieve(sessionId);
    //   console.log(`session retrives: `, session)
    //   if (session.payment_status === 'paid') {
    //     const id = session.metadata.eventId;
    //     const query = { _id: new Object(id) };
    //     const update = {
    //       $set: {
    //         paymentStatus: 'paid',

    //       }
    //     }
    //     const result = await paymentCollection.insertOne()
    //   }
    //   res.send({ success: true })
    //   res.send({ success: true });
    // })








// app.patch('/payment-success', async (req, res) => {
//   try {
//     const sessionId = req.query.session_id;

//     const session = await stripe.checkout.sessions.retrieve(sessionId);
//     console.log("Stripe Session:", session);

//     if (session.payment_status === 'paid') {

//       // Prepare Payment Info
//       const paymentInfo = {
//         userEmail: session.metadata.userEmail,
//         amount: session.metadata.amount,
//         eventId: session.metadata.eventId,
//         eventTitle: session.metadata.eventTitle,
//         clubId: session.metadata.clubId,
//         transactionId: sessionId,
//         status: "paid",
//         paidAt: new Date(),
//       };

//       // Check if payment already exists
//       let saveResult = await paymentCollection.findOne({ transactionId: sessionId });
//       if (!saveResult) {
//         saveResult = await paymentCollection.insertOne(paymentInfo);
//         console.log("Payment Saved:", saveResult);
//       } else {
//         console.log("Payment already exists:", saveResult);
//       }

//       // Prepare Event Registration
//       const registration = {
//         eventId: session.metadata.eventId,
//         userEmail: session.metadata.userEmail,
//         clubId: session.metadata.clubId,
//         status: "registered",
//         paymentId: session.payment_intent,
//         registeredAt: new Date().toISOString(),
//       };

//       // Check if registration already exists
//       let registrationResult = await eventRegistrationsCollection.findOne({
//         eventId: session.metadata.eventId,
//         userEmail: session.metadata.userEmail,
//       });

//       if (!registrationResult) {
//         registrationResult = await eventRegistrationsCollection.insertOne(registration);
//         console.log("Registration Saved:", registrationResult);
//       } else {
//         console.log("Registration already exists:", registrationResult);
//       }

//       return res.send({
//         success: true,
//         message: "Payment saved successfully",
//         paymentInfo,
//         registrationInfo: registrationResult,
//       });
//     }

//     res.status(400).send({ success: false, message: "Payment not completed" });

//   } catch (error) {
//     res.status(500).send({
//       success: false,
//       message: "Payment success API error",
//       error: error.message,
//     });
//   }
// });





app.patch('/payment-success', async (req, res) => {
  try {
    const sessionId = req.query.session_id;

    const session = await stripe.checkout.sessions.retrieve(sessionId);
    console.log("Stripe Session:", session);

    if (session.payment_status === 'paid') {

      // Prepare Payment Info
      const paymentInfo = {
        userEmail: session.metadata.userEmail,
        amount: session.metadata.amount,
        eventId: session.metadata.eventId,
        eventTitle: session.metadata.eventTitle,
        clubId: session.metadata.clubId,
        transactionId: sessionId,
        status: "paid",
        paidAt: new Date(),
      };

      // Upsert Payment (insert if not exists)
      const paymentResult = await paymentCollection.updateOne(
        { transactionId: sessionId },   // filter
        { $setOnInsert: paymentInfo },   // insert only if doesn't exist
        { upsert: true }
      );
      console.log("Payment Result:", paymentResult);

      // Prepare Event Registration
      const registration = {
        eventId: session.metadata.eventId,
        userEmail: session.metadata.userEmail,
        clubId: session.metadata.clubId,
        status: "registered",
        paymentId: sessionId, // Use transactionId to uniquely link
        registeredAt: new Date().toISOString(),
      };

      // Upsert Registration to avoid duplicates
      const registrationResult = await eventRegistrationsCollection.updateOne(
        { eventId: session.metadata.eventId, userEmail: session.metadata.userEmail },
        { $setOnInsert: registration },
        { upsert: true }
      );
      console.log("Registration Result:", registrationResult);

      return res.send({
        success: true,
        message: "Payment and registration processed successfully",
        paymentInfo,
        registrationInfo: registration,
      });
    }

    res.status(400).send({ success: false, message: "Payment not completed" });

  } catch (error) {
    res.status(500).send({
      success: false,
      message: "Payment success API error",
      error: error.message,
    });
  }
});




















// Club Membership api
// Payment: Club Membership Checkout Session
app.post('/payment-club-membership', async (req, res) => {
  try {
    const paymentInfo = req.body;
    console.log("Club Payment Info:", paymentInfo);

    // Convert membership fee
    const amount = parseInt(paymentInfo.cost) * 100;

    // Create Stripe Checkout Session
    const session = await stripe.checkout.sessions.create({
      line_items: [
        {
          price_data: {
            currency: 'USD',
            unit_amount: amount,
            product_data: {
              name: `${paymentInfo.clubName} - Club Membership`,
            }
          },
          quantity: 1,
        },
      ],

      customer_email: paymentInfo.userEmail,
      mode: 'payment',

      metadata: {
        userEmail: paymentInfo.userEmail,
        clubId: paymentInfo.clubId,
        category: paymentInfo.category,
        managerEmail: paymentInfo.managerEmail,
        cost: paymentInfo.cost,
        paymentType: paymentInfo.paymentType, // "club-membership"
        bannerImage: paymentInfo.bannerImage,
        location: paymentInfo.location,
        description: paymentInfo.description,
        createdAt: paymentInfo.createdAt,
        status: "pending"
      },

      success_url: `${process.env.SITE_DOMAIN}/club-membership-payment-success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${process.env.SITE_DOMAIN}/club-membership-payment-cancelled`,
    });

    console.log("Stripe Session:", session);

    // Send Checkout URL to frontend
    res.send({ url: session.url });

  } catch (error) {
    console.error("Payment Error:", error);
    res.status(500).send({ error: error.message });
  }
});







// app.patch('/payment-success', async (req, res) => {
//   try {
//     const sessionId = req.query.session_id;

//     if (!sessionId) {
//       return res.status(400).send({ success: false, message: "Session ID missing" });
//     }

//     const session = await stripe.checkout.sessions.retrieve(sessionId);
//     console.log("Stripe Session:", session);

//     if (session.payment_status !== 'paid') {
//       return res.status(400).send({
//         success: false,
//         message: "Payment not completed",
//       });
//     }

//     // -------------------------------
//     // 1️⃣ Save Payment Info
//     // -------------------------------
//     const paymentInfo = {
//       userEmail: session.metadata.userEmail,
//       amount: session.metadata.amount,
//       eventId: session.metadata.eventId,
//       eventTitle: session.metadata.eventTitle,
//       clubId: session.metadata.clubId,
//       transactionId: sessionId,
//       paymentIntent: session.payment_intent,
//       status: "paid",
//       paidAt: new Date(),
//     };

//     const paymentResult = await paymentCollection.insertOne(paymentInfo);
//     console.log("Payment Saved:", paymentResult.insertedId);

//     // -------------------------------
//     // 2️⃣ Save Event Registration
//     // -------------------------------
//     const registration = {
//       eventId: session.metadata.eventId,
//       userEmail: session.metadata.userEmail,
//       clubId: session.metadata.clubId,
//       status: "registered",
//       paymentId: session.payment_intent,
//       registeredAt: new Date(),
//     };

//     const registrationResult = await eventRegistrationsCollection.insertOne(registration);
//     console.log("Registration Saved:", registrationResult.insertedId);

//     // -------------------------------
//     // 3️⃣ Save Club Membership (NEW)
//     // -------------------------------

//     // avoid duplicate membership
//     const existingMembership = await clubMembershipCollection.findOne({
//       clubId: session.metadata.clubId,
//       userEmail: session.metadata.userEmail,
//     });

//     if (!existingMembership) {
//       const membership = {
//         userEmail: session.metadata.userEmail,
//         clubId: session.metadata.clubId,
//         joinedAt: new Date(),
//         transactionId: sessionId,
//         paymentId: session.payment_intent,
//         status: "active",
//       };

//       const membershipResult = await clubMembershipCollection.insertOne(membership);
//       console.log("Membership Saved:", membershipResult.insertedId);
//     } else {
//       console.log("User already has membership. Skipped inserting new membership.");
//     }

//     // -------------------------------
//     // Final Response
//     // -------------------------------
//     return res.send({
//       success: true,
//       message: "Payment & related data saved successfully",
//       paymentInfo,
//       registrationInfo: registrationResult,
//     });

//   } catch (error) {
//     console.error("Payment Success Error:", error);
//     res.status(500).send({
//       success: false,
//       message: "Payment success API error",
//       error: error.message,
//     });
//   }
// });











// Club Membership Payment Success API
app.patch('/club-membership-payment-success', async (req, res) => {
  try {
    const sessionId = req.query.session_id;

    if (!sessionId) {
      return res.status(400).send({ success: false, message: "Session ID is required" });
    }

    // Retrieve Stripe session
    const session = await stripe.checkout.sessions.retrieve(sessionId);
    console.log("Stripe Session:", session);

    if (session.payment_status === 'paid') {
      // Prepare payment info for payments collection
      const paymentInfo = {
        userEmail: session.metadata.userEmail,
        amount: session.metadata.cost,
        clubId: session.metadata.clubId,
        category: session.metadata.category,
        transactionId: sessionId,
        paymentType: session.metadata.paymentType, // club-membership
        status: "paid",
        paidAt: new Date(),
      };

      // Save payment info if not already exists
      let savedPayment = await paymentCollection.findOne({ transactionId: sessionId });
      if (!savedPayment) {
        savedPayment = await paymentCollection.insertOne(paymentInfo);
        console.log("Payment saved:", savedPayment);
      } else {
        console.log("Payment already exists:", savedPayment);
      }

      // Prepare club membership record
      const clubMembership = {
        userEmail: session.metadata.userEmail,
        clubId: session.metadata.clubId,
        clubName: session.metadata.clubName || "",
        category: session.metadata.category,
        managerEmail: session.metadata.managerEmail,
        bannerImage: session.metadata.bannerImage,
        location: session.metadata.location,
        description: session.metadata.description,
        paymentId: session.payment_intent,
        status: "active",
        joinedAt: new Date(),
      };

      // Check if membership already exists
      let savedMembership = await clubMembershipCollection.findOne({
        userEmail: session.metadata.userEmail,
        clubId: session.metadata.clubId,
      });

      if (!savedMembership) {
        savedMembership = await clubMembershipCollection.insertOne(clubMembership);
        console.log("Club membership saved:", savedMembership);
      } else {
        console.log("Club membership already exists:", savedMembership);
      }

      return res.send({
        success: true,
        message: "Club membership payment saved successfully",
        paymentInfo,
        clubMembershipInfo: savedMembership,
      });
    }

    res.status(400).send({ success: false, message: "Payment not completed" });

  } catch (error) {
    console.error("Club Membership Payment Success Error:", error);
    res.status(500).send({
      success: false,
      message: "Error in club membership payment success API",
      error: error.message,
    });
  }
});










// ============================================ Admin Dashboard Data ========================================

// app.get('/admin-overview', async (req, res) => {
//   try {

//     // 1. USERS
//     const totalUsers = await usersCollection.countDocuments();

//     // 2. CLUBS
//     const totalClubs = await clubsCollection.countDocuments();
//     const pendingClubs = await clubsCollection.countDocuments({ status: "pending" });
//     const approvedClubs = await clubsCollection.countDocuments({ status: "approved" });
//     const rejectedClubs = await clubsCollection.countDocuments({ status: "rejected" });

//     // 3. MEMBERSHIPS
//     const totalMemberships = await clubMembershipCollection.countDocuments();

//     // 4. EVENTS
//     const totalEvents = await eventsCollection.countDocuments();

//     // 5. EVENT REGISTRATIONS
//     const totalEventRegistrations = await eventRegistrationsCollection.countDocuments();

//     // 6. TOTAL PAYMENTS (AMOUNT SUM)
//     const paymentStats = await paymentCollection.aggregate([
//       { $group: { _id: null, totalAmount: { $sum: "$amount" }, count: { $sum: 1 } } }
//     ]).toArray();

//     const totalPaymentAmount = paymentStats[0]?.totalAmount || 0;
//     const totalPayments = paymentStats[0]?.count || 0;

//     // FINAL RESPONSE
//     res.send({
//       users: {
//         total: totalUsers
//       },
//       clubs: {
//         total: totalClubs,
//         pending: pendingClubs,
//         approved: approvedClubs,
//         rejected: rejectedClubs
//       },
//       memberships: {
//         total: totalMemberships
//       },
//       events: {
//         total: totalEvents
//       },
//       eventRegistrations: {
//         total: totalEventRegistrations
//       },
//       payments: {
//         totalPayments,
//         totalAmount: totalPaymentAmount
//       }
//     });

//   } catch (error) {
//     console.error("Admin Overview Error:", error);
//     res.status(500).send({ message: "Server Error" });
//   }
// });








app.get('/admin-overview', async (req, res) => {
  try {

    // 1. USERS
    const totalUsers = await usersCollection.countDocuments();

    // 2. CLUBS
    const totalClubs = await clubsCollection.countDocuments();
    const pendingClubs = await clubsCollection.countDocuments({ status: "pending" });
    const approvedClubs = await clubsCollection.countDocuments({ status: "approved" });
    const rejectedClubs = await clubsCollection.countDocuments({ status: "rejected" });

    // 3. MEMBERSHIPS
    const totalMemberships = await clubMembershipCollection.countDocuments();

    //  MEMBERSHIPS PER CLUB
    const clubs = await clubsCollection.find().toArray();
    const membershipsPerClub = await Promise.all(
      clubs.map(async (club) => {
        const count = await clubMembershipCollection.countDocuments({ clubId: club._id.toString() });
        return {
          clubName: club.name,
          memberships: count,
        };
      })
    );

    // 4. EVENTS
    const totalEvents = await eventsCollection.countDocuments();

    // 5. EVENT REGISTRATIONS
    const totalEventRegistrations = await eventRegistrationsCollection.countDocuments();

    // 6. TOTAL PAYMENTS (AMOUNT SUM)
    const paymentStats = await paymentCollection.aggregate([
      { $group: { _id: null, totalAmount: { $sum: "$amount" }, count: { $sum: 1 } } }
    ]).toArray();

    const totalPaymentAmount = paymentStats[0]?.totalAmount || 0;
    const totalPayments = paymentStats[0]?.count || 0;

    // FINAL RESPONSE
    res.send({
      users: {
        total: totalUsers
      },
      clubs: {
        total: totalClubs,
        pending: pendingClubs,
        approved: approvedClubs,
        rejected: rejectedClubs
      },
      memberships: {
        total: totalMemberships
      },
      membershipsPerClub, // add memberships per club here
      events: {
        total: totalEvents
      },
      eventRegistrations: {
        total: totalEventRegistrations
      },
      payments: {
        totalPayments,
        totalAmount: totalPaymentAmount
      }
    });

  } catch (error) {
    console.error("Admin Overview Error:", error);
    res.status(500).send({ message: "Server Error" });
  }
});


// User get api
app.get('/users', async (req, res) => {
      const cursor = usersCollection.find();
      const result = await cursor.toArray();
      res.send(result)
      // console.log(result);
    })
























































    // Send a ping to confirm a successful connection
    await client.db("admin").command({ ping: 1 });
    console.log("Pinged your deployment. You successfully connected to MongoDB!");
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);



























app.get('/', (req, res) => {
  res.send('Hello World!')
})

app.listen(port, () => {
  console.log(`Example app listening on port ${port}`)
})

